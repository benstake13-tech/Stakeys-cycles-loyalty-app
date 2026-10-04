import { getSupabaseClient, getStoredSupabaseUrl, getStoredSupabaseAnonKey, saveSupabaseConfig } from '../supabase';
import { UserProfile, CustomerBike, ServiceBooking, StampLog, PrizeWheel, PrizeDraw } from '../types/bikeShop';
import { auditLiveSchema, generateSchemaSyncSql } from '../utils/schemaSync';

export interface SupabaseHealthStatus {
  isConfigured: boolean;
  isOnline: boolean;
  url: string;
  hasAnonKey: boolean;
  latencyMs?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  checkedAt: string;
  /** Live schema columns the app expects but the project is missing. */
  schemaMissingColumns?: number;
  /** Live tables the app expects but the project is missing. */
  schemaMissingTables?: number;
}

export async function checkSupabaseHealth(customUrl?: string, customAnonKey?: string): Promise<SupabaseHealthStatus> {
  const url = (customUrl || getStoredSupabaseUrl()).replace(/\/+$/, '');
  const anonKey = customAnonKey !== undefined ? customAnonKey.trim() : getStoredSupabaseAnonKey();

  if (!anonKey) {
    return {
      isConfigured: false,
      isOnline: false,
      url,
      hasAnonKey: false,
      error: 'Supabase URL is linked, but Anon Public API Key is required.',
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }

  const startTime = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    // Verify Anon Key against Supabase Auth gateway
    const res = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (res.ok || res.status === 200) {
      // Audit the live project against the schema the app actually writes.
      let schemaMissingColumns = 0;
      let schemaMissingTables = 0;
      let schemaNote = '';
      try {
        const audit = await auditLiveSchema(url, anonKey);
        if (audit.reachable) {
          schemaMissingColumns = audit.missingColumns.length;
          schemaMissingTables = audit.missingTables.length;
          if (audit.healthy) {
            schemaNote = ' (Database schema in sync)';
          } else {
            schemaNote = ` (Schema drift: ${schemaMissingTables} table(s), ${schemaMissingColumns} column(s) missing — use Fix Database Schema)`;
          }
        } else {
          schemaNote = ' (Could not audit schema)';
        }
      } catch {
        schemaNote = ' (Could not audit schema)';
      }

      return {
        isConfigured: true,
        isOnline: true,
        url,
        hasAnonKey: true,
        latencyMs,
        statusCode: res.status,
        message: `Supabase Cloud is ONLINE & authenticated (${latencyMs}ms)${schemaNote}`,
        schemaMissingColumns,
        schemaMissingTables,
        checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    }

    let errDetail = `HTTP ${res.status}: ${res.statusText}`;
    if (res.status === 401) {
      errDetail = 'Invalid Anon API Key. Please verify your Project API Key from Supabase Settings -> API.';
    }

    return {
      isConfigured: true,
      isOnline: false,
      url,
      hasAnonKey: true,
      latencyMs,
      statusCode: res.status,
      error: errDetail,
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      isConfigured: true,
      isOnline: false,
      url,
      hasAnonKey: true,
      latencyMs,
      error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot reach Supabase host'),
      checkedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  }
}

export const SUPABASE_SQL_SETUP = generateSchemaSyncSql();
// Kept as a constant export so the existing Service Status panel keeps a
// one-click copy button; the generator is the single source of truth.

