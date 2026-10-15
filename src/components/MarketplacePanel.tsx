import { announceMilestone } from '../utils/milestoneAnimations';
import { Capacitor } from '@capacitor/core';
import React, { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, CircleAlert, Clock3, ImagePlus, LoaderCircle, MapPin, RefreshCw, ShieldCheck, Sparkles, Store, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useShop } from '../context/ShopContext';
import { generateGemini } from '../api/geminiGateway';

type Listing = {
  id: string; seller_id?: string; title: string; category: 'bicycle'|'ebike'|'escooter'; make_model: string;
  condition: string; description: string; asking_price: number; images: string[]; status: string; created_at: string;
};
type LedgerRow = { id:string; listing_id:string; seller_id:string; gross_amount:number; commission_amount:number; seller_payable:number; payment_status:string; payout_status:string; payout_reference?:string|null; created_at:string; listing?:{title:string;make_model:string}[]|null };
type BikePhoto = { area: string; file: File };
const BIKE_PHOTO_GUIDE = [
  { id:'main-side', title:'Full bike · drive side', hint:'Show the complete bike from the chain and gears side. This is the listing cover photo.', required:true },
  { id:'other-side', title:'Full bike · opposite side', hint:'Show the complete bike from the side without the chain and gears.', required:true },
  { id:'front-assembly', title:'Front wheel, fork & brake', hint:'Get close enough to show the tyre, wheel, fork and front brake clearly.', required:true },
  { id:'rear-assembly', title:'Rear wheel, gears & brake', hint:'Show the rear tyre, brake, gears and hub or motor if visible.', required:true },
  { id:'drive-system', title:'Drive system close-up', hint:'Show the chain, crank and gears, or the scooter/e-bike drive system.', required:true },
  { id:'cockpit', title:'Handlebars & controls', hint:'Show the levers, grips, display, throttle and controls.', required:true },
  { id:'brand-model', title:'Brand & model markings', hint:'Photograph the logo, model name, badges or frame decals. Keep the serial-number photo separate.', required:true },
  { id:'wheels-tyres', title:'Wheels & tyre condition', hint:'Show tyre tread, sidewalls and any visible size markings.', required:false },
  { id:'battery-motor', title:'Battery & motor (if fitted)', hint:'Show the battery, motor, charging port and display where fitted.', required:false },
  { id:'wear-damage', title:'Wear or damage close-up', hint:'Photograph scratches, rust, damage, wear or any fault you want the buyer to see.', required:false },
] as const;

const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const STATUS: Record<string,string> = { pending_approval: 'Awaiting review', active: 'Live', sold: 'Sold', cancelled: 'Archived', rejected: 'Needs changes' };

