// Deploy: supabase functions deploy growth-advisor
// Secrets: GEMINI_API_KEY (existing), SUPABASE_URL, SUPABASE_ANON_KEY
// Staff-only, on-demand Gemini advice. No key is ever sent to the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const num = (x: unknown) => Number.isFinite(Number(x)) ? Number(x) : 0;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return reply({ error: 'Authentication required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!url || !anon || !key) return reply({ error: 'Growth advisor not configured: check Supabase function secrets' }, 503);
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const { data: identity, error: authError } = await db.auth.getUser(jwt);
  if (authError || !identity.user) return reply({ error: 'Invalid session' }, 401);
  const { data: profile, error: roleError } = await db.from('profiles').select('role').eq('id', identity.user.id).single();
  if (roleError || !['staff', 'admin'].includes(profile?.role)) return reply({ error: 'Staff access required' }, 403);

  // Never include customer names, phone numbers, email, or raw sales records.
  const { data: months, error: monthsError } = await db.from('business_monthly_summary')
    .select('month,revenue_gbp,profit_gbp,retail_sales_gbp,repair_revenue_gbp,service_revenue_gbp,repair_jobs,free_services,people_helped,community_value_gbp')
    .order('month', { ascending: false }).limit(6);
  const { data: targets, error: targetsError } = await db.from('business_kpi_targets')
    .select('target_month,metric_key,target_value').order('target_month', { ascending: false }).limit(60);
  if (monthsError || targetsError) return reply({
    error: 'Business reporting tables unavailable. Apply the business growth SQL migration first.',
    detail: monthsError?.message || targetsError?.message,
  }, 409);
  if (!months?.length) return reply({ error: 'No business activity recorded yet. Add real completed sales, repairs and free services before generating advice.' }, 409);
  const current = months[0];
  const activity = Object.values(current).some(v => typeof v === 'number' && v > 0);
  if (!activity) return reply({ error: 'No recorded activity yet. Recommendations require actual data.' }, 409);

  const prompt = [
    'You are a careful UK bicycle and e-scooter shop business advisor for Stakey\'s Cycles.',
    'Use only these aggregated records. Distinguish measured facts from estimates.',
    'Suggest 2-3 promotions to improve below-target sales, repair revenue or paid services, while preserving margins.',
    'Recognise free community services as social contribution, not sales revenue.',
    'Do not claim causality, guarantee growth, or invent prices, conversion rates or capacity.',
    'Suggest discounts no higher than 20%, and require human approval before any campaign is launched.',
    'Return ONLY a JSON object: {"headline":string,"suggestions":[{"title":string,"reason":string,"target_metric":string,"discount_pct":number,"expected_benefit":string}]}',
    JSON.stringify({ monthly: months, targets }),
  ].join('\n');
  try {
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash-lite';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 1300 } }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('Gemini response status', res.status);
      return reply({ error: res.status === 429 ? 'Gemini rate limit reached. Try again later.' : 'Gemini request failed.' }, 502);
    }
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    const parsed = JSON.parse(raw);
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).slice(0, 3).map((s: Record<string, unknown>) => ({
      title: String(s.title || '').slice(0, 140),
      reason: String(s.reason || '').slice(0, 700),
      target_metric: String(s.target_metric || '').slice(0, 80),
      discount_pct: Math.max(0, Math.min(20, num(s.discount_pct))),
      expected_benefit: String(s.expected_benefit || '').slice(0, 300),
    })).filter((s: { title: string; reason: string }) => s.title && s.reason);
    if (!suggestions.length) return reply({ error: 'Gemini returned no usable suggestions' }, 502);
    return reply({ headline: String(parsed.headline || 'Suggested growth opportunities').slice(0, 300), suggestions, model, generated_at: new Date().toISOString(), basis_month: current.month });
  } catch (error) {
    console.error('Growth advisor failed', error);
    return reply({ error: 'Unable to generate recommendations right now' }, 502);
  }
});
