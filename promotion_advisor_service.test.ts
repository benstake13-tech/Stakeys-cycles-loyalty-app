import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return { models: { generateContent } };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING', NUMBER: 'NUMBER', ARRAY: 'ARRAY' },
}));

vi.mock('./src/api/geminiModel', () => ({
  resolveGeminiModel: () => 'gemini-flash-lite-latest',
  noThinking: () => ({}),
}));

import { advisePromotion, clearAdvisorCache, isPromotionAdvisorConfigured } from './src/api/promotionAdvisorService';
import { buildPromotionBrief } from './src/utils/promotionAdvisor';

const brief = () => buildPromotionBrief([], [], new Date(2026, 5, 15));

beforeEach(() => {
  generateContent.mockReset();
  clearAdvisorCache();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('advisePromotion', () => {
  it('returns the offline recommendation when no API key is configured', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
    expect(isPromotionAdvisorConfigured()).toBe(false);
    const result = await advisePromotion(brief());
    expect(result.source).toBe('offline');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('uses the AI response (on the lite model) when configured', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        headline: 'Focus on drivetrain services',
        actions: [
          {
            title: 'Drivetrain Week',
            rationale: 'High demand in summer.',
            discountPercentage: 15,
            categories: ['cycle', 'ebike'],
            startDate: '2026-06-20',
            endDate: '2026-06-26',
            audience: 'member',
            confidence: 0.8,
          },
        ],
      }),
    });
    const result = await advisePromotion(brief());
    expect(result.source).toBe('ai');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].title).toBe('Drivetrain Week');
    expect(result.actions[0].audience).toBe('member');
    // the low-quota lite model is what was asked for
    expect(generateContent.mock.calls[0][0].model).toBe('gemini-flash-lite-latest');
    // and the SDK's long default retry was disabled
    expect(generateContent.mock.calls[0][0].config.httpOptions.retryOptions.attempts).toBe(1);
  });

  it('caches the answer so a second call does not spend quota again', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    generateContent.mockResolvedValueOnce({
      text: JSON.stringify({
        headline: 'H',
        actions: [{ title: 'A', rationale: 'r', categories: ['cycle'], startDate: '2026-06-20', endDate: '2026-06-26' }],
      }),
    });
    const b = brief();
    const first = await advisePromotion(b);
    const second = await advisePromotion(b);
    expect(second).toStrictEqual(first);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('falls back to offline advice when the model errors (e.g. quota)', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    generateContent.mockRejectedValueOnce(
      new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')
    );
    const result = await advisePromotion(brief());
    expect(result.source).toBe('offline');
    expect(result.actions.length).toBeGreaterThan(0);
  });

  it('falls back to offline when the model returns an unusable payload', async () => {
    vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key');
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ headline: 'H', actions: [] }) });
    const result = await advisePromotion(brief());
    expect(result.source).toBe('offline');
  });
});
