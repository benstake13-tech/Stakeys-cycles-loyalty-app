import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';
import { buildStaffEventMessage, providerAccepted } from './message.ts';

// This internal endpoint uses a dedicated random database dispatch token.
// Supabase gateway JWT verification is off ONLY for this endpoint; the token
// is validated by a service-role-only claim RPC before any event is read/sent.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const token = req.headers.get('x-stakeys-dispatch-token') || '';
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response('Unauthorized', { status: 401 });
  const key = (Deno.env.get('ONESIGNAL_APP_API_KEY') || Deno.env.get('ONESIGNAL_REST_API_KEY') || Deno.env.get('ONESIGNAL_API_KEY') || '').trim().replace(/^['"]|['"]$/g, '');
  if (!key) return new Response('Push server key missing', { status: 503 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: events, error } = await db.rpc('claim_staff_push_events', { p_token: token });
  if (error) return new Response('Unauthorized or queue unavailable', { status: 403 });
  const options = await req.json().catch(() => ({}));
  const appId = Deno.env.get('ONESIGNAL_ANDROID_APP_ID')?.trim() || Deno.env.get('ONESIGNAL_APP_ID')?.trim() || '7f67ab94-3c85-4702-9cd8-d158cf294593';
  if (options.inspect === true && !events?.length) {
    const { data: staff } = await db.from('profiles').select('id').in('role', ['admin', 'staff']);
    const devices = [];
    for (const account of staff || []) {
      const userResponse = await fetch(`https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(account.id)}`, {
        headers: { Authorization: `Key ${key}` }, signal: AbortSignal.timeout(12000),
      });
      const user = await userResponse.json().catch(() => ({}));
      devices.push({ status: userResponse.status, android: (user.subscriptions || []).filter((s: { type: string }) => s.type === 'AndroidPush')
        .map((s: Record<string, unknown>) => ({ enabled: s.enabled, notificationTypes: s.notification_types, appVersion: s.app_version, sdk: s.sdk })) });
    }
    const { data: messageId } = await db.rpc('latest_staff_push_verification');
    if (!messageId) return Response.json({ error: 'No verification alert exists' }, { status: 404 });
    const response = await fetch(`https://api.onesignal.com/notifications/${encodeURIComponent(messageId)}?app_id=${encodeURIComponent(appId)}`, {
      headers: { Authorization: `Key ${key}` }, signal: AbortSignal.timeout(12000),
    });
    const report = await response.json().catch(() => ({}));
    // Delivery diagnostics contain counts and provider reasons only, no device
    // tokens, customer details, credentials or arbitrary message lookups.
    return Response.json({ devices, status: response.status, recipients: report.recipients, successful: report.successful,
      failed: report.failed, errored: report.errored, remaining: report.remaining,
      errors: report.errors ? JSON.stringify(report.errors).replaceAll(key, '[redacted]').slice(0, 1500) : null });
  }
  const { data: staff, error: staffError } = await db.from('profiles').select('id').in('role', ['admin', 'staff']);
  if (staffError) return new Response('Staff lookup unavailable', { status: 503 });
  const ids = (staff || []).map((row: { id: string }) => row.id);
  let accepted = 0;
  for (const event of events || []) {
    const message = buildStaffEventMessage(event, ids, appId);
    let status = 'retry';
    let messageId: string | null = null;
    let reason = 'No subscribed staff recipients';
    if (!message) { status = 'skipped'; reason = 'No eligible staff recipients'; }
    else {
      try {
        const response = await fetch('https://api.onesignal.com/notifications', {
          method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(message), signal: AbortSignal.timeout(12000),
        });
        const result = await response.json().catch(() => ({}));
        if (providerAccepted(result, response.ok)) {
          status = 'accepted'; messageId = result.id; accepted++;
          reason = result.errors ? JSON.stringify(result.errors).replaceAll(key, '[redacted]').slice(0, 300) : '';
        } else reason = `Provider did not accept notification (HTTP ${response.status}): ${JSON.stringify(result.errors || '').replaceAll(key, '[redacted]').slice(0, 220)}`;
      } catch { reason = 'Provider request timed out or failed'; }
    }
    const { error: ackError } = await db.rpc('finish_staff_push_event', {
      p_id: event.id, p_lease: event.lease_id, p_status: status, p_message_id: messageId, p_reason: reason,
    });
    if (ackError) console.error('Staff event acknowledgement failed', event.id);
  }
  return Response.json({ processed: events?.length || 0, accepted });
});
