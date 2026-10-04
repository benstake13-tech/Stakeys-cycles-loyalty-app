// Supabase Edge Function: booking-push-notification
// -----------------------------------------------------------------------------
// Fires from the `service_bookings` AFTER INSERT trigger
// (`notify_service_bookings_push`) and pushes a "new booking" alert to staff
// phones via PushEngage. The trigger authenticates with the shared
// `x-booking-webhook-secret` header (Vault `booking_webhook_secret`).
//
// Required secret:
//   PUSHENGAGE_API_KEY      PushEngage REST API key
//   BOOKING_WEBHOOK_SECRET  must match the Vault `booking_webhook_secret`
// Optional:
//   PUSHENGAGE_APP_ID       defaults to the app id baked into the client snippet.
//
// The staff device is targeted by its PushEngage profile id (the signed-in
// user's uid, set client-side via `identify`), with a fallback to the `staff`
// segment so an alert is never dropped.
//
// Deploy:  supabase functions deploy booking-push-notification --no-verify-jwt
// -----------------------------------------------------------------------------

const PUSHENGAGE_ENDPOINT = 'https://api.pushengage.com/apiv1/notifications';
const STAFF_SEGMENT = 'staff';

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function sendPush(apiKey: string, title: string, message: string, profileId?: string): Promise<Response> {
  const form = new URLSearchParams();
  form.set('notification_title', title);
  form.set('notification_message', message);
  form.set('notification_url', 'https://stakeyswheels.co.uk');
  form.set('notification_type', 'now');
  if (profileId) form.append('profile_id[]', profileId);
  else form.append('include_segments[]', STAFF_SEGMENT);

  return await fetch(PUSHENGAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('BOOKING_WEBHOOK_SECRET');
  const apiKey = Deno.env.get('PUSHENGAGE_API_KEY');
  if (!webhookSecret || !apiKey) {
    console.error('Required booking push secrets are not configured');
    return json({ error: 'Push notification service is not configured' }, 503);
  }

  const providedSecret = req.headers.get('x-booking-webhook-secret');
  if (!providedSecret || providedSecret !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ error: 'Expected a JSON object' }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (payload.type && payload.type !== 'INSERT') {
    return json({ error: 'Only booking insert events are supported' }, 400);
  }
  if (payload.table && payload.table !== 'service_bookings') {
    return json({ error: 'Unexpected table' }, 400);
  }

  const rowValue = payload.record ?? payload.new ?? payload.booking ?? payload;
  if (!rowValue || typeof rowValue !== 'object' || Array.isArray(rowValue)) {
    return json({ error: 'Booking record is missing' }, 400);
  }
  const booking = rowValue as Record<string, unknown>;
  const bookingId = text(booking.id);
  if (!bookingId) return json({ error: 'Booking ID is missing' }, 400);

  const service = text(booking.service_type) || text(booking.service_title) || 'Repair';
  const content = `New booking: ${service} (Job #${bookingId})`;
  const staffProfileId = text(booking.staff_id) || text(booking.assigned_to) || undefined;

  let response: Response;
  try {
    response = await sendPush(apiKey, '🚴 New Customer Booking!', content, staffProfileId);
  } catch (error) {
    console.error('PushEngage request failed', error);
    return json({ error: 'Could not reach push notification provider' }, 502);
  }

  if (!response.ok) {
    console.error('PushEngage rejected notification', { status: response.status });
    return json({ error: 'Push notification provider rejected the request' }, 502);
  }

  const result = await response.json().catch(() => ({}));
  return json({ ok: true, notification_id: result?.id ?? null });
});
