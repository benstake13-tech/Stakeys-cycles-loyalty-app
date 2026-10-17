import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST required.' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(503, { error: 'Auctions are temporarily unavailable.' });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in to bid.' });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user?.email_confirmed_at) return json(401, { error: 'Verify your email and sign in before bidding.' });

  let body: { action?: string; listing_id?: string; amount?: number };
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid auction request.' }); }
  if (!uuid.test(body.listing_id || '')) return json(400, { error: 'Invalid auction listing.' });

  if (body.action === 'bid') {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 50000 || Math.abs(Math.round(amount * 100) - amount * 100) > 1e-6) {
      return json(400, { error: 'Enter a bid between £1 and £50,000 in pounds and pence.' });
    }
    const { data, error } = await admin.rpc('place_marketplace_bid', {
      p_listing_id: body.listing_id, p_bidder_id: auth.user.id, p_amount: amount,
    });
    if (error) return json(409, { error: error.message });
    return json(200, data);
  }
  if (body.action === 'settle') {
    const { data, error } = await admin.rpc('finalize_marketplace_auction', { p_listing_id: body.listing_id });
    if (error) return json(409, { error: 'Could not settle this auction. Please refresh shortly.' });
    return json(200, data);
  }
  return json(400, { error: 'Unknown auction action.' });
});
