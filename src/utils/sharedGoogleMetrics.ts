import { supabase } from '../lib/supabase';
import { apiUrl } from './apiBase';
import { getStoredToken, startOAuthPopup, disconnectProvider } from './oauthService';
import { googleReportMetrics, type BusinessInsights } from './businessInsights';

async function request(method = 'GET', body?: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) return null;
  const response = await fetch(apiUrl('/api/business/google-shared'), {
    method, headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The Google report could not be updated.');
  return result;
}

export async function fetchSharedGoogleInsights(location?: string, selectLocation = false): Promise<BusinessInsights | null> {
  let report = await request();
  if (!report) return null;
  if (selectLocation && location && report.connected && report.locationName !== location && report.canManage) report = await request('POST', { location });
  return {
    provider: 'google', connected: Boolean(report.connected), live: Boolean(report.hasData), shared: Boolean(report.connected),
    connectionId: report.connectionVersion, canManage: Boolean(report.canManage), needsReconnect: Boolean(report.needsReconnect),
    accountLabel: report.accountLabel || 'Google Business Profile', windowLabel: 'Last 28 complete days',
    metrics: report.metrics ? googleReportMetrics(report.metrics) : [],
    locations: report.locations || [], locationName: report.locationName, period: report.period,
    updatedAt: report.updatedAt, stale: Boolean(report.stale), message: report.message,
  };
}

export async function linkSharedGoogle(reconnect = false): Promise<void> {
  const token = !reconnect && getStoredToken('google')?.refreshToken ? getStoredToken('google')! : await startOAuthPopup('google');
  if (!token.refreshToken) throw new Error('Google did not grant offline access. Authorise again to keep the shop connected.');
  const result = await request('POST', { refreshToken: token.refreshToken });
  if (!result?.connected) throw new Error('Sign in as a staff administrator to link Google.');
  // The server now owns the connection; devices no longer need personal Google tokens.
  disconnectProvider('google');
}

export async function disconnectSharedGoogle(): Promise<void> {
  const result = await request('DELETE');
  if (!result) throw new Error('Sign in as a staff administrator.');
  disconnectProvider('google');
}
