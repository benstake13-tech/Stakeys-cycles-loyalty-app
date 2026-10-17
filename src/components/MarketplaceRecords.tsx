import React, { useCallback, useEffect, useState } from 'react';
import { Bike, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Person = { id?: string; name?: string | null; email?: string | null; phone?: string | null; contact?: string | null } | null;
type BikeSnapshot = {
  title?: string; category?: string; subcategory?: string | null; make_model?: string;
  condition?: string; description?: string; asking_price?: number; frame_serial?: string | null;
  serial_check_status?: string | null; image_paths?: string[];
  ai_inspection?: { summary?: string | null } | null;
};
type RecordRow = {
  listing_id: string; seller_id: string; seller_snapshot: Person; bike_snapshot: BikeSnapshot;
  sale_mode: 'fixed' | 'auction'; listing_status: string;
  listing_created_at: string; recorded_at: string; updated_at: string;
};
type RecordEvent = {
  id: number; listing_id: string; event_type: string; actor_id: string | null;
  people: { seller?: Person; buyer?: Person; bidder?: Person; winner?: Person };
  details: Record<string, unknown>; bike_snapshot: BikeSnapshot | null; occurred_at: string;
};

const PAGE_SIZE = 50;
const money = (value: unknown) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value) || 0);
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

function Party({ title, person }: { title: string; person: Person }) {
  if (!person) return null;
  return <div className="rounded-xl border border-white/10 bg-neutral-950/70 p-3 text-xs">
    <p className="font-bold uppercase tracking-wide text-emerald-300">{title}</p>
    <p className="mt-1 font-semibold text-white">{person.name || 'Name not supplied'}</p>
    {person.email && <p className="break-all text-neutral-300">{person.email}</p>}
    {person.phone && <p className="text-neutral-300">{person.phone}</p>}
    {person.contact && <p className="break-all text-neutral-300">{person.contact}</p>}
    <p className="mt-1 break-all font-mono text-[10px] text-neutral-500">Account {person.id || 'not available'}</p>
  </div>;
}

function EventDetail({ event }: { event: RecordEvent }) {
  const d = event.details || {};
  const amount = d.amount ?? d.highest_bid ?? d.gross_amount;
  return <li className="rounded-xl border border-white/10 bg-neutral-950/60 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-white">{label(event.event_type)}</strong><time className="text-neutral-500">{new Date(event.occurred_at).toLocaleString('en-GB')}</time></div>
    {amount != null && <p className="mt-1 font-mono text-emerald-200">{money(amount)}</p>}
    {d.payment_status != null && <p className="mt-1 text-neutral-300">Payment: {String(d.payment_status)} · Payout: {String(d.payout_status || 'not due')}{d.commission_amount != null ? ` · Fee: ${money(d.commission_amount)}` : ''}{d.seller_payable != null ? ` · Seller due: ${money(d.seller_payable)}` : ''}</p>}
    {d.status != null && <p className="mt-1 text-neutral-300">Auction: {String(d.status)}{d.ends_at ? ` · Ends ${new Date(String(d.ends_at)).toLocaleString('en-GB')}` : ''}</p>}
    {d.previous_status != null && <p className="mt-1 text-neutral-400">From {String(d.previous_status)} to {String(d.status)}</p>}
    {d.historical_import === true && <p className="mt-1 text-amber-200">Imported from existing data. Contact details reflect the import time.</p>}
    {d.transaction_id != null && <p className="mt-1 break-all font-mono text-[10px] text-neutral-500">Transaction {String(d.transaction_id)}</p>}
    {d.payout_reference != null && <p className="mt-1 text-neutral-400">Payout reference: {String(d.payout_reference)}</p>}
    {(event.people?.buyer || event.people?.bidder || event.people?.winner) && <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <Party title={event.people.buyer ? 'Buyer' : event.people.bidder ? 'Bidder' : 'Winner'} person={event.people.buyer || event.people.bidder || event.people.winner || null}/>
    </div>}
  </li>;
}

