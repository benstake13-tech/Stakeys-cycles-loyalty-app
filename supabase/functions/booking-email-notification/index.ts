const jsonHeaders = { "Content-Type": "application/json" };

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

function clean(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "(not provided)";
}

const BRAND = {
  green: "#05C147",
  bg: "#0c0d0e",
  card: "#111318",
  panel: "#16181d",
  border: "#27272a",
  text: "#e5e7eb",
  muted: "#9ca3af",
  appUrl: "https://www.stakeyswheels.co.uk",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:13px;vertical-align:top;">${label}</td>
    <td style="padding:9px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:13px;font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

function step(n: number, title: string, body: string): string {
  return `<tr>
    <td style="vertical-align:top;width:34px;padding:0 0 16px 0;">
      <div style="width:26px;height:26px;border-radius:50%;background:${BRAND.green};color:#04140a;font-weight:800;font-size:13px;text-align:center;line-height:26px;">${n}</div>
    </td>
    <td style="vertical-align:top;padding:0 0 16px 12px;">
      <div style="color:#ffffff;font-size:14px;font-weight:700;margin-bottom:2px;">${title}</div>
      <div style="color:${BRAND.muted};font-size:13px;line-height:1.55;">${body}</div>
    </td>
  </tr>`;
}

function panel(title: string, inner: string): string {
  return `<div style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:12px;padding:6px 16px 10px 16px;margin:0 0 16px 0;">
    <div style="color:#ffffff;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:14px 0 6px 0;">${title}</div>
    ${inner}
  </div>`;
}

function button(label: string, href: string): string {
  return `<div style="text-align:center;margin:4px 0 18px 0;">
    <a href="${href}" style="display:inline-block;background:${BRAND.green};color:#04140a;text-decoration:none;font-weight:800;font-size:14px;padding:13px 28px;border-radius:10px;">${label}</a>
  </div>`;
}

function shell(opts: {
  logoUrl: string;
  statusLabel: string;
  statusColor: string;
  headline: string;
  intro: string;
  content: string;
  supportEmail: string;
  supportPhone: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark light"/></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
        <tr><td style="padding:26px 28px 18px 28px;text-align:center;border-bottom:1px solid ${BRAND.border};">
          <img src="${opts.logoUrl}" alt="Stakey's Cycles &amp; Scooter" width="96" style="display:block;margin:0 auto 10px auto;width:96px;height:auto;border-radius:12px;" />
          <div style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:1px;">STAKEY'S CYCLES &amp; SCOOTER</div>
          <div style="color:${BRAND.muted};font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">Workshop Service Booking</div>
        </td></tr>
        <tr><td style="padding:24px 28px 4px 28px;">
          <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${opts.statusColor}22;color:${opts.statusColor};border:1px solid ${opts.statusColor}55;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">${opts.statusLabel}</span>
          <h1 style="color:#ffffff;font-size:22px;margin:14px 0 10px 0;line-height:1.3;">${opts.headline}</h1>
          <div style="color:${BRAND.text};font-size:14px;line-height:1.65;">${opts.intro}</div>
        </td></tr>
        <tr><td style="padding:22px 28px 6px 28px;">${opts.content}</td></tr>
        <tr><td style="padding:18px 28px 26px 28px;border-top:1px solid ${BRAND.border};color:${BRAND.muted};font-size:11px;line-height:1.7;text-align:center;">
          Stakey's Cycles &amp; Scooter · Workshop Service<br/>
          Questions? Email <a href="mailto:${opts.supportEmail}" style="color:${BRAND.green};text-decoration:none;">${opts.supportEmail}</a> or call <a href="tel:${opts.supportPhone}" style="color:${BRAND.green};text-decoration:none;">${opts.supportPhone}</a>.<br/>
          <span style="color:#6b7280;">This is an automated message from the Stakey's booking system.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("BOOKING_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("BOOKING_WEBHOOK_SECRET is not configured");
    return new Response("Function is not configured", { status: 500 });
  }

  const suppliedSecret = req.headers.get("x-booking-webhook-secret") ?? "";
  if (!constantTimeEqual(suppliedSecret, webhookSecret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("BOOKING_FROM_EMAIL");
  const logoUrl = Deno.env.get("BOOKING_LOGO_URL") ||
    "https://lhojocpygcnkxvkrcuxh.supabase.co/storage/v1/object/public/brand/stakeys-logo.png";
  const supportPhone = Deno.env.get("BOOKING_SUPPORT_PHONE") || "+44 7700 900821";
  const supportEmail = Deno.env.get("BOOKING_SUPPORT_EMAIL") || fromEmail || "workshop@stakeyscycles.com";
  const internalRecipients = (Deno.env.get("BOOKING_NOTIFY_EMAILS") ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

  if (!resendApiKey || !fromEmail || internalRecipients.length === 0) {
    console.error("Email provider or recipient configuration is missing");
    return new Response("Function is not configured", { status: 500 });
  }

  let payload: {
    type?: string;
    schema?: string;
    table?: string;
    record?: Record<string, unknown>;
  };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (
    payload.type !== "INSERT" ||
    payload.schema !== "public" ||
    payload.table !== "service_bookings" ||
    !payload.record
  ) {
    return new Response("Unexpected webhook event", { status: 400 });
  }

  const booking = payload.record;
  const customerEmail = typeof booking.customer_email === "string"
    ? booking.customer_email.trim()
    : "";
  const recipients = [...new Set([...internalRecipients, ...(customerEmail ? [customerEmail] : [])])];
  if (recipients.length === 0) {
    return new Response("No recipients configured", { status: 400 });
  }

  const bookingId = clean(booking.id);
  const service = clean(booking.service_title);
  const name = clean(booking.customer_name);
  const date = clean(booking.preferred_date);
  const time = clean(booking.preferred_time_slot);
  const status = clean(booking.status);
  const phone = clean(booking.customer_phone);
  const vehicleModel = clean(booking.vehicle_model);
  const notes = clean(booking.notes);

  // Bike identity (jsonb) -> human-readable summary.
  const bike = (booking.bike_details ?? {}) as Record<string, unknown>;
  const ebikeLabel = bike.ebikeStatus === "factory"
    ? "Factory e-bike"
    : bike.ebikeStatus === "converted"
    ? "Converted e-bike"
    : bike.ebikeStatus === "not_ebike"
    ? "Not an e-bike"
    : "";
  const bikeBits = [
    ebikeLabel,
    bike.colour ? `colour ${clean(bike.colour)}` : "",
    bike.year ? `year ${clean(bike.year)}` : "",
    bike.frameSize ? `frame ${clean(bike.frameSize)}` : "",
    bike.conversionSystem ? clean(bike.conversionSystem) : "",
  ].filter(Boolean).join(", ");

  const hasNotes = notes !== "(not provided)";
  const bikeValue = escapeHtml(vehicleModel) + (bikeBits ? ` <span style="color:${BRAND.muted};font-weight:400;">(${escapeHtml(bikeBits)})</span>` : "");
  const detailRows = [
    detailRow("Reference", `#${escapeHtml(bookingId)}`),
    detailRow("Service", escapeHtml(service)),
    detailRow("Bike", bikeValue),
    detailRow("Drop-off", `${escapeHtml(date)} &middot; ${escapeHtml(time)}`),
    detailRow("Status", escapeHtml(status)),
    hasNotes ? detailRow("Your notes", escapeHtml(notes)) : "",
  ].join("");

  const contactRows = [
    detailRow("Name", escapeHtml(name)),
    detailRow("Phone", escapeHtml(phone)),
    detailRow("Email", escapeHtml(customerEmail || "(not provided)")),
  ].join("");

  const customerSteps = panel("What happens next", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:8px;">
    ${step(1, "Workshop review", "Our mechanics review your request and confirm we have bench capacity for the job.")}
    ${step(2, "You're approved", "We email you the moment your booking is confirmed — no need to chase us.")}
    ${step(3, "Drop off your bike", `Bring it in during your slot on <strong style="color:${BRAND.text};">${escapeHtml(date)}</strong> at <strong style="color:${BRAND.text};">${escapeHtml(time)}</strong> for a quick safety check.`)}
    ${step(4, "Repair &amp; collection", "We complete the work, send an itemised invoice, and let you know it's ready to collect.")}
  </table>`);

  const ownerSteps = panel("Suggested next steps", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:8px;">
    ${step(1, "Review the request", "Check the bike and reported symptoms against today's bench capacity.")}
    ${step(2, "Approve or decline", "Update the booking in the Staff Terminal — the customer is notified automatically.")}
    ${step(3, "Book the slot", "Confirm the drop-off time and prepare the parts and labour estimate.")}
  </table>`);

  for (const recipient of recipients) {
    const isCustomer = customerEmail && recipient.toLowerCase() === customerEmail.toLowerCase();
    const subject = isCustomer
      ? `Booking received: ${service} (#${bookingId})`
      : `New service booking: ${service} (#${bookingId})`;
    const text = isCustomer
      ? `Hello ${name},\n\nThanks — we've received your workshop booking request.\n\nReference:  #${bookingId}\nService:    ${service}\nBike:       ${vehicleModel}${bikeBits ? ` (${bikeBits})` : ""}\nDrop-off:   ${date} at ${time}\n${hasNotes ? `Notes:      ${notes}\n` : ""}\nThe booking is not confirmed until the workshop approves it; we'll email you the moment it is.\n\n— Stakey's Cycles Workshop`
      : `A new service booking was made.\n\nReference:  #${bookingId}\nService:    ${service}\nBike:       ${vehicleModel}${bikeBits ? ` (${bikeBits})` : ""}\nDrop-off:   ${date} at ${time}\n${hasNotes ? `Notes:      ${notes}\n` : ""}\nCustomer: ${name}\nPhone:    ${phone}\nEmail:    ${customerEmail || "(not provided)"}\nStatus:   ${status}`;

    const html = isCustomer
      ? shell({
          logoUrl,
          statusLabel: "Awaiting workshop approval",
          statusColor: "#f59e0b",
          headline: "Your booking request is in",
          intro: `Hi ${escapeHtml(name)}, thanks for booking with Stakey's Cycles. Here's a copy of your request — keep this email as your reference.`,
          content: panel("Your booking", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:6px;">${detailRows}</table>`) +
            customerSteps +
            button("Visit Stakey's Cycles", BRAND.appUrl),
          supportEmail,
          supportPhone,
        })
      : shell({
          logoUrl,
          statusLabel: "New booking",
          statusColor: BRAND.green,
          headline: `New booking from ${escapeHtml(name)}`,
          intro: "A new workshop booking has just come in. Review the details below and approve or decline it in the Staff Terminal.",
          content: panel("Booking details", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:6px;">${detailRows}</table>`) +
            panel("Customer", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:6px;">${contactRows}</table>`) +
            ownerSteps +
            button("Open Staff Terminal", BRAND.appUrl),
          supportEmail,
          supportPhone,
        });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [recipient], subject, text, html }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`Resend rejected the message for ${recipient}: HTTP ${response.status} ${detail}`);
      return new Response(JSON.stringify({ error: "Email delivery failed", status: response.status, detail }), {
        status: 502,
        headers: jsonHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ sent: recipients.length }), {
    status: 200,
    headers: jsonHeaders,
  });
});