import { GoogleGenAI, Type } from "@google/genai";
import { resolveGeminiModel } from "./geminiModel";
import { classifyVisionError, VisionError } from "./visionErrors";

/**
 * Per-attempt ceiling. The SDK's own retry policy is overridden (see below) so
 * a busy model fails fast instead of hanging ~2 minutes, and a slow request is
 * aborted rather than left spinning.
 */
const VISION_TIMEOUT_MS = 20000;
const VISION_MAX_ATTEMPTS = 3; // original + 2 retries
const RETRY_BASE_DELAY_MS = 700;

const getApiKey = () =>
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

export const isBikeVisionConfigured = () => Boolean(getApiKey());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const BIKE_IDENTIFICATION_PROMPT = `You are Stakey's Cycles' master mechanic and bike identification engine.
Study the photo(s) of the bicycle or scooter carefully and return a precise, structured assessment.
You may receive more than one photo: a full side-on shot, a close-up of the brand/head badge, and a
close-up of the model name/decal. Use the close-ups to pin down make and model; use the full shot for
geometry, wheel/tyre size and overall condition.

Rules:
- Identify the make and model as accurately as you can from frame decals, geometry and components. If unsure of an exact model, give the closest family and lower the confidence.
- "type" must be exactly one of: "cycle", "ebike", "electric_scooter", "cargo".
- Determine the bike's positioning: what kind of riding it is built for, whether the fit/setup suits the rider visible in the shot, and estimate the frame size and wheel size from proportions.
- Read the wheels and tyres closely: report the wheel size (e.g. "700c", "27.5in", "26in", "20in"), the exact tyre size printed on the sidewall (imperial like "26x1.95" or ETRTO/ISO like "622-25"), and the valve type (Presta = thin threaded with a locknut; Schrader = car-type; Woods/Dunlop = older/utility). If not legible, leave the field empty — do not guess.
- Look for the frame serial number, usually stamped under the bottom bracket shell or on the rear dropout, and report it exactly if legible.
- List the main specs you can actually see (drivetrain and number of speeds, brake type and brand, fork/suspension and travel, wheels/tyres, cockpit, electrical).
- Look specifically for an electric conversion kit or factory e-system: motor (brand, hub/mid-drive, approx watts), battery (brand, location, volts), controller and wiring. Flag if it looks like an aftermarket conversion rather than a factory e-bike.
- List any obvious problems, wear or damage you can see (worn tyres, rusty chain, broken parts, flat tyres, misaligned wheels, damaged frame, etc.) with a severity.
- Never invent details you cannot see. If something is not visible, omit it or say so in notes.
- Keep every text field short and factual (no sentences longer than ~20 words).`;

const BIKE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    make: { type: Type.STRING, description: "Brand/make, e.g. Trek, Specialized, Giant" },
    model: { type: Type.STRING, description: "Model name/family, or 'Unknown'" },
    type: { type: Type.STRING, description: "One of: cycle, ebike, electric_scooter, cargo" },
    categoryLabel: { type: Type.STRING, description: "Human label, e.g. 'Hybrid Commuter'" },
    year: { type: Type.STRING, description: "Approx year or era, or empty" },
    colour: { type: Type.STRING },
    frameMaterial: { type: Type.STRING, description: "e.g. Aluminium, Carbon, Steel" },
    serialNumber: { type: Type.STRING, description: "Frame serial number exactly as stamped (usually under the bottom bracket or on the rear dropout), or empty if not legible" },
    confidence: { type: Type.NUMBER, description: "0 to 1 confidence in the identification" },
    summary: { type: Type.STRING, description: "One-line overview of the bike" },
    positioning: {
      type: Type.OBJECT,
      properties: {
        ridingStyle: { type: Type.STRING, description: "What the bike is built for" },
        riderFit: { type: Type.STRING, description: "Whether the setup suits the rider" },
        frameSizeEstimate: { type: Type.STRING, description: "e.g. 'Medium (~17in)'" },
        wheelSize: { type: Type.STRING, description: "e.g. '700c', '27.5in', '26in'" },
        tyreSize: { type: Type.STRING, description: "Tyre size exactly as printed, e.g. '700x25c', '26x1.95', or ETRTO '622-25'" },
        valveType: { type: Type.STRING, description: "One of: Presta, Schrader, Woods/Dunlop, Unknown" },
        cockpitSetup: { type: Type.STRING },
        saddleSetup: { type: Type.STRING },
      },
    },
    electricKit: {
      type: Type.OBJECT,
      properties: {
        isElectric: { type: Type.BOOLEAN },
        isAftermarketConversion: { type: Type.BOOLEAN, description: "True if a kit was added to a normal bike" },
        systemType: { type: Type.STRING, description: "e.g. 'Rear hub kit', 'Mid-drive', 'Factory e-system'" },
        motorBrand: { type: Type.STRING },
        motorPosition: { type: Type.STRING, description: "e.g. rear hub, front hub, mid-drive" },
        motorWatts: { type: Type.STRING },
        batteryBrand: { type: Type.STRING },
        batteryLocation: { type: Type.STRING, description: "e.g. downtube, rear rack, seat tube" },
        batteryVolts: { type: Type.STRING },
        controllerNotes: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        notes: { type: Type.STRING },
      },
    },
    mainSpecs: {
      type: Type.ARRAY,
      description: "Visible main components/specs",
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "One of: Drivetrain, Brakes, Suspension / Fork, Wheels & Tires, Cockpit & Controls, Electrical / Battery",
          },
          componentName: { type: Type.STRING },
          currentPart: { type: Type.STRING, description: "What is fitted, with any visible brand" },
          condition: { type: Type.STRING, description: "One of: excellent, good, worn, needs_attention" },
          notes: { type: Type.STRING },
        },
        required: ["category", "componentName", "currentPart"],
      },
    },
    obviousProblems: {
      type: Type.ARRAY,
      description: "Visible problems, wear or damage",
      items: {
        type: Type.OBJECT,
        properties: {
          issue: { type: Type.STRING },
          severity: { type: Type.STRING, description: "One of: low, medium, high" },
          location: { type: Type.STRING, description: "Where on the bike" },
          recommendation: { type: Type.STRING, description: "Suggested workshop action" },
        },
        required: ["issue", "severity"],
      },
    },
  },
  required: ["make", "model", "type", "confidence", "electricKit", "mainSpecs", "obviousProblems", "summary"],
};

