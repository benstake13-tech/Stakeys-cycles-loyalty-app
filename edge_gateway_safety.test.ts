// @vitest-environment node
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

async function loadGateway(slug: string, env: Record<string, string>, fetch = vi.fn()) {
  const output = await build({ entryPoints: [`supabase/functions/${slug}/index.ts`], bundle: true, write: false, format: 'iife', platform: 'node', plugins: [{
    name: 'mock-server-auth', setup(builder) {
      builder.onResolve({ filter: /^https:\/\/esm\.sh\/@supabase\/supabase-js/ }, () => ({ path: 'server-auth', namespace: 'test-auth' }));
      builder.onLoad({ filter: /.*/, namespace: 'test-auth' }, () => ({ contents: 'export const createClient = () => globalThis.__testClient;', loader: 'js' }));
    },
  }] });
  let handler: (request: Request) => Promise<Response>;
  const log = vi.fn();
  const context = {
    Request, Response, AbortSignal, fetch, console: { error: vi.fn(), log },
    Deno: { env: { get: (name: string) => env[name] }, serve: (callback: typeof handler) => { handler = callback; } },
    __testClient: { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'staff-1' } } })) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'staff' } }) }) }) }) },
  };
  runInNewContext(output.outputFiles[0].text, context);
  return { handle: (body: object, auth = '') => handler(new Request('https://project.supabase.co', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) })), fetch, log };
}

describe('Gemini deployed handler safety', () => {
  it('reads a rotated server secret per request and ignores a client model override', async () => {
    const env = { GEMINI_API_KEY: 'server-key-old', GEMINI_MODEL: 'server-model' };
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] })));
    const gateway = await loadGateway('gemini-gateway', env, fetch);
    const body = { model: 'client-model', contents: [{ role: 'user', parts: [{ text: 'OK?' }] }], config: { tools: [{ googleSearch: {} }], serviceTier: 'priority' } };
    await gateway.handle(body);
    env.GEMINI_API_KEY = 'server-key-new';
    const reply = await (await gateway.handle(body)).json();
    expect(fetch.mock.calls[1][0]).toContain('/gemini-3.8-flash:generateContent');
    expect((fetch.mock.calls[1] as any)[1].headers['x-goog-api-key']).toBe('server-key-new');
    const upstreamBody = JSON.parse(String((fetch.mock.calls[1] as any)[1].body));
    expect(upstreamBody).not.toHaveProperty('tools');
    expect(upstreamBody).not.toHaveProperty('serviceTier');
    expect(JSON.stringify(reply)).not.toContain('server-key-new');
    expect(reply.text).toBe('OK');
  });
  it('does not reflect an upstream credential error body', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'server-key-secret', details: [{ reason: 'API_KEY_INVALID' }] } }), { status: 403 }));
    const gateway = await loadGateway('gemini-gateway', { GEMINI_API_KEY: 'server-key-secret' }, fetch);
    const response = await gateway.handle({ contents: [] });
    const body = await response.text();
    expect(body).toContain('KEY_REJECTED');
    expect(body).not.toContain('server-key-secret');
  });
});

describe('native push server action', () => {
  const appId = '7f67ab94-3c85-4702-9cd8-d158cf294593';
  const subscriptionId = '11111111-2222-4333-8444-555555555555';
  const body = { action: 'test-native', platform: 'android-native', appId, subscriptionId };
  const env = { ONESIGNAL_APP_API_KEY: 'private-push-key', ONESIGNAL_APP_ID: appId, SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-role-key' };
  it('rejects an unsigned test before any provider dispatch', async () => {
    const gateway = await loadGateway('onesignal-gateway', env);
    expect((await gateway.handle(body)).status).toBe(401);
    expect(gateway.fetch).not.toHaveBeenCalled();
  });
  it('requires a verified staff session and emits one Android-only target', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'message-1' })));
    const gateway = await loadGateway('onesignal-gateway', env, fetch);
    const response = await gateway.handle(body, 'staff-token');
    expect((await response.json()).accepted).toBe(true);
    const sent = JSON.parse((fetch.mock.calls[0] as any)[1].body);
    expect(sent.include_subscription_ids).toEqual([subscriptionId]);
    expect(sent.isAndroid).toBe(true);
    expect(sent.isAnyWeb).toBe(false);
    expect(sent).not.toHaveProperty('filters');
    expect(sent).not.toHaveProperty('included_segments');
    expect(JSON.stringify(gateway.log.mock.calls)).not.toContain('private-push-key');
  });
  it('rejects an owner tag without contacting OneSignal', async () => {
    const gateway = await loadGateway('onesignal-gateway', env);
    expect((await gateway.handle({ ...body, tag: { key: 'owner_email', value: 'owner@example.test' } }, 'staff-token')).status).toBe(400);
    expect(gateway.fetch).not.toHaveBeenCalled();
  });
  it('explains structured OneSignal errors on HTTP 200 without exposing secrets', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: '', errors: { invalid_subscription_ids: [subscriptionId], api_key: 'private-push-key' } })));
    const gateway = await loadGateway('onesignal-gateway', env, fetch);
    const response = await gateway.handle(body, 'staff-token');
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.accepted).toBe(false);
    expect(result.error).toContain('invalid_subscription_ids');
    expect(JSON.stringify(result)).not.toContain('private-push-key');
    expect(JSON.stringify(gateway.log.mock.calls)).not.toContain('private-push-key');
  });
});