/** Internal case files. Database RLS limits both tables to staff and admins. */
export function MarketplaceRecords() {
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [events, setEvents] = useState<RecordEvent[]>([]);
  const [recordPage, setRecordPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [moreRecords, setMoreRecords] = useState(false);
  const [moreEvents, setMoreEvents] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadRecords = useCallback(async (page = 0) => {
    setBusy(true);
    try {
      const { data, error: queryError } = await supabase.from('marketplace_records')
        .select('listing_id,seller_id,seller_snapshot,bike_snapshot,sale_mode,listing_status,listing_created_at,recorded_at,updated_at')
        .order('updated_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (queryError) throw queryError;
      const rows = (data || []) as RecordRow[];
      setRecords(current => page ? [...current, ...rows] : rows);
      if (!page) setSelected(current => current ? rows.find(row => row.listing_id === current.listing_id) || current : null);
      setMoreRecords(rows.length === PAGE_SIZE);
      setRecordPage(page);
      setError('');
    } catch {
      setError('Marketplace history could not be loaded. Check your staff access and refresh.');
    } finally {
      setBusy(false);
    }
  }, []);

  const loadEvents = useCallback(async (listingId: string, page = 0) => {
    try {
      const { data, error: queryError } = await supabase.from('marketplace_record_events')
        .select('id,listing_id,event_type,actor_id,people,details,bike_snapshot,occurred_at')
        .eq('listing_id', listingId).order('occurred_at', { ascending: false })
        .order('id', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (queryError) throw queryError;
      const rows = (data || []) as RecordEvent[];
      setEvents(current => page ? [...current, ...rows] : rows);
      setMoreEvents(rows.length === PAGE_SIZE);
      setEventPage(page);
    } catch {
      setError('This case timeline could not be loaded.');
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);
  useEffect(() => { if (selected) void loadEvents(selected.listing_id); else setEvents([]); }, [selected?.listing_id, loadEvents]);

  const visible = records.filter(record => {
    const bike = record.bike_snapshot || {};
    return `${bike.title || ''} ${bike.make_model || ''} ${bike.frame_serial || ''} ${record.seller_snapshot?.name || ''} ${record.seller_snapshot?.email || ''} ${record.listing_id}`.toLowerCase().includes(search.trim().toLowerCase());
  });
  const bike = selected?.bike_snapshot || {};

  return <section className="space-y-4 rounded-2xl border border-emerald-400/20 bg-neutral-900/70 p-4 sm:p-5" data-testid="marketplace-records">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-5 w-5 text-emerald-300"/>Marketplace records</h2><p className="mt-1 text-xs leading-5 text-neutral-400">Staff-only bike, seller, bidder, buyer, auction and payment history. Archived and sold listings remain here.</p></div><button type="button" onClick={() => { void loadRecords(); if (selected) void loadEvents(selected.listing_id); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs text-neutral-200"><RefreshCw className="h-4 w-4"/>Refresh records</button></div>
    {error && <p role="alert" className="rounded-lg border border-rose-400/30 p-3 text-xs text-rose-200">{error}</p>}
    <label className="block text-xs text-neutral-300">Search loaded records by bike, serial, seller or ID<input value={search} onChange={event => setSearch(event.target.value)} className="mt-1.5 min-h-10 w-full rounded-lg border border-white/10 bg-neutral-950 px-3 text-sm text-white"/></label>
    <div className="grid gap-4 lg:grid-cols-[minmax(210px,.7fr)_minmax(0,1.3fr)]">
      <div className="max-h-[34rem] space-y-2 overflow-y-auto">
        {visible.length === 0 && <p className="rounded-xl border border-white/10 p-4 text-xs text-neutral-400">{busy ? 'Loading records…' : 'No matching records loaded.'}</p>}
        {visible.map(record => <button key={record.listing_id} type="button" onClick={() => setSelected(record)} className={`w-full rounded-xl border p-3 text-left ${selected?.listing_id === record.listing_id ? 'border-emerald-400/60 bg-emerald-950/30' : 'border-white/10 bg-neutral-950/60'}`}>
          <span className="block truncate text-sm font-semibold text-white">{record.bike_snapshot?.title || 'Marketplace bike'}</span>
          <span className="mt-1 block text-xs text-neutral-300">{record.bike_snapshot?.make_model || 'Model not supplied'} · {record.sale_mode}</span>
          <span className="mt-1 block text-[11px] text-neutral-500">{record.listing_status} · {new Date(record.updated_at).toLocaleDateString('en-GB')}</span>
        </button>)}
        {moreRecords && <button disabled={busy} onClick={() => void loadRecords(recordPage + 1)} className="min-h-10 w-full rounded-lg border border-emerald-400/30 text-xs text-emerald-200 disabled:opacity-50">Load older records</button>}
      </div>
      {selected ? <div className="min-w-0 space-y-4 rounded-xl border border-white/10 bg-neutral-950/40 p-3 sm:p-4">
        <div><p className="flex items-center gap-2 text-sm font-bold text-white"><Bike className="h-4 w-4 text-emerald-300"/>{bike.title || 'Bike details'}</p><p className="mt-1 text-xs text-neutral-300">{bike.make_model || 'Unknown model'} · {bike.category || 'Unknown category'}{bike.subcategory ? ` / ${bike.subcategory}` : ''} · {bike.condition || 'Condition unknown'}</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-neutral-300">{bike.description || 'No description supplied.'}</p><p className="mt-2 text-xs text-emerald-200">Listed at {money(bike.asking_price)} · Frame serial: {bike.frame_serial || 'Not recorded'} · Check: {bike.serial_check_status || 'Not recorded'}</p>{bike.ai_inspection?.summary && <p className="mt-2 text-xs text-neutral-400">Photo assessment: {bike.ai_inspection.summary}</p>}<p className="mt-2 break-all font-mono text-[10px] text-neutral-500">Listing {selected.listing_id} · {bike.image_paths?.length || 0} saved photo reference(s)</p></div>
        <Party title="Seller at submission" person={selected.seller_snapshot}/>
        <div><h3 className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 className="h-4 w-4 text-emerald-300"/>Case timeline</h3><ol className="mt-2 space-y-2">{events.map(event => <EventDetail key={event.id} event={event}/>)}</ol>{moreEvents && <button onClick={() => void loadEvents(selected.listing_id, eventPage + 1)} className="mt-2 min-h-10 w-full rounded-lg border border-emerald-400/30 text-xs text-emerald-200">Load earlier events</button>}</div>
      </div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-neutral-400">Select a record to review its bike and people involved.</p>}
    </div>
  </section>;
}
