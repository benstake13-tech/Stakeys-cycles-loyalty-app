import { describe, expect, it, vi } from 'vitest';
import { getGeminiSettings, normalizeGeminiSelection } from './supabase/functions/_shared/geminiSettings';

describe('shared Gemini model and tier settings', () => {
  it('defaults safely to the latest stable Flash model and free tier', () => {
    expect(normalizeGeminiSelection(null)).toEqual({ model: 'gemini-3.8-flash', tier: 'free' });
  });

  it('rejects unknown and paid-only model choices in free mode', () => {
    expect(normalizeGeminiSelection({ model: 'made-up-model', tier: 'free' })).toEqual({ model: 'gemini-3.8-flash', tier: 'free' });
    expect(normalizeGeminiSelection({ model: 'gemini-4-argon', tier: 'free' })).toEqual({ model: 'gemini-3.8-flash', tier: 'free' });
  });

  it('reads model and tier from the shared non-secret settings row', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ model: 'gemini-3.5-flash-lite', tier: 'paid' }])));
    const config = await getGeminiSettings(name => ({
      GEMINI_API_KEY: 'server-only-key', SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_ANON_KEY: 'public-anon-key',
    } as Record<string, string>)[name], fetchImpl as typeof fetch);

    expect(config).toEqual({ key: 'server-only-key', model: 'gemini-3.5-flash-lite', tier: 'paid' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/gemini_runtime_settings?id=eq.true&select=model,tier',
      expect.objectContaining({ headers: { apikey: 'public-anon-key', Authorization: 'Bearer public-anon-key' } }),
    );
  });

  it('falls back to the safe default when settings cannot be read', async () => {
    const config = await getGeminiSettings(name => ({ GEMINI_API_KEY: 'server-key', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' } as Record<string, string>)[name], vi.fn().mockRejectedValue(new Error('offline')) as typeof fetch);
    expect(config.model).toBe('gemini-3.8-flash');
    expect(config.tier).toBe('free');
  });
});
