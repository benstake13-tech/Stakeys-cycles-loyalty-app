import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// The shared module is plain JS (no type declarations), so import it untyped —
// these assertions are about runtime behaviour, not the inferred param shapes.
import * as sumupShared from './api/sumup/_shared.js';
import sumupHandler from './api/sumup/[action].js';

const {
  resolveSumupConfig,
  toSumupAmount,
  buildCheckoutReference,
  createCheckout,
  getCheckout,
  listReaders,
  createReaderCheckout,
  terminateReaderCheckout,
  sumupRequest,
  buildPaymentSwitchUrl,
  parsePaymentSwitchCallback,
  SUMUP_KEY_ENV_NAMES,
  SUMUP_MERCHANT_ENV_NAMES,
  SUMUP_AFFILIATE_ENV_NAMES,
} = sumupShared as any;

// The SumUp family is one Vercel function dispatched by path segment; these
// wrappers reproduce per-action handlers so assertions read like the old API.
const call = (action: string, req: any, res: any) =>
  sumupHandler({ ...req, query: { ...(req?.query || {}), action } }, res);

function mockRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  } as any;
}

function fetchStub(payload: any, ok = true, status = 200) {
  return vi.fn(async (_url: string, _init?: any) => ({ ok, status, text: async () => JSON.stringify(payload) }));
}

describe('resolveSumupConfig', () => {
  it('accepts any documented key/merchant env name', () => {
    expect(SUMUP_KEY_ENV_NAMES).toContain('SUMUP_API_KEY');
    expect(SUMUP_MERCHANT_ENV_NAMES).toContain('SUMUP_MERCHANT_CODE');
    const cfg = resolveSumupConfig({ SUMUP_API_KEY: 'sk', SUMUP_MERCHANT_CODE: 'ME7RMQN3' });
    expect(cfg.configured).toBe(true);
    expect(cfg.currency).toBe('GBP');
  });

  it('trims whitespace and wrapping quotes from a pasted key', () => {
    const cfg = resolveSumupConfig({ SUMUP_API_KEY: '  "sk_live_x"  ', SUMUP_MERCHANT_CODE: ' MC1 ' });
    expect(cfg.key).toBe('sk_live_x');
    expect(cfg.merchantCode).toBe('MC1');
  });

  it('is NOT configured unless both key and merchant code are present', () => {
    expect(resolveSumupConfig({ SUMUP_API_KEY: 'sk' }).configured).toBe(false);
    expect(resolveSumupConfig({ SUMUP_MERCHANT_CODE: 'MC' }).configured).toBe(false);
    expect(resolveSumupConfig({}).configured).toBe(false);
  });

  it('reports a configured reader and uppercases the currency', () => {
    const cfg = resolveSumupConfig({
      SUMUP_API_KEY: 'sk',
      SUMUP_MERCHANT_CODE: 'MC',
      SUMUP_READER_ID: 'rdr_1',
      SUMUP_CURRENCY: 'eur',
    });
    expect(cfg.readerId).toBe('rdr_1');
    expect(cfg.currency).toBe('EUR');
  });
});

describe('toSumupAmount', () => {
  it('rounds to two decimals (major units)', () => {
    expect(toSumupAmount(15)).toBe(15);
    expect(toSumupAmount(12.345)).toBe(12.35);
    expect(toSumupAmount('4.99')).toBe(4.99);
  });

  it('rejects zero, negative and non-numeric amounts', () => {
    expect(toSumupAmount(0)).toBeNull();
    expect(toSumupAmount(-5)).toBeNull();
    expect(toSumupAmount('abc')).toBeNull();
    expect(toSumupAmount(NaN)).toBeNull();
  });
});

describe('buildCheckoutReference', () => {
  it('is prefixed and unique', () => {
    const a = buildCheckoutReference('till');
    const b = buildCheckoutReference('till');
    expect(a.startsWith('till-')).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe('sumupRequest', () => {
  it('sends a bearer token and parses the JSON body', async () => {
    const fetchImpl = fetchStub({ id: 'chk_1' });
    const res = await sumupRequest('/v0.1/checkouts/chk_1', { key: 'sk', fetchImpl });
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ id: 'chk_1' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.sumup.com/v0.1/checkouts/chk_1');
    expect(init.headers.Authorization).toBe('Bearer sk');
  });

  it('surfaces a transport failure as ok:false without throwing', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: any) => {
      throw new Error('network down');
    });
    const res = await sumupRequest('/x', { key: 'sk', fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.data.error).toBe('network down');
  });

  it('falls back to { raw } when the body is not JSON', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: any) => ({ ok: true, status: 200, text: async () => 'not json' }));
    const res = await sumupRequest('/x', { key: 'sk', fetchImpl });
    expect(res.data).toEqual({ raw: 'not json' });
  });
});

