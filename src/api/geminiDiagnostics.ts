import { getSupabaseClient } from '../supabase';
import { generateGemini } from './geminiGateway';
import { resolveGeminiModel } from './geminiModel';
import type { GeminiTier } from './geminiModel';

export type GeminiDiagnosticStatus = 'pass' | 'fail' | 'skipped';
export type GeminiRepairAction = 'deploy' | 'secrets' | 'key' | 'quota' | 'session' | 'network' | null;

export interface GeminiDiagnosticStep {
  id: 'client' | 'gateway' | 'secret' | 'model';
  label: string;
  status: GeminiDiagnosticStatus;
  detail: string;
  repair?: string;
  repairAction?: GeminiRepairAction;
}

export interface GeminiDiagnosticReport {
  steps: GeminiDiagnosticStep[];
  model: string;
  tier: GeminiTier;
  passed: boolean;
}

interface InvokeResult {
  data?: Record<string, unknown> | null;
  error?: unknown;
}

interface DiagnosticClient {
  functions: {
    invoke: (name: string, options: { body: Record<string, unknown>; signal?: AbortSignal }) => Promise<InvokeResult>;
  };
}

interface GeminiDiagnosticDependencies {
  getClient: () => DiagnosticClient | null;
  generate: typeof generateGemini;
}

const defaultDependencies: GeminiDiagnosticDependencies = {
  getClient: () => getSupabaseClient() as unknown as DiagnosticClient | null,
  generate: generateGemini,
};

async function errorPayload(error: unknown): Promise<{ status?: number; code?: string; error?: string }> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    let body: Record<string, unknown> = {};
    try { body = await context.clone().json(); } catch { /* the status still identifies the gateway failure */ }
    return {
      status: context.status,
      code: typeof body.code === 'string' ? body.code : undefined,
      error: typeof body.error === 'string' ? body.error : undefined,
    };
  }
  return {};
}

function gatewayFailure(payload: { status?: number; code?: string; error?: string }): GeminiDiagnosticStep {
  if (payload.status === 404) {
    return {
      id: 'gateway', label: 'Gemini gateway', status: 'fail',
      detail: 'The gemini-gateway function was not found in this Supabase project.',
      repair: 'Deploy the latest gemini-gateway function, then run this check again.', repairAction: 'deploy',
    };
  }
  if (payload.status === 401) {
    return {
      id: 'gateway', label: 'Gemini gateway', status: 'fail',
      detail: 'Supabase rejected the function call because this app session is not authenticated.',
      repair: 'Sign out and back in to the staff app, then run this check again.', repairAction: 'session',
    };
  }
  if (payload.status === 400 && payload.error === 'Invalid contents') {
    return {
      id: 'gateway', label: 'Gemini gateway', status: 'fail',
      detail: 'The deployed gateway is reachable but does not support the new diagnostic action yet.',
      repair: 'Deploy the latest gemini-gateway function, then run this check again.', repairAction: 'deploy',
    };
  }
  if (payload.code === 'NOT_CONFIGURED') {
    return {
      id: 'secret', label: 'Supabase Gemini secret', status: 'fail',
      detail: 'The gateway cannot find a Gemini API key in its server secrets.',
      repair: 'Add the rotated key to Supabase Edge Function secrets as GEMINI_API_KEY. The key value is never shown in this app.',
      repairAction: 'secrets',
    };
  }
  return {
    id: 'gateway', label: 'Gemini gateway', status: 'fail',
    detail: payload.status ? `The gateway check returned HTTP ${payload.status}.` : 'The app could not reach the Gemini gateway.',
    repair: 'Check the Supabase project URL, function deployment, and network connection, then retry.',
    repairAction: payload.status ? 'deploy' : 'network',
  };
}

