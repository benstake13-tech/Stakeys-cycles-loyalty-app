// Supabase Edge Function: pushengage-send
// -----------------------------------------------------------------------------
// Server-to-server PushEngage send, so booking alerts reach a phone even when
// the app is closed. This replaces the Express route `/api/pushengage/notify`
// in server.ts, which never runs in production (the site is a pure SPA, so all
// `/api/*` requests are rewritten to index.html).
//
// The browser calls it as `sendPushToUser` with the anon key; the REST API key
// stays server-side as a secret.
//
// Required secret (Supabase Dashboard -> Edge Functions -> Secrets, or CLI):
//   PUSHENGAGE_API_KEY   e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
// Optional:
//   PUSHENGAGE_APP_ID    defaults to the app id baked into the client snippet.
//   PUSHENGAGE_WEBHOOK_SECRET
//                        when set, POSTs must send a matching
//                        `x-webhook-secret` header. Leave unset to allow the
//                        browser to call it directly.
//
// GET returns { appId, serverPush } so the client can detect it is configured.
//
// Deploy:  supabase functions deploy pushengage-send
// -----------------------------------------------------------------------------

const DEFAULT_APP_ID = '23a65358-7d1f-4b0b-beff-de8b48f9689f';
const PUSHENGAGE_ENDPOINT = 'https://api.pushengage.com/apiv1/notifications';
const MAX_BODY_BYTES = 16_384;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function appId(): string {
  return Deno.env.get('PUSHENGAGE_APP_ID') || DEFAULT_APP_ID;
}

/** Admin/staff profile ids, from the env override or the profiles table. */
async function resolveAdminRecipients(): Promise<string[]> {
  const override = (Deno.env.get('ADMIN_PROFILE_IDS') || '').trim();
  if (override) return override.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));

  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&role=in.(admin,staff)`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id?: string }>;
    return rows.map((r) => (typeof r.id === 'string' ? r.id.trim() : '')).filter((id) => UUID_RE.test(id));
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');

  // Config probe: lets the client tell whether closed-app push is available.
  if (req.method === 'GET') {
    return json({ appId: appId(), serverPush: Boolean(apiKey) });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Optional shared-secret gate. Off by default so the browser can call it.
  const requiredSecret = Deno.env.get('PUSHENGAGE_WEBHOOK_SECRET');
  if (requiredSecret && req.headers.get('x-webhook-secret') !== requiredSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!apiKey) {
    return json({ error: 'PUSHENGAGE_API_KEY is not configured for the pushengage-send function' }, 500);
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }

  let payload: {
    title?: string;
    body?: string;
    url?: string;
    profileId?: string;
    segment?: string;
    audience?: string;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const title = payload.title?.trim();
  const message = payload.body?.trim();
  if (!title || !message) {
    return json({ error: '`title` and `body` are required' }, 400);
  }

  const form = new URLSearchParams();
  form.set('notification_title', title);
  form.set('notification_message', message);
  form.set('notification_url', payload.url?.trim() || 'https://stakeyswheels.co.uk');
  form.set('notification_type', 'now');

  if (payload.profileId) {
    form.append('profile_id[]', payload.profileId);
  } else if (payload.segment) {
    // Legacy path: an explicit PushEngage segment name (must already exist).
    form.append('include_segments[]', payload.segment);
  } else {
    // No target given (e.g. a booking created by a customer). Resolve the
    // admin/staff profile ids server-side — segments are not usable on this plan.
    const audience = (payload.audience || 'admin').toLowerCase();
    const recipients = audience === 'all' ? [] : await resolveAdminRecipients();
    for (const id of recipients) form.append('profile_id[]', id);
  }

  let upstream: Response;
  try {
    upstream = await fetch(PUSHENGAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
  } catch (error) {
    console.error('PushEngage request failed', error);
    return json({ error: 'Could not reach the push provider' }, 502);
  }

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  // PushEngage returns HTTP 200 even for failures (e.g. "Invalid API Key",
  // "Segment not found"), so check the body's `success` flag too.
  if (!upstream.ok || data?.success === false) {
    console.error('PushEngage rejected the request', upstream.status, data);
    return json({ error: 'Push provider rejected the request', detail: data }, 502);
  }
  return json(data, 200);
});
