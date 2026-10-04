// Supabase Edge Function: pushengage-notification
// -----------------------------------------------------------------------------
// Webhook on `notifications` INSERT -> targeted PushEngage push to one user.
// PushEngage replacement for the old `onesignal-notification` function.
//
// The trigger `private.dispatch_pushengage_notification()` POSTs a
// { type, schema, table, record } envelope here with an
// `x-webhook-secret` header that must match the Vault secret
// `pushengage_notification_webhook_secret`.
//
// Required secrets:
//   PUSHENGAGE_API_KEY   PushEngage REST API key
// Optional:
//   PUSHENGAGE_APP_ID    defaults to the app id baked into the client snippet.
//   PUSHENGAGE_NOTIFICATION_WEBHOOK_SECRET
//                        shared secret the trigger must send (falls back to the
//                        legacy NOTIFICATION_WEBHOOK_SECRET).
//
// Deploy:  supabase functions deploy pushengage-notification --no-verify-jwt
// -----------------------------------------------------------------------------

const DEFAULT_APP_ID = '23a65358-7d1f-4b0b-beff-de8b48f9689f';
const PUSHENGAGE_ENDPOINT = 'https://api.pushengage.com/apiv1/notifications';
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
    Deno.env.get('PUSHENGAGE_NOTIFICATION_WEBHOOK_SECRET') ?? Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
  const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
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

  const form = new URLSearchParams();
  form.set('notification_title', title);
  form.set('notification_message', message);
  form.set('notification_url', 'https://www.stakeyswheels.co.uk');
  form.set('notification_type', 'now');
  // Branding: shop logo as the notification icon.
  const logoUrl = Deno.env.get('BOOKING_LOGO_URL') ||
    'https://lhojocpygcnkxvkrcuxh.supabase.co/storage/v1/object/public/brand/stakeys-logo.png';
  form.set('image_url', logoUrl);
  form.append('profile_id[]', userId);

  let response: Response;
  try {
    response = await fetch(PUSHENGAGE_ENDPOINT, {
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

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // PushEngage returns HTTP 200 even for failures (e.g. "Segment not found").
  if (!response.ok || result?.success === false) {
    console.error('PushEngage rejected the request', { status: response.status, result });
    return json({ error: 'Push delivery failed', detail: result }, 502);
  }

  console.info('PushEngage push sent', { notificationId, userId });
  return json({ accepted: true, result }, 202);
});
