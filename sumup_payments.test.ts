import { describe, it, expect, vi } from 'vitest';
import {
  getSumupConfig,
  createSumupCheckout,
  getSumupCheckoutStatus,
  listSumupReaders,
  sendToSumupReader,
  terminateSumupReaderCheckout,
  pollSumupCheckout,
  buildSumupPaymentSwitchUrl,
  parseSumupCallback,
  SUMUP_PAYMENT_SWITCH_SCHEME,
  type FetchLike,
} from './src/utils/sumupPayments';

// The client helpers are thin wrappers over /api/sumup/*; these tests inject a
// fetch stub (no network) and pin the request shapes + the polling contract.
function jsonResponse(payload: any, ok = true, status = 200): Response {
  return { ok, status, json: async () => payload } as unknown as Response;
}

describe('getSumupConfig', () => {
  it('returns the parsed config when the backend is configured', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ configured: true, currency: 'GBP', hasReader: true, tapToPay: true })) as unknown as FetchLike;
    expect(await getSumupConfig(fetchImpl)).toEqual({ configured: true, currency: 'GBP', hasReader: true, tapToPay: true });
    expect((fetchImpl as any).mock.calls[0][0]).toBe('/api/sumup/config');
  });

  it('degrades to not-configured on a non-JSON body (static host rewrite)', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new Error('html'); } })) as unknown as FetchLike;
    expect(await getSumupConfig(fetchImpl)).toEqual({ configured: false, currency: 'GBP', hasReader: false, tapToPay: false });
  });

  it('degrades to not-configured when the request throws', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('offline'); }) as unknown as FetchLike;
    expect((await getSumupConfig(fetchImpl)).configured).toBe(false);
  });
});

describe('createSumupCheckout', () => {
  it('POSTs the amount and returns the checkout', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ checkoutId: 'chk_1', reference: 'r', hostedCheckoutUrl: 'https://pay/x', status: 'PENDING' })) as unknown as FetchLike;
    const out = await createSumupCheckout({ amount: 20, description: 'Fix' }, fetchImpl);
    expect(out.checkoutId).toBe('chk_1');
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('/api/sumup/checkout');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ amount: 20, description: 'Fix' });
  });

  it('throws the server error message on failure', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'SumUp checkout failed' }, false, 502)) as unknown as FetchLike;
    await expect(createSumupCheckout({ amount: 5 }, fetchImpl)).rejects.toThrow('SumUp checkout failed');
  });
});

describe('readers', () => {
  it('lists readers from the readers payload', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ readers: [{ id: 'rdr_1', name: 'Frontdesk' }] })) as unknown as FetchLike;
    expect(await listSumupReaders(fetchImpl)).toEqual([{ id: 'rdr_1', name: 'Frontdesk' }]);
  });

  it('returns an empty list when the payload has no readers', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({})) as unknown as FetchLike;
    expect(await listSumupReaders(fetchImpl)).toEqual([]);
  });

  it('sends an amount to the reader', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ readerId: 'rdr_1' })) as unknown as FetchLike;
    await sendToSumupReader({ readerId: 'rdr_1', amount: 9.99 }, fetchImpl);
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('/api/sumup/reader-checkout');
    expect(JSON.parse(init.body)).toMatchObject({ readerId: 'rdr_1', amount: 9.99 });
  });

  it('terminates a reader transaction', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ readerId: 'rdr_1' })) as unknown as FetchLike;
    await terminateSumupReaderCheckout('rdr_1', fetchImpl);
    const [url, init] = (fetchImpl as any).mock.calls[0];
    expect(url).toBe('/api/sumup/terminate');
    expect(JSON.parse(init.body)).toEqual({ readerId: 'rdr_1' });
  });
});

describe('getSumupCheckoutStatus', () => {
  it('encodes the id into the query string', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'chk 1', status: 'PAID' })) as unknown as FetchLike;
    await getSumupCheckoutStatus('chk 1', fetchImpl);
    expect((fetchImpl as any).mock.calls[0][0]).toBe('/api/sumup/checkout-status?id=chk%201');
  });
});

describe('pollSumupCheckout', () => {
  it('returns immediately once the status leaves PENDING', async () => {
    const statuses = ['PENDING', 'PENDING', 'PAID'];
    let i = 0;
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'c', status: statuses[Math.min(i++, statuses.length - 1)] })) as unknown as FetchLike;
    const ticks: string[] = [];
    const final = await pollSumupCheckout('c', { fetchImpl, intervalMs: 0, onTick: (s) => ticks.push(s) });
    expect(final).toBe('PAID');
    expect(ticks).toEqual(['PENDING', 'PENDING', 'PAID']);
  });

  it('stops after maxAttempts and reports PENDING', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'c', status: 'PENDING' })) as unknown as FetchLike;
    const final = await pollSumupCheckout('c', { fetchImpl, intervalMs: 0, maxAttempts: 3 });
    expect(final).toBe('PENDING');
    expect((fetchImpl as any).mock.calls.length).toBe(3);
  });

  it('treats a missing status as PENDING', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: 'c' })) as unknown as FetchLike;
    const final = await pollSumupCheckout('c', { fetchImpl, intervalMs: 0, maxAttempts: 2 });
    expect(final).toBe('PENDING');
  });
});

describe('Tap to Pay helpers', () => {
  it('exposes the canonical Payment Switch scheme', () => {
    expect(SUMUP_PAYMENT_SWITCH_SCHEME).toBe('sumupmerchant://pay/1.0');
  });

  it('requests a Payment Switch URL from the server', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ url: 'sumupmerchant://pay/1.0?amount=5.00&currency=GBP' })
    ) as unknown as FetchLike;
    const url = await buildSumupPaymentSwitchUrl({ amount: 5 }, fetchImpl);
    expect(url).toBe('sumupmerchant://pay/1.0?amount=5.00&currency=GBP');
    const [u, init] = (fetchImpl as any).mock.calls[0];
    expect(u).toBe('/api/sumup/payment-switch-url');
    expect(init.method).toBe('POST');
  });

  it('parses a success callback into ok:true', () => {
    const r = parseSumupCallback('smp-status=success&smp-tx-code=TX1&foreign-tx-id=till-1');
    expect(r).toEqual({ status: 'success', ok: true, txCode: 'TX1', foreignTxId: 'till-1', message: null });
  });

  it('parses a failed callback into ok:false', () => {
    const r = parseSumupCallback('smp-status=failed');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('failed');
  });

  it('accepts a URLSearchParams object', () => {
    const params = new URLSearchParams({ 'smp-status': 'invalidstate' });
    expect(parseSumupCallback(params).status).toBe('invalidstate');
  });
});
