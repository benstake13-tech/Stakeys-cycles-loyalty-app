/**
 * One client for all Gemini features. API keys stay in Supabase Edge Function
 * secrets; the frontend never reads VITE_GEMINI_API_KEY.
 */
import { supabase } from '../lib/supabase';

export const isGeminiGatewayConfigured = (): boolean => Boolean(supabase?.functions?.invoke);

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiContent = { role: string; parts: GeminiPart[] };
type GeminiRequest = {
  model?: string;
  contents: GeminiContent[];
  config?: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
    abortSignal?: AbortSignal;
    httpOptions?: unknown;
    thinkingConfig?: unknown;
  };
};
export const generateGemini = async (request: GeminiRequest): Promise<{ text: string; model?: string }> => {
  if (!isGeminiGatewayConfigured()) throw Error('Gemini gateway unavailable');
  const { abortSignal, httpOptions, thinkingConfig, ...config } = request.config || {};
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (abortSignal?.aborted) abort();
  abortSignal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30000);
  try {
  const { data, error } = await supabase.functions.invoke('gemini-gateway', {
    body: { contents: request.contents, config },
    signal: controller.signal,
  });
  if (error) {
    let detail: { code?: string; error?: string } = {};
    const response = error.context;
    if (response instanceof Response) {
      try { detail = await response.clone().json(); } catch { /* non-JSON gateway response */ }
    }
    const code = detail.code || (detail.error === 'GEMINI_API_KEY is not configured' ? 'NOT_CONFIGURED' : '');
    const messages: Record<string, string> = {
      NOT_CONFIGURED: 'The assistant needs GEMINI_API_KEY in Supabase Edge Function secrets.',
      KEY_REJECTED: 'Google rejected the assistant API key. Check the Gemini key and its API restrictions in Supabase.',
      RATE_LIMITED: 'The assistant has reached its Gemini quota. Please try again later.',
      MODEL_UNAVAILABLE: 'The latest Gemini Flash model is unavailable for this Google API project.',
      SERVICE_BUSY: 'Gemini is temporarily busy. Please try again shortly.',
      BILLING_REQUIRED: 'Gemini returned HTTP 402: Google says the project linked to this key has no usable prepay credits. For Free Tier, use an AI Studio key from a project marked Free Tier. Paid fallback is disabled.',
    };
    if (messages[code]) throw Error(messages[code]);
    if (response instanceof Response && response.status === 404) throw Error('The gemini-gateway function is not deployed in Supabase.');
    if (response instanceof Response && response.status === 401) throw Error('The assistant gateway could not authenticate this session. Please sign in again.');
    if (controller.signal.aborted) throw Error('The assistant request timed out. Please try again.');
    throw Error('The assistant cannot reach its AI service. Please try again.');
  }
  if (data?.error) throw Error(data.error);
  if (typeof data?.text !== 'string') throw Error('Invalid Gemini response');
  return { text: data.text, ...(typeof data.model === 'string' ? { model: data.model } : {}) };
  } finally {
    clearTimeout(timer);
    abortSignal?.removeEventListener('abort', abort);
  }
};
