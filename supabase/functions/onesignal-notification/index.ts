// Supabase Edge Function: onesignal-notification
// -----------------------------------------------------------------------------
// Webhook on `notifications` INSERT -> targeted OneSignal push to one user.
//
// The trigger `private.dispatch_onesignal_notification()` POSTs a
// { type, schema, table, record } envelope here with an
// `x-webhook-secret` header that must match the Vault secret
// `onesignal_notification_webhook_secret`.
//
// Required secrets:
//   ONESIGNAL_API_KEY    OneSignal App API key (os_v2_app_...)
// Optional:
//   ONESIGNAL_APP_ID     defaults to the app id baked into the client snippet.
//   ONESIGNAL_NOTIFICATION_WEBHOOK_SECRET
//                        shared secret the trigger must send.
//
// Deploy:  supabase functions deploy onesignal-notification --no-verify-jwt
// -----------------------------------------------------------------------------

const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';
const ONESIGNAL_ENDPOINT = 'https://api.onesignal.com/notifications';
const MAX_BODY_BYTES = 16_384;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret =
    Deno.env.get('ONESIGNAL_NOTIFICATION_WEBHOOK_SECRET') ?? Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
  const apiKey = Deno.env.get('ONESIGNAL_API_KEY');
  if (!webhookSecret || !apiKey) {
    console.error('Required push secrets are not configured');
    return json({ error: 'Push notification service is not configured' }, 503);
  }

  const suppliedSecret = req.headers.get('x-webhook-secret') ?? '';
  if (suppliedSecret !== webhookSecret) return json({ error: 'Unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Payload too large' }, 413);
    }
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    payload.type !== 'INSERT' ||
    payload.schema !== 'public' ||
    payload.table !== 'notifications' ||
    typeof payload.record !== 'object' ||
    payload.record === null
  ) {
    return json({ error: 'Unexpected webhook event' }, 400);
  }

  const record = payload.record as Record<string, unknown>;
  const userId = typeof record.user_id === 'string' ? record.user_id.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const notificationId = typeof record.id === 'string' ? record.id : '';
  if (!userId || !title || !message || !notificationId) {
    return json({ error: 'Notification is missing required fields' }, 400);
  }

  // Branding: shop logo as the notification icon.
  const logoUrl = Deno.env.get('BOOKING_LOGO_URL') ||
    'https://lhojocpygcnkxvkrcuxh.supabase.co/storage/v1/object/public/brand/stakeys-logo.png';

  const notification = {
    app_id: Deno.env.get('ONESIGNAL_APP_ID') || DEFAULT_APP_ID,
    include_aliases: { external_id: [userId] },
    target_channel: 'push',
    headings: { en: title },
    contents: { en: message },
    url: 'https://www.stakeyswheels.co.uk',
    chrome_web_icon: logoUrl,
  };

  let response: Response;
  try {
    response = await fetch(ONESIGNAL_ENDPOINT, {
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

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || (Array.isArray(result?.errors) && result.errors.length > 0)) {
    console.error('OneSignal rejected the request', { status: response.status, result });
    return json({ error: 'Push delivery failed', detail: result }, 502);
  }

  console.info('OneSignal push sent', { notificationId, userId });
  return json({ accepted: true, result }, 202);
});
