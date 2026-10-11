/**
 * SumUp card payments — browser-side helpers.
 *
 * Every call is proxied through the `/api/sumup/*` serverless family so the
 * SumUp API key stays server-only. The functions here are deliberately thin and
 * accept an injectable `fetchImpl` so the till logic can be unit-tested without
 * touching the network or a live merchant account.
 */

export type SumupStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | string;

export interface SumupConfig {
  configured: boolean;
  currency: string;
  hasReader: boolean;
  tapToPay: boolean;
}

export interface SumupCheckout {
  checkoutId: string;
  reference: string;
  hostedCheckoutUrl: string | null;
  status: SumupStatus | null;
}

export interface SumupReader {
  id: string;
  name?: string;
  status?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const notConfigured: SumupConfig = { configured: false, currency: 'GBP', hasReader: false, tapToPay: false };

async function postJson(path: string, body: unknown, fetchImpl: FetchLike): Promise<any> {
  const res = await fetchImpl(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return parse(res);
}

async function getJson(path: string, fetchImpl: FetchLike): Promise<any> {
  const res = await fetchImpl(path);
  return parse(res);
}

async function parse(res: Response): Promise<any> {
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message) as Error & { detail?: unknown; status?: number };
    err.detail = data?.detail;
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Whether this deployment can take card payments, plus the merchant currency. */
export async function getSumupConfig(fetchImpl: FetchLike = fetch): Promise<SumupConfig> {
  try {
    const data = await getJson('/api/sumup/config', fetchImpl);
    if (data && typeof data === 'object' && 'configured' in data) {
      return {
        configured: Boolean(data.configured),
        currency: data.currency || 'GBP',
        hasReader: Boolean(data.hasReader),
        tapToPay: Boolean(data.tapToPay),
      };
    }
    return notConfigured;
  } catch {
    return notConfigured;
  }
}

/** Creates an online checkout and returns its id + hosted payment URL. */
export async function createSumupCheckout(
  params: { amount: number; description?: string; reference?: string; redirectUrl?: string },
  fetchImpl: FetchLike = fetch
): Promise<SumupCheckout> {
  return postJson('/api/sumup/checkout', params, fetchImpl);
}

/** Polls a checkout's status — PENDING until the customer pays, then PAID/FAILED. */
export async function getSumupCheckoutStatus(
  checkoutId: string,
  fetchImpl: FetchLike = fetch
): Promise<{ id: string; status: SumupStatus | null; raw?: any }> {
  return getJson(`/api/sumup/checkout-status?id=${encodeURIComponent(checkoutId)}`, fetchImpl);
}

/** Lists the card readers paired to the merchant account. */
export async function listSumupReaders(fetchImpl: FetchLike = fetch): Promise<SumupReader[]> {
  const data = await getJson('/api/sumup/readers', fetchImpl);
  return Array.isArray(data?.readers) ? data.readers : [];
}

/** Pushes an amount onto a paired reader so the customer can tap/insert a card. */
export async function sendToSumupReader(
  params: { readerId?: string; amount: number; description?: string; returnUrl?: string },
  fetchImpl: FetchLike = fetch
): Promise<any> {
  return postJson('/api/sumup/reader-checkout', params, fetchImpl);
}

/** Reads a reader's live status (screen, connectivity, battery). */
export async function getSumupReaderStatus(
  readerId?: string,
  fetchImpl: FetchLike = fetch
): Promise<any> {
  const q = readerId ? `?readerId=${encodeURIComponent(readerId)}` : '';
  return getJson(`/api/sumup/reader-status${q}`, fetchImpl);
}

/** Stops the current transaction on the reader. */
export async function terminateSumupReaderCheckout(
  readerId?: string,
  fetchImpl: FetchLike = fetch
): Promise<any> {
  return postJson('/api/sumup/terminate', { readerId }, fetchImpl);
}

/**
 * Polls a checkout until it leaves PENDING (or the budget runs out). Returns the
 * final status; `onTick` receives each polled status so the UI can animate.
 */
export async function pollSumupCheckout(
  checkoutId: string,
  {
    fetchImpl = fetch,
    intervalMs = 2000,
    maxAttempts = 90,
    onTick,
  }: { fetchImpl?: FetchLike; intervalMs?: number; maxAttempts?: number; onTick?: (s: SumupStatus) => void } = {}
): Promise<SumupStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const { status } = await getSumupCheckoutStatus(checkoutId, fetchImpl);
    const s = status || 'PENDING';
    onTick?.(s);
    if (s !== 'PENDING') return s;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return 'PENDING';
}

// ---------------------------------------------------------------------------
// Tap to Pay (softPOS) via the SumUp Payment Switch.
//
// This is the free-tier path: instead of a paired Solo reader, the merchant's
// phone runs the SumUp app, and our till hands off with a `sumupmerchant://`
// URL. The affiliate key never reaches the browser — the server builds the URL.
// ---------------------------------------------------------------------------

export interface PaymentSwitchRequest {
  amount: number;
  title?: string;
  reference?: string;
  currency?: string;
  appId?: string;
  callbackSuccess?: string;
  callbackFail?: string;
  receiptEmail?: string;
}

export interface PaymentSwitchResult {
  status: string | null;
  ok: boolean;
  txCode: string | null;
  foreignTxId: string | null;
  message: string | null;
}

/** The canonical scheme the SumUp app registers for the Payment Switch. */
export const SUMUP_PAYMENT_SWITCH_SCHEME = 'sumupmerchant://pay/1.0';

/** Asks the server for a signed Payment Switch URL (keeps the affiliate key server-side). */
export async function buildSumupPaymentSwitchUrl(
  params: PaymentSwitchRequest,
  fetchImpl: FetchLike = fetch
): Promise<string> {
  const data = await postJson('/api/sumup/payment-switch-url', params, fetchImpl);
  return data?.url;
}

/** True when the browser is a mobile device (where the SumUp app handoff works). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
}

/**
 * Parses the query the SumUp app appends to the callback URL when it returns.
 * Accepts either a raw query string or a URLSearchParams-like object.
 */
export function parseSumupCallback(search: string | URLSearchParams = ''): PaymentSwitchResult {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const status = params.get('smp-status');
  return {
    status,
    ok: status === 'success',
    txCode: params.get('smp-tx-code'),
    foreignTxId: params.get('foreign-tx-id'),
    message: params.get('smp-message'),
  };
}

/**
 * Opens the SumUp app for a tap-to-pay transaction. Returns false if the URL
 * could not be produced (SumUp unconfigured) — the caller should fall back.
 */
export async function launchSumupTapToPay(
  params: PaymentSwitchRequest,
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  const url = await buildSumupPaymentSwitchUrl(params, fetchImpl);
  if (!url || typeof window === 'undefined') return false;
  window.location.href = url;
  return true;
}
