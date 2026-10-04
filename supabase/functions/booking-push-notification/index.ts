// Supabase Edge Function: booking-push-notification
// -----------------------------------------------------------------------------
// Fires from the `service_bookings` AFTER INSERT trigger
// (`service_bookings_booking_push_insert`) and pushes a "new booking" alert to
// staff/admin phones via PushEngage. The trigger authenticates with the shared
// `x-booking-webhook-secret` header (Vault `booking_webhook_secret`).
//
// Required secrets:
//   PUSHENGAGE_API_KEY       PushEngage REST API key
//   BOOKING_WEBHOOK_SECRET   must match the Vault `booking_webhook_secret`
//   SUPABASE_URL             auto-injected by the Edge Functions runtime
//   SUPABASE_SERVICE_ROLE_KEY
//                            auto-injected; used to look up the admin profile ids
// Optional:
//   ADMIN_PROFILE_IDS        comma-separated override of the recipient list
//
// Targeting: the alert goes to the booking's assigned staff member (if any) and
// to every admin/staff profile, sent as ONE multi-`profile_id` push. We do NOT
// use a PushEngage segment — this account's plan has hit its segment limit, so a
// `staff` segment cannot exist and any segment-targeted push would be dropped
// with a 200/"Segment not found" while still looking like success.
//
// Deploy:  supabase functions deploy booking-push-notification --no-verify-jwt
// -----------------------------------------------------------------------------

const PUSHENGAGE_ENDPOINT = 'https://api.pushengage.com/apiv1/notifications';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Admin/staff profile ids to alert, from the env override or the profiles table. */
async function resolveStaffRecipients(): Promise<string[]> {
  const override = text(Deno.env.get('ADMIN_PROFILE_IDS'));
  if (override) return override.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));

  const url = text(Deno.env.get('SUPABASE_URL'));
  const key = text(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&role=in.(admin,staff)`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id?: string }>;
    return rows.map((r) => text(r.id)).filter((id) => UUID_RE.test(id));
  } catch {
    return [];
  }
}

async function sendPush(apiKey: string, title: string, message: string, profileIds: string[]): Promise<Response> {
  const form = new URLSearchParams();
  form.set('notification_title', title);
  form.set('notification_message', message);
  form.set('notification_url', 'https://stakeyswheels.co.uk');
  form.set('notification_type', 'now');
  for (const id of profileIds) form.append('profile_id[]', id);

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

  const assigned = text(booking.staff_id) || text(booking.assigned_to);
  const admins = await resolveStaffRecipients();
  const recipients = [...new Set([...(UUID_RE.test(assigned) ? [assigned] : []), ...admins])];

  if (recipients.length === 0) {
    console.error('No push recipients resolved (no assigned staff and no admin profiles)');
    return json({ error: 'No push recipients available' }, 503);
  }

  let response: Response;
  try {
    response = await sendPush(apiKey, '🚴 New Customer Booking!', content, recipients);
  } catch (error) {
    console.error('PushEngage request failed', error);
    return json({ error: 'Could not reach push notification provider' }, 502);
  }

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // PushEngage answers 200 even for failures ("Segment not found", "Invalid API
  // Key"), so a successful HTTP status alone is not enough.
  if (!response.ok || result?.success === false) {
    console.error('PushEngage rejected notification', { status: response.status, result });
    return json({ error: 'Push notification provider rejected the request', detail: result }, 502);
  }

  return json({ ok: true, recipients: recipients.length, notification_id: result?.notification_id ?? null });
});
