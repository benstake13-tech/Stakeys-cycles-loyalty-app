/**
 * Singleton Supabase Client (`src/lib/supabase.ts`)
 * Implements a singleton Supabase client using environment variables with debug console logging for network requests.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 
  (import.meta as any).env?.VITE_SUPABASE_URL || 
  'https://lhojocpygcnkxvkrcuxh.supabase.co';

const SUPABASE_ANON_KEY = 
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxob2pvY3B5Z2Nua3h2a3JjdXhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzU2MTYsImV4cCI6MjEwNTg1MTYxNn0.RuSrHufSCEd3bwOzF3kYD5MKx9gI1TKK9apF3HWJeZ8';

let instance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!instance) {
    console.log(`[SUPABASE SINGLETON] Initializing client with URL: ${SUPABASE_URL}`);
    instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return instance;
}

export const supabase = getSupabaseClient();
