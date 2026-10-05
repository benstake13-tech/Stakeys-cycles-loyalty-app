import React, { useState } from 'react';
import {
  Code,
  Shield,
  Database,
  Layers,
  Copy,
  Check,
  FileCode,
  Lock,
  Server,
  Terminal,
} from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import { DEFAULT_SUPABASE_URL } from '../shared/supabase';

export const DeliverablesViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rls' | 'service' | 'schema' | 'guide'>('rls');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { users, prizeWheels, draws, stampLogs } = useShop();

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const supabaseRlsGuide = `-- SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- Run in Supabase SQL Editor to enable open public read/write access for cross-device syncing

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_bikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "Allow public select customer_bikes" ON public.customer_bikes FOR SELECT USING (true);
CREATE POLICY "Allow public insert customer_bikes" ON public.customer_bikes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update customer_bikes" ON public.customer_bikes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete customer_bikes" ON public.customer_bikes FOR DELETE USING (true);

CREATE POLICY "Allow public select service_bookings" ON public.service_bookings FOR SELECT USING (true);
CREATE POLICY "Allow public insert service_bookings" ON public.service_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update service_bookings" ON public.service_bookings FOR UPDATE USING (true);

CREATE POLICY "Allow public select stamp_logs" ON public.stamp_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert stamp_logs" ON public.stamp_logs FOR INSERT WITH CHECK (true);`;

  const supabaseServiceCode = `/**
 * Stakey's Cycles - Supabase Backend Synchronization Service
 * Cloud URL: https://lhojocpygcnkxvkrcuxh.supabase.co
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhojocpygcnkxvkrcuxh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1. Fetch Customer Bikes from Supabase
export async function fetchCustomerBikes(userId: string) {
  const { data, error } = await supabase
    .from('customer_bikes')
    .select('*')
    .eq('customer_id', userId);
  if (error) throw error;
  return data;
}

// 2. Insert Service Booking
export async function insertBooking(booking: any) {
  const { error } = await supabase
    .from('service_bookings')
    .insert(booking);
  if (error) throw error;
  return true;
}

// 3. Realtime Subscription across devices
export function subscribeToChanges(onChanged: () => void) {
  return supabase
    .channel('public-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public' }, () => {
      onChanged();
    })
    .subscribe();
}`;

  return (
    <div className="space-y-6 animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Server className="w-4 h-4 text-emerald-500" />
            Supabase Cloud Deliverables &amp; Architecture
          </div>
          <h2 className="text-2xl font-black text-white mt-1">Supabase Cloud Database &amp; Realtime</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Target Cloud URL: <code className="text-emerald-400 font-mono">{DEFAULT_SUPABASE_URL}</code> • RLS Policies, SQL Schema, and Realtime Sync.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800 text-xs">
          <button
            onClick={() => setActiveTab('rls')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'rls'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Supabase RLS Policies
          </button>

          <button
            onClick={() => setActiveTab('service')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'service'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            supabase.ts Client
          </button>

          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'schema'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            SQL Schema Setup
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20 font-bold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Cross-Device Guide
          </button>
        </div>
      </div>

      {/* Tab 1: RLS Policies */}
      {activeTab === 'rls' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Supabase Row Level Security (RLS) SQL
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Ensures cross-device requests and mobile cellular connections are fully authorized without HTTP 401/403 errors.
              </p>
            </div>
            <button
              onClick={() => handleCopy('rls', supabaseRlsGuide)}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey === 'rls' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'rls' ? 'Copied' : 'Copy SQL'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
            {supabaseRlsGuide}
          </pre>
        </div>
      )}

      {/* Tab 2: Service Code */}
      {activeTab === 'service' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                Supabase Client &amp; Realtime Service (`src/supabase.ts`)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Official `@supabase/supabase-js` client configuration with persistent sessions and automatic token refresh.
              </p>
            </div>
            <button
              onClick={() => handleCopy('service', supabaseServiceCode)}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedKey === 'service' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedKey === 'service' ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 font-mono text-xs text-neutral-200 overflow-x-auto leading-relaxed">
            {supabaseServiceCode}
          </pre>
        </div>
      )}

      {/* Tab 3: SQL Schema */}
      {activeTab === 'schema' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-400" />
                Supabase Database Tables (`supabase_setup.sql`)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Tables provisioned in Supabase cloud PostgreSQL for profiles, customer_bikes, service_bookings, and stamp_logs.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
            <div className="font-semibold text-emerald-400">Core Tables Configured:</div>
            <ul className="list-disc list-inside space-y-1.5 text-neutral-300">
              <li>
                <strong className="text-white font-mono">profiles</strong>: User accounts, membership numbers, roles, stamps &amp; tickets.
              </li>
              <li>
                <strong className="text-white font-mono">customer_bikes</strong>: Connected garage bikes, stock specs, and scraped component JSON.
              </li>
              <li>
                <strong className="text-white font-mono">service_bookings</strong>: Workshop appointments, status, staff notes, and approval records.
              </li>
              <li>
                <strong className="text-white font-mono">stamp_logs</strong>: Immutable visit stamp audit trail and reward logs.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 4: Guide */}
      {activeTab === 'guide' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Cross-Device &amp; Cross-Network Connectivity Guide
          </h3>

          <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-white">1. Cloud HTTPS Endpoint</div>
              <p className="text-neutral-400">
                All database calls target <code className="text-emerald-400 font-mono">https://lhojocpygcnkxvkrcuxh.supabase.co</code>, ensuring seamless connectivity over mobile cellular networks, external Wi-Fi, and different computers without local tunnel drops.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-white">2. Realtime WebSocket Synchronization</div>
              <p className="text-neutral-400">
                Supabase Realtime subscriptions automatically broadcast changes across devices when staff add stamps or customers book services.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
