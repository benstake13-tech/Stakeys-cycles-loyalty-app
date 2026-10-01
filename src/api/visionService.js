import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function analyzeBikeImage(base64Image) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

  const prompt = `
    Analyze this bike image and identify technical specs, fault conditions, and hanger type.
    Return ONLY valid JSON matching this schema:
    {
      "identified_bike": {
        "make": "string",
        "model": "string",
        "type": "string",
        "frame_material": "string",
        "drivetrain_components": "string",
        "derailleur_hanger_type": "string"
      },
      "visually_broken_parts": ["string"],
      "common_model_faults": ["string"],
      "recommended_solutions": [
        {
          "issue": "string",
          "action": "string",
          "parts_needed": ["string"]
        }
      ]
    }
  `;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64Image.split(',')[1], mimeType: "image/jpeg" } }
  ]);

  return JSON.parse(result.response.text());
}
