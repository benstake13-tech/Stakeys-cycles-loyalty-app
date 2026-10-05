// Supabase Edge Function: send-email
// -----------------------------------------------------------------------------
// Forwards a transactional email (workshop booking alerts, customer
// confirmations, approvals/declines and the staff "test email") to the Resend
// HTTP API. The browser app calls this via supabase.functions.invoke('send-email').
//
// Required secret (Supabase Dashboard -> Edge Functions -> Secrets, or CLI):
//   RESEND_API_KEY   e.g. re_xxxxxxxx
// Optional:
//   MAIL_FROM        default sender, e.g. "Stakey's Cycles <noreply@stakeyswheels.co.uk>"
//                    The domain must be verified in Resend for the `from` to
//                    match what the app sends (noreply@stakeyswheels.co.uk); set a
//                    different MAIL_FROM to override the app-supplied address.
//
// Deploy:  supabase functions deploy send-email
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return json({ error: 'RESEND_API_KEY is not configured for the send-email function' }, 500);
  }

  let payload: { to?: string; subject?: string; html?: string; from?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const to = payload.to?.trim();
  const subject = payload.subject?.trim();
  if (!to || !subject || (!payload.html && !payload.text)) {
    return json({ error: '`to`, `subject` and one of `html`/`text` are required' }, 400);
  }

  const from = Deno.env.get('MAIL_FROM') || payload.from?.trim() || DEFAULT_FROM;

  const resendBody: Record<string, unknown> = {
    from,
    to: [to],
    subject,
  };
  if (payload.html) resendBody.html = payload.html;
  if (payload.text) resendBody.text = payload.text;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendBody),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      console.error(`[send-email] Resend ${res.status}: ${bodyText}`);
      return json({ error: 'Email provider rejected the request', status: res.status, detail: bodyText }, 502);
    }

    let id: string | undefined;
    try {
      id = JSON.parse(bodyText)?.id;
    } catch {
      /* Resend normally returns JSON; ignore parse issues */
    }
    return json({ success: true, id });
  } catch (err) {
    console.error('[send-email] dispatch failed:', err);
    return json({ error: 'Failed to reach email provider', detail: String(err) }, 502);
  }
});
