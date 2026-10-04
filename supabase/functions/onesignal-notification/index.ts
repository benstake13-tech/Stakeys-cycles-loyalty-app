const ONE_SIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
if (!ONE_SIGNAL_APP_ID) throw new Error('ONESIGNAL_APP_ID is required');

const ONE_SIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
if (!ONE_SIGNAL_REST_API_KEY) throw new Error('ONESIGNAL_REST_API_KEY is required');

const WEBHOOK_SECRET = Deno.env.get('NOTIFICATION_WEBHOOK_SECRET');
if (!WEBHOOK_SECRET) throw new Error('NOTIFICATION_WEBHOOK_SECRET is required');

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const suppliedSecret = req.headers.get('x-webhook-secret') ?? '';
  if (suppliedSecret !== WEBHOOK_SECRET) return json({ error: 'Unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > 16_384) {
      return json({ error: 'Payload too large' }, 413);
    }
    payload = JSON.parse(text);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    payload.type !== 'INSERT' || payload.schema !== 'public' ||
    payload.table !== 'notifications' ||
    typeof payload.record !== 'object' || payload.record === null
  ) {
    return json({ error: 'Unexpected webhook event' }, 400);
  }

  const record = payload.record as Record<string, unknown>;
  if (
    typeof record.user_id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.message !== 'string' ||
    typeof record.id !== 'string'
  ) {
    return json({ error: 'Notification is missing required fields' }, 400);
  }

  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${ONE_SIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: ONE_SIGNAL_APP_ID,
      target_channel: 'push',
      include_aliases: { external_id: [record.user_id] },
      headings: { en: record.title },
      contents: { en: record.message },
      data: { notification_id: record.id, type: record.type ?? null },
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.error('OneSignal request failed', { status: response.status, response: responseText });
    return json({ error: 'Push delivery failed' }, 502);
  }

  const result = await response.json();
  console.info('OneSignal push sent', { notificationId: record.id, userId: record.user_id });
  return json({ accepted: true, result }, 202);
});