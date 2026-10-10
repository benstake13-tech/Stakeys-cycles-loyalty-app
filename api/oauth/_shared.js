/**
 * Shared OAuth 2.0 (Authorization Code + PKCE) helpers for the Vercel
 * serverless functions.
 *
 * Mirrors the `OAUTH_CONFIG` block in server.ts so the dev server and the
 * deployed (static Vercel) site behave identically. Client secrets are
 * server-only and must never reach the browser; only the public client id is
 * read in the client via `import.meta.env.VITE_*`.
 */

export const OAUTH_CONFIG = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: (env = process.env) => env.VITE_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID,
    clientSecret: (env = process.env) => env.GOOGLE_CLIENT_SECRET,
  },
  meta: {
    tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
    clientId: (env = process.env) => env.VITE_META_APP_ID || env.META_APP_ID,
    clientSecret: (env = process.env) => env.META_APP_SECRET,
  },
};

/**
 * Resolves the provider config + credentials, or an `{ error }` describing why
 * the request cannot proceed (unknown provider / missing server secret).
 */
export function resolveProvider(provider, env = process.env) {
  const cfg = OAUTH_CONFIG[provider];
  if (!cfg) {
    return { error: { status: 400, body: { error: 'Unknown provider' } } };
  }
  const clientId = cfg.clientId(env);
  const clientSecret = cfg.clientSecret(env);
  if (!clientId || !clientSecret) {
    return {
      error: {
        status: 500,
        body: { error: `${provider} OAuth is not configured on the server` },
      },
    };
  }
  return { cfg, clientId, clientSecret };
}

/** POST a urlencoded body to a token endpoint and pass the JSON straight back. */
export async function exchangeToken(tokenUrl, params) {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await response.json();
  return { status: response.status, ok: response.ok, data };
}
