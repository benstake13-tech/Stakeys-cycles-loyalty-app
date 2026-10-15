import { generateGemini } from './geminiGateway';

/**
 * Existing customer bike identifier, routed through the shared Supabase Gemini
 * gateway used by the rest of the app. No browser API key or separate service.
 */
export async function analyzeBikeImage(imageDataUrl) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('Choose a valid image file.');
  }
  const match = imageDataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('Choose a JPEG, PNG or WebP photo.');
  const prompt = `Identify the bicycle or scooter in the photo. Return ONLY valid JSON with keys make, model, type (cycle, ebike, electric_scooter, cargo), year, confidence (0-1), coverage (0-100), summary, mainSpecs (array of objects with componentName,currentPart,brand,model,condition,confidence,visibility), obviousProblems (array of issue,severity,location,recommendation), faults (array of component,faultTitle,description,severity), photoRequests (array of area,instruction,reason), and notVisible (array of strings). Be cautious, do not invent unseen details, use "Unknown / To Be Inspected" when identity is uncertain, and describe only visible component observations. This is a visual estimate, not a mechanical safety inspection.`;
  const response = await generateGemini({
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: match[1], data: match[2] } }, { text: prompt }] }],
    config: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 6000 },
  });
  let result;
  try { result = JSON.parse(response.text); } catch { throw new Error('The AI returned an incomplete bike assessment. Try a clearer photo.'); }
  if (typeof result?.make !== 'string' || typeof result?.model !== 'string') {
    throw new Error('Could not identify the bike. Please use a clearer photo.');
  }
  return {
    identified_bike: { make: result.make, model: result.model, type: result.type || 'cycle', year: result.year || '', confidence: Number(result.confidence) || 0 },
    ...result,
    hasVisualData: true,
    usedFallback: false,
  };
}
