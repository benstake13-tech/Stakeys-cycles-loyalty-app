import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { getGeminiSettings } from './supabase/functions/_shared/geminiSettings';
import { generateGuideGemini } from './public/guide/gemini-gateway.js';

describe('shared server Gemini secret settings', () => {
  it('selects the canonical rotated secret over a legacy alias', async () => {
    const env: Record<string, string> = { GEMINI_API_KEY: ' "rotated-server-key" ', GOOGLE_API_KEY: 'old-key', GEMINI_MODEL: 'server-model' };
    await expect(getGeminiSettings(name => env[name])).resolves.toEqual({ key: 'rotated-server-key', model: 'gemini-3.8-flash', tier: 'free' });
  });
  it('never uses a browser-prefixed key', async () => {
    const env: Record<string, string> = { VITE_GEMINI_API_KEY: 'browser-key' };
    expect((await getGeminiSettings(name => env[name])).key).toBe('');
  });
});

describe('standalone workshop guide AI routing', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());
  it('posts text and structured-output config only to Supabase', async () => {
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://project.supabase.co', anonKey: 'public-client-token' })));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ text: '{"suggestions":[]}', model: 'server-model' })));
    const contents = [{ role: 'user', parts: [{ text: 'Identify a Trek hanger' }] }];
    expect(await generateGuideGemini({ contents, config: { responseMimeType: 'application/json' } })).toEqual({ text: '{"suggestions":[]}', model: 'server-model' });
    const [url, options] = fetch.mock.calls[1];
    expect(url).toBe('https://project.supabase.co/functions/v1/gemini-gateway');
    expect(JSON.parse(String(options?.body))).toEqual({ contents, config: { responseMimeType: 'application/json' } });
    expect(options?.headers).not.toHaveProperty('x-goog-api-key');
  });
  it('does not ship any browser Google SDK/key path in the static guide', () => {
    for (const name of readdirSync('public/guide/assets').filter(name => name.endsWith('.js'))) {
      const source = readFileSync(`public/guide/assets/${name}`, 'utf8');
      expect(source).not.toMatch(/generativelanguage\.googleapis\.com|GoogleGenAI|__STAKEYS_GEMINI_KEY__|VITE_GEMINI_API_KEY/);
    }
  });
});
