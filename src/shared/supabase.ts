import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://lhojocpygcnkxvkrcuxh.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2pvY3B5Z2Nua3h2a3JjdXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzU2MTYsImV4cCI6MjEwNTg1MTYxNn0.RuSrHufSCEd3bwOzF3kYD5MKx9gI1TKK9apF3HWJeZ8';

export function getStoredSupabaseUrl(): string {
  try {
    const saved = localStorage.getItem('stakeys_supabase_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_SUPABASE_URL;
}

export function getStoredSupabaseAnonKey(): string {
  try {
    const saved = localStorage.getItem('stakeys_supabase_anon_key');
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {}
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  try {
    localStorage.setItem('stakeys_supabase_url', url.trim().replace(/\/+$/, ''));
    localStorage.setItem('stakeys_supabase_anon_key', anonKey.trim());
  } catch {}
}

let cachedClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const url = getStoredSupabaseUrl();
  const anonKey = getStoredSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  if (cachedClient && currentClientUrl === url && currentClientKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentClientUrl = url;
    currentClientKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    return null;
  }
}
