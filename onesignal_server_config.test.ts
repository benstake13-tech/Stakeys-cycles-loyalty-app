import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAppId, resolveRestKey, resolveOrigin, buildTagFilter, DEFAULT_APP_ID } from './api/onesignal/_shared.js';
import onesignalHandler from './api/onesignal/[action].js';
const notifyHandler = (req: any, res: any) =>
  onesignalHandler({ ...req, query: { ...(req?.query || {}), action: 'notify' } }, res);

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

describe('buildTagFilter', () => {
  it('always includes the required `relation` field', () => {
    expect(buildTagFilter({ key: 'owner_email', value: 'a@b.test' })).toEqual({
      field: 'tag',
      key: 'owner_email',
      relation: '=',
      value: 'a@b.test',
    });
  });

  it('trims whitespace and returns null for an incomplete tag', () => {
    expect(buildTagFilter({ key: '  owner_email ', value: ' x ' })).toEqual({
      field: 'tag',
      key: 'owner_email',
      relation: '=',
      value: 'x',
    });
    expect(buildTagFilter({ key: 'owner_email' })).toBeNull();
    expect(buildTagFilter({ value: 'x' })).toBeNull();
    expect(buildTagFilter(null)).toBeNull();
  });
});

describe('notify handler tag targeting', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ONESIGNAL_REST_API_KEY = 'test-rest-key';
  });

  afterEach(() => {
    delete process.env.ONESIGNAL_REST_API_KEY;
  });

  it('sends an owner-tagged push with a valid OneSignal filter (not a 0-device filter)', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: any) => ({
      status: 200,
      json: async () => ({ id: 'msg-1', recipients: 1 }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = {
      statusCode: 0,
      body: null as any,
      setHeader: vi.fn(),
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };

    await notifyHandler(
      {
        method: 'POST',
        body: {
          title: 'New booking',
          body: 'Details',
          tag: { key: 'owner_email', value: 'stakeyscycle95@gmail.com' },
        },
      },
      res
    );

    expect(res.statusCode).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.filters).toEqual([
      { field: 'tag', key: 'owner_email', relation: '=', value: 'stakeyscycle95@gmail.com' },
    ]);
    expect(sent.included_segments).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
