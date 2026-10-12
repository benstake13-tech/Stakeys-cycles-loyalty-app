/** In-browser bridge to our server-owned Gemini 3.5 Flash-Lite service.
 * GEMINI_API_KEY is never bundled into client assets.
 */
export async function analyzeBikeImage(imageDataUrl) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new Error('Choose a valid image file.');
  }

  // Native APKs serve local bundled assets, not a backend API. Configure an
  // HTTPS host through the public VITE_APP_API_ORIGIN build variable.
  const apiOrigin = String(import.meta.env.VITE_APP_API_ORIGIN || '').trim().replace(/[/]+$/, '');
  if (import.meta.env.VITE_APP_EDITION && !apiOrigin) {
    throw new Error('The bike scanner needs the shop AI server address configured in the Android build.');
  }
  const response = await fetch(`${apiOrigin}/api/gemini/scan-bike`, {
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
