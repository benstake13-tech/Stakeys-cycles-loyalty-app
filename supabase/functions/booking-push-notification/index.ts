// Supabase Edge Function: booking-push-notification
// -----------------------------------------------------------------------------
// Fires from the `service_bookings` AFTER INSERT trigger
// (`service_bookings_booking_push_insert`) and pushes a "new booking" alert to
// staff/admin phones via OneSignal. The trigger authenticates with the shared
// `x-booking-webhook-secret` header (Vault `booking_webhook_secret`).
//
// Required secrets:
//   ONESIGNAL_API_KEY        OneSignal App API key (os_v2_app_...)
//   BOOKING_WEBHOOK_SECRET   must match the Vault `booking_webhook_secret`
//   SUPABASE_URL             auto-injected by the Edge Functions runtime
//   SUPABASE_SERVICE_ROLE_KEY
//                            auto-injected; used to look up the admin profile ids
// Optional:
//   ONESIGNAL_APP_ID         defaults to the app id baked into the client snippet.
//   ADMIN_PROFILE_IDS        comma-separated override of the recipient list
//
// Targeting: the alert goes to the shop's admin devices only, sent as ONE push
// targeting the admin external ids (the profile ids set via OneSignal.login).
// This is independent of who created the booking (admin, staff, customer or
// guest) — the DB trigger fires for any insert.
//
// Deploy:  supabase functions deploy booking-push-notification --no-verify-jwt
// -----------------------------------------------------------------------------

const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';
const ONESIGNAL_ENDPOINT = 'https://api.onesignal.com/notifications';
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

/** Admin profile ids to alert, from the env override or the profiles table. */
async function resolveAdminRecipients(): Promise<string[]> {
  const override = text(Deno.env.get('ADMIN_PROFILE_IDS'));
  if (override) return override.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));

  const url = text(Deno.env.get('SUPABASE_URL'));
  const key = text(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=id&role=eq.admin`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ id?: string }>;
    return rows.map((r) => text(r.id)).filter((id) => UUID_RE.test(id));
  } catch {
    return [];
  }
}

const DEFAULT_LOGO_URL =
  'https://lhojocpygcnkxvkrcuxh.supabase.co/storage/v1/object/public/brand/stakeys-logo.png';

async function sendPush(
  apiKey: string,
  title: string,
  message: string,
  externalIds: string[],
  opts: { logoUrl?: string; url?: string } = {},
): Promise<Response> {
  const appUrl = opts.url || 'https://www.stakeyswheels.co.uk';
  const logoUrl = opts.logoUrl || DEFAULT_LOGO_URL;
  // Branding: the shop logo as the notification icon and a large banner image.
  const notification = {
    app_id: Deno.env.get('ONESIGNAL_APP_ID') || DEFAULT_APP_ID,
    include_aliases: { external_id: externalIds },
    target_channel: 'push',
    headings: { en: title },
    contents: { en: message },
    url: appUrl,
    chrome_web_icon: logoUrl,
    chrome_web_image: logoUrl,
  };

  return await fetch(ONESIGNAL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(notification),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('BOOKING_WEBHOOK_SECRET');
  const apiKey = Deno.env.get('ONESIGNAL_API_KEY');
  const logoUrl = Deno.env.get('BOOKING_LOGO_URL') || DEFAULT_LOGO_URL;
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
  const customer = text(booking.customer_name) || 'Guest';
  const bike = text(booking.vehicle_model);
  const date = text(booking.preferred_date);
  const time = text(booking.preferred_time_slot);
  const phone = text(booking.customer_phone);
  const when = date ? `${date}${time ? ` ${time}` : ''}` : '';

  // Push text carries the booking details so the admin can triage at a glance.
  const title = `🚴 New Booking — ${customer}`;
  const content = [
    service,
    bike,
    when,
    phone,
    `#${bookingId}`,
  ].filter(Boolean).join(' · ');

  // Alert the admin devices only. Booking alerts must reach the shop's admin
  // regardless of who booked (admin, staff, customer or guest), so we do not
  // add the customer or any assigned staff — the admin profile is the single
  // recipient.
  const admins = await resolveAdminRecipients();
  const recipients = [...new Set(admins)];

  if (recipients.length === 0) {
    console.error('No admin push recipient resolved');
    return json({ error: 'No push recipients available' }, 503);
  }

  let response: Response;
  try {
    response = await sendPush(apiKey, title, content, recipients, { logoUrl });
  } catch (error) {
    console.error('OneSignal request failed', error);
    return json({ error: 'Could not reach push notification provider' }, 502);
  }

  const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // OneSignal's v2 API returns HTTP 200 with a populated `errors` field on
  // failure (e.g. `["All included players are not subscribed"]`) and an empty
  // `id`. A real success always carries a notification id, so require both.
  if (!response.ok || !result?.id) {
    console.error('OneSignal rejected notification', { status: response.status, result });
    return json({ error: 'Push notification provider rejected the request', detail: result }, 502);
  }

  return json({ ok: true, recipients: recipients.length, notification_id: result.id });
});
