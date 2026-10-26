import { describeGoogleIssue } from './_googleIssues.js';
import { randomUUID } from 'node:crypto';
import { resolveSupabaseUrl, resolveServiceKey, resolveAdminEmails } from '../auth/_shared.js';
import { resolveProvider, exchangeToken } from '../oauth/_shared.js';
import { googleInsights } from './_google.js';

const REFRESH_MS = 5 * 60 * 1000;

class ConnectionChanged extends Error {}
function publicReport(row, admin) {
  if (!row) return { connected: false, canManage: admin, metrics: null, message: 'An administrator needs to link the shop’s Google Business account once.' };
  return {
    connected: true, canManage: admin, connectionVersion: row.connection_version, locationName: row.location_name,
    locations: row.locations || [], accountLabel: (row.locations || []).find(l => l.name === row.location_name)?.title || 'Google Business Profile',
    metrics: row.snapshot?.metrics || null, hasData: Boolean(row.snapshot?.hasData), period: row.snapshot?.period,
    updatedAt: row.updated_at, stale: Boolean(row.last_error) || !row.updated_at || Date.now() - Date.parse(row.updated_at) > REFRESH_MS,
    issue: row.last_issue || (/quota exceeded/i.test(row.last_error || '') ? describeGoogleIssue({ error: { message: row.last_error } }, 429) : undefined),
    message: row.last_error || (!row.location_name ? 'An administrator must select the shop location.' : undefined), needsReconnect: row.needs_reconnect,
  };
}

