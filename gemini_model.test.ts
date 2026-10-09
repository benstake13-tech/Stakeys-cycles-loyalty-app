import { describe, expect, it, afterEach, vi } from 'vitest';
import { resolveGeminiModel, isLiteModel, noThinking } from './src/api/geminiModel';

describe('resolveGeminiModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the least-quota Lite alias when unset', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', '');
    expect(resolveGeminiModel()).toBe('gemini-flash-lite-latest');
  });

  it('honours an explicit override', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-3.8-flash');
    expect(resolveGeminiModel()).toBe('gemini-3.8-flash');
  });

  it('trims whitespace and ignores a blank override', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', '   ');
    expect(resolveGeminiModel()).toBe('gemini-flash-lite-latest');
    vi.stubEnv('VITE_GEMINI_MODEL', '  gemini-2.5-flash  ');
    expect(resolveGeminiModel()).toBe('gemini-2.5-flash');
  });
});

describe('isLiteModel / noThinking', () => {
  it('detects Lite models', () => {
    expect(isLiteModel('gemini-flash-lite-latest')).toBe(true);
    expect(isLiteModel('gemini-3.1-flash-lite')).toBe(true);
    expect(isLiteModel('gemini-flash-latest')).toBe(false);
    expect(isLiteModel('gemini-3.8-flash')).toBe(false);
  });

  it('omits thinkingConfig for Lite models (they reject it with HTTP 400)', () => {
    expect(noThinking('gemini-flash-lite-latest')).toEqual({});
    expect(noThinking('gemini-3.1-flash-lite')).toEqual({});
  });

  it('sets a zero thinking budget for non-Lite Flash models', () => {
    expect(noThinking('gemini-flash-latest')).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    expect(noThinking('gemini-3.8-flash')).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
  });
});
