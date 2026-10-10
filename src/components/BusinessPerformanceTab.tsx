import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Facebook,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  Link2Off,
  Loader2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import {
  OAuthProvider,
  OAUTH_PROVIDERS,
  isProviderConfigured,
  getStoredToken,
  isTokenExpired,
  disconnectProvider,
  startOAuthPopup,
} from '../utils/oauthService';
import { fetchInsights, BusinessInsights, refreshServerManaged, isServerManaged } from '../utils/businessInsights';

interface ProviderState {
  insights: BusinessInsights | null;
  loading: boolean;
  error: string | null;
  authorising: boolean;
}

const emptyState: ProviderState = { insights: null, loading: false, error: null, authorising: false };

const PROVIDER_META: Record<OAuthProvider, { icon: React.FC<any>; accent: string; blurb: string }> = {
  google: {
    icon: Building2,
    accent: 'text-sky-400',
    blurb: 'Search & Maps views, website clicks, calls and direction requests.',
  },
  meta: {
    icon: Facebook,
    accent: 'text-blue-400',
    blurb: 'Facebook Page impressions, engagement, follows and audience.',
  },
};

export const BusinessPerformanceTab: React.FC = () => {
  const [states, setStates] = useState<Record<OAuthProvider, ProviderState>>({
    google: { ...emptyState },
    meta: { ...emptyState },
  });

  const patch = (provider: OAuthProvider, next: Partial<ProviderState>) =>
    setStates((prev) => ({ ...prev, [provider]: { ...prev[provider], ...next } }));

  const load = useCallback(async (provider: OAuthProvider) => {
    patch(provider, { loading: true, error: null });
    const insights = await fetchInsights(provider);
    patch(provider, { insights, loading: false });
  }, []);

  // On mount, always load Meta from the server-side token (no login), and load
  // Google only when it is already authorised in this browser.
  useEffect(() => {
    void (async () => {
      await refreshServerManaged();
      void load('meta');
      const googleToken = getStoredToken('google');
      if (googleToken && !isTokenExpired(googleToken)) void load('google');
    })();
  }, [load]);

  const handleConnect = async (provider: OAuthProvider) => {
    patch(provider, { authorising: true, error: null });
    try {
      await startOAuthPopup(provider);
      await load(provider);
    } catch (err: any) {
      patch(provider, { error: err?.message || 'Authorization failed.' });
    } finally {
      patch(provider, { authorising: false });
    }
  };

  const handleDisconnect = (provider: OAuthProvider) => {
    disconnectProvider(provider);
    patch(provider, { insights: null, error: null });
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-start gap-3 pb-4 border-b border-neutral-800">
          <TrendingUp className="w-6 h-6 text-emerald-500 shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-white">Google &amp; Meta Business Performance</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              How customers find the shop across Google Search, Maps, Facebook and Instagram.
              Meta results are read from a secure server-side token and appear here automatically,
              with no Facebook login. Google uses a one-time Authorise with Google connection.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
          {(['google', 'meta'] as OAuthProvider[]).map((provider) => {
            const meta = PROVIDER_META[provider];
            const state = states[provider];
            const configured = isProviderConfigured(provider);
            const token = getStoredToken(provider);
            const browserConnected = Boolean(token && !isTokenExpired(token));
            const serverManaged = isServerManaged(provider);
            const connected = browserConnected || serverManaged;
            // Meta is read entirely from the server-side token — it never shows a
            // link/authorise prompt, only results (or a note that the token is unset).
            const isMeta = provider === 'meta';
            const metaLive = isMeta && (state.insights?.metrics?.length ?? 0) > 0;
            const Icon = meta.icon;

            return (
              <div
                key={provider}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${meta.accent}`} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{OAUTH_PROVIDERS[provider].label}</div>
                      <div className="text-[11px] text-neutral-400">{meta.blurb}</div>
                    </div>
                  </div>

                  {connected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                      <ShieldCheck className="w-3 h-3" /> {serverManaged && !browserConnected ? 'Server linked' : 'Authorised'}
                    </span>
                  ) : isMeta && metaLive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold uppercase tracking-wide">
                      <ShieldCheck className="w-3 h-3" /> Live
                    </span>
                  ) : isMeta ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-400 text-[10px] font-bold uppercase tracking-wide">
                      <TriangleAlert className="w-3 h-3" /> Token not set
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-400 text-[10px] font-bold uppercase tracking-wide">
                      <Link2Off className="w-3 h-3" /> Not linked
                    </span>
                  )}
                </div>

                {!isMeta && !configured && !serverManaged && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-[11px] text-amber-300">
                    <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Set <code className="font-mono">{OAUTH_PROVIDERS[provider].clientIdEnv}</code> to
                      enable the “Authorise with Google” button.
                    </span>
                  </div>
                )}

                {serverManaged && !browserConnected && (
                  <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Read with the server-side Meta token — no Facebook login required.
                  </p>
                )}

                {connected && state.insights && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-neutral-400">
                        {state.insights.accountLabel} · {state.insights.windowLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => load(provider)}
                        className="text-neutral-400 hover:text-white transition-colors"
                        title="Refresh"
                      >
                        <RefreshCcw className={`w-3.5 h-3.5 ${state.loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    {state.insights.metrics.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {state.insights.metrics.map((metric, idx) => (
                          <div
                            key={idx}
                            className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-3"
                            title={metric.hint}
                          >
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                              {metric.label}
                            </div>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="text-lg font-black text-white tabular-nums">
                                {metric.value}
                              </span>
                              {metric.delta != null && (
                                <span
                                  className={`inline-flex items-center text-[10px] font-bold ${
                                    metric.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {metric.delta >= 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {Math.abs(metric.delta).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-neutral-500">
                        {state.insights.message || 'No metrics returned.'}
                      </p>
                    )}
                  </div>
                )}

                {!connected && state.insights && state.insights.message && (
                  <p className="text-[11px] text-neutral-500">{state.insights.message}</p>
                )}

                {state.error && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1.5">
                    <TriangleAlert className="w-3.5 h-3.5" /> {state.error}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                  {isMeta || serverManaged ? (
                    <button
                      type="button"
                      onClick={() => load(provider)}
                      className="pressable px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-2"
                    >
                      <RefreshCcw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  ) : browserConnected ? (
                    <button
                      type="button"
                      onClick={() => handleDisconnect(provider)}
                      className="pressable px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!configured || state.authorising}
                      onClick={() => handleConnect(provider)}
                      className="pressable px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {state.authorising ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                      Authorise with Google
                    </button>
                  )}

                  <a
                    href={
                      provider === 'google'
                        ? 'https://business.google.com/'
                        : 'https://business.facebook.com/'
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
                  >
                    Open dashboard <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
