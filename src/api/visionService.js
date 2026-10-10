import { GoogleGenAI, Type } from "@google/genai";
import { resolveGeminiModel } from "./geminiModel";
import { classifyVisionError, VisionError } from "./visionErrors";
import { SPEC_SYSTEMS } from "../utils/bikeSpecTaxonomy";

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

/** The taxonomy rendered as a part-by-part checklist for the prompt. */
export const taxonomyChecklist = SPEC_SYSTEMS.map(
  (system) => `- ${system.label}: ${system.components.map((c) => c.name).join(", ")}`
).join("\n");

const BIKE_IDENTIFICATION_PROMPT = `You are Stakey's Cycles' master mechanic and bike identification engine.
Study the photo(s) of the bicycle or scooter carefully and return a precise, structured assessment.
You may receive more than one photo: a full side-on shot, a close-up of the brand/head badge, and a
close-up of the model name/decal. Use the close-ups to pin down make and model; use the full shot for
geometry, wheel/tyre size and overall condition.

EXHAUSTIVE PART SWEEP (most important):
Work through the checklist below top to bottom and emit ONE entry in "mainSpecs" for EVERY component,
whether or not it is clearly visible. Set "visibility" honestly:
- "visible"  = you can clearly see it,
- "partial"  = you can partly see it / infer it from a related part,
- "assumed"  = not visible but implied by the bike type (e.g. inner tubes on a ridden bike).
Never invent a specific measurement you cannot see: leave "specValue"/brand/model empty and lower
"confidence" instead. This is a completeness exercise, not a summary — do not stop after a few items.

Checklist:
${taxonomyChecklist}

For each entry provide: "systemId" (use the exact system id you are working within), "componentId"
(use the exact component id from the checklist), "componentName", "category" (keep the broad legacy
bucket: Drivetrain, Brakes, Suspension / Fork, Wheels & Tires, Cockpit & Controls, or
Electrical / Battery), "currentPart" (what is fitted, with any visible brand), "specValue" (the
measured dimension/size/spec, e.g. "700x32c", "11-34T", "160mm rotor", "622-25"), "brand", "model",
"condition" (excellent | good | worn | needs_attention), "visibility"
(visible | partial | assumed), "confidence" (0 to 1) and "notes".

Also return:
- "notVisible": an array of the component names you could NOT assess from these photos and that the
  mechanic must confirm at intake.
- "coverage": a 0-1 estimate of how much of the bike's components you were able to assess.

Other required fields:
- "type" must be exactly one of: "cycle", "ebike", "electric_scooter", "cargo".
- Determine the bike's positioning: what kind of riding it is built for, whether the fit/setup suits the rider visible in the shot, and estimate the frame size and wheel size from proportions.
- Read the wheels and tyres closely: report the wheel size (e.g. "700c", "27.5in", "26in", "20in"), the exact tyre size printed on the sidewall (imperial like "26x1.95" or ETRTO/ISO like "622-25"), and the valve type (Presta = thin threaded with a locknut; Schrader = car-type; Woods/Dunlop = older/utility). If not legible, leave the field empty — do not guess.
- Look for the frame serial number, usually stamped under the bottom bracket shell or on the rear dropout, and report it exactly if legible.
- Look specifically for an electric conversion kit or factory e-system: motor (brand, hub/mid-drive, approx watts), battery (brand, location, volts), controller and wiring. Flag if it looks like an aftermarket conversion rather than a factory e-bike.
- List any obvious problems, wear or damage you can see (worn tyres, rusty chain, broken parts, flat tyres, misaligned wheels, damaged frame, etc.) with a severity.
- Never invent details you cannot see. If something is not visible, mark it "assumed"/"partial" and add it to "notVisible".
- Keep every text field short and factual (no sentences longer than ~20 words).

DIAGNOSTIC INTAKE (multilingual + graceful fallback):
- Detect the language of any customer notes supplied with the photos and report it as
  "inputLanguageDetected" (ISO code or name, e.g. "es", "en", "pl"). Translate the notes to English
  into "userNotesTranslated", keeping every technical detail (noises, component behaviour, history).
  If no notes were supplied, set it to "No user notes provided".
- Set "hasVisualData" true only when at least one usable photo was supplied and analysed.
- Rate the bike's overall condition as "overallCondition": one of Excellent | Good | Fair | Poor | Critical.
- Provide "faults": the list of faults a mechanic should act on, each with "component",
  "faultTitle", "description", "severity" (Low | Medium | High | Critical safety risk) and "source"
  (Visual Inspection | User Note | Combined). Include faults reported in the customer notes even when
  not visible in the photos, marking their source "User Note".
- Provide "wheelSizeAndSpecs": the wheel + tyre spec as one string (e.g. "700x32c", "27.5 x 2.10",
  "10x2.5 pneumatic"). If it cannot be read, use "Standard / Requires Workshop Measurement".
- FALLBACK: if a photo is missing, unclear, or a detail cannot be determined, set "make" (brand) to
  "Unknown / To Be Inspected" (or take it from the notes), "model" likewise, and rely on the notes.
  If neither photos nor notes give anything usable, return a single fault titled
  "General Workshop Assessment Needed" rather than empty data.`;

