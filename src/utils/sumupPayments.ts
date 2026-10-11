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

const notConfigured: SumupConfig = { configured: false, currency: 'GBP', hasReader: false };

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
