/**
 * Resolves the Gemini model id for the in-browser AI features (AI Bike
 * Identifier + Shop Assistant + booking translation).
 *
 * Default is a **Flash-Lite** model: it is the cheapest tier, so it consumes the
 * least of the free-tier quota, and it still supports image input + structured
 * JSON output. Google retires specific versions for new API keys, so we use the
 * `gemini-flash-lite-latest` alias, which always resolves to a currently-served
 * Lite model. Pin an exact version with VITE_GEMINI_MODEL if ever needed.
 *
 * (The full `gemini-flash-latest` still works but drains quota far faster — the
 * free-tier project hit `429 RESOURCE_EXHAUSTED` on it, while the Lite models
 * kept answering.)
 */
const DEFAULT_GEMINI_MODEL = 'gemini-flash-lite-latest';

export function resolveGeminiModel(): string {
  const override =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GEMINI_MODEL
      : undefined;
  const value = typeof override === 'string' ? override.trim() : '';
  return value || DEFAULT_GEMINI_MODEL;
}

/** Lite models (the default) do not accept `thinkingConfig`; Flash 3.x requires it. */
export const isLiteModel = (model: string): boolean => /lite/i.test(model);

/**
 * Deterministic calls (translation, short factual assistant answers) must not
 * spend output budget "thinking". On Gemini 3.x Flash the hidden thinking tokens
 * are drawn from `maxOutputTokens`, so a small cap is consumed before the
 * visible answer finishes and the response is silently truncated — setting the
 * thinking budget to 0 fixes that.
 *
 * The Lite models used by default reject `thinkingConfig` outright (HTTP 400),
 * so this returns an empty object for them and the real config only for models
 * that support it. Spread the result into a call config: `...noThinking(model)`.
 */
export function noThinking(model: string = resolveGeminiModel()): { thinkingConfig?: { thinkingBudget: number } } {
  return isLiteModel(model) ? {} : { thinkingConfig: { thinkingBudget: 0 } };
}

/**
 * Backwards-compatible alias. Prefer `noThinking(model)` so a Lite model isn't
 * sent an unsupported `thinkingConfig`.
 */
export const NO_THINKING = { thinkingConfig: { thinkingBudget: 0 } } as const;
