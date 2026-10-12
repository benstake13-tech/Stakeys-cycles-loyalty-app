import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('apiUrl — web build (no VITE_API_BASE_URL)', () => {
  it('keeps app-relative API paths unchanged so web stays same-origin', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();
    const { apiUrl, API_BASE_URL } = await import('./apiBase');
    expect(API_BASE_URL).toBe('');
    expect(apiUrl('/api/onesignal/config')).toBe('/api/onesignal/config');
    expect(apiUrl('/api/wallet/apple?x=1')).toBe('/api/wallet/apple?x=1');
  });

  it('passes absolute URLs through untouched', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.resetModules();
    const { apiUrl } = await import('./apiBase');
    expect(apiUrl('https://example.com/x')).toBe('https://example.com/x');
    expect(apiUrl('//cdn.example.com/x')).toBe('//cdn.example.com/x');
  });
});

describe('apiUrl — native build (VITE_API_BASE_URL set)', () => {
  it('makes every app-relative path absolute against the API origin', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://www.stakeys-cycles.co.uk');
    vi.resetModules();
    const { apiUrl, API_BASE_URL } = await import('./apiBase');
    expect(API_BASE_URL).toBe('https://www.stakeys-cycles.co.uk');
    expect(apiUrl('/api/sumup/config')).toBe('https://www.stakeys-cycles.co.uk/api/sumup/config');
    expect(apiUrl('api/onesignal/notify')).toBe('https://www.stakeys-cycles.co.uk/api/onesignal/notify');
  });

  it('trims a trailing slash from the configured base', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://www.stakeys-cycles.co.uk/');
    vi.resetModules();
    const { apiUrl } = await import('./apiBase');
    expect(apiUrl('/api/business/status')).toBe('https://www.stakeys-cycles.co.uk/api/business/status');
  });

  it('still leaves already-absolute URLs untouched', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://www.stakeys-cycles.co.uk');
    vi.resetModules();
    const { apiUrl } = await import('./apiBase');
    expect(apiUrl('https://accounts.google.com/o/oauth2/v2/auth')).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth'
    );
  });
});
