import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The E-code AI assist used to swallow every Gemini failure and report "AI
 * assist is not configured", which misdiagnosed a real API failure (e.g. the
 * project's prepayment credits running out) as a missing key. These tests verify
 * the assist surfaces the classified error while still returning the
 * deterministic offline matches so the tech is never left empty-handed.
 */
const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent } };
  }),
}));

vi.mock('./src/api/geminiModel', () => ({
  resolveGeminiModel: () => 'gemini-flash-lite-latest',
  noThinking: () => ({}),
}));

beforeEach(() => {
  generateContent.mockReset();
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assistECodeLookup AI failure handling', () => {
  it('surfaces a depleted-quota error instead of reporting "not configured"', async () => {
    const body = JSON.stringify({
      error: {
        code: 402,
        message: 'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
        status: 'RESOURCE_EXHAUSTED',
      },
    });
    generateContent.mockRejectedValue(new Error(body));

    const { assistECodeLookup } = await import('./src/api/eVehicleCodeAssist');
    const result = await assistECodeLookup({
      category: 'electric_scooter',
      brand: 'Xiaomi',
      model: 'M365',
      symptom: 'it beeps E23 and the throttle does nothing',
    });

    // Falls back to deterministic matches, but reports the REAL cause.
    expect(result.source).toBe('offline');
    expect(result.error?.kind).toBe('QUOTA_EXHAUSTED');
    expect(result.error?.retryable).toBe(false);
    expect(result.guidance).toMatch(/credits|billing|quota/i);
    expect(result.guidance).not.toMatch(/not configured/i);
    // The deterministic fallback still finds the throttle code.
    expect(result.matches.some((m) => m.code === 'E23')).toBe(true);
  });

  it('does not set an error when the AI call succeeds', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ matches: [{ code: 'E23', title: 'Throttle', reason: 'throttle fault', confidence: 0.9 }], guidance: 'Check the throttle connector.' }),
    });

    const { assistECodeLookup } = await import('./src/api/eVehicleCodeAssist');
    const result = await assistECodeLookup({
      category: 'electric_scooter',
      brand: 'Xiaomi',
      model: 'M365',
      symptom: 'throttle dead',
    });

    expect(result.source).toBe('ai');
    expect(result.error).toBeUndefined();
    expect(result.matches[0].code).toBe('E23');
  });
});
