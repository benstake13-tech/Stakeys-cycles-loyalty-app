/**
 * Shared SumUp server helpers for the Vercel functions.
 *
 * The SumUp API key is server-only and must never reach the browser: the
 * Checkout and Reader APIs both authenticate with a bearer token that can move
 * money, so every call is proxied through `/api/sumup/*`. This module keeps the
 * credential resolution and the HTTP plumbing in one place so the dispatcher
 * stays thin and the logic is unit-testable without a network.
 *
 * All request helpers accept a `fetchImpl` so tests can inject a stub.
 */

export const SUMUP_API_BASE = 'https://api.sumup.com';

/** Env var names the SumUp API key might be stored under. */
export const SUMUP_KEY_ENV_NAMES = ['SUMUP_API_KEY', 'SUMUP_REST_API_KEY', 'SUMUP_SECRET_KEY'];

/** Env var names the merchant code might be stored under. */
export const SUMUP_MERCHANT_ENV_NAMES = ['SUMUP_MERCHANT_CODE', 'SUMUP_MERCHANT'];

const trimValue = (raw) =>
  typeof raw === 'string' ? raw.trim().replace(/^["']|["']$/g, '') : '';

function firstEnv(env, names) {
  for (const name of names) {
    const value = trimValue(env?.[name]);
    if (value) return value;
  }
  return null;
}

/**
 * Resolves the SumUp server configuration. `configured` is true only when both
 * a key and a merchant code are present — without both, no payment can be
 * created and the UI must fall back to a manual method.
 */
export function resolveSumupConfig(env = process.env) {
  const key = firstEnv(env, SUMUP_KEY_ENV_NAMES);
  const merchantCode = firstEnv(env, SUMUP_MERCHANT_ENV_NAMES);
  const readerId = firstEnv(env, ['SUMUP_READER_ID']);
  const currency = (firstEnv(env, ['SUMUP_CURRENCY']) || 'GBP').toUpperCase();
  return { key, merchantCode, readerId, currency, configured: Boolean(key && merchantCode) };
}

/** SumUp expects the amount in major units with two decimals (15.00, not 1500). */
export function toSumupAmount(pounds) {
  const n = Number(pounds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** A short, unique, human-readable checkout reference. */
export function buildCheckoutReference(prefix = 'stakeys') {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${stamp}-${rand}`;
}

/**
 * Performs an authenticated SumUp request. Returns `{ ok, status, data }`;
 * `data` is the parsed JSON body (or `{ error }` when the upstream failed).
 */
export async function sumupRequest(
  path,
  { method = 'GET', body, key, base = SUMUP_API_BASE, fetchImpl = fetch } = {}
) {
  const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
  const init = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let upstream;
  try {
    upstream = await fetchImpl(`${base}${path}`, init);
  } catch (err) {
    return { ok: false, status: 0, data: { error: err?.message || 'SumUp request failed' } };
  }

  const text = await upstream.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { ok: upstream.ok, status: upstream.status, data };
}

/** Creates an online checkout. With `hosted: true` the response carries a pay URL. */
export async function createCheckout({
  amount,
  currency,
  reference,
  description,
  redirectUrl,
  hosted = true,
  merchantCode,
  key,
  fetchImpl,
}) {
  const payload = {
    merchant_code: merchantCode,
    amount: toSumupAmount(amount),
    currency,
    checkout_reference: reference,
  };
  if (description) payload.description = description;
  if (redirectUrl) payload.redirect_url = redirectUrl;
  if (hosted) payload.hosted_checkout = { enabled: true };
  return sumupRequest('/v0.1/checkouts', { method: 'POST', body: payload, key, fetchImpl });
}

/** Retrieves a checkout by id — used to poll the payment status. */
export async function getCheckout({ checkoutId, key, fetchImpl }) {
  return sumupRequest(`/v0.1/checkouts/${encodeURIComponent(checkoutId)}`, { key, fetchImpl });
}

/** Lists the readers paired to a merchant account. */
export async function listReaders({ merchantCode, key, fetchImpl }) {
  return sumupRequest(`/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers`, {
    key,
    fetchImpl,
  });
}

/** Pushes a checkout onto a paired physical reader (SumUp Solo / Air). */
export async function createReaderCheckout({
  merchantCode,
  readerId,
  amount,
  currency,
  reference,
  description,
  returnUrl,
  key,
  fetchImpl,
}) {
  const payload = {
    total_amount: {
      currency,
      minor_unit: 2,
      value: Math.round(Number(amount) * 100),
    },
  };
  if (description) payload.description = description;
  if (returnUrl) payload.return_url = returnUrl;
  if (reference) payload.checkout_reference = reference;
  return sumupRequest(
    `/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(readerId)}/checkout`,
    { method: 'POST', body: payload, key, fetchImpl }
  );
}

/** Reads the live status of a reader (screen, connectivity, battery). */
export async function getReaderStatus({ merchantCode, readerId, key, fetchImpl }) {
  return sumupRequest(
    `/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(readerId)}/status`,
    { key, fetchImpl }
  );
}

/** Stops the current transaction on the reader. */
export async function terminateReaderCheckout({ merchantCode, readerId, key, fetchImpl }) {
  return sumupRequest(
    `/v0.1/merchants/${encodeURIComponent(merchantCode)}/readers/${encodeURIComponent(readerId)}/checkout`,
    { method: 'DELETE', key, fetchImpl }
  );
}
