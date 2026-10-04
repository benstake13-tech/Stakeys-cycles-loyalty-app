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

  for (const recipient of recipients) {
    const isCustomer = customerEmail && recipient.toLowerCase() === customerEmail.toLowerCase();
    const subject = isCustomer
      ? `Booking request received: ${service}`
      : `New service booking: ${service}`;
    const text = isCustomer
      ? `Hello ${name},\n\nWe received your booking request.\n\nService: ${service}\nPreferred date: ${date}\nPreferred time: ${time}\nReference: ${bookingId}\n\nThe booking is not confirmed until your business confirms it.`
      : `A new service booking was made.\n\nCustomer: ${name}\nCustomer email: ${customerEmail || "(not provided)"}\nCustomer phone: ${clean(booking.customer_phone)}\nService: ${service}\nPreferred date: ${date}\nPreferred time: ${time}\nStatus: ${clean(booking.status)}\nReference: ${bookingId}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [recipient], subject, text }),
    });

    if (!response.ok) {
      console.error(`Resend returned HTTP ${response.status}`);
      return new Response("Email delivery failed", { status: 502 });
    }
  }

  return new Response(JSON.stringify({ sent: recipients.length }), {
    status: 200,
    headers: jsonHeaders,
  });
});