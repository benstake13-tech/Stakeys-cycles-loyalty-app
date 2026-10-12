/** In-browser bridge to our server-owned Gemini 3.5 Flash-Lite service.
 * GEMINI_API_KEY is never bundled into client assets.
 */
export async function analyzeBikeImage(imageDataUrl) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('Choose a valid image file.');
  }

  const response = await fetch('/api/gemini/scan-bike', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'The AI scanner is unavailable. Please try again.');
  }
  if (!payload?.identified_bike) {
    throw new Error('Could not identify the bike. Please use a clearer photo.');
  }
  return payload;
}