/**
 * Normalises one supplied image into a Gemini inline-data part. Accepts either a
 * raw data URL / base64 string, or an object `{ data, mimeType }` so callers can
 * pass several photos (full shot + brand badge + model decal) in one call.
 */
function toImagePart(image, fallbackMime) {
  if (typeof image === "string") {
    return { inlineData: { data: image.split(",").pop(), mimeType: fallbackMime } };
  }
  return { inlineData: { data: image.data, mimeType: image.mimeType || fallbackMime } };
}

/**
 * Sends one or more bike photos to Gemini and returns a structured
 * identification: make/model, positioning, e-kit detection, main specs and
 * obvious problems.
 *
 * `images` may be a single data URL / base64 string (legacy) or an array of
 * strings / `{ data, mimeType }` objects. Passing a brand close-up and a model
 * close-up alongside the full side-on shot markedly improves make/model accuracy
 * for the same single request (so it does not cost extra quota).
 *
 * The SDK's default retry policy (5 attempts, up to 60s apart) is what made a
 * busy model hang for ~2 minutes. We disable it and run our own bounded loop:
 * each attempt has a hard 20s ceiling (AbortController), transient capacity
 * errors (503/500/429) back off and retry up to twice, and any failure is
 * rethrown as a `VisionError` the UI can show as a clean banner.
 */
export async function identifyBikeFromImage(images, mimeType = "image/jpeg") {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new VisionError(classifyVisionError(new Error("AI vision is not configured."), { configured: false }));
  }

  const ai = new GoogleGenAI({ apiKey });
  const imageParts = (Array.isArray(images) ? images : [images])
    .filter(Boolean)
    .map((image) => toImagePart(image, mimeType));
  if (!imageParts.length) {
    throw new VisionError(classifyVisionError(new Error("No image supplied."), { configured: true }));
  }

  let lastError;
  for (let attempt = 1; attempt <= VISION_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, VISION_TIMEOUT_MS);

    try {
      const response = await ai.models.generateContent({
        model: resolveGeminiModel(),
        contents: [
          {
            role: "user",
            parts: [...imageParts, { text: BIKE_IDENTIFICATION_PROMPT }],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: BIKE_RESPONSE_SCHEMA,
          temperature: 0.2,
          abortSignal: controller.signal,
          // Own the retry/backoff loop instead of the SDK's long default.
          httpOptions: { timeout: VISION_TIMEOUT_MS, retryOptions: { attempts: 1 } },
        },
      });

      const text = response.text;
      if (!text) throw new Error("The AI returned an empty response. Please try another photo.");
      return JSON.parse(text);
    } catch (err) {
      const info = classifyVisionError(err, { configured: true, timedOut });
      lastError = info;
      const canRetry = info.retryable && info.transient && attempt < VISION_MAX_ATTEMPTS;
      if (!canRetry) break;
      // Exponential backoff with a little jitter, so retries don't synchronise.
      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new VisionError(lastError || classifyVisionError(new Error("unknown")));
}

/**
 * Legacy helper retained for compatibility. Prefer identifyBikeFromImage.
 */
export async function analyzeBikeImage(base64Image) {
  const result = await identifyBikeFromImage(base64Image);
  return {
    identified_bike: {
      make: result.make,
      model: result.model,
      type: result.type,
      frame_material: result.frameMaterial || "",
      drivetrain_components:
        (result.mainSpecs || []).find((s) => s.category === "Drivetrain")?.currentPart || "",
      derailleur_hanger_type: "",
    },
    visually_broken_parts: (result.obviousProblems || []).map((p) => p.issue),
    common_model_faults: [],
    recommended_solutions: (result.obviousProblems || []).map((p) => ({
      issue: p.issue,
      action: p.recommendation || "Inspect in workshop",
      parts_needed: [],
    })),
  };
}
