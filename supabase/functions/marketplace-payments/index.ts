import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST required' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sumupKey = Deno.env.get('SUMUP_API_KEY');
  const merchantCode = Deno.env.get('SUMUP_MERCHANT_CODE');
  if (!sumupKey || !merchantCode) return json(503, { error: 'Marketplace card payments are not configured.' });
  const bearer = req.headers.get('Authorization') || '';
  const token = bearer.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in to continue.' });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user || !user.email_confirmed_at) return json(401, { error: 'Verify your email and sign in before buying or selling.' });

  let body: { action?: string; conversation_id?: string; transaction_id?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON body.' }); }

  if (body.action === 'create') {
    if (!body.conversation_id) return json(400, { error: 'Agree a price and handover plan before checkout.' });
    const { data: conversation, error: conversationError } = await admin.from('marketplace_conversations')
      .select('id,listing_id,buyer_id,seller_id').eq('id', body.conversation_id).maybeSingle();
    if (conversationError || !conversation || conversation.buyer_id !== user.id) return json(404, { error: 'Sale agreement not found.' });
    const { data: listing, error: listingError } = await admin.from('marketplace_listings')
      .select('id,seller_id,title,status').eq('id', conversation.listing_id).maybeSingle();
    if (listingError || !listing || listing.status !== 'active') return json(404, { error: 'This listing is no longer available.' });
    if (listing.seller_id === user.id || listing.seller_id !== conversation.seller_id) return json(400, { error: 'Invalid sale agreement.' });

    const { data: tx, error: txError } = await admin.rpc('reserve_marketplace_agreed_transaction', {
      p_conversation_id: conversation.id, p_buyer_id: user.id,
    }).maybeSingle();
    if (txError || !tx) return json(409, { error: txError?.message || 'Could not reserve this sale. Refresh and try again.' });

    const reference = `STK-${tx.id.replaceAll('-', '').slice(0, 24)}`;
    const redirectUrl = `${(Deno.env.get('SITE_URL') || 'https://www.stakeys-cycles.co.uk').replace(/\/$/, '')}/?page=marketplace&marketplace_tx=${tx.id}`;
    const checkoutResponse = await fetch('https://api.sumup.com/v0.1/checkouts', {
      method: 'POST',
      headers: { Authorization: `Bearer ${sumupKey}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchant_code: merchantCode, amount: Number(tx.gross_amount), currency: 'GBP', checkout_reference: reference, description: `Marketplace: ${listing.title}`.slice(0, 50), redirect_url: redirectUrl, hosted_checkout: { enabled: true } }),
    });
    const checkout = await checkoutResponse.json().catch(() => ({}));
    if (!checkoutResponse.ok || !checkout?.id || !checkout?.hosted_checkout_url) {
      await admin.from('marketplace_transactions').update({ payment_status: 'cancelled' }).eq('id', tx.id);
      return json(502, { error: 'SumUp could not start checkout. No payment has been taken.' });
    }
    await admin.from('marketplace_transactions').update({ sumup_checkout_id: String(checkout.id) }).eq('id', tx.id);
    return json(200, { checkout_url: checkout.hosted_checkout_url, transaction_id: tx.id });
  }

  if (body.action === 'confirm') {
    if (!body.transaction_id) return json(400, { error: 'Transaction id is required.' });
    const { data: tx, error: txError } = await admin.from('marketplace_transactions').select('id,buyer_id,seller_id,payment_status,sumup_checkout_id').eq('id', body.transaction_id).maybeSingle();
    if (txError || !tx || (tx.buyer_id !== user.id && tx.seller_id !== user.id)) return json(404, { error: 'Transaction not found.' });
    if (tx.payment_status === 'completed') return json(200, { status: 'completed' });
    if (!tx.sumup_checkout_id) return json(409, { error: 'Checkout is still being prepared.' });
    const statusResponse = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(tx.sumup_checkout_id)}`, { headers: { Authorization: `Bearer ${sumupKey}`, Accept: 'application/json' } });
    const checkout = await statusResponse.json().catch(() => ({}));
    if (!statusResponse.ok) return json(502, { error: 'Could not verify payment with SumUp. Try again shortly.' });
    if (checkout.status === 'PAID') {
      const sumupTransactionId = String(checkout.transaction_code || checkout.transaction_id || checkout.id);
      const { error } = await admin.rpc('complete_marketplace_transaction', { p_transaction_id: tx.id, p_sumup_transaction_id: sumupTransactionId });
      if (error) return json(409, { error: 'Payment was received, but the sale needs staff review. Contact the shop with your transaction reference.' });
      return json(200, { status: 'completed' });
    }
    if (['FAILED','EXPIRED','CANCELLED'].includes(String(checkout.status || '').toUpperCase())) {
      await admin.from('marketplace_transactions').update({ payment_status: 'cancelled' }).eq('id', tx.id).eq('payment_status','pending');
      return json(200, { status: 'cancelled' });
    }
    return json(200, { status: 'pending' });
  }
  return json(400, { error: 'Unknown action.' });
});
