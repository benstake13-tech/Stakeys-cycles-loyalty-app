import { describe, expect, it, afterEach, vi } from 'vitest';
import { resolveGeminiModel } from './src/api/geminiModel';

describe('resolveGeminiModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the gemini-flash-latest alias when unset', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', '');
    expect(resolveGeminiModel()).toBe('gemini-flash-latest');
  });

  it('honours an explicit override', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', 'gemini-3.8-flash');
    expect(resolveGeminiModel()).toBe('gemini-3.8-flash');
  });

  it('trims whitespace and ignores a blank override', () => {
    vi.stubEnv('VITE_GEMINI_MODEL', '   ');
    expect(resolveGeminiModel()).toBe('gemini-flash-latest');
    vi.stubEnv('VITE_GEMINI_MODEL', '  gemini-2.5-flash  ');
    expect(resolveGeminiModel()).toBe('gemini-2.5-flash');
  });
});
