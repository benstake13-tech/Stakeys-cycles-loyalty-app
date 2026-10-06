import { supabase } from '../lib/supabase';

/**
 * Staff-managed shop assistant configuration.
 *
 * The assistant appears on the public website and the customer loyalty app.
 * Staff edit its name, greeting, tone, quick prompts and knowledge base from
 * the Staff Station → Assistant tab; this store persists that config locally
 * and to Supabase so the change reaches every visitor.
 */

export interface AssistantConfig {
  enabled: boolean;
  name: string;
  greeting: string;
  /** Personality brief handed to the model as a system instruction. */
  tone: string;
  quickPrompts: string[];
  /** Extra business knowledge staff want the assistant to use. */
  knowledge: string;
  /** Shown when the assistant cannot answer or is unavailable. */
  fallback: string;
  updatedAt: string;
}

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  enabled: true,
  name: "Stakey's Helper",
  greeting:
    "Hi, I'm the Stakey's Helper. Ask me about repairs, prices, opening hours, stock or how your loyalty pass works.",
  tone:
    "You are the friendly assistant for Stakey's Cycles & Scooter, a small independent cycle and e-scooter workshop in Salford. " +
    "Be warm, brief and practical. Use British English. Only use the facts provided to you; if you are unsure, say so and point the " +
    "customer to the workshop phone number rather than guessing. Never invent prices, stock levels or opening hours.",
  quickPrompts: [
    'How much is a full service?',
    'Do you repair e-scooters?',
    'How does the loyalty stamp card work?',
    'Can I book a repair today?',
  ],
  knowledge:
    "Workshop: Stakey's Cycles & Scooter, Salford, Greater Manchester. Repairs, servicing and second-hand parts and bikes. " +
    "Online orders are click & collect from the workshop. Loyalty: collect stamps on visits; a full card earns a reward. " +
    "Always confirm final prices with the workshop before quoting a customer.",
  fallback:
    "I'm not sure about that one — the quickest answer will come from the workshop directly. Please call or message the team and they'll help you straight away.",
  updatedAt: new Date().toISOString(),
};

const STORAGE_KEY = 'stakeys_assistant_config_v1';

let cached: AssistantConfig | null = null;
const listeners = new Set<(c: AssistantConfig) => void>();

function clone(config: AssistantConfig): AssistantConfig {
  return JSON.parse(JSON.stringify(config)) as AssistantConfig;
}

export function getAssistantConfig(): AssistantConfig {
  if (cached) return cached;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AssistantConfig>;
        cached = { ...clone(DEFAULT_ASSISTANT_CONFIG), ...parsed };
        return cached;
      }
    } catch (err) {
      console.error('[ASSISTANT] Failed to parse saved config:', err);
    }
  }
  cached = clone(DEFAULT_ASSISTANT_CONFIG);
  return cached;
}

export function updateAssistantConfig(patch: Partial<AssistantConfig>): void {
  const next = { ...clone(getAssistantConfig()), ...patch, updatedAt: new Date().toISOString() };
  cached = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('[ASSISTANT] Failed to persist config:', err);
    }
  }
  listeners.forEach((fn) => fn(next));
  void persistAssistantConfigToSupabase(next);
}

export function resetAssistantConfig(): void {
  updateAssistantConfig(DEFAULT_ASSISTANT_CONFIG);
}

export function subscribeAssistantConfig(fn: (c: AssistantConfig) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let columnProbeState: 'unknown' | 'absent' | 'present' = 'unknown';

async function persistAssistantConfigToSupabase(config: AssistantConfig): Promise<boolean> {
  try {
    if (columnProbeState === 'absent') return false;

    // Prefer the dedicated table; if the project predates it, fall back to the
    // shared app_settings key/value store so the config still reaches staff.
    const { error } = await supabase
      .from('assistant_config')
      .upsert({ id: 'default', config, updated_at: config.updatedAt }, { onConflict: 'id' });

    if (!error) {
      columnProbeState = 'present';
      return true;
    }

    if (error.code === '42P01' || error.code === 'PGRST205' || error.message?.includes('does not exist')) {
      columnProbeState = 'absent';
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert({ key: 'assistant_config', value: config }, { onConflict: 'key' });
      if (settingsError) {
        console.warn('[ASSISTANT] Config sync skipped:', settingsError.message);
        return false;
      }
      return true;
    }

    console.warn('[ASSISTANT] Config sync skipped:', error.message);
    return false;
  } catch (err) {
    console.warn('[ASSISTANT] Config sync exception:', err);
    return false;
  }
}
