// The standalone guide only holds public Supabase configuration. Its Gemini
// credential is read by the Edge Function, never by this document.
let publicConfig;

export async function generateGuideGemini(request) {
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) {
      const generate = window.parent.__STAKEYS_GENERATE_GEMINI__;
      if (typeof generate === 'function') return await generate(request);
    }
  } catch (error) {
    // A gateway error from a callable bridge must be shown, not retried anonymously.
    if (error?.name !== 'SecurityError') throw error;
  }

  publicConfig ||= fetch(new URL('./gemini-config.json', import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Workshop AI gateway configuration is unavailable.');
      return response.json();
    }).catch(error => { publicConfig = undefined; throw error; });
  const { url, anonKey } = await publicConfig;
  if (!url || !anonKey) throw new Error('Workshop AI gateway is not configured.');
  const { abortSignal, httpOptions, thinkingConfig, ...config } = request.config || {};
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (abortSignal?.aborted) abort();
  abortSignal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/functions/v1/gemini-gateway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ contents: request.contents, config }),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.error) {
      const messages = {
        NOT_CONFIGURED: 'Set GEMINI_API_KEY in Supabase Edge Function secrets.',
        KEY_REJECTED: 'Google rejected the Gemini key stored in Supabase.',
        RATE_LIMITED: 'Gemini quota reached. Try again later.',
        MODEL_UNAVAILABLE: 'The Gemini model configured in Supabase is unavailable.',
        SERVICE_BUSY: 'Gemini is temporarily busy. Try again shortly.',
        BILLING_REQUIRED: 'Gemini returned Payment Required. Check billing and API access for the Google project linked to the Supabase Gemini key.',
      };
      throw new Error(messages[data.code] || 'Workshop AI request failed. Try again later.');
    }
    if (typeof data.text !== 'string') throw new Error('Invalid Workshop AI response.');
    return { text: data.text, model: data.model };
  } finally {
    clearTimeout(timeout);
    abortSignal?.removeEventListener('abort', abort);
  }
}
