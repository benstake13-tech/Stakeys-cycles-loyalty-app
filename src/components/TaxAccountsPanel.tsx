import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Expense = {
  id: string; spent_on: string; supplier: string; description: string; category: string;
  gross_amount: number; vat_amount: number; business_use_percent: number;
  evidence_reference: string; claim_status: 'review' | 'approved' | 'excluded';
};
const categories = ['Stock / parts for resale', 'Tools and equipment', 'Workshop rent and utilities', 'Insurance', 'Advertising and website', 'Phone and internet', 'Vehicle and travel', 'Professional fees', 'Bank and card fees', 'Training', 'Other'];
const gbp = (n: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
const csvCell = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const TaxAccountsPanel: React.FC<{ incomeGross: number; startDate: string; endDate: string }> = ({ incomeGross, startDate, endDate }) => {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [vatStatus, setVatStatus] = useState<'unknown' | 'registered' | 'not_registered'>('unknown');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState('');
  const [vat, setVat] = useState('0');
  const [businessUse, setBusinessUse] = useState('100');
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('tax_expenses').select('*').order('spent_on', { ascending: false }).limit(5000);
    if (error) setNotice('Expense ledger unavailable. Apply the tax_expenses migration and check staff permissions: ' + error.message);
    else { setRows((data || []) as Expense[]); setNotice(''); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const periodRows = useMemo(() => rows.filter(r => r.spent_on >= startDate && r.spent_on <= endDate), [rows, startDate, endDate]);
  // VAT must never be reclaimed until registration and invoice eligibility are confirmed.
  // Conservative provisional deduction: gross business-use share; capital/stock rules need review.
  const approved = periodRows.filter(r => r.claim_status === 'approved');
  const allowable = round(approved.reduce((sum, r) => sum + Number(r.gross_amount) * Number(r.business_use_percent) / 100, 0));
  const pending = periodRows.filter(r => r.claim_status === 'review');
  const potential = round(pending.reduce((sum, r) => sum + Number(r.gross_amount) * Number(r.business_use_percent) / 100, 0));
  const estimatedProfit = round(incomeGross - allowable);
  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Number(amount), inputVat = Number(vat), use = Number(businessUse);
    if (!supplier.trim() || !spentOn || !Number.isFinite(gross) || gross <= 0 || !Number.isFinite(inputVat) || inputVat < 0 || inputVat > gross || !Number.isFinite(use) || use < 0 || use > 100) {
      setNotice('Enter a supplier, date, positive gross amount, valid VAT amount and business-use percentage.'); return;
    }
    setBusy(true);
    const { error } = await supabase.from('tax_expenses').insert({
      spent_on: spentOn, supplier: supplier.trim(), description: description.trim(), category,
      gross_amount: round(gross), vat_amount: round(inputVat), business_use_percent: use,
      evidence_reference: evidence.trim(), claim_status: 'review',
    });
    setBusy(false);
    if (error) { setNotice('Expense not saved: ' + error.message); return; }
    setSupplier(''); setDescription(''); setAmount(''); setVat('0'); setEvidence('');
    await load();
  };
  const changeStatus = async (row: Expense, status: Expense['claim_status']) => {
    const { error } = await supabase.from('tax_expenses').update({ claim_status: status, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (error) { setNotice('Claim review not saved: ' + error.message); return; }
    await load();
  };
  const exportCsv = () => {
    const headers = ['Date','Supplier','Description','Category','Gross GBP','VAT shown GBP','Business use %','Provisional business cost GBP','Evidence reference','Claim review'];
    const lines = periodRows.map(r => [r.spent_on,r.supplier,r.description,r.category,r.gross_amount,r.vat_amount,r.business_use_percent,round(r.gross_amount*r.business_use_percent/100),r.evidence_reference,r.claim_status]);
    const csv = [headers,...lines].map(line => line.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `stakeys-tax-expenses-${startDate}-${endDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const inputClass = 'rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-white w-full';
  return <section className="rounded-xl border border-emerald-800/50 bg-neutral-950 p-4 space-y-4" data-testid="tax-accounts-panel">
    <div><h2 className="text-lg font-bold text-white">Tax &amp; Accounts · Sole trader</h2>
      <p className="text-xs text-neutral-400">Expense ledger, claim review and provisional profit for {startDate} to {endDate}. Not an HMRC filing or a final tax calculation.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {([['Recorded income (gross)', incomeGross], ['Approved business-use costs', allowable], ['Costs awaiting review', potential], ['Provisional profit before tax', estimatedProfit]] as const).map(([label,value]) =>
        <div key={label} className="rounded-lg border border-neutral-800 p-3"><p className="text-[11px] text-neutral-400">{label}</p><strong className="text-lg text-white">{gbp(value)}</strong></div>)}
    </div>
    <p className="text-xs text-amber-300">Income shown is the existing sales report, not a reconciled tax cashbook. VAT registration is unconfirmed; amounts are gross and no VAT reclaim or income tax/National Insurance liability is calculated. Stock, capital assets, private use, accruals and tax-year adjustments require review. Do not file these estimates with HMRC.</p>
    <label className="block text-xs text-neutral-300">VAT registration status
      <select value={vatStatus} onChange={e => setVatStatus(e.target.value as typeof vatStatus)} className={inputClass}>
        <option value="unknown">Not confirmed</option><option value="registered">Registered — check VAT invoices and scheme</option><option value="not_registered">Not VAT registered</option>
      </select>
    </label>
    <p className="text-xs text-neutral-400">{vatStatus === 'registered' ? 'Registration indicated only; input VAT is not automatically recoverable. Confirm VAT scheme, dates and valid invoices with your accountant.' : 'No input VAT reclaim calculated. Confirm your registration status and effective date before VAT reporting.'}</p>
    <form onSubmit={record} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <label className="text-xs text-neutral-300">Date<input required type="date" value={spentOn} onChange={e => setSpentOn(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">Supplier<input required value={supplier} onChange={e => setSupplier(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">Category<select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="text-xs text-neutral-300">Gross paid (£)<input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">VAT shown on invoice (£)<input type="number" min="0" step="0.01" value={vat} onChange={e => setVat(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">Business use (%)<input type="number" min="0" max="100" step="0.01" value={businessUse} onChange={e => setBusinessUse(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">Description<input value={description} onChange={e => setDescription(e.target.value)} className={inputClass}/></label>
      <label className="text-xs text-neutral-300">Receipt / invoice reference<input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Invoice number or receipt location" className={inputClass}/></label>
      <button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-white font-bold text-sm disabled:opacity-50">{busy ? 'Saving…' : 'Record expense for review'}</button>
    </form>
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <h3 className="text-sm font-bold text-white">Expense and claim review ({pending.length} awaiting review)</h3>
      <button type="button" onClick={exportCsv} className="rounded-lg bg-neutral-800 px-3 py-2 text-white text-xs">Export expenses CSV</button>
    </div>
    {notice && <p role="alert" className="text-xs text-amber-300">{notice}</p>}
    {loading ? <p className="text-xs text-neutral-400">Loading expense records…</p> : <div className="overflow-x-auto">
      <table className="min-w-full text-xs text-left text-neutral-200"><thead><tr className="text-neutral-400 border-b border-neutral-700">{['Date','Supplier / category','Gross','Business use','Evidence','Review'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>{periodRows.map(r => <tr key={r.id} className="border-b border-neutral-800">
          <td className="p-2">{r.spent_on}</td><td className="p-2">{r.supplier}<span className="block text-neutral-500">{r.category} · {r.description}</span></td>
          <td className="p-2">{gbp(Number(r.gross_amount))}</td><td className="p-2">{r.business_use_percent}%</td>
          <td className="p-2">{r.evidence_reference || 'Missing'}</td>
          <td className="p-2"><select aria-label={`Claim status for ${r.supplier}`} value={r.claim_status} onChange={e=>void changeStatus(r,e.target.value as Expense['claim_status'])} className="rounded bg-neutral-800 p-2"><option value="review">Review</option><option value="approved">Approved (provisional)</option><option value="excluded">Exclude</option></select></td>
        </tr>)}</tbody></table>
      {!periodRows.length && <p className="p-4 text-neutral-400">No expenses in this date range.</p>}
    </div>}
    <p className="text-[11px] text-neutral-500">Mark approved only after checking business purpose, invoice evidence, private-use split and the applicable HMRC rules. Approval is a bookkeeping flag, not confirmation of tax relief. Export and have an accountant review before filing.</p>
  </section>;
};