describe('createCheckout payload', () => {
  it('posts merchant_code, amount and currency with a hosted-checkout flag', async () => {
    const fetchImpl = fetchStub({ id: 'chk_1', hosted_checkout_url: 'https://pay.sumup/x' });
    await createCheckout({
      amount: 15,
      currency: 'GBP',
      reference: 'ref-1',
      merchantCode: 'ME7RMQN3',
      key: 'sk',
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.sumup.com/v0.1/checkouts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      merchant_code: 'ME7RMQN3',
      amount: 15,
      currency: 'GBP',
      checkout_reference: 'ref-1',
      hosted_checkout: { enabled: true },
    });
  });
});

describe('reader helpers', () => {
  it('lists readers under the merchant path', async () => {
    const fetchImpl = fetchStub([{ id: 'rdr_1' }]);
    await listReaders({ merchantCode: 'MC1', key: 'sk', fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.sumup.com/v0.1/merchants/MC1/readers');
  });

  it('sends a minor-unit total when pushing to a reader', async () => {
    const fetchImpl = fetchStub({ data: {} });
    await createReaderCheckout({
      merchantCode: 'MC1',
      readerId: 'rdr_1',
      amount: 12.5,
      currency: 'GBP',
      key: 'sk',
      fetchImpl,
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.sumup.com/v0.1/merchants/MC1/readers/rdr_1/checkout');
    expect(JSON.parse(init.body).total_amount).toEqual({ currency: 'GBP', minor_unit: 2, value: 1250 });
  });

  it('terminates a reader checkout with DELETE', async () => {
    const fetchImpl = fetchStub({});
    await terminateReaderCheckout({ merchantCode: 'MC1', readerId: 'rdr_1', key: 'sk', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
  });
});

describe('sumup handler', () => {
  beforeEach(() => {
    process.env.SUMUP_API_KEY = 'sk_test';
    process.env.SUMUP_MERCHANT_CODE = 'ME7RMQN3';
  });
  afterEach(() => {
    delete process.env.SUMUP_API_KEY;
    delete process.env.SUMUP_MERCHANT_CODE;
    delete process.env.SUMUP_READER_ID;
    delete process.env.SUMUP_AFFILIATE_KEY;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('config reports configured + currency + reader flag', async () => {
    // A local .env may carry a real affiliate key; clear it so this assertion
    // is about the REST-key path only.
    delete process.env.SUMUP_AFFILIATE_KEY;
    process.env.SUMUP_READER_ID = 'rdr_1';
    const res = mockRes();
    await call('config', { method: 'GET' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ configured: true, tapToPay: false, currency: 'GBP', hasReader: true });
  });

  it('503s with a hint when SumUp is not configured', async () => {
    delete process.env.SUMUP_API_KEY;
    const res = mockRes();
    await call('config', { method: 'GET' }, res);
    expect(res.body.configured).toBe(false);

    const res2 = mockRes();
    await call('checkout', { method: 'POST', body: { amount: 10 } }, res2);
    expect(res2.statusCode).toBe(503);
    expect(res2.body.hint).toContain('SUMUP_API_KEY');
  });

  it('checkout returns the hosted pay URL from SumUp', async () => {
    vi.stubGlobal('fetch', fetchStub({ id: 'chk_9', status: 'PENDING', hosted_checkout_url: 'https://pay.sumup/chk_9' }));
    const res = mockRes();
    await call('checkout', { method: 'POST', body: { amount: 42.5, description: 'Gear service' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.checkoutId).toBe('chk_9');
    expect(res.body.hostedCheckoutUrl).toBe('https://pay.sumup/chk_9');
  });

  it('checkout rejects a non-positive amount before calling SumUp', async () => {
    const spy = fetchStub({});
    vi.stubGlobal('fetch', spy);
    const res = mockRes();
    await call('checkout', { method: 'POST', body: { amount: 0 } }, res);
    expect(res.statusCode).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('checkout-status requires an id and returns the status', async () => {
    const bad = mockRes();
    await call('checkout-status', { method: 'GET', query: {} }, bad);
    expect(bad.statusCode).toBe(400);

    vi.stubGlobal('fetch', fetchStub({ id: 'chk_9', status: 'PAID' }));
    const res = mockRes();
    await call('checkout-status', { method: 'GET', query: { id: 'chk_9' } }, res);
    expect(res.body).toEqual({ id: 'chk_9', status: 'PAID', raw: { id: 'chk_9', status: 'PAID' } });
  });

  it('rejects GET on POST-only actions with 405', async () => {
    const res = mockRes();
    await call('checkout', { method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('404s an unknown action', async () => {
    const res = mockRes();
    await call('nope', { method: 'GET' }, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('Tap to Pay (Payment Switch)', () => {
  afterEach(() => {
    delete process.env.SUMUP_AFFILIATE_KEY;
    delete process.env.SUMUP_API_KEY;
    delete process.env.SUMUP_MERCHANT_CODE;
  });

  it('is reported independently of the online-checkout config', () => {
    // Affiliate key alone => tapToPay on, configured (online) off.
    const cfg = resolveSumupConfig({ SUMUP_AFFILIATE_KEY: 'aff_123' });
    expect(cfg.tapToPay).toBe(true);
    expect(cfg.configured).toBe(false);
  });

  it('builds a sumupmerchant:// URL with amount, currency and callback', () => {
    const url = buildPaymentSwitchUrl({
      affiliateKey: 'aff_123',
      amount: 12.5,
      currency: 'GBP',
      title: 'Gear service',
      foreignTxId: 'till-1',
      callbackSuccess: 'https://till.example',
    });
    expect(url.startsWith('sumupmerchant://pay/1.0?')).toBe(true);
    const q = new URLSearchParams(url.split('?')[1]);
    expect(q.get('amount')).toBe('12.50');
    expect(q.get('currency')).toBe('GBP');
    expect(q.get('affiliate-key')).toBe('aff_123');
    expect(q.get('title')).toBe('Gear service');
    expect(q.get('foreign-tx-id')).toBe('till-1');
    expect(q.get('callbacksuccess')).toBe('https://till.example');
    expect(q.get('skip-screen-success')).toBe('true');
  });

  it('parses a success callback', () => {
    const r = parsePaymentSwitchCallback({
      'smp-status': 'success',
      'smp-tx-code': 'TX-1',
      'foreign-tx-id': 'till-1',
    });
    expect(r.ok).toBe(true);
    expect(r.txCode).toBe('TX-1');
    expect(r.foreignTxId).toBe('till-1');
  });

  it('treats failed and invalidstate callbacks as not ok', () => {
    expect(parsePaymentSwitchCallback({ 'smp-status': 'failed' }).ok).toBe(false);
    expect(parsePaymentSwitchCallback({ 'smp-status': 'invalidstate' }).status).toBe('invalidstate');
    expect(parsePaymentSwitchCallback({}).ok).toBe(false);
  });

  it('payment-switch-url returns a URL when the affiliate key is set', async () => {
    process.env.SUMUP_AFFILIATE_KEY = 'aff_123';
    const res = mockRes();
    await call(
      'payment-switch-url',
      { method: 'POST', body: { amount: 9.99, title: 'Inner tube', reference: 'till-9' } },
      res
    );
    expect(res.statusCode).toBe(200);
    const q = new URLSearchParams(String(res.body.url).split('?')[1]);
    expect(q.get('amount')).toBe('9.99');
    expect(q.get('affiliate-key')).toBe('aff_123');
    expect(q.get('foreign-tx-id')).toBe('till-9');
  });

  it('payment-switch-url 503s when no affiliate key is set', async () => {
    const res = mockRes();
    await call('payment-switch-url', { method: 'POST', body: { amount: 5 } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.hint).toContain('SUMUP_AFFILIATE_KEY');
  });

  it('payment-switch-url rejects a non-positive amount', async () => {
    process.env.SUMUP_AFFILIATE_KEY = 'aff_123';
    const res = mockRes();
    await call('payment-switch-url', { method: 'POST', body: { amount: 0 } }, res);
    expect(res.statusCode).toBe(400);
  });

  it('rejects GET on payment-switch-url with 405', async () => {
    const res = mockRes();
    await call('payment-switch-url', { method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
  });

  it('includes app-id from SUMUP_APP_ID so SumUp can validate the key', async () => {
    process.env.SUMUP_AFFILIATE_KEY = 'aff_123';
    process.env.SUMUP_APP_ID = 'co.uk.stakeys.till';
    const res = mockRes();
    await call('payment-switch-url', { method: 'POST', body: { amount: 5 } }, res);
    const q = new URLSearchParams(String(res.body.url).split('?')[1]);
    expect(q.get('app-id')).toBe('co.uk.stakeys.till');
    delete process.env.SUMUP_APP_ID;
  });
});
