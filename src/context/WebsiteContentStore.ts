import { useSyncExternalStore } from 'react';
import { DEFAULT_WEBSITE_CONTENT } from '../data/websiteContent';
import { supabase } from '../lib/supabase';
import { WebsiteContent } from '../types/websiteContent';

/** Shared website content. A publication is acknowledged only after the server
 * returns the saved document; local storage is a read cache, not publication. */
const STORAGE_KEY = 'stakeys.website_content.v3';

/**
 * Earlier drafts live under v1/v2 and still carry the poor-quality gallery and
 * location photos imported from the old site. Bumping the key drops that stale
 * content on the next load; we also actively remove the old keys so it can
 * never be resurrected by a downgrade or a second tab.
 */
const LEGACY_STORAGE_KEYS = [
  'stakeys.website_content.v1',
  'stakeys.website_content.v2',
];

/**
 * The old marketing site's CDN. Images carried over from it were low quality
 * and staff have asked for them gone, so a saved draft is scrubbed of them on
 * load rather than only resetting fresh installs.
 */
const LEGACY_IMAGE_HOST = 'cdn6.editmysite.com';

function isCarriedImage(url: string | undefined): boolean {
  return typeof url === 'string' && url.includes(LEGACY_IMAGE_HOST);
}

let cached: WebsiteContent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function clone(content: WebsiteContent): WebsiteContent {
  return JSON.parse(JSON.stringify(content)) as WebsiteContent;
}

/**
 * Saved drafts (and Supabase rows) can predate newer content fields. Fill any
 * missing brand-story block/arrays from the defaults so the Home page never
 * renders a blank section for a returning visitor.
 */
function normalizeContent(content: WebsiteContent): WebsiteContent {
  const defaults = clone(DEFAULT_WEBSITE_CONTENT);
  const brand = { ...defaults.brandStory, ...(content.brandStory || {}) };
  brand.bullets = brand.bullets?.length ? brand.bullets : defaults.brandStory.bullets;
  brand.howWeWorkSteps = brand.howWeWorkSteps?.length ? brand.howWeWorkSteps : defaults.brandStory.howWeWorkSteps;
  return { ...content, brandStory: brand };
}

let isSyncing = false;
let publishRevision = 0;
let publicationInFlight = false;
export async function syncFromSupabase(): Promise<void> {
  if (isSyncing || publicationInFlight || typeof window === 'undefined') return;
  isSyncing = true;
  const revision = publishRevision;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('website_content_json')
      .eq('id', 1)
      .maybeSingle();
    if (revision !== publishRevision) return;
    if (!error && data && data.website_content_json) {
      const parsed = data.website_content_json as any;
      const merged = { ...clone(DEFAULT_WEBSITE_CONTENT), ...parsed };
      merged.products = (merged.products || []).map((p: any) => {
        return { ...p, stock: p.stock ?? 1 };
      });
      merged.shopDisclaimers = merged.shopDisclaimers ?? clone(DEFAULT_WEBSITE_CONTENT).shopDisclaimers;
      merged.siteAnnouncements = merged.siteAnnouncements ?? clone(DEFAULT_WEBSITE_CONTENT).siteAnnouncements;
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch { /* Remote publication remains authoritative if the cache is full. */ }
      cached = normalizeContent(merged);
      notify();
      console.log('[WEBSITE CONTENT] Successfully synchronized with Supabase.');
    }
  } catch (err) {
    console.error('[WEBSITE CONTENT] Failed to sync from Supabase:', err);
  } finally {
    isSyncing = false;
  }
}

export function getWebsiteContent(): WebsiteContent {
  if (cached) return cached;
  void syncFromSupabase();
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
        // Drop the poor-quality photos carried over from the old site so a
        // returning visitor's saved draft is cleaned, not just new installs.
        if (isCarriedImage(merged.locationImage)) merged.locationImage = '';
        merged.galleryImages = (merged.galleryImages ?? []).filter((g) => !isCarriedImage(g.url));
        cached = normalizeContent(merged);
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

export async function updateWebsiteContent(patch: Partial<WebsiteContent>): Promise<WebsiteContent> {
  const next = clone(getWebsiteContent());
  Object.assign(next, patch);
  next.updatedAt = new Date().toISOString();
  publishRevision++; publicationInFlight = true;
  try { const published = await persistToSupabase(next); save(published); return published; } finally { publicationInFlight = false; }
}

export async function resetWebsiteContent(): Promise<void> {
  const fresh = clone(DEFAULT_WEBSITE_CONTENT);
  publishRevision++; publicationInFlight = true;
  try { save(await persistToSupabase(fresh)); } finally { publicationInFlight = false; }
}

async function persistToSupabase(content: WebsiteContent): Promise<WebsiteContent> {
  const { data, error } = await supabase.from('app_settings')
    .update({ website_content_json: content }).eq('id', 1)
    .select('website_content_json').single();
  if (error) throw new Error(`Website was not published: ${error.message}. Check website_content_json and staff permissions.`);
  if (!data?.website_content_json || JSON.stringify(data.website_content_json) === '{}') {
    throw new Error('Website was not published: no saved content was returned. Check the settings row and staff permissions.');
  }
  const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
  if (canonical(data.website_content_json) !== canonical(content)) throw new Error('Website was not published: the saved document did not match your draft. Your edits are still available to retry.');
  return normalizeContent(data.website_content_json as WebsiteContent);
}

let syncTimer: ReturnType<typeof setInterval> | undefined;
function refreshVisible() { if (typeof document !== 'undefined' && !document.hidden) void syncFromSupabase(); }
function subscribeWebsiteContent(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    syncTimer = setInterval(refreshVisible, 30000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('storage', refreshVisible);
  }
  return () => {
    listeners.delete(onChange);
    if (!listeners.size && typeof window !== 'undefined') {
      clearInterval(syncTimer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('storage', refreshVisible);
    }
  };
}

export function useWebsiteContent(): WebsiteContent {
  const snapshot = useSyncExternalStore(subscribeWebsiteContent, getWebsiteContent);
  return snapshot;
}