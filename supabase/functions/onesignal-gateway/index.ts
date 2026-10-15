import { buildNativeAccountTestMessage, buildNativeTestMessage } from "./nativeTest.ts";

// Keeps the OneSignal App API key in Supabase Edge Function secrets and uses
// OneSignal's current REST endpoint/authentication scheme.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';
const OWNER_EMAIL = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'stakeyscycle95@gmail.com';

// OneSignal can return errors as an object even with HTTP 200. Keep its reason
// readable by older APKs, whose error renderer only understands string arrays.
function providerErrorMessage(errors: unknown, apiKey: string): string {
  if (!errors) return '';
  const redact = (value: unknown) => typeof value === 'string' ? value.replaceAll(apiKey, '[redacted]') : value;
  const serialize = (value: unknown) => typeof value === 'string' ? String(redact(value)) : JSON.stringify(value, (key, entry) =>
    /authorization|api.?key|token|secret|password|private_key/i.test(key) ? '[redacted]' : redact(entry));
  return (Array.isArray(errors) ? errors.map(serialize).join('; ') : serialize(errors)).slice(0, 1600);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const appId = (Deno.env.get('ONESIGNAL_APP_ID') || DEFAULT_APP_ID).trim();
  const androidAppId = Deno.env.get('ONESIGNAL_ANDROID_APP_ID')?.trim() || appId;
  const apiKey = (Deno.env.get('ONESIGNAL_APP_API_KEY') || Deno.env.get('ONESIGNAL_REST_API_KEY') || Deno.env.get('ONESIGNAL_API_KEY') || '').trim().replace(/^['"]|['"]$/g, '');
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  if (body.action === 'config') return json({ appId, androidAppId, serverPush: Boolean(apiKey), keySource: apiKey ? 'Supabase Edge Function secret' : null });
  if (!['notify', 'test-native', 'test-native-account'].includes(String(body.action))) return json({ error: 'Unknown OneSignal action' }, 404);
  if (!apiKey) return json({ error: 'OneSignal server key is not configured in Supabase', code: 'NOT_CONFIGURED' }, 503);

  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  let callerId: string | null = null;
  let isStaff = false;
  if (bearer && supabaseUrl && serviceKey) {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data } = await admin.auth.getUser(bearer);
      callerId = data.user?.id || null;
      if (callerId) {
        const { data: profile } = await admin.from('profiles').select('role').eq('id', callerId).maybeSingle();
        isStaff = ['staff','admin'].includes(profile?.role || '');
      }
    } catch (error) { console.error('OneSignal caller verification failed:', error); }
  }

  if (body.action === 'test-native' || body.action === 'test-native-account') {
    if (!callerId) return json({ error: 'Sign in to test native push', code: 'AUTH_REQUIRED' }, 401);
    if (!isStaff) return json({ error: 'Staff access required', code: 'STAFF_REQUIRED' }, 403);
    let testMessage;
    const accountTest = body.action === 'test-native-account';
    try {
      testMessage = accountTest
        ? buildNativeAccountTestMessage(body, androidAppId, callerId)
        : buildNativeTestMessage(body, androidAppId);
    }
    catch (error) { return json({ error: (error as Error).message, code: 'INVALID_NATIVE_TARGET' }, 400); }
    try {
      const upstream = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(testMessage),
        signal: AbortSignal.timeout(15000),
      });
      const result = await upstream.json().catch(() => ({}));
      // Acceptance is not confirmation that the phone displayed the message.
      const hasErrors = Array.isArray(result.errors) ? result.errors.length > 0 : Boolean(result.errors);
      const accepted = upstream.ok && Boolean(result.id) && !hasErrors && result.recipients !== 0;
      const providerReason = providerErrorMessage(result.errors, apiKey);
      // Log only outcome metadata and redacted provider errors, never keys or FCM tokens.
      console.log('Native push test outcome', JSON.stringify({
        providerStatus: upstream.status,
        accepted,
        hasMessageId: Boolean(result.id),
        recipients: typeof result.recipients === 'number' ? result.recipients : null,
        errors: providerReason || null,
      }));
      return json({ id: typeof result.id === 'string' ? result.id : null,
        ...(typeof result.recipients === 'number' ? { recipients: result.recipients } : {}),
        ...(providerReason ? { errors: [providerReason] } : {}), accepted, ...(!accepted ? {
        error: providerReason ? `OneSignal rejected the native test: ${providerReason}` : 'OneSignal returned no accepted message ID. Check this Android subscription in the OneSignal dashboard.',
        code: 'NATIVE_TEST_REJECTED',
      } : {}), platform: 'android-native', ...(accountTest
        ? { targetScope: 'signed-in-staff-android-devices' }
        : { subscriptionId: body.subscriptionId }) }, upstream.status);
    } catch {
      return json({ error: 'Native push dispatch failed', code: 'UPSTREAM_ERROR' }, 502);
    }
  }

  const title = String(body.title || "Stakey's Cycles").slice(0, 120);
  const content = String(body.body || '').slice(0, 2000);
  if (!content.trim()) return json({ error: 'Notification body is required' }, 400);
  const message: Record<string, unknown> = {
    app_id: appId,
    headings: { en: title },
    contents: { en: content },
    target_channel: 'push',
  };
  if (appId === androidAppId) {
    message.small_icon = 'ic_stat_stakeys';
    message.android_accent_color = 'FF05C147';
    message.android_channel_id = 'stakeys_cycles_updates';
  }

  const externalId = body.externalUserId ? String(body.externalUserId).slice(0, 200) : '';
  const tag = body.tag && typeof body.tag === 'object' ? body.tag as { key?: unknown; value?: unknown } : null;
  const email = String(body.email || '').trim().toLowerCase();
  const segment = String(body.segment || '').trim();
  const targetCount = Number(Boolean(externalId)) + Number(Boolean(tag?.key && tag?.value)) + Number(Boolean(email)) + Number(Boolean(segment));
  if (targetCount !== 1) return json({ error: 'Choose exactly one notification target' }, 400);

  if (externalId) {
    if (!isStaff && externalId !== callerId) return json({ error: 'Only staff can send to another user' }, 403);
    message.include_aliases = { external_id: [externalId] };
  } else if (tag?.key && tag?.value) {
    const key = String(tag.key).trim();
    const value = String(tag.value).trim();
    if (!key || !value) return json({ error: 'Tag key and value are required' }, 400);
    if (!isStaff && !(key === 'owner_email' && value.toLowerCase() === OWNER_EMAIL.toLowerCase())) return json({ error: 'Staff permission is required for this tag' }, 403);
    message.filters = [{ field: 'tag', key, relation: '=', value }];
  } else if (email) {
    if (!isStaff && email !== OWNER_EMAIL.toLowerCase()) return json({ error: 'Staff permission is required to message this email' }, 403);
    message.target_channel = 'email';
    message.email_to = [email];
    message.email_subject = title;
    message.email_body = content;
    delete message.headings;
    delete message.contents;
  } else if (segment) {
    if (!isStaff) return json({ error: 'Staff permission is required to send to a segment' }, 403);
    message.included_segments = [segment];
  }

  const siteUrl = (Deno.env.get('APP_ORIGIN') || 'https://www.stakeys-cycles.co.uk').replace(/\/$/, '');
  let clickUrl = siteUrl;
  if (typeof body.url === 'string') {
    try {
      const candidate = new URL(body.url);
      if (candidate.origin === new URL(siteUrl).origin) clickUrl = candidate.toString();
    } catch {}
  }
  if (message.target_channel === 'push') message.url = clickUrl;

  try {
    const upstream = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15000),
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) console.error('OneSignal API rejected request:', upstream.status, JSON.stringify(result).slice(0, 500));
    return json(result, upstream.status);
  } catch (error) {
    console.error('OneSignal request failed:', error);
    return json({ error: 'OneSignal dispatch failed', code: 'UPSTREAM_ERROR' }, 502);
  }
});
