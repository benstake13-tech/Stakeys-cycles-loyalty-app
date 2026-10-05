import React, { useState, useEffect } from 'react';
import {
  Server,
  Cloud,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Settings,
  Wifi,
  WifiOff,
  Copy,
  Check,
  Globe,
  Terminal,
  Database,
  Key,
  Code2,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import {
  checkSupabaseHealth,
  SupabaseHealthStatus,
  SUPABASE_SQL_SETUP,
} from '../shared/api/supabaseService';
import {
  getStoredSupabaseUrl,
  getStoredSupabaseAnonKey,
  saveSupabaseConfig,
} from '../shared/supabase';

interface ServiceStatusBadgeProps {
  variant?: 'compact' | 'full' | 'header';
}

export const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({ variant = 'full' }) => {
  const { serviceStatus, checkServiceHealth, updatePocketBaseTargetUrl } = useShop();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'supabase' | 'pocketbase'>('supabase');

  // PocketBase state
  const [isPingingPb, setIsPingingPb] = useState(false);
  const [pbUrlInput, setPbUrlInput] = useState(serviceStatus.url);
  const [pbUrlFeedback, setPbUrlFeedback] = useState<string | null>(null);

  // Supabase state
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(getStoredSupabaseUrl());
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(getStoredSupabaseAnonKey());
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseHealthStatus>({
    isConfigured: Boolean(getStoredSupabaseAnonKey()),
    isOnline: false,
    url: getStoredSupabaseUrl(),
    hasAnonKey: Boolean(getStoredSupabaseAnonKey()),
    checkedAt: 'Not tested',
  });
  const [isPingingSupabase, setIsPingingSupabase] = useState(false);
  const [supabaseFeedback, setSupabaseFeedback] = useState<string | null>(null);

  // Copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Test Supabase on mount
  useEffect(() => {
    runSupabaseHealthTest();
  }, []);

  const runSupabaseHealthTest = async (url?: string, anonKey?: string) => {
    setIsPingingSupabase(true);
    try {
      const res = await checkSupabaseHealth(url || supabaseUrlInput, anonKey !== undefined ? anonKey : supabaseAnonKeyInput);
      setSupabaseStatus(res);
      return res;
    } finally {
      setIsPingingSupabase(false);
    }
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrlInput, supabaseAnonKeyInput);
    const res = await runSupabaseHealthTest(supabaseUrlInput, supabaseAnonKeyInput);
    if (res.isOnline) {
      setSupabaseFeedback('Supabase Cloud connected & online!');
    } else {
      setSupabaseFeedback(res.error || 'Config saved, testing connection...');
    }
    setTimeout(() => setSupabaseFeedback(null), 5000);
  };

  const handlePingPb = async (urlToTest?: string) => {
    setIsPingingPb(true);
    try {
      await checkServiceHealth(urlToTest);
    } finally {
      setIsPingingPb(false);
    }
  };

  const handleSavePbUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pbUrlInput.trim()) return;
    setIsPingingPb(true);
    try {
      const res = await updatePocketBaseTargetUrl(pbUrlInput.trim());
      if (res.isOnline) {
        setPbUrlFeedback('PocketBase connection verified & active!');
      } else {
        setPbUrlFeedback(`Saved, but service unreachable (${res.error || 'Check tunnel'}).`);
      }
      setTimeout(() => setPbUrlFeedback(null), 4000);
    } finally {
      setIsPingingPb(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isPbOnline = serviceStatus.isOnline;
  const isSupaOnline = supabaseStatus.isOnline;
  const schemaDriftCount =
    (supabaseStatus.schemaMissingColumns || 0) + (supabaseStatus.schemaMissingTables || 0);

  // Header compact badge
  if (variant === 'header') {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/60 border border-slate-800 rounded-md text-[10px] text-slate-400 font-mono transition-all hover:bg-slate-800/60 cursor-pointer"
          title="Click to view Supabase & Backend Diagnostics"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isSupaOnline || isPbOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>{isSupaOnline ? 'Supabase: Online' : isPbOnline ? 'PocketBase: Online' : 'Backend Setup'}</span>
          {isSupaOnline && supabaseStatus.latencyMs !== undefined && (
            <span className="text-slate-600">({supabaseStatus.latencyMs}ms)</span>
          )}
        </button>

        {isModalOpen && renderModal()}
      </>
    );
  }

  // Full Station Bar Badge
  return (
    <>
      <div
        className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all ${
          isSupaOnline || isPbOnline
            ? 'bg-[#0d1612] border-emerald-500/30 shadow-lg shadow-emerald-950/20'
            : 'bg-[#141820] border-neutral-800 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isSupaOnline
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}
          >
            <Cloud className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                {isSupaOnline
                  ? 'Supabase Cloud (24/7 Online)'
                  : 'Supabase Project Linked'}
              </span>
              {isSupaOnline && supabaseStatus.latencyMs !== undefined ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {supabaseStatus.latencyMs} ms
                </span>
              ) : !supabaseStatus.hasAnonKey ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Waiting for Anon API Key
                </span>
              ) : null}
            </div>

            <p className="text-[11px] text-neutral-400 font-mono truncate max-w-xs sm:max-w-md">
              Host: <span className="text-neutral-200">{supabaseUrlInput}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => runSupabaseHealthTest()}
            disabled={isPingingSupabase}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/80 text-xs font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
            title="Ping Supabase Cloud Now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPingingSupabase ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isPingingSupabase ? 'Checking...' : 'Test Status'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>Connect &amp; Setup SQL</span>
          </button>
        </div>
      </div>

      {isModalOpen && renderModal()}
    </>
  );

  function renderModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Database &amp; Backend Configuration</h3>
                <p className="text-xs text-neutral-400">
                  Supabase Cloud (24/7 cross-device customer logins) &amp; Local PC options
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-neutral-800 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('supabase')}
              className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'supabase'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Supabase Cloud (24/7 Active)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pocketbase')}
              className={`pb-3 px-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer flex items-center gap-2 ${
                activeTab === 'pocketbase'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Local PC / PocketBase</span>
            </button>
          </div>

          {/* TAB 1: SUPABASE */}
          {activeTab === 'supabase' && (
            <div className="space-y-5">
              {/* Current Status Banner */}
              <div
                className={`p-4 rounded-2xl border ${
                  isSupaOnline
                    ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                    : 'bg-[#141820] border-neutral-800 text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isSupaOnline ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    <span className="font-bold text-sm">
                      {isSupaOnline
                        ? schemaDriftCount > 0
                          ? `Supabase Connected — ${schemaDriftCount} schema issue${schemaDriftCount === 1 ? '' : 's'} found`
                          : `Supabase Connected & Healthy (${supabaseStatus.latencyMs}ms)`
                        : supabaseStatus.hasAnonKey
                        ? supabaseStatus.error || 'Connection offline'
                        : 'Supabase Project Linked — Please enter your Anon API Key'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => runSupabaseHealthTest()}
                    disabled={isPingingSupabase}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    title="Ping Supabase"
                  >
                    <RefreshCw className={`w-4 h-4 ${isPingingSupabase ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                </div>
                <div className="text-xs font-mono text-neutral-400 mt-2 truncate">
                  Endpoint: {supabaseUrlInput}
                </div>
              </div>

              {isSupaOnline && schemaDriftCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">
                      {schemaDriftCount} schema issue{schemaDriftCount === 1 ? '' : 's'} detected.
                    </span>{' '}
                    The live project is missing {supabaseStatus.schemaMissingTables || 0} table(s) and{' '}
                    {supabaseStatus.schemaMissingColumns || 0} column(s) the app writes. Use{' '}
                    <strong>Fix Database Schema</strong> in the staff command bar to generate the sync SQL.
                  </div>
                </div>
              )}

              {/* Supabase Key Form */}
              <form onSubmit={handleSaveSupabase} className="space-y-4 bg-[#0a0d11] p-4 rounded-2xl border border-neutral-800">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">
                    Supabase Project URL:
                  </label>
                  <input
                    type="text"
                    value={supabaseUrlInput}
                    onChange={(e) => setSupabaseUrlInput(e.target.value)}
                    placeholder="https://lhojocpygcnkxvkrcuxh.supabase.co"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-neutral-300">
                      Supabase Anon (Public) API Key:
                    </label>
                    <a
                      href={`https://supabase.com/dashboard/project/lhojocpygcnkxvkrcuxh/settings/api`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      Find Key in Supabase Settings &rarr;
                    </a>
                  </div>
                  <input
                    type="password"
                    value={supabaseAnonKeyInput}
                    onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-neutral-400 mt-1">
                    In your Supabase Dashboard, click <strong>Project Settings &rarr; API &rarr; Project API keys &rarr; anon (public)</strong> and paste it here.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    disabled={isPingingSupabase}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    {isPingingSupabase ? 'Testing...' : 'Save & Connect Supabase'}
                  </button>

                  {supabaseFeedback && (
                    <span className="text-xs text-emerald-300 font-medium">
                      {supabaseFeedback}
                    </span>
                  )}
                </div>
              </form>

              {/* 1-Click Database Setup SQL */}
              <div className="p-4 rounded-2xl bg-[#0a0d11] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      1-Click Database Schema (SQL Script)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(SUPABASE_SQL_SETUP, 'sql')}
                    className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedText === 'sql' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText === 'sql' ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400">
                  Click <strong>Copy SQL Script</strong>, open the Supabase SQL Editor, paste and click <strong>Run</strong>. This will automatically create all tables (profiles, bookings, customer bikes, stamps, and prize wheels).
                </p>

                <div className="flex gap-2 pt-1">
                  <a
                    href="https://supabase.com/dashboard/project/lhojocpygcnkxvkrcuxh/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Open Supabase SQL Editor</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL PC POCKETBASE */}
          {activeTab === 'pocketbase' && (
            <div className="space-y-4">
              <form onSubmit={handleSavePbUrl} className="space-y-3 bg-[#0a0d11] p-4 rounded-2xl border border-neutral-800">
                <label className="block text-xs font-semibold text-neutral-300">
                  PocketBase Host / Cloudflare Tunnel URL:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pbUrlInput}
                    onChange={(e) => setPbUrlInput(e.target.value)}
                    placeholder="https://your-tunnel.trycloudflare.com or http://127.0.0.1:8090"
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isPingingPb}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isPingingPb ? 'Testing...' : 'Save & Test'}
                  </button>
                </div>

                {pbUrlFeedback && (
                  <div className="text-xs text-emerald-300 font-medium">
                    {pbUrlFeedback}
                  </div>
                )}
              </form>

              {/* Startup Commands */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200">1. Start PocketBase on your PC</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('./pocketbase serve --http="127.0.0.1:8090"', 'cmd1')}
                      className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 font-mono"
                    >
                      {copiedText === 'cmd1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === 'cmd1' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code className="block p-2 rounded-lg bg-neutral-900 text-emerald-300 font-mono text-[11px]">
                    ./pocketbase serve --http="127.0.0.1:8090"
                  </code>
                </div>

                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-200">2. Run Cloudflare Quick Tunnel</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('cloudflared tunnel --url http://127.0.0.1:8090', 'cmd2')}
                      className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 font-mono"
                    >
                      {copiedText === 'cmd2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === 'cmd2' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <code className="block p-2 rounded-lg bg-neutral-900 text-emerald-300 font-mono text-[11px]">
                    cloudflared tunnel --url http://127.0.0.1:8090
                  </code>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
};
