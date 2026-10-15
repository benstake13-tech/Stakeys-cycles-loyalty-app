import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(x => x.toString(16).padStart(2, '0')).join('');
const normaliseSerial = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const comparable = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cleanText = (value: unknown, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function cleanInspection(value: any) {
  const rows = (items: unknown, limit: number, map: (row: any) => unknown) => Array.isArray(items) ? items.slice(0, limit).filter(item => item && typeof item === 'object' && !Array.isArray(item)).map(map) : [];
  return {
    make: cleanText(value.make, 100), model: cleanText(value.model, 140), year: typeof value.year === 'number' || typeof value.year === 'string' ? value.year : null,
    type: cleanText(value.type, 40), colour: cleanText(value.colour, 80) || null, frameMaterial: cleanText(value.frameMaterial, 100) || null,
    overallCondition: cleanText(value.overallCondition, 60) || null, wheelSizeAndSpecs: cleanText(value.wheelSizeAndSpecs, 160) || null,
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)), coverage: Math.max(0, Math.min(100, Number(value.coverage) || 0)),
    summary: cleanText(value.summary, 800) || null, hasVisualData: true, usedFallback: false,
    mainSpecs: rows(value.mainSpecs, 50, (spec: any) => ({
      componentName: cleanText(spec.componentName, 100), category: cleanText(spec.category, 100), currentPart: cleanText(spec.currentPart, 240),
      brand: cleanText(spec.brand, 100), model: cleanText(spec.model, 140), specValue: cleanText(spec.specValue, 160), condition: cleanText(spec.condition, 60),
      confidence: Math.max(0, Math.min(1, Number(spec.confidence) || 0)), visibility: cleanText(spec.visibility, 60),
      stockComparison: cleanText(spec.stockComparison, 80), stockComparisonNote: cleanText(spec.stockComparisonNote, 240),
      specDetails: rows(spec.specDetails, 16, (detail: any) => ({ name: cleanText(detail.name, 100), value: cleanText(detail.value, 160), verification: cleanText(detail.verification, 60) })),
    })),
    obviousProblems: rows(value.obviousProblems, 30, (problem: any) => ({ issue: cleanText(problem.issue, 240), severity: cleanText(problem.severity, 40), location: cleanText(problem.location, 160), recommendation: cleanText(problem.recommendation, 240) })),
    faults: rows(value.faults, 30, (fault: any) => ({ faultTitle: cleanText(fault.faultTitle, 180), component: cleanText(fault.component, 120), severity: cleanText(fault.severity, 40), description: cleanText(fault.description, 240) })),
    photoRequests: rows(value.photoRequests, 20, (request: any) => ({ area: cleanText(request.area, 120), instruction: cleanText(request.instruction, 240), reason: cleanText(request.reason, 240), systemId: cleanText(request.systemId, 80) })),
    notVisible: Array.isArray(value.notVisible) ? value.notVisible.slice(0, 30).map((entry: unknown) => cleanText(entry, 140)).filter(Boolean) : [],
  };
}

function serialsClose(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false;
  if (a.includes(b) || b.includes(a)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length] <= 1;
}

