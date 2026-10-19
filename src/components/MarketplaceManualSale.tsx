import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

type Props = { sellerCompletion?:boolean; listing: { id: string; title: string; asking_price: number }; onClose: () => void; onRecorded: () => Promise<void> };

/** Staff records an offline sale without asserting that card payment was taken. */
export function MarketplaceManualSale({ listing, onClose, onRecorded, sellerCompletion=false }: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [amount, setAmount] = useState(String(listing.asking_price));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || contact.trim().length < 3 || !(Number(amount) > 0)) return;
    setBusy(true);
    try {
    const { error } = await supabase.rpc('record_marketplace_manual_sale', {
      p_listing_id: listing.id, p_buyer_name: name.trim(), p_buyer_contact: contact.trim(),
      p_amount: Number(amount), p_note: note.trim(),
    });
    if (error) { toast.error(error.message || 'Could not record the sale.'); setBusy(false); return; }
    toast.success('Offline sale and buyer details recorded.');
    await onRecorded();
    onClose();
    } catch {toast.error('Could not save the sale. Please retry; your details are still here.');}
    finally {setBusy(false);}
  };

  return <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Record offline marketplace sale" className="w-full max-w-lg space-y-4 rounded-t-2xl border border-emerald-400/30 bg-neutral-900 p-5 sm:rounded-2xl">
      <div><h2 className="font-bold text-white">{sellerCompletion?'Mark sale as complete':'Record offline sale'}</h2><p className="mt-1 text-sm text-neutral-300">{listing.title}</p><p className="mt-2 text-xs leading-5 text-amber-200">This marks the listing sold immediately and saves the buyer and sale amount. The sold advert stays visible for 2 days, then leaves the public marketplace automatically. It does not verify payment or create a SumUp transaction.</p></div>
      <label className="block text-xs font-semibold text-neutral-200">Buyer name<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-neutral-950 px-3 text-sm text-white"/></label>
      <label className="block text-xs font-semibold text-neutral-200">Buyer email or phone<input required minLength={3} maxLength={200} value={contact} onChange={event => setContact(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-neutral-950 px-3 text-sm text-white"/></label>
      <label className="block text-xs font-semibold text-neutral-200">Actual sale amount (£)<input required type="number" min="0.01" max="50000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-white/15 bg-neutral-950 px-3 text-sm text-white"/></label>
      <label className="block text-xs font-semibold text-neutral-200">Sale note (optional)<textarea maxLength={500} rows={2} value={note} onChange={event => setNote(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/15 bg-neutral-950 px-3 py-2 text-sm text-white"/></label>
      <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-lg border border-white/15 text-sm text-neutral-200">Cancel</button><button disabled={busy || name.trim().length < 2 || contact.trim().length < 3 || Number(amount) <= 0} className="min-h-11 flex-1 rounded-lg bg-emerald-400 text-sm font-bold text-neutral-950 disabled:opacity-50">{busy ? 'Recording…' : sellerCompletion?'Mark as complete':'Save sale record'}</button></div>
    </form>
  </div>;
}
