import React,{useRef,useState} from 'react';
import {HeartHandshake,CheckCircle2} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useShop} from '../context/ShopContext';

export function BikeDonationSection(){
 const {currentUser}=useShop();
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 const requestId=useRef<string|null>(null);
 const [form,setForm]=useState({name:currentUser?.displayName||'',email:currentUser?.email||'',phone:'',postcode:'',bike:'',condition:'not_sure',notes:'',consent:false});
 const field=(key:string,value:string|boolean)=>setForm(previous=>({...previous,[key]:value}));
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy||!form.consent)return;setBusy(true);setError('');
  try{
   requestId.current??=crypto.randomUUID();
   const {error}=await supabase.rpc('submit_bike_donation',{p_id:requestId.current,p_name:form.name.trim(),p_email:form.email.trim(),p_phone:form.phone.trim(),p_postcode:form.postcode.trim(),p_bike:form.bike.trim(),p_condition:form.condition,p_notes:form.notes.trim(),p_consent:form.consent});
   if(error)throw error;setSent(true);
  }catch{setError('Your donation offer could not be saved. Please retry — your details are still here.');}
  finally{setBusy(false);}
 }
 const input='mt-1.5 min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none';
 return <section className="rounded-3xl border border-emerald-300/25 bg-gradient-to-br from-emerald-950/50 via-neutral-950/80 to-cyan-950/30 p-5 shadow-xl backdrop-blur-xl sm:p-7" aria-labelledby="bike-donation-heading">
  <div className="flex items-start gap-3"><HeartHandshake className="mt-1 h-7 w-7 shrink-0 text-emerald-300" aria-hidden="true"/><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Give a bike a new purpose</p><h2 id="bike-donation-heading" className="mt-2 text-2xl font-bold text-white">Donate a bicycle</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-200">Our aim is to repair donated bicycles and pass them on free of charge to people with disabilities. We’ll reach out to local support services to develop the referral and handover process together.</p><p className="mt-2 max-w-2xl text-xs leading-5 text-neutral-400">Offer a bike below. The workshop will review its condition and contact you about suitability and handover before accepting it. Collection and placement depend on the support available.</p></div></div>
  {sent?<div role="status" className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-100"><CheckCircle2 className="mb-2 h-6 w-6"/><h3 className="font-bold">Donation offer received</h3><p className="mt-2 text-sm">Thank you. Your offer is saved with the workshop. We’ll contact you using the details you provided to discuss the bike and next steps.</p></div>:<>
   <button type="button" aria-expanded={open} aria-controls="bike-donation-form" onClick={()=>setOpen(!open)} className="mt-5 min-h-11 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">{open?'Close donation form':'Offer a bike to donate'}</button>
   {open&&<form id="bike-donation-form" aria-label="Bicycle donation offer" onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
    <label className="text-sm text-neutral-200">Donor name<input required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={e=>field('name',e.target.value)} className={input}/></label>
    <label className="text-sm text-neutral-200">Contact email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>field('email',e.target.value)} className={input}/></label>
    <label className="text-sm text-neutral-200">Phone (optional)<input type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={e=>field('phone',e.target.value)} className={input}/></label>
    <label className="text-sm text-neutral-200">Postcode (optional)<input maxLength={12} autoComplete="postal-code" value={form.postcode} onChange={e=>field('postcode',e.target.value)} className={input}/></label>
    <label className="text-sm text-neutral-200 sm:col-span-2">Bicycle details<input required minLength={3} maxLength={500} placeholder="Make, model, size or type, if known" value={form.bike} onChange={e=>field('bike',e.target.value)} className={input}/></label>
    <label className="text-sm text-neutral-200 sm:col-span-2">Bicycle condition<select value={form.condition} onChange={e=>field('condition',e.target.value)} className={input}><option value="working">Working</option><option value="needs_repairs">Needs repairs</option><option value="not_sure">Not sure</option></select></label>
    <label className="text-sm text-neutral-200 sm:col-span-2">Condition notes (optional)<textarea rows={3} maxLength={1500} placeholder="Known faults, missing parts, or anything the workshop should know" value={form.notes} onChange={e=>field('notes',e.target.value)} className={input}/></label>
    <label className="flex items-start gap-3 text-xs leading-5 text-neutral-300 sm:col-span-2"><input required type="checkbox" checked={form.consent} onChange={e=>field('consent',e.target.checked)} className="mt-1 h-4 w-4 shrink-0"/>I agree that Stakey’s Cycles can store these details and contact me about this bicycle donation.</label>
    {error&&<p role="alert" className="text-sm text-rose-200 sm:col-span-2">{error}</p>}
    <button disabled={busy||!form.consent} className="min-h-11 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-neutral-950 disabled:opacity-50 sm:col-span-2">{busy?'Sending donation offer…':'Send donation offer'}</button>
   </form>}
  </>}
 </section>;
}
