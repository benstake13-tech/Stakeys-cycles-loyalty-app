import { describe, it, expect } from 'vitest';
import { resolveAppId, resolveRestKey, resolveOrigin, DEFAULT_APP_ID } from './api/onesignal/_shared.js';

describe('OneSignal server config resolution', () => {
  it('finds the REST key under any accepted env name', () => {
    expect(resolveRestKey({ ONESIGNAL_REST_API_KEY: 'a' }).key).toBe('a');
    expect(resolveRestKey({ ONESIGNAL_API_KEY: 'b' }).source).toBe('ONESIGNAL_API_KEY');
    expect(resolveRestKey({ VITE_ONESIGNAL_REST_API_KEY: 'c' }).key).toBe('c');
  });

  it('trims whitespace and wrapping quotes from a pasted key', () => {
    expect(resolveRestKey({ ONESIGNAL_REST_API_KEY: '  "abc123"  ' }).key).toBe('abc123');
  });

  it('falls through a blank primary name to the next', () => {
    const r = resolveRestKey({ ONESIGNAL_REST_API_KEY: '   ', ONESIGNAL_API_KEY: 'real' });
    expect(r.key).toBe('real');
    expect(r.source).toBe('ONESIGNAL_API_KEY');
  });

  it('reports no key when nothing is set', () => {
    expect(resolveRestKey({})).toEqual({ key: null, source: null });
  });

  it('resolves the app id with a safe default', () => {
    expect(resolveAppId({ ONESIGNAL_APP_ID: 'x' })).toBe('x');
    expect(resolveAppId({})).toBe(DEFAULT_APP_ID);
  });

  it('derives the click-through origin from the request host', () => {
    const req = { headers: { host: 'stakey-cycles.co.uk', 'x-forwarded-proto': 'https' } };
    expect(resolveOrigin(req, {})).toBe('https://stakey-cycles.co.uk');
    expect(resolveOrigin(req, { APP_ORIGIN: 'https://custom.example' })).toBe('https://custom.example');
  });
});
