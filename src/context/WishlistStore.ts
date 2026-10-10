import { useSyncExternalStore } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reactive, SSR-safe wishlist / "notify me" store.
 *
 * A customer can watch a shop product (or a category) and be told when similar
 * stock lands. Persisted per-device in localStorage; a best-effort Supabase
 * sync follows the customer across devices when the `app_settings` table
 * already carries a `wishlist_json` column (anon credentials cannot run DDL, so
 * we never create it — absent column simply stays local-only).
 */

const STORAGE_KEY = 'stakeys.wishlist.v1';

export interface WishlistItem {
  /** Product id (or a synthetic `category:<key>` id for a category watch). */
  productId: string;
  title: string;
  category?: string;
  imageUrl?: string;
  /** Stock level when it was watched; used to detect "back in stock". */
  stockAtWatch: number;
  addedAt: string;
}

let cached: WishlistItem[] | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function read(): WishlistItem[] {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cached = parsed.filter((i) => i && typeof i.productId === 'string');
          return cached;
        }
      }
    } catch {
      // Ignore malformed storage (private mode / older draft) and start empty.
    }
  }
  cached = [];
  return cached;
}

function write(items: WishlistItem[]): void {
  cached = items;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Persistence is best-effort; the in-memory list still drives the UI.
    }
  }
  notify();
  void persistToSupabase(items);
}

export function getWishlist(): WishlistItem[] {
  return read();
}

export function isWatched(productId: string): boolean {
  return read().some((i) => i.productId === productId);
}

export function addToWishlist(item: Omit<WishlistItem, 'addedAt'>): void {
  const items = read();
  if (items.some((i) => i.productId === item.productId)) return;
  write([{ ...item, addedAt: new Date().toISOString() }, ...items]);
}

export function removeFromWishlist(productId: string): void {
  write(read().filter((i) => i.productId !== productId));
}

export function toggleWishlist(item: Omit<WishlistItem, 'addedAt'>): boolean {
  if (isWatched(item.productId)) {
    removeFromWishlist(item.productId);
    return false;
  }
  addToWishlist(item);
  return true;
}

export function clearWishlist(): void {
  write([]);
}

/**
 * Items that were watched while out of stock and are now available — the
 * "back in stock" signal. `currentStock` maps a product id to its live level.
 */
export function backInStockItems(currentStock: Record<string, number>): WishlistItem[] {
  return read().filter((i) => i.stockAtWatch <= 0 && (currentStock[i.productId] ?? 0) > 0);
}

let columnProbe: 'unknown' | 'absent' | 'present' = 'unknown';
async function persistToSupabase(items: WishlistItem[]): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if (columnProbe === 'absent') return;
    if (columnProbe === 'unknown') {
      const probe = await supabase.from('app_settings').select('wishlist_json').eq('id', 1).maybeSingle();
      if (probe.error) {
        columnProbe = 'absent';
        return;
      }
      columnProbe = 'present';
    }
    await supabase.from('app_settings').update({ wishlist_json: items }).eq('id', 1);
  } catch {
    // Local-only is an acceptable degradation.
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useWishlist(): WishlistItem[] {
  return useSyncExternalStore(subscribe, getWishlist);
}
