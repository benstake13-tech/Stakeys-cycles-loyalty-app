import { announceMilestone } from '../utils/milestoneAnimations';
import { Capacitor } from '@capacitor/core';
import React, { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, CircleAlert, Clock3, ImagePlus, LoaderCircle, MapPin, RefreshCw, ShieldCheck, Store, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useShop } from '../context/ShopContext';

type Listing = {
  id: string; seller_id?: string; title: string; category: 'bicycle'|'ebike'|'escooter'; make_model: string;
  condition: string; description: string; asking_price: number; images: string[]; status: string; created_at: string;
};
type LedgerRow = { id:string; listing_id:string; seller_id:string; gross_amount:number; commission_amount:number; seller_payable:number; payment_status:string; payout_status:string; payout_reference?:string|null; created_at:string; listing?:{title:string;make_model:string}[]|null };

const money = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const STATUS: Record<string,string> = { pending_approval: 'Awaiting review', active: 'Live', sold: 'Sold', cancelled: 'Cancelled', rejected: 'Needs changes' };

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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [payoutRefs, setPayoutRefs] = useState<Record<string,string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ title:'', category:'bicycle', make_model:'', condition:'good', description:'', asking_price:'' });
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
    if (staff) query = query.in('status',['pending_approval','active']);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!native || !userId) { setAppNotice(true); return; }
    if (files.length > 5) { toast.error('Choose up to 5 photos.'); return; }
    if (files.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 8*1024*1024)) { toast.error('Use JPG, PNG or WebP photos under 8 MB each.'); return; }
    const price = Number(form.asking_price);
    if (!Number.isFinite(price) || price <= 0) { toast.error('Enter a valid asking price.'); return; }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || auth.user.id !== userId || !auth.user.email_confirmed_at) throw new Error('Verify your email and sign in again before listing.');
      const id = crypto.randomUUID();
      const imageUrls: string[] = [];
      for (const [i,file] of files.entries()) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${userId}/${id}/${i}.${ext}`;
        const { error } = await supabase.storage.from('marketplace-images').upload(path,file,{contentType:file.type,upsert:false});
        if (error) throw error;
        imageUrls.push(path);
      }
      const { error } = await supabase.from('marketplace_listings').insert({ id, seller_id:userId, ...form, asking_price:Math.round(price*100)/100, images:imageUrls, status:'pending_approval' });
      if (error) throw error;
      toast.success('Listing sent for review. It will appear publicly after approval.');
      announceMilestone({ id: `marketplace-submitted:${id}`, scope: userId, kind: 'listing', title: 'Listing submitted', detail: 'The team will review it before it goes live.' });
      setForm({title:'',category:'bicycle',make_model:'',condition:'good',description:'',asking_price:''}); setFiles([]); setShowForm(false); await load();
    } catch (err:any) { toast.error(err?.message || 'Could not submit the listing.'); }
    finally { setBusy(false); }
  };

  const moderate = async (item: Listing, status: 'active'|'rejected'|'sold') => {
    const { error } = await supabase.from('marketplace_listings').update({ status }).eq('id',item.id);
    if (error) toast.error(`Could not update listing: ${error.message}`); else { toast.success(`Listing ${STATUS[status].toLowerCase()}.`); if (userId && (status === 'active' || status === 'sold')) announceMilestone({ id: `marketplace-${status}:${item.id}`, scope: userId, kind: status === 'sold' ? 'sale' : 'listing', title: status === 'sold' ? 'Sale recorded' : 'Listing approved', detail: status === 'sold' ? 'The listing has been marked as sold.' : 'This ride is now visible in the marketplace.' }); await load(); }
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

    {staff&&<section className="space-y-3 rounded-2xl border border-white/10 bg-neutral-900/70 p-4 sm:p-5"><div><h2 className="font-bold text-white">Marketplace sales &amp; payout ledger</h2><p className="mt-1 text-xs text-neutral-400">SumUp charges the buyer’s full amount to the shop account. Seller balances are due for separate manual payout; this app does not send the payout. Admins can record completed payouts with a reference.</p></div>{ledger.length===0?<p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-neutral-500">No marketplace payments yet.</p>:<div className="space-y-2">{ledger.map(tx=><div key={tx.id} className="grid gap-3 rounded-xl border border-white/5 bg-neutral-950/70 p-3 text-xs sm:grid-cols-[1fr_auto_auto_auto]"><div className="min-w-0"><div className="truncate font-semibold text-white">{tx.listing?.[0]?.title||'Marketplace item'} · {tx.listing?.[0]?.make_model||''}</div><div className="truncate font-mono text-neutral-500">Sale {tx.id} · seller {tx.seller_id}</div><div className="mt-1 text-neutral-500">{new Date(tx.created_at).toLocaleString()} · payment {tx.payment_status} · payout {tx.payout_status}{tx.payout_reference?` · ref ${tx.payout_reference}`:''}</div></div><div className="text-neutral-300">Gross <b className="text-white">{money(Number(tx.gross_amount))}</b></div><div className="text-neutral-300">Fee <b className="text-emerald-300">{money(Number(tx.commission_amount))}</b></div><div className="text-neutral-300">Seller due <b className="text-amber-200">{money(Number(tx.seller_payable))}</b></div>{currentUser?.role==='admin'&&tx.payment_status==='completed'&&tx.payout_status!=='paid'&&<div className="flex gap-2 sm:col-span-4"><input aria-label="Payout reference" value={payoutRefs[tx.id]??''} onChange={e=>setPayoutRefs({...payoutRefs,[tx.id]:e.target.value})} placeholder="Bank transfer / payout reference" className="min-h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 text-xs text-white"/><button onClick={()=>void markPayoutPaid(tx)} className="min-h-10 rounded-lg bg-emerald-400 px-3 font-bold text-neutral-950">Record payout</button></div>}</div>)}</div>}</section>}

    {!staff && (!native || appNotice) && <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-5 text-sm leading-6 text-neutral-300" role="status"><h2 className="font-semibold text-white">Browse here. Buy and sell in the app.</h2><p className="mt-2">Open the Stakey’s Cycles app to sign in, list your ride or continue with a purchase. Contact the workshop if you need the current installation link.</p></aside>}
    {imageWarning && <p role="status" className="text-sm text-amber-200">Some listing photos could not be loaded. Refresh to try again.</p>}
    {!staff && loadError && <p role="alert" className="rounded-xl border border-amber-400/25 p-4 text-sm text-amber-200">{loadError}</p>}
    {staff && loadError && <p role="alert" className="text-sm text-amber-200">{loadError}</p>}
    {!staff && native && userId && showForm && <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-white/10 bg-neutral-900/80 p-5 sm:grid-cols-2" data-testid="marketplace-listing-form">
      <label className="text-xs font-semibold text-neutral-300">Listing title<input required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Trek hybrid bike, medium" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <label className="text-xs font-semibold text-neutral-300">Make and model<input required maxLength={120} value={form.make_model} onChange={e=>setForm({...form,make_model:e.target.value})} placeholder="Brand and model" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <label className="text-xs font-semibold text-neutral-300">Type<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="bicycle">Bicycle</option><option value="ebike">E-bike</option><option value="escooter">E-scooter</option></select></label>
      <label className="text-xs font-semibold text-neutral-300">Condition<select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})} className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white"><option value="new">New</option><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="spares">For spares or repair</option></select></label>
      <label className="text-xs font-semibold text-neutral-300">Asking price (£)<input required type="number" min="1" max="50000" step="0.01" inputMode="decimal" value={form.asking_price} onChange={e=>setForm({...form,asking_price:e.target.value})} placeholder="0.00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <label className="text-xs font-semibold text-neutral-300">Photos (up to 5)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setFiles(Array.from(e.target.files||[]).slice(0,5))} className="mt-1.5 block w-full text-xs text-neutral-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-400/15 file:px-3 file:py-2 file:text-emerald-200"/><span className="mt-1 block font-normal text-neutral-500">Available to every signed-in, email-verified seller. Staff permission is not needed to upload photos.</span></label>
      <label className="text-xs font-semibold text-neutral-300 sm:col-span-2">Description<textarea maxLength={2000} rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Size, service history, included accessories and any known faults" className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-3 text-sm text-white outline-none focus:border-emerald-400/60"/></label>
      <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-amber-950/20 p-3 text-xs leading-5 text-amber-100/80"><span className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>A listing is not live until the shop approves it. Do not include a frame serial number or private contact details in the description. Handover and payment terms are agreed before any sale.</span><button disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-emerald-400 px-5 py-2.5 font-bold text-neutral-950 disabled:opacity-60">{busy&&<LoaderCircle className="h-4 w-4 animate-spin"/>}Submit for review</button></div>
    </form>}

    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-white">{staff?'Listings to review':'Available locally'}</h2><button onClick={()=>void load()} type="button" aria-label="Refresh listings" className="rounded-lg border border-white/10 p-2 text-neutral-400 hover:text-white"><RefreshCw className="h-4 w-4"/></button></div>
    {loading ? <div className="flex justify-center py-12 text-emerald-300"><LoaderCircle className="h-6 w-6 animate-spin"/></div> : loadError ? null : listings.length===0 ? <div className="rounded-2xl border border-dashed border-white/10 px-5 py-12 text-center"><Bike className="mx-auto h-8 w-8 text-neutral-600"/><p className="mt-3 font-semibold text-white">{staff?'Nothing waiting for review':'No approved listings yet'}</p><p className="mt-1 text-sm text-neutral-500">{staff?'New seller listings will appear here.':'Check back soon, or list your ride to get started.'}</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80">
      <div className="relative aspect-[4/3] bg-neutral-950">{item.images?.[0]?<img src={item.images[0]} alt={item.title} loading="lazy" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center"><Bike className="h-12 w-12 text-neutral-700"/></div>}<span className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">{STATUS[item.status]||item.status}</span></div>
      <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-white">{item.title}</h3><p className="mt-0.5 text-xs capitalize text-neutral-400">{item.make_model} · {item.category==='ebike'?'E-bike':item.category==='escooter'?'E-scooter':'Bicycle'} · {item.condition}</p></div><strong className="shrink-0 font-mono text-lg text-emerald-300">{money(Number(item.asking_price))}</strong></div>{item.description&&<p className="line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-neutral-400">{item.description}</p>}
        {staff?<div className="flex flex-wrap gap-2 border-t border-white/5 pt-3">{item.status==='pending_approval'&&<><button onClick={()=>void moderate(item,'active')} className="min-h-10 rounded-lg bg-emerald-400 px-3 text-xs font-bold text-neutral-950">Approve listing</button><button onClick={()=>void moderate(item,'rejected')} className="min-h-10 rounded-lg border border-amber-400/30 px-3 text-xs font-bold text-amber-200">Request changes</button></>}{item.status==='active'&&<button onClick={()=>void moderate(item,'sold')} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-bold text-neutral-200">Mark sold</button>}<span className="inline-flex items-center gap-1 text-[11px] text-neutral-500"><Clock3 className="h-3.5 w-3.5"/>{new Date(item.created_at).toLocaleDateString()}</span></div>:item.status==='active'&&(!userId || item.seller_id!==userId)?<div className="space-y-2 border-t border-white/5 pt-3">{native && userId && !checkoutEnabled ? <a href="https://www.stakeyswheels.co.uk/?page=visit" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950">Arrange purchase with the workshop</a> : <button disabled={buyingId===item.id} onClick={()=>void buy(item)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 text-sm font-bold text-neutral-950 disabled:opacity-60">{buyingId===item.id&&<LoaderCircle className="h-4 w-4 animate-spin"/>}{native && userId ? 'Buy securely with SumUp' : 'Use the app to buy'}</button>}<p className="text-[11px] leading-4 text-neutral-500">Confirm the item, handover arrangements and sale terms with the workshop before paying.</p></div>:<div className="border-t border-white/5 pt-3 text-xs leading-5 text-neutral-400"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-400"/>{item.seller_id===userId?'Your listing':'Sale completed'}</div>}
      </div></article>)}</div>}
    {!staff&&<p className="text-center text-[11px] leading-5 text-neutral-500">Peer-to-peer listings are supplied by private sellers. The shop checks listing submissions but does not certify condition or ownership. Confirm item details and sale terms before paying. Fees and seller payout terms must be confirmed with the workshop before a sale.</p>}
  </section>;
};

export default MarketplacePanel;
