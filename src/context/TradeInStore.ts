import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reactive, SSR-safe trade-in / part-exchange lead store.
 *
 * A customer asks the workshop to value their old bike; the request is captured
 * as a lead and surfaced in the staff terminal. Persisted per-device in
 * localStorage; a best-effort Supabase sync mirrors leads into the
 * `app_settings` JSON column `tradein_json` when it already exists (anon
 * credentials cannot run DDL, so we never create it).
 */

const STORAGE_KEY = 'stakeys.tradein.v1';

export interface TradeInRequest {
  id: string;
  /** Signed-in customer who submitted it (when known). */
  customerUid?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  /** Details of the bike being traded in. */
  brand: string;
  model: string;
  year?: string;
  category?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  /** Free-text description of the bike's history / faults. */
  notes?: string;
  /** Optional photo as a data URL or storage URL. */
  photoUrl?: string;
  /** What the customer is interested in buying. */
  interestedIn?: string;
  status: 'new' | 'contacted' | 'valued' | 'closed';
  createdAt: string;
}

let cached: TradeInRequest[] | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function read(): TradeInRequest[] {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cached = parsed.filter((r) => r && typeof r.id === 'string');
          return cached;
        }
      }
    } catch {
      // Ignore malformed storage and start empty.
    }
  }
  cached = [];
  return cached;
}

function write(items: TradeInRequest[]): void {
  cached = items;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Best-effort persistence.
    }
  }
  notify();
  void persistToSupabase(items);
}

export function getTradeInRequests(): TradeInRequest[] {
  return read();
}

export function submitTradeInRequest(
  request: Omit<TradeInRequest, 'id' | 'status' | 'createdAt'>
): TradeInRequest {
  const entry: TradeInRequest = {
    ...request,
    id: `ti-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  write([entry, ...read()]);
  return entry;
}

export function updateTradeInStatus(id: string, status: TradeInRequest['status']): void {
  write(read().map((r) => (r.id === id ? { ...r, status } : r)));
}

export function deleteTradeInRequest(id: string): void {
  write(read().filter((r) => r.id !== id));
}

let columnProbe: 'unknown' | 'absent' | 'present' = 'unknown';
async function persistToSupabase(items: TradeInRequest[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (columnProbe === 'absent') return;
    if (columnProbe === 'unknown') {
      const probe = await supabase.from('app_settings').select('tradein_json').eq('id', 1).maybeSingle();
      if (probe.error) {
        columnProbe = 'absent';
        return;
      }
      columnProbe = 'present';
    }
    await supabase.from('app_settings').update({ tradein_json: items }).eq('id', 1);
  } catch {
    // Local-only is an acceptable degradation.
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useTradeInRequests(): TradeInRequest[] {
  return useSyncExternalStore(subscribe, getTradeInRequests);
}
