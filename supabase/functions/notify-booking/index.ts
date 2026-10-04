// Supabase Edge Function: notify-booking
// -----------------------------------------------------------------------------
// Server-side workshop alert for NEW bookings. A Database Webhook on
// `public.service_bookings` (AFTER INSERT) POSTs the row here, and this function
// emails the workshop owner via Resend. Because it runs in Supabase — not in the
// customer's browser — the alert still fires when the customer closes the tab,
// and it can't be lost to a navigation race.
//
// This function is webhook-only: it rejects any caller whose JWT role is not
// `service_role` (the webhook is configured to authenticate with the service
// role key), so it cannot be spammed with the public anon key.
//
// Required secrets (Supabase Dashboard -> Project Settings -> Edge Functions ->
// Secrets, or `supabase secrets set`):
//   RESEND_API_KEY   e.g. re_xxxxxxxx
// Optional:
//   MAIL_FROM        default sender, e.g. "Stakey's Cycles <noreply@stakeyswheels.co.uk>"
//
// `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by
// the Edge Functions runtime and are used to read the workshop recipient from
// `app_settings`.
//
// Deploy:  supabase functions deploy notify-booking
// Setup:   see supabase/WEBHOOK_EMAIL_SETUP.md
// -----------------------------------------------------------------------------

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = "Stakey's Cycles <noreply@stakeyswheels.co.uk>";

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Reads the `role` claim out of the caller's JWT (no signature check needed —
 *  the platform already verified it). Used to require service_role. */
