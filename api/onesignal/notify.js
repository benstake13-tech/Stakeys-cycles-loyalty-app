/**
 * Vercel serverless function — OneSignal push dispatch.
 *
 * Mirrors server.ts `/api/onesignal/notify` for the production (static Vercel)
 * deployment: the browser sends the target (signed-in profile, email
 * subscription or tag segment) and we call the OneSignal REST API
 * server-to-server so pushes arrive even when the app/tab is closed.
 *
 * The REST API key is server-only and never reaches the browser.
 */
import { resolveAppId, resolveRestKey, resolveOrigin } from './_shared.js';

const ONESIGNAL_ENDPOINT = 'https://onesignal.com/api/v1/notifications';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    message.filters = [{ field: 'tag', key: String(tag.key), value: String(tag.value) }];
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
