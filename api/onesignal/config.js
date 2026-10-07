/**
 * Vercel serverless function — OneSignal runtime config.
 *
 * The production site is a static Vite build on Vercel (see vercel.json), which
 * serves only `dist/` + `api/*`. The Express routes in server.ts are dev-only
 * (`npm run dev`), so this endpoint mirrors server.ts `/api/onesignal/config`
 * where the deployed front-end can actually reach it.
 *
 * The App ID is safe to expose to the browser; the REST key never is. Only the
 * key's presence is reported, as a boolean, plus which env-var name it was
 * found under so a misconfigured deploy is diagnosable.
 */
import { resolveAppId, resolveRestKey, REST_KEY_ENV_NAMES } from './_shared.js';

export default function handler(_req, res) {
  const appId = resolveAppId();
  const { key, source } = resolveRestKey();
  res.status(200).json({
    appId,
    serverPush: Boolean(appId && key),
    restKeyEnv: source,
    restKeyEnvNames: REST_KEY_ENV_NAMES,
  });
}
