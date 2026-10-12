/**
 * Absolute base for the app's own serverless API (`/api/*`).
 *
 * On the web the API lives on the same origin as the page, so a relative
 * `/api/...` path is correct and stays correct behind any domain or preview URL.
 *
 * In the packaged native app (Capacitor) that assumption breaks: the WebView
 * serves the bundled assets under the origin set in `capacitor.config.json`
 * (`server.hostname`). Capacitor registers a wildcard handler for that origin,
 * so a relative `/api/...` request is answered from the app's own asset bundle
 * (404) and never reaches the network. The API therefore has to be addressed by
 * its real, absolute origin.
 *
 * Set `VITE_API_BASE_URL` (e.g. `https://www.stakeys-cycles.co.uk`) when
 * building the native bundle. When it is unset — web builds, local dev, tests —
 * requests stay relative, exactly as before.
 */
const RAW_BASE = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();

/** Absolute API origin, or '' to keep requests relative (same-origin web). */
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

/**
 * Resolve an API path (or any app-relative URL) against the configured base.
 * An already-absolute URL is returned untouched, so this is safe to apply at
 * every call site regardless of how the request is finally issued.
 */
export function apiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * The origin to use for links that leave the app: share URLs, Supabase auth
 * email redirects, and OAuth redirect URIs. On the web this is just the page
 * origin. In the native build the page origin is the local WebView
 * (`https://localhost`), which would produce dead links, so the deployed origin
 * is used instead. `API_BASE_URL` being set is exactly the native-build signal.
 */
export function publicOrigin(): string {
  if (API_BASE_URL) return API_BASE_URL;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://www.stakeys-cycles.co.uk';
}
