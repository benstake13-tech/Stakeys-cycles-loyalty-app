/**
 * Vercel serverless function — OneSignal runtime config.
 *
 * The production site is a static Vite build on Vercel (see vercel.json), which
 * serves only `dist/` + `api/*`. The Express routes in server.ts are dev-only
 * (`npm run dev`), so this endpoint mirrors server.ts `/api/onesignal/config`
 * where the deployed front-end can actually reach it.
 *
 * The App ID is safe to expose to the browser; the REST key never is. Only the
 * key's presence is reported, as a boolean.
 */
const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';

export default function handler(_req, res) {
  const appId =
    process.env.VITE_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || DEFAULT_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY;
  res.status(200).json({ appId, serverPush: Boolean(appId && apiKey) });
}
