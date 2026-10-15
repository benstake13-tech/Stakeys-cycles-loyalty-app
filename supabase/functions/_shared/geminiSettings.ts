export const GEMINI_MODEL_CATALOG = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash · latest', free: true },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash · stable', free: true },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · lower cost', free: true },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite · lower cost', free: true },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon · paid only', free: false },
] as const;

export type GeminiTier = 'free' | 'paid';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function normalizeGeminiSelection(value: unknown): { model: string; tier: GeminiTier } {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const tier: GeminiTier = input.tier === 'paid' ? 'paid' : 'free';
  const selected = GEMINI_MODEL_CATALOG.find(model => model.id === input.model);
  const model = selected && (tier === 'paid' || selected.free) ? selected.id : DEFAULT_GEMINI_MODEL;
  return { model, tier };
}

/** Both AI functions select the same server-held credential and shared runtime model. */
export async function getGeminiSettings(
  getEnv: (name: string) => string | undefined,
  fetchImpl: typeof fetch = fetch,
) {
  const clean = (value: string | undefined) => (value || '').trim().replace(/^['"]|['"]$/g, '');
  const primary = clean(getEnv('GEMINI_API_KEY'));
  let selection = normalizeGeminiSelection({});
  const url = clean(getEnv('SUPABASE_URL'));
  const anon = clean(getEnv('SUPABASE_ANON_KEY'));
  if (url && anon) {
    try {
      const response = await fetchImpl(`${url.replace(/\/$/, '')}/rest/v1/gemini_runtime_settings?id=eq.true&select=model,tier`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        signal: AbortSignal.timeout(4000),
      });
      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows[0]) selection = normalizeGeminiSelection(rows[0]);
      }
    } catch { /* use the safe server default while config storage is unavailable */ }
  }
  return {
    key: primary || clean(getEnv('GOOGLE_API_KEY')),
    ...selection,
  };
}
