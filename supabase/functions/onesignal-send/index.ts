// Supabase Edge Function: onesignal-send
// -----------------------------------------------------------------------------
// Server-to-server OneSignal send, so booking alerts reach a phone even when
// the app is closed. This replaces the Express route `/api/onesignal/notify`
// in server.ts, which never runs in production (the site is a pure SPA, so all
// `/api/*` requests are rewritten to index.html).
//
// The browser calls it as `sendPushToUser` with the anon key; the OneSignal App
// API key stays server-side as a secret.
//
// Required secret (Supabase Dashboard -> Edge Functions -> Secrets, or CLI):
//   ONESIGNAL_API_KEY    App API key, starts with `os_v2_app_...`
// Optional:
//   ONESIGNAL_APP_ID     defaults to the app id baked into the client snippet.
//   ONESIGNAL_WEBHOOK_SECRET
//                        when set, POSTs must send a matching
//                        `x-webhook-secret` header. Leave unset to allow the
//                        browser to call it directly.
//
// GET returns { appId, serverPush } so the client can detect it is configured.
//
// Deploy:  supabase functions deploy onesignal-send
// -----------------------------------------------------------------------------

const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';
const ONESIGNAL_ENDPOINT = 'https://api.onesignal.com/notifications';
const ONESIGNAL_APP_ENDPOINT = 'https://api.onesignal.com/apps';
const MAX_BODY_BYTES = 16_384;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads the app's public web configuration so the client can compare the origin
 * the site is served from against the origin OneSignal is locked to. A mismatch
 * (e.g. app set to the apex, site served from `www`) makes the SDK refuse to
 * initialise, so no device ever subscribes. Only non-secret fields are returned.
 */
async function readWebConfig(apiKey: string): Promise<Record<string, unknown> | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${ONESIGNAL_APP_ENDPOINT}/${appId()}`, {
      headers: { Authorization: `Key ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, any>;
    const restrict = data?.restrict_origin;
    return {
      chromeWebOrigin: data?.chrome_web_origin ?? null,
      safariSiteOrigin: data?.safari_site_origin ?? null,
      siteOrigin: data?.siteInfo?.origin ?? null,
      restrictOrigin: Boolean(restrict && (restrict.enable ?? restrict)),
    };
  } catch {
    return null;
  }
}

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
  return Deno.env.get('ONESIGNAL_APP_ID') || DEFAULT_APP_ID;
}

/** Admin profile ids, from the env override or the profiles table. */
async function resolveAdminRecipients(): Promise<string[]> {
  const override = (Deno.env.get('ADMIN_PROFILE_IDS') || '').trim();
  if (override) return override.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));

  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&role=eq.admin`, {
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

  const apiKey = Deno.env.get('ONESIGNAL_API_KEY');

  // Config probe: lets the client tell whether closed-app push is available,
  // and whether the OneSignal app's origin matches where the site is served.
  if (req.method === 'GET') {
    const webConfig = apiKey ? await readWebConfig(apiKey) : null;
    return json({ appId: appId(), serverPush: Boolean(apiKey), webConfig });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Optional shared-secret gate. Off by default so the browser can call it.
  const requiredSecret = Deno.env.get('ONESIGNAL_WEBHOOK_SECRET');
  if (requiredSecret && req.headers.get('x-webhook-secret') !== requiredSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (!apiKey) {
    return json({ error: 'ONESIGNAL_API_KEY is not configured for the onesignal-send function' }, 500);
  }

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }

  let payload: {
    title?: string;
    body?: string;
    url?: string;
    externalId?: string;
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

  // OneSignal targeting: an external_id alias, an explicit segment, or (when a
  // booking was created by a customer) the admin/staff profile ids resolved
  // server-side.
  const notification: Record<string, unknown> = {
    app_id: appId(),
    headings: { en: title },
    contents: { en: message },
    url: payload.url?.trim() || 'https://www.stakeyswheels.co.uk',
  };

  if (payload.externalId) {
    notification.include_aliases = { external_id: [payload.externalId] };
    notification.target_channel = 'push';
  } else if (payload.segment) {
    notification.included_segments = [payload.segment];
  } else {
    const audience = (payload.audience || 'admin').toLowerCase();
    if (audience === 'all') {
      notification.included_segments = ['Subscribed Users'];
    } else {
      const recipients = await resolveAdminRecipients();
      if (recipients.length === 0) {
        return json({ error: 'No admin recipients to target' }, 422);
      }
      notification.include_aliases = { external_id: recipients };
      notification.target_channel = 'push';
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(ONESIGNAL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });
  } catch (error) {
    console.error('OneSignal request failed', error);
    return json({ error: 'Could not reach the push provider' }, 502);
  }

  const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  // OneSignal's v2 API returns HTTP 200 with a populated `errors` field on
  // failure (e.g. `["All included players are not subscribed"]`) and an empty
  // `id`. A real success always carries a notification id, so require both.
  if (!upstream.ok || !data?.id) {
    console.error('OneSignal rejected the request', upstream.status, data);
    return json({ error: 'Push provider rejected the request', detail: data }, 502);
  }

  // A notification id can still come back while OneSignal reports every requested
  // external id as invalid — that means no device is subscribed for those users,
  // so the send reached nobody. Surface it instead of reporting a false success.
  const requestedAliases = (notification.include_aliases as { external_id?: string[] } | undefined)?.external_id;
  const invalidAliases = (data.errors as { invalid_aliases?: { external_id?: string[] } } | undefined)
    ?.invalid_aliases?.external_id;
  if (
    requestedAliases?.length &&
    invalidAliases?.length &&
    requestedAliases.every((id) => invalidAliases.includes(id))
  ) {
    console.error('OneSignal had no valid recipients for the target aliases', invalidAliases);
    return json(
      { error: 'No device is subscribed for the target user(s)', detail: data, invalidAliases },
      502
    );
  }

  return json(data, 200);
});
