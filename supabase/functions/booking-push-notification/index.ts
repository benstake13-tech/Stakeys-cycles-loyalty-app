const DEFAULT_ONESIGNAL_APP_ID = "wqkpdqnevlzmtsuayrhc";
const ADMIN_EXTERNAL_ID = "c6226c5d-2110-46b2-88e6-53d9decc78da";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("BOOKING_WEBHOOK_SECRET");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? Deno.env.get("ONESIGNAL_REST_KEY");
  const appId = Deno.env.get("ONESIGNAL_APP_ID") ?? DEFAULT_ONESIGNAL_APP_ID;
  if (!webhookSecret || !restApiKey) {
    console.error("Required booking push secrets are not configured");
    return json({ error: "Push notification service is not configured" }, 503);
  }

  const providedSecret = req.headers.get("x-booking-webhook-secret");
  if (!providedSecret || providedSecret !== webhookSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ error: "Expected a JSON object" }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (payload.type && payload.type !== "INSERT") {
    return json({ error: "Only booking insert events are supported" }, 400);
  }
  if (payload.table && payload.table !== "service_bookings") {
    return json({ error: "Unexpected table" }, 400);
  }

  const rowValue = payload.record ?? payload.new ?? payload.booking ?? payload;
  if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) {
    return json({ error: "Booking record is missing" }, 400);
  }
  const booking = rowValue as Record<string, unknown>;
  const bookingId = text(booking.id);
  if (!bookingId) return json({ error: "Booking ID is missing" }, 400);

  const service = text(booking.service_type) || text(booking.service_title) || "Repair";
  const content = `New booking: ${service} (Job #${bookingId})`;

  let onesignalResponse: Response;
  try {
    onesignalResponse = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Key ${restApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_aliases: { external_id: [ADMIN_EXTERNAL_ID] },
        headings: { en: "🚴 New Customer Booking!" },
        contents: { en: content },
        data: { booking_id: bookingId },
      }),
    });
  } catch (error) {
    console.error("OneSignal request failed", error);
    return json({ error: "Could not reach push notification provider" }, 502);
  }

  if (!onesignalResponse.ok) {
    console.error("OneSignal rejected notification", { status: onesignalResponse.status });
    return json({ error: "Push notification provider rejected the request" }, 502);
  }

  const result = await onesignalResponse.json().catch(() => ({}));
  return json({ ok: true, notification_id: result?.id ?? null });
});