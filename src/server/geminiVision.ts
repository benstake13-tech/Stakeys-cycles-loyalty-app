import { GoogleGenAI } from '@google/genai';

/** Server-only Gemini configuration. Do not import this module into client UI. */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function scanBikeWithGemini(imageDataUrl: unknown) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    const error = new Error('GEMINI_API_KEY is not configured on the server.');
    Object.assign(error, { status: 503 });
    throw error;
  }
  if (typeof imageDataUrl !== 'string') {
    const error = new Error('Please attach a photo of a bike.');
    Object.assign(error, { status: 400 });
    throw error;
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
  if (!match || !IMAGE_TYPES.has(match[1])) {
    const error = new Error('Use a JPEG, PNG or WebP photo.');
    Object.assign(error, { status: 400 });
    throw error;
  }

  const [, mimeType, data] = match;
  if (Math.ceil(data.length * 0.75) > MAX_IMAGE_BYTES + 2) {
    const error = new Error('Photo must be 6 MB or smaller.');
    Object.assign(error, { status: 413 });
    throw error;
  }

  const client = new GoogleGenAI({ apiKey: key });
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        text: `You assist Stakey's Cycles mechanics and customers. Examine the supplied bicycle/scooter photo.
Return ONE JSON object with fields:
{
  "identified_bike": {
    "make": "string",
    "model": "string",
    "type": "cycle | ebike | electric_scooter | cargo",
    "frame_material": "string",
    "drivetrain_components": "string",
    "derailleur_hanger_type": "string"
  },
  "visually_broken_parts": ["string"],
  "common_model_faults": ["string"],
  "recommended_solutions": [
    { "issue": "string", "action": "string", "parts_needed": ["string"] }
  ]
}
When a fact cannot be confirmed from the photo, write "Unknown" or leave the relevant list empty.
Do not invent model numbers, damage, or part compatibility. An image is not a substitute for a physical safety inspection.`
      },
      { inlineData: { data, mimeType } }
    ],
    config: { responseMimeType: 'application/json', temperature: 0.2 }
  });

  const raw = response.text?.trim();
  if (!raw) throw new Error('Gemini returned an empty analysis.');
  let result: unknown;
  try {
    result = JSON.parse(raw.replace(/^\x60\x60\x60(?:json)?\s*/i, '').replace(/\s*\x60\x60\x60$/, ''));
  } catch {
    throw new Error('Gemini returned an unreadable analysis. Please retry.');
  }
  if (!result || typeof result !== 'object' || !('identified_bike' in result)) {
    throw new Error('Gemini did not recognise a bicycle. Try another photo.');
  }
  return result;
}
