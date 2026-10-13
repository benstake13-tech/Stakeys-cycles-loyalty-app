// Unified Gemini proxy. Deploy: supabase functions deploy gemini-gateway
// Reads GEMINI_API_KEY only from Supabase secrets. No browser-exposed key.
// Public assistant/booking requests are allowed; rate limiting and abuse protection
// should be configured at the Supabase gateway before public rollout.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const key = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!key) return json({ error: 'GEMINI_API_KEY is not configured', code: 'NOT_CONFIGURED' }, 503);
  const size = Number(req.headers.get('content-length') || 0);
  if (size > 9_000_000) return json({ error: 'Request too large' }, 413);
  let body: { contents?: unknown; config?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  if (!Array.isArray(body.contents) || body.contents.length > 24) return json({ error: 'Invalid contents' }, 400);
  // Model is controlled by the server. Ignore client-supplied model names.
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-lite-latest';
  const config = body.config || {};
  const systemInstruction = typeof config.systemInstruction === 'string'
    ? { parts: [{ text: config.systemInstruction.slice(0, 20000) }] } : undefined;
  const generationConfig = {
    temperature: typeof config.temperature === 'number' ? Math.min(1, Math.max(0, config.temperature)) : 0.3,
    maxOutputTokens: typeof config.maxOutputTokens === 'number' ? Math.min(8192, Math.max(32, config.maxOutputTokens)) : 2048,
    ...(config.responseMimeType ? { responseMimeType: config.responseMimeType } : {}),
    ...(config.responseSchema ? { responseSchema: config.responseSchema } : {}),
  };
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: body.contents, systemInstruction, generationConfig }),
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error('Gemini gateway upstream status:', response.status);
      const code = response.status === 429 ? 'RATE_LIMITED' : [400, 401, 403].includes(response.status) ? 'UPSTREAM_REJECTED' : 'UPSTREAM_ERROR';
      const upstream = await response.json().catch(() => null);
      const keyRejected = [401, 403].includes(response.status) || upstream?.error?.details?.some((d: { reason?: string }) => d.reason === 'API_KEY_INVALID');
      return json({ error: 'Gemini request failed', code: keyRejected ? 'KEY_REJECTED' : code, status: response.status }, 502);
    }
    const data = await response.json();
    return json({ text: data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '', model });
  } catch (e) {
    console.error('Gemini gateway request failed:', e);
    return json({ error: 'Gemini temporarily unavailable' }, 502);
  }
});
