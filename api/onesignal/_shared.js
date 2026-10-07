/**
 * Shared OneSignal server helpers for the Vercel functions.
 *
 * The REST API key is server-only and must never reach the browser. Depending
 * on how the project was set up it may be stored under one of several names
 * (including the `VITE_`-prefixed form, which is harmless as long as it is only
 * read here on the server), so we accept any of them and trim stray whitespace
 * or surrounding quotes from copy-paste.
 */

export const DEFAULT_APP_ID = '7f67ab94-3c85-4702-9cd8-d158cf294593';

/** Every env var name the OneSignal REST key might be stored under. */
export const REST_KEY_ENV_NAMES = [
  'ONESIGNAL_REST_API_KEY',
  'ONESIGNAL_API_KEY',
  'VITE_ONESIGNAL_REST_API_KEY',
];

export function resolveAppId(env = process.env) {
  return env.VITE_ONESIGNAL_APP_ID || env.ONESIGNAL_APP_ID || DEFAULT_APP_ID;
}

/**
 * Returns `{ key, source }` where `source` is the env-var name the key was
 * found under (or null). Trims whitespace and a single pair of wrapping quotes.
 */
export function resolveRestKey(env = process.env) {
  for (const name of REST_KEY_ENV_NAMES) {
    const raw = env[name];
    if (typeof raw === 'string' && raw.trim()) {
      return { key: raw.trim().replace(/^["']|["']$/g, ''), source: name };
    }
  }
  return { key: null, source: null };
}

/** Origin used for a notification's click-through URL (in order of preference). */
export function resolveOrigin(req, env = process.env) {
  if (env.APP_ORIGIN) return env.APP_ORIGIN;
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  return host ? `${proto}://${host}` : 'https://stakeys-cycle.co.uk';
}
