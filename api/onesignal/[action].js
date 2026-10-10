/**
 * Vercel serverless function — OneSignal push (dispatched by action).
 *
 * One function serves `/api/onesignal/*` (config / notify) to stay within the
 * Vercel Serverless Function budget (Hobby allows 12 per deployment). The action
 * is the dynamic path segment (`/api/onesignal/notify` → `req.query.action ===
 * 'notify'`), so client URLs are unchanged. The REST key is server-only.
 */
import { resolveAppId, resolveRestKey, resolveOrigin, buildTagFilter, REST_KEY_ENV_NAMES } from './_shared.js';

const ONESIGNAL_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

function onesignalConfig(_req, res) {
  const appId = resolveAppId();
  const { key, source } = resolveRestKey();
  return res.status(200).json({
    appId,
    serverPush: Boolean(appId && key),
    restKeyEnv: source,
    restKeyEnvNames: REST_KEY_ENV_NAMES,
  });
}

async function onesignalNotify(req, res) {
  const { title, body, url, externalUserId, email, segment, tag } = req.body || {};
  const appId = resolveAppId();
  const { key: apiKey } = resolveRestKey();
  if (!appId || !apiKey) {
    return res.status(500).json({
      error: 'OneSignal server push is not configured',
      hint: 'Set ONESIGNAL_REST_API_KEY (or ONESIGNAL_API_KEY) in the deployment environment.',
    });
  }

  // OneSignal allows exactly one targeting method per message.
  const message = {
    app_id: appId,
    headings: { en: title || "Stakey's Cycles" },
    contents: { en: body || '' },
    url: url || resolveOrigin(req),
  };
  if (externalUserId) {
    message.include_aliases = { external_id: [String(externalUserId)] };
    message.target_channel = 'push';
  } else if (tag?.key && tag?.value) {
    message.filters = [buildTagFilter(tag)];
  } else if (email) {
    message.include_email_tokens = [String(email)];
    message.target_channel = 'email';
  } else {
    message.included_segments = [String(segment || 'Subscribed Users')];
  }

  try {
    const upstream = await fetch(ONESIGNAL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (error) {
    console.error('OneSignal push error:', error);
    res.status(500).json({ error: 'Push dispatch failed' });
  }
}

export default async function handler(req, res) {
  const action = String(req.query.action || '');
  if (action === 'config') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return onesignalConfig(req, res);
  }
  if (action === 'notify') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    return onesignalNotify(req, res);
  }
  return res.status(404).json({ error: 'Unknown onesignal action' });
}