/** Shared marketplace surface used by the public website and customer app. */
export const MarketplacePanel: React.FC<{ staff?: boolean; enabled?: boolean }> = ({ staff = false, enabled = true }) => {
  const { currentUser } = useShop();
  const native = Capacitor.isNativePlatform();
  const checkoutEnabled = import.meta.env.VITE_MARKETPLACE_PAYMENTS_ENABLED === 'true';
  const [appNotice, setAppNotice] = useState(false);
  const [imageWarning, setImageWarning] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [busy, setBusy] = useState(false);
  const [resettingListings, setResettingListings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [payoutRefs, setPayoutRefs] = useState<Record<string,string>>({});
  const [files, setFiles] = useState<BikePhoto[]>([]);
  const [captureArea, setCaptureArea] = useState<string>(BIKE_PHOTO_GUIDE[0].id);
  const [serialPhoto, setSerialPhoto] = useState<File | null>(null);
  const [frameSerial, setFrameSerial] = useState('');
  const [aiInspection, setAiInspection] = useState<Record<string, any> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({ title:'', category:'bicycle', subcategory:'other', make_model:'', condition:'good', description:'', asking_price:'' });
  const userId = currentUser?.uid;

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setLoadError('');
    setImageWarning(false);
    try {
    const table = supabase.from('marketplace_listings');
    let query = userId || staff
      ? table.select('id,seller_id,title,category,make_model,condition,description,asking_price,images,status,created_at').order('created_at',{ascending:false})
      : table.select('id,title,category,make_model,condition,description,asking_price,images,status,created_at').order('created_at',{ascending:false});
    if (staff) query = query.in('status',['pending_approval','active','cancelled']);
    else if (userId) query = query.or(`status.eq.active,seller_id.eq.${userId}`);
    else query = query.eq('status','active');
    const { data, error } = await query;
    if (error) throw error;
    else {
      const rows = (data || []) as Listing[];
      const paths = rows.flatMap(row => row.images || []);
      const signed = paths.length ? await supabase.storage.from('marketplace-images').createSignedUrls(paths, 3600) : { data: [] };
      if ('error' in signed && signed.error) setImageWarning(true);
      const signedByPath = new Map((signed.data || []).map((x:any) => [x.path, x.signedUrl]));
      setListings(rows.map(row => ({ ...row, images:(row.images || []).map(path => signedByPath.get(path) || '').filter(Boolean) })));
    }
    if (staff) {
      const { data: rows, error: ledgerError } = await supabase.from('marketplace_transactions').select('id,listing_id,seller_id,gross_amount,commission_amount,seller_payable,payment_status,payout_status,payout_reference,created_at,listing:marketplace_listings(title,make_model)').order('created_at',{ascending:false}).limit(50);
      if (ledgerError) toast.error('Could not load marketplace ledger.');
      else setLedger((rows || []) as LedgerRow[]);
    }
    } catch { setLoadError('We could not load the marketplace. Please refresh or contact Stakey’s Cycles if this continues.'); }
    finally { setLoading(false); }
  }, [staff,userId,enabled]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const txId = new URLSearchParams(window.location.search).get('marketplace_tx');
    if (!txId || staff || verifying || !native || !userId) return;
    setVerifying(true);
    void supabase.functions.invoke('marketplace-payments', { body: { action:'confirm', transaction_id:txId } }).then(({data,error}) => {
      if (error) throw error;
      if (data?.status === 'completed') toast.success('Payment confirmed. The seller payout has been queued for the shop.');
      else if (data?.status === 'cancelled') toast.error('That checkout was cancelled or expired.');
      else toast('Payment is still processing. Use refresh in a moment to check again.');
      const url = new URL(window.location.href); url.searchParams.delete('marketplace_tx'); window.history.replaceState(null,'',url.toString());
    }).catch((error:any) => toast.error(error?.message || 'Could not verify the payment yet. Refresh to try again.')).finally(() => setVerifying(false));
  }, [staff]);

  const identifyBike = async () => {
    if (!native || !userId) { setAppNotice(true); return; }
    const missingRequiredViews = BIKE_PHOTO_GUIDE.filter(area => area.required && !files.some(photo => photo.area === area.id));
    if (missingRequiredViews.length) { toast.error('Capture each required view: ' + missingRequiredViews.map(area => area.title).join(', ') + '.'); return; }
    if (files.length > 10) { toast.error('Capture up to 10 guided photos.'); return; }
    if (files.some(({file}) => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) { toast.error('Use JPG, PNG or WebP photos under 8 MB each.'); return; }
    setAnalyzing(true); setAiInspection(null);
    try {
      const orderedPhotos = files.slice().sort((a,b) => BIKE_PHOTO_GUIDE.findIndex(area => area.id === a.area) - BIKE_PHOTO_GUIDE.findIndex(area => area.id === b.area));
      const parts = (await Promise.all(orderedPhotos.map(async ({area,file}) => {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1100 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d'); if (!context) throw new Error('Could not prepare the photos on this device.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare a photo.')), 'image/jpeg', 0.72));
        const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
        const guide = BIKE_PHOTO_GUIDE.find(item => item.id === area);
        return [{ text: 'Photo area: ' + (guide?.title || area) + '. Requested view: ' + (guide?.hint || '') }, { inlineData: { mimeType: 'image/jpeg', data: btoa(binary) } }];
      }))).flat();
      const prompt = [
        'Identify the bicycle, e-bike or scooter in these seller photos using only visible evidence. Each image is preceded by its named bike area and requested view; inspect that area closely, combine evidence across the labeled views, and report which areas are still unclear. Never invent an exact model, year, component specification, condition, fault, frame serial number, ownership or stolen status.',
        'Return one JSON object only with keys make, model, year, type, category, subcategory, colour, frameMaterial, overallCondition, wheelSizeAndSpecs, confidence, coverage, summary, suggestedTitle, suggestedDescription, mainSpecs, obviousProblems, faults, photoRequests, notVisible.',
        'category must be bicycle, ebike or escooter. For bicycle use subcategory commuter, hardtail_mtb, road or other. overallCondition must be new, excellent, good, fair or spares. confidence is 0 to 1 and coverage is 0 to 100.',
        'mainSpecs is a short array of objects containing componentName, category, currentPart, brand, model, specValue, condition, confidence, visibility, stockComparison, stockComparisonNote and specDetails. obviousProblems and faults must describe only clearly visible evidence. photoRequests lists helpful missing angles. notVisible lists facts the images cannot establish.',
        'Keep the suggested description factual and concise. Do not include serial numbers or private contact details. Do not claim ownership or safety has been verified.'
      ].join(' ');
      const reply = await generateGemini({ contents: [{ role:'user', parts:[{ text:prompt }, ...parts] }], config:{ responseMimeType:'application/json', maxOutputTokens:1800, temperature:0.2 } });
      const result = JSON.parse(reply.text.replace(new RegExp(String.fromCharCode(96).repeat(3) + '(?:json)?','gi'),'').trim());
      const make = String(result.make || '').trim().slice(0,100), model = String(result.model || '').trim().slice(0,140);
      if (!make || !model || /unknown|unidentified|not sure/i.test(make + ' ' + model)) throw new Error('The photos did not identify a reliable make and model. Add clearer angles and try again.');
      const category = ['bicycle','ebike','escooter'].includes(result.category) ? result.category : 'bicycle';
      const conditions = ['new','excellent','good','fair','spares'];
      const inspection = {
        make, model, year: typeof result.year === 'number' || typeof result.year === 'string' ? result.year : null,
        type:String(result.type || category).slice(0,40), colour:String(result.colour || '').slice(0,80) || null,
        frameMaterial:String(result.frameMaterial || '').slice(0,100) || null,
        overallCondition:conditions.includes(result.overallCondition) ? result.overallCondition : 'good',
        wheelSizeAndSpecs:String(result.wheelSizeAndSpecs || '').slice(0,160) || null,
        confidence:Math.max(0,Math.min(1,Number(result.confidence) || 0)), coverage:Math.max(0,Math.min(100,Number(result.coverage) || 0)),
        summary:String(result.summary || '').slice(0,800), hasVisualData:true, usedFallback:false,
        mainSpecs:Array.isArray(result.mainSpecs) ? result.mainSpecs.slice(0,25) : [],
        obviousProblems:Array.isArray(result.obviousProblems) ? result.obviousProblems.slice(0,20) : [],
        faults:Array.isArray(result.faults) ? result.faults.slice(0,20) : [],
        photoRequests:Array.isArray(result.photoRequests) ? result.photoRequests.slice(0,10) : [],
        notVisible:Array.isArray(result.notVisible) ? result.notVisible.slice(0,20) : [],
      };
      setAiInspection(inspection);
      setForm(previous => ({ ...previous, title:String(result.suggestedTitle || make + ' ' + model).slice(0,120), category, subcategory:['commuter','hardtail_mtb','road','other'].includes(result.subcategory) ? result.subcategory : 'other', make_model:make + ' ' + model, condition:inspection.overallCondition, description:String(result.suggestedDescription || inspection.summary || '').slice(0,2000) }));
      toast.success('Bike identified. Check the suggested details and correct them before listing.');
    } catch (error:any) { toast.error(error?.message || 'The AI could not identify the bike. Try clearer photos.'); }
    finally { setAnalyzing(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!native || !userId) { setAppNotice(true); return; }
    if (!aiInspection) { toast.error('Identify the bike from your photos before submitting.'); return; }
    const missingRequiredViews = BIKE_PHOTO_GUIDE.filter(area => area.required && !files.some(photo => photo.area === area.id));
    if (missingRequiredViews.length) { toast.error('Complete all required guided bike photos before submitting.'); return; }
    if (files.length > 10) { toast.error('Capture up to 10 guided listing photos.'); return; }
    if (!frameSerial.trim() || !serialPhoto) { toast.error('Enter the frame serial number and add a clear photo of it.'); return; }
    if (files.some(({file}) => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8*1024*1024) || !['image/jpeg','image/png','image/webp'].includes(serialPhoto.type) || serialPhoto.size > 8*1024*1024) { toast.error('Use JPG, PNG or WebP photos under 8 MB each.'); return; }
    const price = Number(form.asking_price);
    if (!Number.isFinite(price) || price <= 0 || price > 50000) { toast.error('Enter a valid asking price.'); return; }
    const identity = form.make_model.trim().split(/\s+/);
    if (identity.length < 2) { toast.error('Check and enter both the bike make and model.'); return; }
    const inspectionForListing = { ...aiInspection, make:identity[0], model:identity.slice(1).join(' ') };
    const orderedPhotos = files.slice().sort((a,b) => BIKE_PHOTO_GUIDE.findIndex(area => area.id === a.area) - BIKE_PHOTO_GUIDE.findIndex(area => area.id === b.area));
    setBusy(true); const uploadedPaths:string[]=[]; let keepUploads=false;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || auth.user.id !== userId || !auth.user.email_confirmed_at) throw new Error('Verify your email and sign in again before listing.');
      const id = crypto.randomUUID(), imagePaths:string[]=[];
      for (const [i,photo] of orderedPhotos.entries()) {
        const {file}=photo;
        const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg', objectPath=userId+'/'+id+'/'+i+'.'+ext;
        const { error }=await supabase.storage.from('marketplace-images').upload(objectPath,file,{contentType:file.type,upsert:false});
        if(error) throw error; uploadedPaths.push(objectPath); imagePaths.push(objectPath);
      }
      const serialExt=serialPhoto.type==='image/png'?'png':serialPhoto.type==='image/webp'?'webp':'jpg', serialPath=userId+'/'+id+'/serial-number.'+serialExt;
      const { error:serialError }=await supabase.storage.from('marketplace-images').upload(serialPath,serialPhoto,{contentType:serialPhoto.type,upsert:false});
      if(serialError) throw serialError; uploadedPaths.push(serialPath);
      const listing={id,seller_id:userId,title:form.title.trim(),category:form.category,subcategory:form.category==='bicycle'?form.subcategory:null,make_model:form.make_model.trim(),condition:form.condition,description:form.description.trim(),asking_price:Math.round(price*100)/100,images:imagePaths,ai_inspection:inspectionForListing};
      const {data,error}=await supabase.functions.invoke('marketplace-listings',{body:{action:'create',listing,frame_serial_number:frameSerial.trim(),serial_number_photo_path:serialPath}});
      if(error) {
        const response=(error as any).context;
        if(response instanceof Response) { const detail=await response.clone().json().catch(()=>null); if(detail?.message||detail?.error) throw new Error(detail.message||detail.error); }
        throw error;
      }
      if(!data?.listing_id) throw new Error(data?.error||'The listing could not be verified.');
      keepUploads=true;
      toast.success('Listing sent for review. It will appear publicly after shop approval.');
      announceMilestone({id:'marketplace-submitted:'+id,scope:userId,kind:'listing',title:'Listing submitted',detail:'The team will review it and its AI photo assessment before it goes live.'});
      setForm({title:'',category:'bicycle',subcategory:'other',make_model:'',condition:'good',description:'',asking_price:''});
      setFiles([]); setSerialPhoto(null); setFrameSerial(''); setAiInspection(null); setShowForm(false); await load();
    } catch(error:any) {
      if(!keepUploads&&uploadedPaths.length) await supabase.storage.from('marketplace-images').remove(uploadedPaths);
      toast.error(error?.message||'Could not submit the listing.');
    } finally { setBusy(false); }
  };

  const moderate = async (item: Listing, status: 'active'|'rejected'|'sold'|'pending_approval') => {
    const { error } = await supabase.from('marketplace_listings').update({ status }).eq('id',item.id);
    if (error) toast.error(`Could not update listing: ${error.message}`); else { toast.success(`Listing ${STATUS[status].toLowerCase()}.`); if (userId && (status === 'active' || status === 'sold')) announceMilestone({ id: `marketplace-${status}:${item.id}`, scope: userId, kind: status === 'sold' ? 'sale' : 'listing', title: status === 'sold' ? 'Sale recorded' : 'Listing approved', detail: status === 'sold' ? 'The listing has been marked as sold.' : 'This ride is now visible in the marketplace.' }); await load(); }
  };

  const archiveOpenListings = async () => {
    if (!staff || resettingListings) return;
    const openCount = listings.filter(item => item.status === 'pending_approval' || item.status === 'active').length;
    if (!openCount) { toast('There are no open marketplace listings to archive.'); return; }
    const confirmed = window.confirm(`Archive ${openCount} open marketplace listing${openCount === 1 ? '' : 's'}? They will be hidden from customers and marked cancelled. Sold listings and payment/payout history will stay untouched.`);
    if (!confirmed) return;
    setResettingListings(true);
    try {
      const { data, error } = await supabase.from('marketplace_listings').update({ status: 'cancelled' })
        .in('status', ['pending_approval', 'active']).select('id');
      if (error) throw error;
      const count = Array.isArray(data) ? data.length : 0;
      toast.success(`Archived ${count} open marketplace listing${count === 1 ? '' : 's'}.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || 'Could not archive the marketplace listings.');
    } finally { setResettingListings(false); }
  };

  const markPayoutPaid = async (tx: LedgerRow) => {
    const reference = (payoutRefs[tx.id] || '').trim();
    if (!reference) { toast.error('Enter the bank or payout reference first.'); return; }
    const { error } = await supabase.from('marketplace_transactions').update({ payout_status:'paid', payout_reference:reference, payout_paid_at:new Date().toISOString(), payout_paid_by:userId }).eq('id',tx.id);
    if (error) toast.error(`Payout update failed: ${error.message}`);
    else { toast.success('Payout recorded.'); await load(); }
  };

  const buy = async (item: Listing) => {
    if (!native || !userId) { setAppNotice(true); return; }
    if (!checkoutEnabled) { toast.error('Please contact the workshop to arrange this purchase.'); return; }
    setBuyingId(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('marketplace-payments', { body: { action:'create', listing_id:item.id } });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error(data?.error || 'SumUp could not start checkout.');
      window.location.assign(data.checkout_url);
    } catch (error:any) { toast.error(error?.message || 'Could not start checkout.'); setBuyingId(null); }
  };

  return <section className="mx-auto w-full max-w-6xl space-y-6" data-testid={staff?'staff-marketplace':'marketplace'}>
    <header className="rounded-3xl border border-emerald-400/15 bg-gradient-to-br from-emerald-950/60 via-neutral-950 to-neutral-900 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-emerald-300"><Store className="h-4 w-4"/> Local, moderated marketplace</div>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Bikes, e-bikes &amp; scooters</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">Browse rides listed by local owners. Every listing is reviewed by Stakey’s Cycles before it goes live.</p>
        </div>
        {!staff && <button type="button" onClick={()=> native && userId ? setShowForm(v=>!v) : setAppNotice(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-neutral-950 hover:bg-emerald-300">{showForm?<X className="h-4 w-4"/>:<ImagePlus className="h-4 w-4"/>}{showForm?'Close':'List your ride'}</button>}
      </div>
      {!staff && <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400"/>Email-verified accounts</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-400"/>Inspection and handover arranged locally</span></div>}
    </header>

    {staff&&<section className="rounded-2xl border border-amber-400/20 bg-amber-950/10 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Reset marketplace listings</h2><p className="mt-1 text-xs text-neutral-400">Archive all open listings at once. Sold listings and payment history are kept.</p></div><button type="button" disabled={resettingListings || listings.every(item => item.status !== 'pending_approval' && item.status !== 'active')} onClick={() => void archiveOpenListings()} className="min-h-10 rounded-lg border border-amber-400/40 px-3 text-xs font-bold text-amber-200 disabled:cursor-not-allowed disabled:opacity-40">{resettingListings ? 'Archiving…' : `Archive open listings (${listings.filter(item => item.status === 'pending_approval' || item.status === 'active').length})`}</button></div>{listings.some(item => item.status === 'cancelled')&&<div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-xs font-semibold text-neutral-300">Archived listings</p><div className="space-y-2">{listings.filter(item => item.status === 'cancelled').map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-neutral-950/60 p-3 text-xs"><span className="text-neutral-300">{item.title} · {item.make_model}</span><button type="button" onClick={() => void moderate(item, 'pending_approval')} className="min-h-9 rounded-lg border border-emerald-400/30 px-3 font-semibold text-emerald-200">Restore for review</button></div>)}</div></div>}</section>}
    {staff&&<section className="space-y-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-4 sm:p-5"><div><h2 className="font-bold text-white">Marketplace sales &amp; payout ledger</h2><p className="mt-1 text-xs text-neutral-400">SumUp charges the buyer’s full amount to the shop account. Seller balances are due for separate manual payout; this app does not send the payout. Admins can record completed payouts with a reference.</p></div>{ledger.length===0?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">No marketplace payments yet.</p>:<div className="space-y-2">{ledger.map(tx=><div key={tx.id} className="grid gap-3 rounded-xl border border-white/5 bg-neutral-950/70 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><div className="min-w-0"><div className="truncate font-semibold text-white">{tx.listing?.[0]?.title||'Marketplace item'} · {tx.listing?.[0]?.make_model||''}</div><div className="truncate font-mono text-neutral-500">Sale {tx.id} · seller {tx.seller_id}</div><div className="mt-1 text-neutral-500">{new Date(tx.created_at).toLocaleString()} · payment {tx.payment_status} · payout {tx.payout_status}{tx.payout_reference?` · ref ${tx.payout_reference}`:''}</div></div><div className="text-neutral-300">Gross <b className="text-white">{money(Number(tx.gross_amount))}</b></div><div className="text-neutral-300">Fee <b className="text-emerald-300">{money(Number(tx.commission_amount))}</b></div><div className="text-neutral-300">Seller due <b className="text-amber-200">{money(Number(tx.seller_payable))}</b></div>{currentUser?.role==='admin'&&tx.payment_status==='completed'&&tx.payout_status!=='paid'&&<div className="flex gap-2 sm:col-span-4"><input aria-label="Payout reference" value={payoutRefs[tx.id]??''} onChange={e=>setPayoutRefs({...payoutRefs,[tx.id]:e.target.value})} placeholder="Bank transfer / payout reference" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 text-xs text-white"/><button onClick={()=>void markPayoutPaid(tx)} className="min-h-10 rounded-lg bg-emerald-400 px-3 font-bold text-neutral-950">Record payout</button></div>}</div>)}</div>}</section>}

    {!staff && (!native || appNotice) && <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-5 text-sm leading-6 text-neutral-300" role="status"><h2 className="font-semibold text-white">Browse here. Buy and sell in the app.</h2><p className="mt-2">Open the Stakey’s Cycles app to sign in, list your ride or continue with a purchase. Contact the workshop if you need the current installation link.</p></aside>}
    {imageWarning && <p role="status" className="text-sm text-amber-200">Some listing photos could not be loaded. Refresh to try again.</p>}
    {!staff && loadError && <p role="alert" className="rounded-xl border border-amber-400/25 p-4 text-sm text-amber-200">{loadError}</p>}
    {staff && loadError && <p role="alert" className="text-sm text-amber-200">{loadError}</p>}
    {!staff && native && userId && showForm && <form onSubmit={submit} className="space-y-5 rounded-2xl border border-emerald-400/15 bg-neutral-900/90 p-4 sm:p-6" data-testid="marketplace-listing-form">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Sparkles className="h-6 w-6"/></div><div><h2 className="text-lg font-bold text-white">List your bike with AI</h2><p className="mt-1 text-sm leading-5 text-neutral-400">Take one camera photo for each guided area. Seven clear views are required; add up to three close-ups for a fuller Gemini assessment.</p></div></div>
      <section className="space-y-3 rounded-xl border border-white/10 bg-neutral-950/60 p-4" aria-label="AI bike identification">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-white">Step 1 · Photograph each area</p><p className="mt-1 text-xs leading-5 text-neutral-500">Tap a specific view to open the camera. The full drive-side view is always used as the listing cover. All labeled photos are sent together to Gemini.</p></div><span className="shrink-0 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">{files.length}/10 photos</span></div>
        <input id="marketplace-bike-photos" data-testid="marketplace-bike-photos" type="file" accept="image/*" capture="environment" onChange={e=>{const captured=e.target.files?.[0];if(captured){const photoArea=captureArea;setFiles(previous=>[...previous.filter(photo=>photo.area!==photoArea),{area:photoArea,file:captured}]);setAiInspection(null);const nextArea=BIKE_PHOTO_GUIDE.find(area=>area.id!==photoArea&&!files.some(photo=>photo.area===area.id));if(nextArea)setCaptureArea(nextArea.id);}e.target.value='';}} className="sr-only"/>
        <div className="grid gap-2 sm:grid-cols-2">{BIKE_PHOTO_GUIDE.map((area,index)=>{const captured=files.find(photo=>photo.area===area.id);return <div key={area.id} className="rounded-lg border border-white/10 bg-neutral-900 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-white">{index+1}. {area.title}{index===0&&<span className="ml-2 text-emerald-300">· Cover</span>}</p><p className="mt-1 text-[11px] leading-4 text-neutral-400">{area.hint}</p></div><span className="shrink-0 rounded-full bg-white/5 px-2 py-1 text-[10px] font-semibold text-neutral-400">{area.required?'Required':'Extra'}</span></div>{captured?<div className="mt-2 flex items-center justify-between gap-2 text-[11px]"><span className="min-w-0 truncate text-emerald-200">Captured · {captured.file.name}</span><button type="button" onClick={()=>{setFiles(previous=>previous.filter(photo=>photo.area!==area.id));setCaptureArea(area.id);setAiInspection(null);}} className="shrink-0 rounded-md px-2 py-1 font-semibold text-neutral-300">Retake</button><button type="button" aria-label={'Remove '+area.title} onClick={()=>{setFiles(previous=>previous.filter(photo=>photo.area!==area.id));setAiInspection(null);}} className="shrink-0 rounded-md px-2 py-1 font-semibold text-rose-200">Remove</button></div>:<button type="button" onClick={()=>{if(files.length>=10){toast.error('Remove an extra photo before capturing another.');return;}setCaptureArea(area.id);document.getElementById('marketplace-bike-photos')?.click();}} className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-emerald-400/25 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10">Capture this view</button>}</div>;})}</div>
        <div className="flex items-center justify-between gap-3 text-xs text-neutral-400"><span>{files.filter(photo=>BIKE_PHOTO_GUIDE.find(area=>area.id===photo.area)?.required).length}/7 required views captured</span><span>{Math.max(0,7-files.filter(photo=>BIKE_PHOTO_GUIDE.find(area=>area.id===photo.area)?.required).length)} still needed</span></div>
        <button type="button" onClick={()=>void identifyBike()} disabled={analyzing||BIKE_PHOTO_GUIDE.some(area=>area.required&&!files.some(photo=>photo.area===area.id))} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 font-bold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles className="h-4 w-4"/>{analyzing?'Identifying from the guided photos…':aiInspection?'Analyse photos again':'Identify bike and create listing'}</button>
        <p className="text-[11px] leading-4 text-neutral-500">Required views cover both sides, front, rear, drive system, controls and brand/model markings. Add relevant extra close-ups. The private serial-number photo is collected separately and is not sent to Gemini.</p>
      </section>
      {aiInspection&&<section className="space-y-4 rounded-xl border border-emerald-400/20 bg-emerald-950/20 p-4" data-testid="marketplace-ai-review">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-emerald-200">Step 2 · Review the AI draft</p><p className="mt-1 text-xs leading-5 text-neutral-300">{aiInspection.summary||'Check the identified details against your bike and correct anything that is wrong.'}</p></div><span className="shrink-0 rounded-full border border-emerald-300/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">{Math.round(Number(aiInspection.confidence||0)*100)}% match</span></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-neutral-300">Listing title<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"/></label><label className="text-xs font-semibold text-neutral-300">Make and model<input required maxLength={120} value={form.make_model} onChange={e=>{const value=e.target.value;setForm({...form,make_model:value});if(aiInspection){const parts=value.trim().split(/\s+/);setAiInspection({...aiInspection,make:parts[0]||'',model:parts.slice(1).join(' ')||aiInspection.model});}}} className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"/></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-neutral-300">Type<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="bicycle">Bicycle</option><option value="ebike">E-bike</option><option value="escooter">E-scooter</option></select></label>{form.category==='bicycle'&&<label className="text-xs font-semibold text-neutral-300">Bike style<select value={form.subcategory} onChange={e=>setForm({...form,subcategory:e.target.value})} className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="commuter">Commuter</option><option value="hardtail_mtb">Hardtail mountain bike</option><option value="road">Road bike</option><option value="other">Other</option></select></label>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-neutral-300">Visible condition<select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="new">New</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="spares">For spares or repair</option></select></label><label className="text-xs font-semibold text-neutral-300">Asking price (£)<input required type="number" min="1" max="50000" step="0.01" inputMode="decimal" value={form.asking_price} onChange={e=>setForm({...form,asking_price:e.target.value})} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"/></label></div>
        <label className="block text-xs font-semibold text-neutral-300">Description<textarea maxLength={2000} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Review the AI description, then add size, service history, accessories and known faults." className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"/></label>
        {Array.isArray(aiInspection.mainSpecs)&&aiInspection.mainSpecs.length>0&&<div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="mb-2 text-xs font-bold text-white">Visible component assessment</p><div className="space-y-1.5">{aiInspection.mainSpecs.slice(0,8).map((spec:any,index:number)=><p key={index} className="text-xs leading-5 text-neutral-300"><b>{spec.componentName||spec.category||'Component'}:</b> {spec.currentPart||spec.specValue||'Details unclear'}{spec.condition?' · '+spec.condition:''}</p>)}</div></div>}
        {Array.isArray(aiInspection.obviousProblems)&&aiInspection.obviousProblems.length>0&&<div className="rounded-lg border border-amber-400/20 bg-amber-950/20 p-3"><p className="mb-1 text-xs font-bold text-amber-100">Visible issues to check</p>{aiInspection.obviousProblems.slice(0,5).map((problem:any,index:number)=><p key={index} className="text-xs leading-5 text-amber-100/80">{problem.issue||problem.recommendation}</p>)}</div>}
        <label className="block text-xs font-semibold text-neutral-300">Frame serial number<input required maxLength={40} value={frameSerial} onChange={e=>setFrameSerial(e.target.value)} placeholder="Number stamped on the frame" className="mt-1.5 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"/><span className="mt-1 block font-normal text-neutral-500">Checked privately against Bike Index and never shown in your public listing.</span></label>
        <label className="block text-xs font-semibold text-neutral-300">Photo of frame serial number<input required type="file" accept="image/*" capture="environment" onChange={e=>setSerialPhoto(e.target.files?.[0]||null)} className="mt-1.5 block w-full text-xs text-neutral-400 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-emerald-400/15 file:px-3 file:text-emerald-200"/></label>
        <div className="flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80"><span className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>Review and correct the AI draft. Keep the serial number and private contact details out of the public description. The listing stays hidden until the shop approves it.</span><button disabled={busy||analyzing||!serialPhoto||!frameSerial.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-neutral-950 disabled:opacity-60">{busy&&<LoaderCircle className="h-4 w-4 animate-spin"/>}{busy?'Submitting for review…':'Submit for shop review'}</button></div>
      </section>}
    </form>}

    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">{staff?'Listings to review':'Available locally'}</h2><button onClick={()=>void load()} type="button" aria-label="Refresh listings" className="rounded-lg border border-white/10 p-2 text-neutral-400 hover:text-white"><RefreshCw className="h-4 w-4"/></button></div>
    {loading ? <div className="flex justify-center py-12 text-emerald-300"><LoaderCircle className="h-6 w-6 animate-spin"/></div> : loadError ? null : listings.length===0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center"><Bike className="mx-auto h-8 w-8 text-neutral-600"/><p className="mt-3 font-semibold text-white">{staff?'Nothing waiting for review':'No approved listings yet'}</p><p className="mt-1 text-sm text-neutral-500">{staff?'New seller listings will appear here.':'Check back soon, or list your ride to get started.'}</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80">
      <div className="relative aspect-[4/3] bg-neutral-950">{item.images?.[0]?<img src={item.images[0]} alt={item.title} loading="lazy" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Bike className="h-12 w-12 text-neutral-700"/></div>}<span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">{STATUS[item.status]||item.status}</span></div>
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-white">{item.title}</h3><p className="mt-0.5 text-xs capitalize text-neutral-400">{item.make_model} · {item.category==='ebike'?'E-bike':item.category==='escooter'?'E-scooter':'Bicycle'} · {item.condition}</p></div><strong className="shrink-0 font-mono text-lg text-emerald-300">{money(Number(item.asking_price))}</strong></div>{item.description&&<p className="line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-neutral-400">{item.description}</p>}
        {staff?<div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">{item.status==='pending_approval'&&<><button onClick={()=>void moderate(item,'active')} className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Approve listing</button><button onClick={()=>void moderate(item,'rejected')} className="min-h-10 rounded-lg border border-amber-400/30 px-3 text-xs font-bold text-amber-200">Request changes</button></>}{item.status==='active'&&<button onClick={()=>void moderate(item,'sold')} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold text-neutral-200">Mark sold</button>}{item.status==='cancelled'&&<button onClick={()=>void moderate(item,'pending_approval')} className="min-h-10 rounded-lg border border-emerald-400/30 px-3 text-xs font-bold text-emerald-200">Restore for review</button>}<span className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><Clock3 className="h-3.5 w-3.5"/>{new Date(item.created_at).toLocaleDateString()}</span></div>:item.status==='active'&&(!userId || item.seller_id!==userId)?<div className="space-y-2 border-t border-white/5 pt-3">{native && userId && !checkoutEnabled ? <a href="https://www.stakeyswheels.co.uk/?page=visit" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950">Arrange purchase with the workshop</a> : <button disabled={buyingId===item.id} onClick={()=>void buy(item)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950 disabled:opacity-60">{buyingId===item.id&&<LoaderCircle className="h-4 w-4 animate-spin"/>}{native && userId ? 'Buy securely with SumUp' : 'Use the app to buy'}</button>}<p className="text-[11px] leading-4 text-neutral-500">Confirm the item, handover arrangements and sale terms with the workshop before paying.</p></div>:<div className="border-t border-white/5 pt-3 text-xs leading-5 text-neutral-400"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-400"/>{item.status==='cancelled'?'Archived':item.seller_id===userId?'Your listing':'Sale completed'}</div>}
      </div></article>)}</div>}
    {!staff&&<p className="text-center text-[11px] leading-5 text-neutral-500">Peer-to-peer listings are supplied by private sellers. The shop checks listing submissions but does not certify condition or ownership. Confirm item details and sale terms before paying. Fees and seller payout terms must be confirmed with the workshop before a sale.</p>}
  </section>;
};

export default MarketplacePanel;
