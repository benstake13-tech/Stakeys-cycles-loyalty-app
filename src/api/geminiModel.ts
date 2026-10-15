export type GeminiTier = 'free' | 'paid';

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash · latest', free: true },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash · stable', free: true },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite · lower cost', free: true },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite · lower cost', free: true },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon · paid only', free: false },
] as const;

/** Server default used before the shared staff setting has been loaded. */
export function resolveGeminiModel(): string {
  return 'gemini-3.8-flash';
}

/** Recognises Lite model hints for backwards-compatible generation callers. */
export const isLiteModel = (model: string): boolean => /lite/i.test(model);

export function noThinking(model: string = resolveGeminiModel()): { thinkingConfig?: { thinkingBudget: number } } {
  return isLiteModel(model) ? {} : { thinkingConfig: { thinkingBudget: 0 } };
}

export const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } } as const;
