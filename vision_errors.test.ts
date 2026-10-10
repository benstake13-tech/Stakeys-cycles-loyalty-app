import { describe, it, expect } from 'vitest';
import { classifyVisionError } from './src/api/visionErrors';

/** The exact body captured from the UI that started this bug report. */
const LIVE_503 =
  '{ "error": { "code": 503, "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.", "status": "UNAVAILABLE" } }';

describe('classifyVisionError', () => {
  it('maps the live 503 payload to MODEL_OVERLOADED with a friendly message', () => {
    const info = classifyVisionError(new Error(LIVE_503));
    expect(info.kind).toBe('MODEL_OVERLOADED');
    expect(info.retryable).toBe(true);
    expect(info.transient).toBe(true);
    expect(info.message).toMatch(/temporarily busy/i);
    // Never leak the raw JSON to the user.
    expect(info.message).not.toMatch(/[{}\[\]]/);
    expect(info.message).not.toContain('UNAVAILABLE');
  });

  it('treats 500 / 502 / 504 as overloaded and retryable', () => {
    for (const code of [500, 502, 504]) {
      const info = classifyVisionError(new Error(JSON.stringify({ error: { code } })));
      expect(info.kind).toBe('MODEL_OVERLOADED');
      expect(info.retryable).toBe(true);
    }
  });

  it('maps 429 to RATE_LIMITED', () => {
    const info = classifyVisionError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'));
    expect(info.kind).toBe('RATE_LIMITED');
    expect(info.retryable).toBe(true);
  });

  it('maps a depleted prepayment (402 / RESOURCE_EXHAUSTED) to a non-retryable QUOTA_EXHAUSTED', () => {
    // The exact body the Gemini SDK throws when prepayment credits run out.
    const body = JSON.stringify({
      error: {
        code: 402,
        message: 'Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.',
        status: 'RESOURCE_EXHAUSTED',
      },
    });
    const info = classifyVisionError(new Error(body));
    expect(info.kind).toBe('QUOTA_EXHAUSTED');
    expect(info.retryable).toBe(false);
    expect(info.transient).toBe(false);
    // Never leak the raw JSON, and don't mistake it for a transient rate limit.
    expect(info.message).not.toMatch(/[{}\[\]]/);
    expect(info.message).toMatch(/credits|billing|quota/i);
  });

  it('recognises an abort/timeout as TIMEOUT', () => {
    const abort = Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    expect(classifyVisionError(abort, { timedOut: true }).kind).toBe('TIMEOUT');
    expect(classifyVisionError(new Error('request timed out')).kind).toBe('TIMEOUT');
  });

  it('flags an unconfigured key as non-retryable', () => {
    const info = classifyVisionError(new Error('AI vision is not configured.'), { configured: false });
    expect(info.kind).toBe('NOT_CONFIGURED');
    expect(info.retryable).toBe(false);
  });

  it('recognises an offline/network failure', () => {
    expect(classifyVisionError(new Error('Failed to fetch')).kind).toBe('OFFLINE');
  });

  it('falls back to a generic retryable message for unknown errors', () => {
    const info = classifyVisionError(new Error('kaboom'));
    expect(info.kind).toBe('UNKNOWN');
    expect(info.retryable).toBe(true);
    expect(info.message).toMatch(/try again/i);
  });
});
