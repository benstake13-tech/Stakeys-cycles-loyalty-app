/**
 * Vercel serverless function — SumUp card payments (dispatched by action).
 *
 * One function serves the whole `/api/sumup/*` family so the deployment stays
 * within the Vercel Serverless Function budget (Hobby allows 12 per deployment;
 * every file under `api/` counts as one). The action is the dynamic path segment
 * (`/api/sumup/checkout` → `req.query.action === 'checkout'`), so client URLs
 * stay clean. The SumUp API key is server-only and never returned.
 *
 * Actions:
 *   config          GET  — whether SumUp is configured + the merchant currency
 *   checkout        POST — create an online checkout (returns hosted pay URL)
 *   checkout-status GET  — poll a checkout by id (?id=)
 *   readers         GET  — list paired readers
 *   reader-checkout POST — push an amount to a paired reader
 *   reader-status   GET  — live reader status
 *   terminate       POST — stop the current reader transaction
 */
import {
  resolveSumupConfig,
  createCheckout,
  getCheckout,
  listReaders,
  createReaderCheckout,
  getReaderStatus,
  terminateReaderCheckout,
  buildCheckoutReference,
  buildPaymentSwitchUrl,
  toSumupAmount,
} from './_shared.js';

function notConfigured(res) {
  return res.status(503).json({
    error: 'SumUp is not configured on this deployment.',
    hint: 'Set SUMUP_API_KEY and SUMUP_MERCHANT_CODE in the deployment environment.',
  });
}

function sumupConfig(res) {
  const cfg = resolveSumupConfig();
  return res.status(200).json({
    configured: cfg.configured,
    tapToPay: cfg.tapToPay,
    currency: cfg.currency,
    hasReader: Boolean(cfg.readerId),
  });
}

/**
 * Builds a Payment Switch URL for Tap to Pay (softPOS). Only the affiliate key
 * is needed — no REST key — so this works on the free tap-to-pay tier. The URL
 * is returned to the client, which opens it to hand off to the SumUp app.
 */
function sumupPaymentSwitchUrl(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.tapToPay) {
    return res.status(503).json({
      error: 'SumUp Tap to Pay is not configured on this deployment.',
      hint: 'Set SUMUP_AFFILIATE_KEY in the deployment environment.',
    });
  }
  const amount = toSumupAmount(req.body?.amount ?? req.query?.amount);
  if (amount === null) return res.status(400).json({ error: 'A positive amount is required.' });

  const url = buildPaymentSwitchUrl({
    affiliateKey: cfg.affiliateKey,
    amount,
    currency: req.body?.currency || cfg.currency,
    title: req.body?.title,
    foreignTxId: req.body?.reference || buildCheckoutReference('till'),
    appId: req.body?.appId || cfg.appId,
    callbackSuccess: req.body?.callbackSuccess,
    callbackFail: req.body?.callbackFail,
    receiptEmail: req.body?.receiptEmail,
  });
  return res.status(200).json({ url });
}

async function sumupCheckout(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const amount = toSumupAmount(req.body?.amount);
  if (amount === null) {
    return res.status(400).json({ error: 'A positive amount is required.' });
  }

  const reference = req.body?.reference || buildCheckoutReference();
  const { ok, status, data } = await createCheckout({
    amount,
    currency: req.body?.currency || cfg.currency,
    reference,
    description: req.body?.description,
    redirectUrl: req.body?.redirectUrl,
    merchantCode: cfg.merchantCode,
    key: cfg.key,
  });

  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp checkout failed', detail: data });
  }
  return res.status(200).json({
    checkoutId: data?.id,
    reference,
    hostedCheckoutUrl: data?.hosted_checkout_url || null,
    status: data?.status || null,
    raw: data,
  });
}

async function sumupCheckoutStatus(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ error: 'id is required' });

  const { ok, status, data } = await getCheckout({ checkoutId: id, key: cfg.key });
  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp status lookup failed', detail: data });
  }
  return res.status(200).json({ id, status: data?.status || null, raw: data });
}

async function sumupReaders(res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const { ok, status, data } = await listReaders({ merchantCode: cfg.merchantCode, key: cfg.key });
  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp reader lookup failed', detail: data });
  }
  return res.status(200).json({ readers: Array.isArray(data) ? data : data?.items || [] });
}

async function sumupReaderCheckout(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const readerId = String(req.body?.readerId || cfg.readerId || '').trim();
  if (!readerId) return res.status(400).json({ error: 'A reader id is required.' });

  const amount = toSumupAmount(req.body?.amount);
  if (amount === null) return res.status(400).json({ error: 'A positive amount is required.' });

  const { ok, status, data } = await createReaderCheckout({
    merchantCode: cfg.merchantCode,
    readerId,
    amount,
    currency: req.body?.currency || cfg.currency,
    reference: req.body?.reference || buildCheckoutReference(),
    description: req.body?.description,
    returnUrl: req.body?.returnUrl,
    key: cfg.key,
  });
  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp reader checkout failed', detail: data });
  }
  return res.status(200).json({ readerId, raw: data });
}

async function sumupReaderStatus(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const readerId = String(req.query.readerId || cfg.readerId || '').trim();
  if (!readerId) return res.status(400).json({ error: 'A reader id is required.' });

  const { ok, status, data } = await getReaderStatus({
    merchantCode: cfg.merchantCode,
    readerId,
    key: cfg.key,
  });
  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp reader status failed', detail: data });
  }
  return res.status(200).json({ readerId, status: data?.status || null, raw: data });
}

async function sumupTerminate(req, res) {
  const cfg = resolveSumupConfig();
  if (!cfg.configured) return notConfigured(res);

  const readerId = String(req.body?.readerId || cfg.readerId || '').trim();
  if (!readerId) return res.status(400).json({ error: 'A reader id is required.' });

  const { ok, status, data } = await terminateReaderCheckout({
    merchantCode: cfg.merchantCode,
    readerId,
    key: cfg.key,
  });
  if (!ok) {
    return res.status(status || 502).json({ error: 'SumUp terminate failed', detail: data });
  }
  return res.status(200).json({ readerId, raw: data });
}

export default async function handler(req, res) {
  const action = String(req.query.action || '');
  const method = String(req.method || 'GET').toUpperCase();

  const needsPost = ['checkout', 'reader-checkout', 'terminate', 'payment-switch-url'];
  if (needsPost.includes(action) && method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  switch (action) {
    case 'config':
      return sumupConfig(res);
    case 'payment-switch-url':
      return sumupPaymentSwitchUrl(req, res);
    case 'checkout':
      return sumupCheckout(req, res);
    case 'checkout-status':
      return sumupCheckoutStatus(req, res);
    case 'readers':
      return sumupReaders(res);
    case 'reader-checkout':
      return sumupReaderCheckout(req, res);
    case 'reader-status':
      return sumupReaderStatus(req, res);
    case 'terminate':
      return sumupTerminate(req, res);
    default:
      return res.status(404).json({ error: 'Unknown sumup action' });
  }
}