function liveRequestFailure(error: unknown): GeminiDiagnosticStep {
  const message = error instanceof Error ? error.message : String(error || 'Unknown Gemini error');
  const lower = message.toLowerCase();
  if (/not configured/.test(lower)) {
    return {
      id: 'secret', label: 'Supabase Gemini secret', status: 'fail', detail: message,
      repair: 'Add the rotated key to Supabase Edge Function secrets as GEMINI_API_KEY.', repairAction: 'secrets',
    };
  }
  if (/quota|rate limit/.test(lower)) {
    return {
      id: 'model', label: 'Gemini live request', status: 'fail', detail: message,
      repair: 'Check the Google AI Studio project quota. Keep the key on the Free Tier; this gateway has no paid fallback.', repairAction: 'quota',
    };
  }
  if (/billing|402|prepay/.test(lower)) {
    return {
      id: 'model', label: 'Gemini live request', status: 'fail', detail: message,
      repair: 'Use an AI Studio key from a project marked Free Tier. Paid fallback is disabled.', repairAction: 'quota',
    };
  }
  if (/key|rejected|api key/.test(lower)) {
    return {
      id: 'model', label: 'Gemini live request', status: 'fail', detail: message,
      repair: 'Replace GEMINI_API_KEY with a valid Google AI Studio key and check its API restrictions.', repairAction: 'key',
    };
  }
  if (/not deployed|404/.test(lower)) {
    return {
      id: 'gateway', label: 'Gemini gateway', status: 'fail', detail: message,
      repair: 'Deploy the latest gemini-gateway function, then run this check again.', repairAction: 'deploy',
    };
  }
  return {
    id: 'model', label: 'Gemini live request', status: 'fail', detail: message,
    repair: 'Check the live request error, Google AI Studio key status, Free Tier quota, and model availability.',
    repairAction: 'network',
  };
}

/**
 * Checks each layer separately: app config, deployed gateway, server-side key
 * presence, and a small live generation request. No secret value is returned.
 */
export async function runGeminiDiagnostics(
  dependencies: GeminiDiagnosticDependencies = defaultDependencies
): Promise<GeminiDiagnosticReport> {
  const steps: GeminiDiagnosticStep[] = [];
  const client = dependencies.getClient();
  let model = resolveGeminiModel();
  let tier: GeminiTier = 'free';
  if (!client?.functions?.invoke) {
    steps.push({
      id: 'client', label: 'Supabase app connection', status: 'fail',
      detail: 'This app build has no configured Supabase client.',
      repair: 'Check the app’s Supabase URL and public client key, then reopen the staff app.', repairAction: 'network',
    });
    return { steps, model, tier, passed: false };
  }
  steps.push({ id: 'client', label: 'Supabase app connection', status: 'pass', detail: 'Supabase client is configured.' });

  let diagnostic: InvokeResult;
  try {
    diagnostic = await client.functions.invoke('gemini-gateway', {
      body: { action: 'diagnostic' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    steps.push(gatewayFailure(await errorPayload(error)));
    return { steps, model, tier, passed: false };
  }
  if (diagnostic.error) {
    steps.push(gatewayFailure(await errorPayload(diagnostic.error)));
    return { steps, model, tier, passed: false };
  }
  if (diagnostic.data?.diagnostic !== true) {
    steps.push({
      id: 'gateway', label: 'Gemini gateway', status: 'fail',
      detail: 'The deployed function returned an unexpected diagnostic response.',
      repair: 'Deploy the latest gemini-gateway function, then run this check again.', repairAction: 'deploy',
    });
    return { steps, model, tier, passed: false };
  }
  if (typeof diagnostic.data.model === 'string') model = diagnostic.data.model;
  if (diagnostic.data.tier === 'paid') tier = 'paid';
  steps.push({ id: 'gateway', label: 'Gemini gateway', status: 'pass', detail: 'The deployed gateway is reachable and supports diagnostics.' });

  if (diagnostic.data.keyConfigured !== true) {
    steps.push({
      id: 'secret', label: 'Supabase Gemini secret', status: 'fail',
      detail: 'No Gemini key is configured in the gateway’s server secrets.',
      repair: 'Add the rotated Google AI Studio key in Supabase Edge Function secrets using the name GEMINI_API_KEY.',
      repairAction: 'secrets',
    });
    return { steps, model, tier, passed: false };
  }
  steps.push({ id: 'secret', label: 'Supabase Gemini secret', status: 'pass', detail: 'A server-side Gemini key is present. Its value is hidden.' });

  try {
    const result = await dependencies.generate({
      contents: [{ role: 'user', parts: [{ text: 'Reply with only the word OK.' }] }],
      config: { maxOutputTokens: 8, temperature: 0 },
    });
    if (!result.text.trim()) throw new Error('Gemini returned an empty response.');
    steps.push({ id: 'model', label: 'Gemini live request', status: 'pass', detail: `The server key and ${result.model || model} model completed a live test.` });
  } catch (error) {
    steps.push(liveRequestFailure(error));
  }
  return { steps, model, tier, passed: steps.every((step) => step.status === 'pass') };
}
