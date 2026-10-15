import { supabase } from '../lib/supabase';

/** Shared authenticated client for Gemini features; secrets stay in Supabase. */
export async function generateGemini(request: { contents: unknown[]; config?: Record<string, unknown> }) {
  const { data, error } = await supabase.functions.invoke('gemini-gateway', {
    body: { contents: request.contents, config: request.config || {} },
  });
  if (error) throw new Error(error.message || 'The AI gateway is temporarily unavailable.');
  if (data?.error) throw new Error(String(data.error));
  if (typeof data?.text !== 'string') throw new Error('The AI gateway returned an invalid response.');
  return data as { text: string; model?: string };
}