export async function googleShared(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!session) return res.status(401).json({ error: 'Sign in to your staff account.' });
  const url = resolveSupabaseUrl();
  const serviceKey = resolveServiceKey().key;
  if (!serviceKey) return res.status(503).json({ error: 'Shared Google connection is not configured on the server.' });
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const table = `${url}/rest/v1/google_business_connection`;
  let row;
  let authorisedAdmin = false;
  const db = async (method, filter, body) => {
    if (method === 'PATCH' && row?.connection_version) filter += `&connection_version=eq.${encodeURIComponent(row.connection_version)}`;
    const response = await fetch(`${table}${filter}`, { method, headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error('Could not access the shared Google connection.');
    const rows = response.status === 204 ? [] : await response.json();
    if (method === 'PATCH' && row?.connection_version && !rows.length) throw new ConnectionChanged();
    return rows;
  };
  try {
    const auth = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: `Bearer ${session}` } });
    if (!auth.ok) return res.status(401).json({ error: 'Your staff session expired. Please sign in again.' });
    const user = await auth.json();
    if (!user.id) return res.status(401).json({ error: 'Invalid staff session.' });
    const profile = await fetch(`${url}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`, { headers });
    if (!profile.ok) return res.status(403).json({ error: 'Could not verify staff access.' });
    const role = (await profile.json())?.[0]?.role;
    if (!['admin', 'staff'].includes(role)) return res.status(403).json({ error: 'Staff access required.' });
    const admin = role === 'admin' && resolveAdminEmails().has(String(user.email || '').toLowerCase());
    authorisedAdmin = admin;
    if (req.method !== 'GET' && !admin) return res.status(403).json({ error: 'Only an administrator can change the shared Google connection.' });
    if (req.method === 'DELETE') {
      await db('DELETE', '?id=eq.primary');
      return res.status(200).json({ connected: false, canManage: true });
    }
    row = (await db('GET', '?id=eq.primary&select=*'))[0];
    const oauth = () => {
      const config = resolveProvider('google');
      if (config.error) throw new Error('Google OAuth is not configured on the server.');
      return config;
    };
    const refresh = async refreshToken => {
      const c = oauth();
      return exchangeToken(c.cfg.tokenUrl, new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }));
    };
    if (req.method === 'POST') {
      if (req.body?.refreshToken) {
        if (typeof req.body.refreshToken !== 'string' || req.body.refreshToken.length > 8192) return res.status(400).json({ error: 'Invalid offline refresh token.' });
        const token = await refresh(req.body.refreshToken);
        if (!token.ok || !token.data?.access_token) return res.status(400).json({ error: 'Google did not accept this connection. Authorise Google again with offline access.' });
        if (!String(token.data.scope || '').split(' ').includes('https://www.googleapis.com/auth/business.manage')) return res.status(400).json({ error: 'Authorise Google Business Profile access before linking.' });
        row = (await db('POST', '?on_conflict=id', { id: 'primary', connection_version: randomUUID(), refresh_token: token.data.refresh_token || req.body.refreshToken, location_name: null, locations: [], snapshot: null, updated_at: null, last_attempt_at: null, last_error: null, last_issue: null, needs_reconnect: false }))[0];
      } else if (req.body?.location && row) {
        if (!(row.locations || []).some(location => location.name === req.body.location)) return res.status(400).json({ error: 'Choose a location returned by your linked Google account.' });
        row = (await db('PATCH', '?id=eq.primary', { connection_version: randomUUID(), location_name: req.body.location, snapshot: null, updated_at: null, last_attempt_at: null, last_error: null, last_issue: null }))[0];
      } else return res.status(400).json({ error: 'An offline refresh token is required. Authorise Google and link the account.' });
    }
    if (!row) return res.status(200).json({ connected: false, canManage: admin, metrics: null, message: 'An administrator needs to link the shop’s Google Business account once.' });
    const send = () => res.status(200).json(publicReport(row, admin));
    if (row.needs_reconnect || (row.last_attempt_at && Date.now() - Date.parse(row.last_attempt_at) < REFRESH_MS)) return send();
    // Claim a refresh across concurrent server instances; other readers keep the saved report.
    const filter = row.last_attempt_at ? `last_attempt_at=eq.${encodeURIComponent(row.last_attempt_at)}` : 'last_attempt_at=is.null';
    const claim = await db('PATCH', `?id=eq.primary&${filter}`, { last_attempt_at: new Date().toISOString() });
    if (!claim.length) { row = (await db('GET', '?id=eq.primary&select=*'))[0] || row; return send(); }
    row = claim[0];
    try {
      const token = await refresh(row.refresh_token);
      if (!token.ok || !token.data?.access_token) {
        const revoked = token.data?.error === 'invalid_grant';
        row = (await db('PATCH', '?id=eq.primary', { last_error: revoked ? 'Google access expired or was revoked. An administrator needs to reconnect.' : 'Google is temporarily unavailable. Showing the last successful report.', needs_reconnect: revoked, last_issue: null }))[0];
        return send();
      }
      const googleAuth = { Authorization: `Bearer ${token.data.access_token}` };
      if (!row.location_name) {
        const accounts = await googleInsights('accounts', {}, googleAuth);
        if (accounts.status !== 200) throw Object.assign(new Error(accounts.data?.error?.message || 'Google could not list the business locations.'), { providerData: accounts.data, providerStatus: accounts.status });
        const locations = accounts.data.locations || [];
        row = (await db('PATCH', '?id=eq.primary', { locations, location_name: locations.length === 1 ? locations[0].name : null, last_issue: null, last_error: locations.length ? null : 'Google returned no accessible business locations.' }))[0];
      }
      if (row.location_name) {
        const report = await googleInsights('performance', { location: row.location_name }, googleAuth);
        if (report.status !== 200) throw Object.assign(new Error(report.data?.error?.message || 'Google could not load performance data.'), { providerData: report.data, providerStatus: report.status });
        if (report.data.hasData) {
          row = (await db('PATCH', '?id=eq.primary', { snapshot: report.data, updated_at: new Date().toISOString(), last_error: null, last_issue: null, needs_reconnect: false, ...(token.data.refresh_token ? { refresh_token: token.data.refresh_token } : {}) }))[0];
        } else row = (await db('PATCH', '?id=eq.primary', { last_issue: null, last_error: 'Google has not returned new performance data yet. Any saved figures remain visible.' }))[0];
      }
    } catch (error) {
      if (error instanceof ConnectionChanged) throw error;
      // Only Google read errors reach here; never return token endpoint payloads or credentials.
      row = (await db('PATCH', '?id=eq.primary', { last_error: String(error.message || 'Google could not update the report.').slice(0, 1200), last_issue: describeGoogleIssue(error.providerData, error.providerStatus) }))[0];
    }
    return send();
  } catch (error) {
    if (error instanceof ConnectionChanged) {
      try { return res.status(200).json(publicReport((await db('GET', '?id=eq.primary&select=*'))[0], authorisedAdmin)); } catch { /* report unavailable below */ }
    }
    return res.status(503).json({ error: 'The shared Google report is temporarily unavailable. Please retry.' });
  }
}
