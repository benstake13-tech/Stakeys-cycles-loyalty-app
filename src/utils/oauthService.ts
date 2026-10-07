/**
 * OAuth 2.0 (Authorization Code + PKCE) for Google and Meta.
 *
 * The client secret is NEVER held in the browser: the authorization code and
 * PKCE verifier are exchanged server-side by /api/oauth/token, which returns the
 * access/refresh tokens back here for the session.
 */

export type OAuthProvider = 'google' | 'meta';

export interface OAuthTokens {
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  scope?: string;
  accountLabel?: string;
}

const TOKEN_KEY = 'stakeys_oauth_tokens';
const PKCE_KEY = 'stakeys_oauth_pkce';

export const OAUTH_PROVIDERS: Record<
  OAuthProvider,
  { label: string; clientIdEnv: string; authBase: string; scope: string; extraParams?: Record<string, string> }
> = {
  google: {
    label: 'Google Business Profile',
    clientIdEnv: 'VITE_GOOGLE_CLIENT_ID',
    authBase: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/business.manage openid email profile',
    extraParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  },
  meta: {
    label: 'Meta Business (Facebook & Instagram)',
    clientIdEnv: 'VITE_META_APP_ID',
    authBase: 'https://www.facebook.com/v21.0/dialog/oauth',
    scope: 'public_profile,pages_show_list,pages_read_engagement,read_insights,business_management',
  },
};

/**
 * Reads the public OAuth client id for a provider.
 *
 * These MUST be read as literal `import.meta.env.VITE_*` accesses. Indexing the
 * env object dynamically (e.g. `import.meta.env[name]`) makes Vite inline the
 * WHOLE environment — including server-only secrets like
 * `VITE_ONESIGNAL_REST_API_KEY` — into the public browser bundle. The switch
 * below keeps each read a static property access so only these two public
 * values can ever be inlined.
 */
export function getClientId(provider: OAuthProvider): string | undefined {
  switch (provider) {
    case 'google':
      return import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    case 'meta':
      return import.meta.env.VITE_META_APP_ID as string | undefined;
    default:
      return undefined;
  }
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return Boolean(getClientId(provider));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes).slice(0, length);
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

function loadTokens(): Partial<Record<OAuthProvider, OAuthTokens>> {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTokens(tokens: Partial<Record<OAuthProvider, OAuthTokens>>) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function getStoredToken(provider: OAuthProvider): OAuthTokens | null {
  const token = loadTokens()[provider];
  if (!token) return null;
  return token;
}

export function isTokenExpired(token: OAuthTokens | null, skewMs = 60_000): boolean {
  if (!token) return true;
  return Date.now() > token.expiresAt - skewMs;
}

export function disconnectProvider(provider: OAuthProvider) {
  const tokens = loadTokens();
  delete tokens[provider];
  saveTokens(tokens);
}

/** Builds the provider authorization URL and stashes the PKCE verifier/state. */
export async function buildAuthorizationUrl(
  provider: OAuthProvider
): Promise<{ url: string; state: string; redirectUri: string }> {
  const clientId = getClientId(provider);
  if (!clientId) throw new Error(`${OAUTH_PROVIDERS[provider].label} OAuth is not configured.`);

  const redirectUri = `${window.location.origin}/oauth/callback`;
  const state = randomString(24);
  const codeVerifier = randomString(64);
  const challenge = base64UrlEncode(await sha256(codeVerifier));

  const pkceStore = JSON.parse(localStorage.getItem(PKCE_KEY) || '{}');
  pkceStore[state] = { provider, codeVerifier, createdAt: Date.now() };
  localStorage.setItem(PKCE_KEY, JSON.stringify(pkceStore));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_PROVIDERS[provider].scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(OAUTH_PROVIDERS[provider].extraParams || {}),
  });

  return { url: `${OAUTH_PROVIDERS[provider].authBase}?${params.toString()}`, state, redirectUri };
}

export function consumePkce(state: string): { provider: OAuthProvider; codeVerifier: string } | null {
  try {
    const store = JSON.parse(localStorage.getItem(PKCE_KEY) || '{}');
    const entry = store[state];
    if (!entry) return null;
    delete store[state];
    localStorage.setItem(PKCE_KEY, JSON.stringify(store));
    return { provider: entry.provider, codeVerifier: entry.codeVerifier };
  } catch {
    return null;
  }
}

/** Exchanges an authorization code for tokens via the backend proxy. */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const res = await fetch('/api/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, code, codeVerifier, redirectUri }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Token exchange failed');

  const tokens: OAuthTokens = {
    provider,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    scope: data.scope,
  };
  const store = loadTokens();
  store[provider] = tokens;
  saveTokens(store);
  return tokens;
}

/** Returns a valid access token, refreshing it server-side if needed. */
export async function getValidAccessToken(provider: OAuthProvider): Promise<string | null> {
  const token = getStoredToken(provider);
  if (!token) return null;
  if (!isTokenExpired(token)) return token.accessToken;

  if (!token.refreshToken) {
    disconnectProvider(provider);
    return null;
  }
  try {
    const res = await fetch('/api/oauth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, refreshToken: token.refreshToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Refresh failed');
    const refreshed: OAuthTokens = {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    const store = loadTokens();
    store[provider] = refreshed;
    saveTokens(store);
    return refreshed.accessToken;
  } catch {
    disconnectProvider(provider);
    return null;
  }
}

/**
 * Opens the provider consent screen in a popup and resolves with tokens once the
 * popup lands back on /oauth/callback.
 */
export function startOAuthPopup(provider: OAuthProvider): Promise<OAuthTokens> {
  return new Promise(async (resolve, reject) => {
    let authUrl: string;
    let state: string;
    let redirectUri: string;
    try {
      ({ url: authUrl, state, redirectUri } = await buildAuthorizationUrl(provider));
    } catch (err) {
      return reject(err);
    }

    const popup = window.open(authUrl, 'stakeys-oauth', 'width=520,height=680,menubar=no,toolbar=no');
    if (!popup) return reject(new Error('Popup blocked — allow popups for this site and retry.'));

    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Authorization timed out. Please try again.'));
    }, 5 * 60 * 1000);

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== 'stakeys-oauth-callback') return;
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);

      if (payload.error) return reject(new Error(payload.error));
      if (payload.state !== state) return reject(new Error('OAuth state mismatch.'));

      const pkce = consumePkce(payload.state);
      if (!pkce) return reject(new Error('OAuth session expired. Please retry.'));

      try {
        const tokens = await exchangeCodeForTokens(pkce.provider, payload.code, pkce.codeVerifier, redirectUri);
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    };

    window.addEventListener('message', onMessage);
  });
}

/**
 * Runs inside the popup landing on /oauth/callback. Relays the code back to the
 * opener window and closes the popup. Returns true if it handled the callback.
 */
export function handleOAuthCallbackPage(): boolean {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error_description') || params.get('error');
  if (!code && !error) return false;

  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: 'stakeys-oauth-callback', code, state, error },
      window.location.origin
    );
    window.close();
    return true;
  }
  return false;
}