function jwtRole(req: Request): string | null {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

interface OwnerConfig {
  ownerEmail: string;
  ownerPhone: string;
  emailAlertsEnabled: boolean;
  businessName: string;
}

/** Loads the workshop notification settings from `app_settings` (id = 1). */
async function fetchOwnerConfig(): Promise<OwnerConfig> {
  const empty: OwnerConfig = {
    ownerEmail: '',
    ownerPhone: '',
    emailAlertsEnabled: false,
    businessName: "Stakey's Cycles",
  };
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return empty;
  try {
    const res = await fetch(
      `${url}/rest/v1/app_settings?select=owner_email,owner_phone,email_alerts_enabled,business_name&id=eq.1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return empty;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return empty;
    return {
      ownerEmail: row.owner_email || '',
      ownerPhone: row.owner_phone || '',
      emailAlertsEnabled: row.email_alerts_enabled === true,
      businessName: row.business_name || "Stakey's Cycles",
    };
  } catch {
    return empty;
  }
}

type BookingRecord = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const money = (v: unknown): string => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

/** Server-side mirror of the app's workshop alert template. */
function ownerBookingEmailHtml(record: BookingRecord, config: OwnerConfig): string {
  const id = str(record.id);
  const serviceTitle = str(record.service_title);
  const vehicleCategory = str(record.vehicle_type).toUpperCase().replace('_', ' ');
  const vehicleModel = str(record.vehicle_model);
  const preferredDate = str(record.preferred_date);
  const preferredTimeSlot = str(record.preferred_time_slot);
  const servicePrice = money(record.service_price);
  const customerEmail = str(record.customer_email);
  const customerName = str(record.customer_name);
  const customerPhone = str(record.customer_phone);
  const membershipNumber = str(record.membership_number);
  const notes = str(record.notes);
  const approved = str(record.approval_status) === 'approved';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Service Booking - ${config.businessName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #ffffff; margin: 0; padding: 24px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #141517; border-radius: 16px; border: 1px solid #27272a; overflow: hidden;">
    <tr>
      <td style="background-color: #05C147; padding: 24px; text-align: center;">
        <h1 style="color: #000000; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 2px;">STAKEYS</h1>
        <p style="color: #000000; margin: 4px 0 0 0; font-size: 14px; font-weight: 600; letter-spacing: 1px;">CYCLES &amp; SCOOTER</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1f2937; padding: 12px 24px; border-bottom: 1px solid #374151; color: #34d399; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
        ⚡ NEW WORKSHOP REPAIR BOOKING RECEIVED
      </td>
    </tr>
    <tr>
      <td style="padding: 28px 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 16px 0;">Booking #${id}</h2>
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color: #18181b; border-radius: 12px; margin-bottom: 20px; border: 1px solid #27272a;">
          <tr><td style="color: #a1a1aa; font-size: 13px; width: 35%;">Service Requested:</td><td style="color: #05C147; font-size: 15px; font-weight: 700;">${serviceTitle}</td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Vehicle:</td><td style="color: #ffffff; font-size: 14px; font-weight: 600;">${vehicleCategory} — ${vehicleModel}</td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Scheduled Slot:</td><td style="color: #ffffff; font-size: 14px; font-weight: 600;">📅 ${preferredDate} (${preferredTimeSlot})</td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Estimated Charge:</td><td style="color: #34d399; font-size: 15px; font-weight: 700;">£${servicePrice}</td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Status:</td><td style="color: #facc15; font-size: 13px; font-weight: 700;">${approved ? '✅ Confirmed & Approved' : '⏳ Awaiting Workshop Review & Approval'}</td></tr>
        </table>
        <h3 style="color: #d4d4d8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px 0;">Customer Information</h3>
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background-color: #18181b; border-radius: 12px; margin-bottom: 20px; border: 1px solid #27272a;">
          <tr><td style="color: #a1a1aa; font-size: 13px; width: 35%;">Customer Name:</td><td style="color: #ffffff; font-size: 14px; font-weight: 600;">${customerName}</td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Email:</td><td style="color: #38bdf8; font-size: 14px;"><a href="mailto:${customerEmail}" style="color: #38bdf8; text-decoration: none;">${customerEmail}</a></td></tr>
          <tr><td style="color: #a1a1aa; font-size: 13px;">Phone / Mobile:</td><td style="color: #38bdf8; font-size: 14px; font-weight: 600;"><a href="tel:${customerPhone}" style="color: #34d399; text-decoration: none;">${customerPhone}</a></td></tr>
          ${membershipNumber ? `<tr><td style="color: #a1a1aa; font-size: 13px;">Loyalty Member ID:</td><td style="color: #05C147; font-size: 13px; font-family: monospace; font-weight: 700;">${membershipNumber}</td></tr>` : ''}
          ${notes ? `<tr><td style="color: #a1a1aa; font-size: 13px; vertical-align: top;">Customer Notes:</td><td style="color: #e4e4e7; font-size: 13px; font-style: italic;">"${notes}"</td></tr>` : ''}
        </table>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding-top: 10px;">
              <a href="mailto:${customerEmail}?subject=Regarding Your Repair Booking #${id}" style="background-color: #05C147; color: #000000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; margin-right: 10px;">✉️ Reply via Email</a>
              <a href="tel:${customerPhone}" style="background-color: #27272a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">📞 Call Customer</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color: #090a0b; padding: 16px 24px; text-align: center; border-top: 1px solid #27272a; color: #71717a; font-size: 12px;">
        Notification delivered automatically to <strong>${config.ownerEmail}</strong> • ${config.businessName} Staff Portal
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendViaResend(
  apiKey: string,
  payload: { from: string; to: string; subject: string; html: string }
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: payload.from, to: [payload.to], subject: payload.subject, html: payload.html }),
  });
  const detail = await res.text();
  return { ok: res.ok, status: res.status, detail };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  // Webhook-only: the Database Webhook authenticates with the service role key.
  if (jwtRole(req) !== 'service_role') {
    return json({ error: 'This endpoint is restricted to the database webhook.' }, 403);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return json({ error: 'RESEND_API_KEY is not configured for the notify-booking function' }, 500);
  }

  let payload: { type?: string; table?: string; record?: BookingRecord };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const record = payload?.record;
  if (payload?.table !== 'service_bookings' || !record) {
    return json({ error: 'Expected a service_bookings webhook payload with a record.' }, 400);
  }
  // Only alert on a genuinely new booking.
  if (payload?.type && payload.type !== 'INSERT') {
    return json({ skipped: true, reason: `ignored ${payload.type} event` });
  }

  const config = await fetchOwnerConfig();
  if (!config.ownerEmail) {
    return json({ skipped: true, reason: 'no workshop notification recipient is set (app_settings.owner_email)' });
  }
  if (!config.emailAlertsEnabled) {
    return json({ skipped: true, reason: 'workshop email alerts are turned off' });
  }

  const subject = `⚡ [STAKEY'S WORKSHOP] New Booking #${str(record.id)}: ${str(record.service_title)} (${str(record.customer_name)})`;
  const html = ownerBookingEmailHtml(record, config);
  const from = Deno.env.get('MAIL_FROM') || DEFAULT_FROM;

  try {
    const result = await sendViaResend(apiKey, { from, to: config.ownerEmail, subject, html });
    if (!result.ok) {
      console.error(`[notify-booking] Resend ${result.status}: ${result.detail}`);
      return json({ error: 'Email provider rejected the request', status: result.status, detail: result.detail }, 502);
    }
    console.log(`[notify-booking] ✅ Workshop alert sent to ${config.ownerEmail} for booking #${str(record.id)}`);
    return json({ success: true });
  } catch (err) {
    console.error('[notify-booking] dispatch failed:', err);
    return json({ error: 'Failed to reach email provider', detail: String(err) }, 502);
  }
});
