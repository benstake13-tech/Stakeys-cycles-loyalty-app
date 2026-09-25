/**
 * Stakey's Cycles - PocketBase Client Configuration
 * Target URL: https://intelligent-traffic-icon-catherine.trycloudflare.com
 */
import PocketBase from 'pocketbase';

export const DEFAULT_POCKETBASE_URL =
  import.meta.env.VITE_POCKETBASE_URL || 'https://intelligent-traffic-icon-catherine.trycloudflare.com';

export function getStoredPocketBaseUrl(): string {
  try {
    const saved = localStorage.getItem('stakeys_pocketbase_url');
    if (saved && saved.trim()) {
      const trimmed = saved.trim().replace(/\/+$/, '');
      // Automatically migrate from old expired tunnel URL to the new one
      if (trimmed.includes('carrier-santa-district-newcastle.trycloudflare.com')) {
        localStorage.setItem('stakeys_pocketbase_url', DEFAULT_POCKETBASE_URL.replace(/\/+$/, ''));
        return DEFAULT_POCKETBASE_URL.replace(/\/+$/, '');
      }
      return trimmed;
    }
  } catch {}
  return DEFAULT_POCKETBASE_URL.replace(/\/+$/, '');
}

export const POCKETBASE_URL = getStoredPocketBaseUrl();

export const pb = new PocketBase(POCKETBASE_URL);

// Disable auto-cancellation for parallel requests
pb.autoCancellation(false);

export function setPocketBaseUrl(newUrl: string): string {
  const cleanUrl = newUrl.trim().replace(/\/+$/, '');
  try {
    localStorage.setItem('stakeys_pocketbase_url', cleanUrl);
    pb.baseUrl = cleanUrl;
  } catch {}
  return cleanUrl;
}

export default pb;
