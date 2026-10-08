import { GoogleGenAI, Type } from "@google/genai";
import { resolveGeminiModel } from "./geminiModel";

const getApiKey = () =>
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

export const isBikeVisionConfigured = () => Boolean(getApiKey());

const BIKE_IDENTIFICATION_PROMPT = `You are Stakey's Cycles' master mechanic and bike identification engine.
Study the photo of the bicycle or scooter carefully and return a precise, structured assessment.

Rules:
- Identify the make and model as accurately as you can from frame decals, geometry and components. If unsure of an exact model, give the closest family and lower the confidence.
- "type" must be exactly one of: "cycle", "ebike", "electric_scooter", "cargo".
- Determine the bike's positioning: what kind of riding it is built for, whether the fit/setup suits the rider visible in the shot, and estimate the frame size and wheel size from proportions.
- Look specifically for an electric conversion kit or factory e-system: motor (brand, hub/mid-drive, approx watts), battery (brand, location, volts), controller and wiring. Flag if it looks like an aftermarket conversion rather than a factory e-bike.
- List the main specs you can actually see (drivetrain, brakes, fork/suspension, wheels/tyres, cockpit, electrical).
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
    confidence: { type: Type.NUMBER, description: "0 to 1 confidence in the identification" },
    summary: { type: Type.STRING, description: "One-line overview of the bike" },
    positioning: {
      type: Type.OBJECT,
      properties: {
        ridingStyle: { type: Type.STRING, description: "What the bike is built for" },
        riderFit: { type: Type.STRING, description: "Whether the setup suits the rider" },
        frameSizeEstimate: { type: Type.STRING, description: "e.g. 'Medium (~17in)'" },
        wheelSize: { type: Type.STRING, description: "e.g. '700c', '27.5in'" },
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
 * Sends a bike photo to Gemini and returns a structured identification:
 * make/model, positioning, e-kit detection, main specs and obvious problems.
 */
export async function identifyBikeFromImage(base64Image, mimeType = "image/jpeg") {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "AI vision is not configured. Add VITE_GEMINI_API_KEY to your environment to enable bike identification."
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const data = typeof base64Image === "string" ? base64Image.split(",").pop() : base64Image;

  const response = await ai.models.generateContent({
    model: resolveGeminiModel(),
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data, mimeType } },
          { text: BIKE_IDENTIFICATION_PROMPT },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: BIKE_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("The AI returned an empty response. Please try another photo.");
  return JSON.parse(text);
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