const BIKE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    make: { type: Type.STRING, description: "Brand/make, e.g. Trek, Specialized, Giant. Use 'Unknown / To Be Inspected' when it cannot be determined." },
    model: { type: Type.STRING, description: "Model name/family, or 'Unknown / To Be Inspected' when it cannot be determined" },
    type: { type: Type.STRING, description: "One of: cycle, ebike, electric_scooter, cargo" },
    categoryLabel: { type: Type.STRING, description: "Human label, e.g. 'Hybrid Commuter'" },
    year: { type: Type.STRING, description: "Approx year or era, or empty" },
    colour: { type: Type.STRING },
    frameMaterial: { type: Type.STRING, description: "e.g. Aluminium, Carbon, Steel" },
    serialNumber: { type: Type.STRING, description: "Frame serial number exactly as stamped (usually under the bottom bracket or on the rear dropout), or empty if not legible" },
    inputLanguageDetected: { type: Type.STRING, description: "ISO code or name of the customer notes language, e.g. 'es', 'en', 'pl'" },
    userNotesTranslated: { type: Type.STRING, description: "English translation of the customer notes, or 'No user notes provided'" },
    hasVisualData: { type: Type.BOOLEAN, description: "True only when at least one usable photo was analysed" },
    overallCondition: { type: Type.STRING, description: "One of: Excellent, Good, Fair, Poor, Critical" },
    wheelSizeAndSpecs: { type: Type.STRING, description: "Wheel + tyre spec as one string, e.g. '700x32c', '27.5 x 2.10', '10x2.5 pneumatic'; else 'Standard / Requires Workshop Measurement'" },
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
      description: "One entry per component in the taxonomy checklist (walk the whole bike)",
      items: {
        type: Type.OBJECT,
        properties: {
          systemId: {
            type: Type.STRING,
            description: "System id from the taxonomy, e.g. frame, wheels, brakes, drivetrain, cockpit, seating, suspension, electric, accessories, safety",
          },
          componentId: { type: Type.STRING, description: "Exact component id from the taxonomy checklist" },
          category: {
            type: Type.STRING,
            description: "One of: Drivetrain, Brakes, Suspension / Fork, Wheels & Tires, Cockpit & Controls, Electrical / Battery",
          },
          componentName: { type: Type.STRING },
          currentPart: { type: Type.STRING, description: "What is fitted, with any visible brand" },
          specValue: { type: Type.STRING, description: "Measured dimension/size/spec, e.g. '700x32c', '11-34T', '160mm rotor'" },
          brand: { type: Type.STRING },
          model: { type: Type.STRING },
          condition: { type: Type.STRING, description: "One of: excellent, good, worn, needs_attention" },
          visibility: { type: Type.STRING, description: "One of: visible, partial, assumed, not_visible" },
          confidence: { type: Type.NUMBER, description: "0 to 1 confidence in this component" },
          notes: { type: Type.STRING },
        },
        required: ["systemId", "componentId", "category", "componentName", "currentPart", "visibility"],
      },
    },
    notVisible: {
      type: Type.ARRAY,
      description: "Component names that could not be assessed from the photos and must be confirmed at intake",
      items: { type: Type.STRING },
    },
    coverage: {
      type: Type.NUMBER,
      description: "0 to 1 estimate of how much of the bike's components were assessed",
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
    faults: {
      type: Type.ARRAY,
      description: "Actionable faults, from the photos and/or the customer notes",
      items: {
        type: Type.OBJECT,
        properties: {
          component: { type: Type.STRING, description: "e.g. Rear Hydraulic Brake, Drive Chain, Hub Motor" },
          faultTitle: { type: Type.STRING, description: "Short summary of the issue" },
          description: { type: Type.STRING, description: "Detailed explanation of the observed or reported issue" },
          severity: { type: Type.STRING, description: "One of: Low, Medium, High, Critical safety risk" },
          source: { type: Type.STRING, description: "One of: Visual Inspection, User Note, Combined" },
        },
        required: ["component", "faultTitle", "description", "severity", "source"],
      },
    },
  },
  required: ["make", "model", "type", "confidence", "electricKit", "mainSpecs", "obviousProblems", "summary", "faults", "overallCondition", "wheelSizeAndSpecs", "hasVisualData", "inputLanguageDetected", "userNotesTranslated"],
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
export async function identifyBikeFromImage(images, mimeType = "image/jpeg", userNotes = "") {
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

  const notes = typeof userNotes === "string" ? userNotes.trim() : "";
  const promptText = notes
    ? `${BIKE_IDENTIFICATION_PROMPT}\n\nCUSTOMER NOTES (may be in any language — detect it, translate to English, and use it):\n${notes}`
    : BIKE_IDENTIFICATION_PROMPT;

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
            parts: [...imageParts, { text: promptText }],
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

/**
 * Local fallback diagnostic used when Gemini is unreachable, rate-limited,
 * offline or returns nothing usable. It builds a valid diagnostic purely from
 * the customer's text so the booking / garage flow never blocks or hangs.
 * Shape matches the structured diagnostic contract in the prompt above.
 */
export function getFallbackDiagnostic(userNotes = "") {
  const hasText = typeof userNotes === "string" && userNotes.trim().length > 0;
  const notes = hasText ? userNotes.trim() : "";
  return {
    inputLanguageDetected: "en",
    userNotesTranslated: hasText ? notes : "No user notes provided",
    hasVisualData: false,
    brand: "Unknown / To Be Inspected",
    make: "Unknown / To Be Inspected",
    model: "Unknown / To Be Inspected",
    wheelSizeAndSpecs: "Standard / Requires Workshop Measurement",
    overallCondition: "Fair",
    faults: [
      {
        component: "General Intake",
        faultTitle: hasText ? "Customer Reported Issue" : "General Workshop Assessment Needed",
        description: hasText
          ? `Reported: "${notes}". Visual diagnostic offline — staff will inspect upon arrival.`
          : "Full manual inspection required upon workshop drop-off.",
        severity: "Medium",
        source: hasText ? "User Note" : "Visual Inspection",
      },
    ],
    // Keep the richer identification fields present (empty) so any consumer that
    // reads them — the garage save path, the UI — never sees undefined.
    type: "cycle",
    confidence: 0,
    summary: hasText ? "Reported issue — awaiting workshop inspection" : "Awaiting workshop inspection",
    positioning: {},
    electricKit: { isElectric: false },
    mainSpecs: [],
    notVisible: [],
    coverage: 0,
    obviousProblems: hasText
      ? [{ issue: "Customer Reported Issue", severity: "medium", location: "Per customer notes" }]
      : [],
  };
}

/**
 * Diagnostic entry point for the intake flow. Sends 1-4 photos plus optional
 * free-text notes (any language) to Gemini, and — crucially — never throws for
 * an unavailable service: if the service is unconfigured, no photo was supplied,
 * or the call fails after its bounded retries, it returns the local
 * `getFallbackDiagnostic` payload instead so the UI keeps working.
 *
 * Returns `{ ...diagnostic, usedFallback, fallbackReason }`.
 */
export async function diagnoseFault({ images = [], userNotes = "" } = {}) {
  const hasImages = (Array.isArray(images) ? images : [images]).filter(Boolean).length > 0;
  if (!hasImages || !isBikeVisionConfigured()) {
    return {
      ...getFallbackDiagnostic(userNotes),
      usedFallback: true,
      fallbackReason: hasImages ? "not-configured" : "no-images",
    };
  }
  try {
    const diagnostic = await identifyBikeFromImage(images, "image/jpeg", userNotes);
    return { ...diagnostic, usedFallback: false, fallbackReason: null };
  } catch (err) {
    const info = classifyVisionError(err);
    return { ...getFallbackDiagnostic(userNotes), usedFallback: true, fallbackReason: info.kind || "error" };
  }
}