function matchesMakeModel(bike: any, listingMakeModel: string): boolean {
  const haystack = comparable([bike?.manufacturer_name, bike?.frame_model, bike?.model_name, bike?.name, bike?.title].filter(Boolean).join(' '));
  const needle = comparable(listingMakeModel);
  if (!haystack || !needle) return false;
  if (haystack.includes(needle) || needle.includes(haystack)) return true;
  const tokens = listingMakeModel.toUpperCase().split(/[^A-Z0-9]+/).filter(token => token.length > 2);
  return tokens.length > 0 && tokens.every(token => haystack.includes(comparable(token)));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST required.' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json(503, { error: 'Marketplace listing verification is unavailable.' });
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in to submit a listing.' });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user || !user.email_confirmed_at) return json(401, { error: 'Verify your email and sign in before listing a bike.' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid request.' }); }
  if (body?.action !== 'create') return json(400, { error: 'Unknown listing action.' });
  const listing = body.listing;
  const serial = String(body.frame_serial_number || '').trim();
  const normalized = normaliseSerial(serial);
  const serialPhotoPath = String(body.serial_number_photo_path || '');
  if (!listing || listing.seller_id !== user.id || !listing.id || !/^[0-9a-f-]{36}$/i.test(String(listing.id))) return json(400, { error: 'Invalid listing details.' });
  const category = String(listing.category || '');
  const isParts = category === 'parts';
  const aiInspection = listing.ai_inspection;
  if (!isParts && (!aiInspection || typeof aiInspection !== 'object' || Array.isArray(aiInspection) || aiInspection.hasVisualData !== true || aiInspection.usedFallback !== false || !String(aiInspection.make || '').trim() || !String(aiInspection.model || '').trim() || comparable(`${aiInspection.make} ${aiInspection.model}`) !== comparable(listing.make_model) || !Array.isArray(aiInspection.mainSpecs) || JSON.stringify(aiInspection).length > 60000)) {
    return json(400, { error: 'Run the guided AI photo identification and use its make/model result before submitting a vehicle listing.' });
  }
  if (isParts ? (serial.length > 0 || serialPhotoPath.length > 0) : (normalized.length < 4 || normalized.length > 40 || /^(UNKNOWN|NONE|N\/A|NOTAVAILABLE)$/.test(normalized))) {
    return json(400, { error: isParts ? 'Do not include a frame serial on a parts listing.' : 'Enter the stamped frame serial number.' });
  }
  if (!isParts && !serialPhotoPath.startsWith(`${user.id}/${listing.id}/serial-number.`)) return json(400, { error: 'Upload a clear frame serial-number photo.' });
  if (!Array.isArray(listing.images) || listing.images.length < 1 || listing.images.length > 10 || listing.images.some((p: unknown) => typeof p !== 'string' || !p.startsWith(`${user.id}/${listing.id}/`))) return json(400, { error: 'Add one to ten listing photos.' });
  if (String(listing.title || '').trim().length < 4 || String(listing.title).length > 120 || String(listing.make_model || '').trim().length < 2 || String(listing.description || '').length > 2000) return json(400, { error: 'Check the listing title, make/model and description.' });
  if (!['bicycle', 'ebike', 'escooter', 'parts'].includes(category) || !['new', 'excellent', 'good', 'fair', 'spares'].includes(listing.condition)) return json(400, { error: 'Invalid listing category or condition.' });
  const subcategory = listing.subcategory ? String(listing.subcategory) : null;
  if (category === 'bicycle' ? !['commuter', 'hardtail_mtb', 'road', 'other'].includes(subcategory || '') : subcategory !== null) return json(400, { error: 'Choose a valid bicycle category.' });
  const askingPrice = Number(listing.asking_price);
  if (!Number.isFinite(askingPrice) || askingPrice <= 0 || askingPrice > 50000) return json(400, { error: 'Enter a valid asking price.' });

  const folder = `${user.id}/${listing.id}`;
  const { data: uploaded, error: storageError } = await admin.storage.from('marketplace-images').list(folder, { limit: 20 });
  if (storageError) return json(400, { error: 'We could not verify the uploaded photos. Please reselect and upload them.' });
  const uploadedNames = new Set((uploaded || []).map(file => `${folder}/${file.name}`));
  if ((!isParts && !uploadedNames.has(serialPhotoPath)) || listing.images.some((path: string) => !uploadedNames.has(path))) return json(400, { error: 'A listing photo is missing. Please upload the photos again.' });

  const safeListing = {
    id: String(listing.id), seller_id: user.id, title: String(listing.title).trim(), category,
    subcategory, make_model: String(listing.make_model).trim(), condition: listing.condition,
    description: String(listing.description || '').trim(), asking_price: Math.round(askingPrice * 100) / 100,
    images: listing.images, ai_inspection: isParts ? null : cleanInspection(aiInspection),
  };
  if (isParts) {
    const { data: listingId, error } = await admin.rpc('create_marketplace_parts_listing', { p_listing: safeListing });
    if (error || !listingId) return json(500, { error: 'The parts listing could not be submitted for staff review.' });
    return json(200, { status: 'pending_approval', listing_id: listingId });
  }

  const params = new URLSearchParams({ serial, stolenness: 'stolen' });
  const bikeIndexHeaders: Record<string, string> = { Accept: 'application/json' };
  const accessToken = Deno.env.get('BIKE_INDEX_ACCESS_TOKEN');
  if (accessToken) bikeIndexHeaders.Authorization = `Bearer ${accessToken}`;
  let response: Response;
  try {
    response = await fetch(`https://bikeindex.org/api/v3/search?${params.toString()}`, { headers: bikeIndexHeaders, signal: AbortSignal.timeout(10000) });
  } catch {
    return json(503, { error: 'The stolen-bike database is temporarily unavailable. Your listing has not been saved; please try again shortly.' });
  }
  if (!response.ok) return json(503, { error: 'The stolen-bike database could not complete the check. Your listing has not been saved; please try again shortly.' });
  let data: any;
  try { data = await response.json(); } catch { return json(503, { error: 'The stolen-bike database returned an unreadable response. Your listing has not been saved.' }); }
  if (!Array.isArray(data?.bikes)) return json(503, { error: 'The stolen-bike database returned an incomplete response. Your listing has not been saved.' });

  const responseHash = await sha256(JSON.stringify(data));
  const stolen = data.bikes.filter((bike: any) => bike?.stolen === true);
  const exactMatches = stolen.filter((bike: any) => normaliseSerial(String(bike?.serial || '')) === normalized);
  const possibleMatches = stolen.filter((bike: any) => {
    const returnedSerial = normaliseSerial(String(bike?.serial || ''));
    if (!returnedSerial || returnedSerial === normalized || !serialsClose(returnedSerial, normalized)) return false;
    return matchesMakeModel(bike, String(listing.make_model || '')) || ![bike?.manufacturer_name, bike?.frame_model, bike?.model_name, bike?.name, bike?.title].some(Boolean);
  });

  if (exactMatches.length > 0) {
    const serialHash = await sha256(normalized);
    const { error: flagError } = await admin.from('marketplace_stolen_listing_flags').insert({
      user_id: user.id, listing_title: String(listing.title).trim(), make_model: String(listing.make_model).trim(),
      serial_sha256: serialHash, bike_index_response_sha256: responseHash, matching_stolen_records: exactMatches.length,
    });
    if (flagError) return json(503, { error: 'The safety review could not be recorded. The listing was not saved; contact the workshop.' });
    return json(409, { status: 'rejected_stolen', message: 'This serial number exactly matches a bike reported as stolen in Bike Index. This listing cannot be submitted. Stakey’s has flagged the attempt for an administrator to review.' });
  }

  const lookupStatus = possibleMatches.length > 0 ? 'review_required' : 'clear';
  const checkedAt = new Date().toISOString();
  const { data: listingId, error: saveError } = await admin.rpc('create_marketplace_listing_checked', {
    p_listing: safeListing, p_serial_number: serial, p_serial_photo_path: serialPhotoPath,
    p_check_status: lookupStatus, p_checked_at: checkedAt, p_response_sha256: responseHash,
    p_match_count: possibleMatches.length,
  });
  if (saveError || !listingId) return json(500, { error: 'The verified listing could not be saved. Your photos are still available; please retry or contact the workshop.' });
  return json(200, { status: lookupStatus, listing_id: listingId, checked_at: checkedAt });
});
