import { useSyncExternalStore } from 'react';
import { DEFAULT_WEBSITE_CONTENT } from '../data/websiteContent';
import { supabase } from '../lib/supabase';
import { WebsiteContent } from '../types/websiteContent';

/**
 * Reactive, SSR-safe website-content store.
 *
 * Staff edits persist per-device in localStorage so the public Website tab
 * always reflects what staff published in the staff station. The store is a
 * module singleton (no provider needed); `useWebsiteContent` subscribes via
 * `useSyncExternalStore` so every edit instantly re-renders the preview.
 *
 * Live Supabase persistence is only attempted when the `app_settings`
 * table already has a `website_content_json` column — anon credentials cannot
 * run DDL,so we never create it. If the column exists,we upsert it on save
 * so edits follow staff across devices; otherwise we stay local-only.
 */
const STORAGE_KEY = 'stakeys.website_content.v2';

/**
 * Earlier drafts live under v1 and still carry the seeded demo stock. Bumping
 * the key drops that stale shelf on the next load; we also actively remove the
 * old key so it can never be resurrected by a downgrade or a second tab.
 */
const LEGACY_STORAGE_KEYS = ['stakeys.website_content.v1'];

let cached: WebsiteContent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function clone(content: WebsiteContent): WebsiteContent {
  return JSON.parse(JSON.stringify(content)) as WebsiteContent;
}

export function getWebsiteContent(): WebsiteContent {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      try {
        window.localStorage.removeItem(legacyKey);
      } catch {
        // Ignore storage failures (private mode); the new key still wins.
      }
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WebsiteContent>;
        const merged = { ...clone(DEFAULT_WEBSITE_CONTENT), ...parsed };
        // Saved drafts predate stock tracking; default it so the shop never
        // renders "undefined in stock" or lets the basket exceed inventory.
        merged.products = merged.products.map((p) => ({ ...p, stock: p.stock ?? 1 }));
        // Saved drafts also predate the shop disclaimers; fall back to the
        // defaults so the checkout never renders an empty notice area.
        merged.shopDisclaimers = merged.shopDisclaimers ?? clone(DEFAULT_WEBSITE_CONTENT).shopDisclaimers;
        merged.siteAnnouncements = merged.siteAnnouncements ?? clone(DEFAULT_WEBSITE_CONTENT).siteAnnouncements;
        cached = merged;
        return cached!;
      }
    } catch (err) {
      console.error('[WEBSITE CONTENT] Failed to parse saved content:', err);
    }
  }
  cached = clone(DEFAULT_WEBSITE_CONTENT);
  return cached!;
}

function save(candidate: WebsiteContent): void {
  cached = candidate;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
    } catch (err) {
      console.error('[WEBSITE CONTENT] Failed to persist content:', err);
    }
  }
  notify();
}

export function updateWebsiteContent(patch: Partial<WebsiteContent>): void {
  const next = clone(getWebsiteContent());
  Object.assign(next, patch);
  next.updatedAt = new Date().toISOString();
  save(next);
  void persistToSupabase(next);
}

export function resetWebsiteContent(): void {
  const fresh = clone(DEFAULT_WEBSITE_CONTENT);
  save(fresh);
  void persistToSupabase(fresh);
}

let columnProbeState: 'unknown' | 'absent' | 'present' = 'unknown';
async function persistToSupabase(content: WebsiteContent): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    // Probe once whether app_settings already carries a website_content_json
    // column. Anon credentials cannot run DDL,so we never create it — if the
    // column is absent we simply stay local-only and try again next session.

    if (columnProbeState === 'absent') return false;
    if (columnProbeState === 'unknown') {
      const probe = await supabase
        .from('app_settings')
        .select('website_content_json')
        .eq('id', 1)
        .maybeSingle();
      if (probe.error) {
        columnProbeState = 'absent';
        return false;
      }
      columnProbeState = 'present';
    }
    const { error } = await supabase
      .from('app_settings')
      .update({ website_content_json: content })
      .eq('id', 1);
    return !error;
  } catch (err) {
    console.error('[WEBSITE CONTENT] Supabase persistence skipped:', err);
    return false;
  }
}

function subscribeWebsiteContent(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useWebsiteContent(): WebsiteContent {
  const snapshot = useSyncExternalStore(subscribeWebsiteContent, getWebsiteContent);
  return snapshot;
}