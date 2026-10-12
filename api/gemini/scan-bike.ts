import { scanBikeWithGemini } from '../../src/server/geminiVision';

/** Vercel-compatible production route for statically built Vite deployments. */
export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin === 'https://localhost' || origin === 'capacitor://localhost') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST required' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const analysis = await scanBikeWithGemini(body?.image);
    return res.status(200).json(analysis);
  } catch (error: any) {
    console.error('[Gemini vision]', error);
    return res.status(error.status || 502).json({
      error: error.status ? error.message : 'Bike analysis is currently unavailable. Please try again.',
    });
  }
}
