/**
 * Resolves the Gemini model id for the in-browser AI features (AI Bike
 * Identifier + Shop Assistant).
 *
 * Google retires specific model versions for new API keys — `gemini-2.5-flash`
 * now returns 404 for keys created after its cut-off. The `gemini-flash-latest`
 * alias always resolves to a currently-served Flash model, so it is the safe
 * default. Pin an exact version with VITE_GEMINI_MODEL if ever needed.
 */
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export function resolveGeminiModel(): string {
  const override =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GEMINI_MODEL
      : undefined;
  const value = typeof override === 'string' ? override.trim() : '';
  return value || DEFAULT_GEMINI_MODEL;
}

/**
 * Deterministic calls (translation, short factual assistant answers) must not
 * spend output budget "thinking". On Gemini 3.x the hidden thinking tokens are
 * drawn from `maxOutputTokens`, so a small cap (the old 400) is consumed before
 * the visible answer finishes and the response is silently truncated. Setting
 * the thinking budget to 0 returns the full answer within a modest token cap.
 */
export const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } } as const;
