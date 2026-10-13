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
export const generateGemini = async (request: GeminiRequest): Promise<{ text: string }> => {
  if (!isGeminiGatewayConfigured()) throw Error('Gemini gateway unavailable');
  const { abortSignal, httpOptions, thinkingConfig, ...config } = request.config || {};
  const { data, error } = await supabase.functions.invoke('gemini-gateway', {
    body: { contents: request.contents, config },
  });
  if (error) throw error;
  if (data?.error) throw Error(data.error);
  if (typeof data?.text !== 'string') throw Error('Invalid Gemini response');
  return { text: data.text };
};
