import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Check,
  Percent,
  PoundSterling,
  Calendar,
  Ban,
  Copy,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { DiscountCode, DiscountCodeType, VehicleCategory } from '../types/bikeShop';
import { describeDiscountValue } from '../utils/discountService';

const CATEGORY_OPTIONS: { id: VehicleCategory; label: string }[] = [
  { id: 'cycle', label: 'Bicycle' },
  { id: 'ebike', label: 'E-Bike' },
  { id: 'electric_scooter', label: 'E-Scooter' },
  { id: 'cargo', label: 'Cargo' },
];

type FormState = {
  code: string;
  title: string;
  description: string;
  type: DiscountCodeType;
  value: number;
  status: 'active' | 'disabled';
  expiresAt: string;
  usageLimit: number;
  assignedToUid: string;
  assignedToMembership: string;
  assignedToName: string;
  eligibleCategories: VehicleCategory[];
  minimumSpend: number;
};

const blankForm = (): FormState => ({
  code: `STK-${Math.floor(1000 + Math.random() * 9000)}`,
  title: '',
  description: '',
  type: 'percent',
  value: 10,
  status: 'active',
  expiresAt: '',
  usageLimit: 0,
  assignedToUid: '',
  assignedToMembership: '',
  assignedToName: '',
  eligibleCategories: [],
  minimumSpend: 0,
});

function statusPill(code: DiscountCode) {
  if (code.status === 'disabled')
    return 'bg-neutral-800 text-neutral-400 border-neutral-700';
  if (code.status === 'expired')
    return 'bg-rose-950/60 text-rose-300 border-rose-900';
  return 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
}

export const DiscountCodesTab: React.FC = () => {
  const {
    discountCodes,
    users = [],
    currentUser,
    addDiscountCode,
    updateDiscountCode,
    deleteDiscountCode,
  } = useShop();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const customers = (users || []).filter((u) => u.role === 'customer');

  const openAdd = () => {
    setEditingId(null);
    setForm(blankForm());
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (code: DiscountCode) => {
    setEditingId(code.id);
    setForm({
      code: code.code,
      title: code.title,
      description: code.description || '',
      type: code.type,
      value: code.value,
      status: code.status === 'expired' ? 'active' : code.status,
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().split('T')[0] : '',
      usageLimit: code.usageLimit || 0,
      assignedToUid: code.assignedToUid || '',
      assignedToMembership: code.assignedToMembership || '',
      assignedToName: code.assignedToName || '',
      eligibleCategories: code.eligibleCategories || [],
      minimumSpend: code.minimumSpend || 0,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const toggleCategory = (cat: VehicleCategory) => {
    setForm((f) => ({
      ...f,
      eligibleCategories: f.eligibleCategories.includes(cat)
        ? f.eligibleCategories.filter((c) => c !== cat)
        : [...f.eligibleCategories, cat],
    }));
  };

  const handleAssignedChange = (uid: string) => {
    const member = customers.find((c) => c.uid === uid);
    setForm((f) => ({
      ...f,
      assignedToUid: uid,
      assignedToMembership: member?.membershipNumber || '',
      assignedToName: member?.displayName || '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanCode = form.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) return setError('A code is required.');
    if (!form.title.trim()) return setError('Give the code a title.');
    if (form.type === 'percent' && (form.value <= 0 || form.value > 100))
      return setError('Percentage must be between 1 and 100.');
    if (form.type === 'fixed' && form.value <= 0)
      return setError('Enter an amount greater than £0.');

    const duplicate = discountCodes.find(
      (c) => c.code.toUpperCase().replace(/\s+/g, '') === cleanCode && c.id !== editingId
    );
    if (duplicate) return setError(`Code "${cleanCode}" already exists.`);

    const payload = {
      code: cleanCode,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      value: Number(form.value),
      status: form.status,
      expiresAt: form.expiresAt ? new Date(form.expiresAt) : undefined,
      usageLimit: form.usageLimit > 0 ? form.usageLimit : undefined,
      assignedToUid: form.assignedToUid || undefined,
      assignedToMembership: form.assignedToMembership || undefined,
      assignedToName: form.assignedToName || undefined,
      eligibleCategories: form.eligibleCategories,
      minimumSpend: form.minimumSpend > 0 ? form.minimumSpend : undefined,
      createdBy: currentUser?.displayName,
    };

    if (editingId) {
      await updateDiscountCode(editingId, payload);
      setFlash(`Discount code ${cleanCode} updated.`);
    } else {
      await addDiscountCode(payload);
      setFlash(`Discount code ${cleanCode} is live and scannable.`);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (code: DiscountCode) => {
    if (!confirm(`Delete discount code ${code.code}? This cannot be undone.`)) return;
    await deleteDiscountCode(code.id);
    setFlash(`Discount code ${code.code} deleted.`);
  };

  const handleToggleDisabled = async (code: DiscountCode) => {
    await updateDiscountCode(code.id, {
      status: code.status === 'active' ? 'disabled' : 'active',
    });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setFlash(`Copied ${code} to clipboard.`);
    } catch {
      setFlash(code);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" /> Discount Codes
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Create codes customers scan at the till. The discount is applied automatically and the price updated.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="pressable flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
        >
          <Plus className="w-4 h-4" /> New Code
        </button>
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-300">
          <Check className="w-4 h-4" /> {flash}
        </div>
      )}

      {discountCodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
          <Tag className="w-8 h-8 text-neutral-700 mx-auto" />
          <p className="mt-2 text-sm text-neutral-400">No discount codes yet.</p>
          <p className="text-xs text-neutral-500">Create one and it becomes scannable at the till instantly.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {discountCodes.map((code) => (
            <div
              key={code.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => copyCode(code.code)}
                  className="font-mono text-lg font-black text-white tracking-wider hover:text-amber-300 flex items-center gap-1.5"
                  title="Copy code"
                >
                  {code.code} <Copy className="w-3.5 h-3.5 text-neutral-600" />
                </button>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusPill(code)}`}>
                  {code.status}
                </span>
              </div>

              <div>
                <div className="text-sm font-semibold text-neutral-200 flex items-center gap-1.5">
                  {code.type === 'percent' ? (
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <PoundSterling className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  {describeDiscountValue(code.type, code.value)}
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">{code.title}</div>
                {code.description && (
                  <div className="text-[11px] text-neutral-600 mt-0.5">{code.description}</div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 text-[10px] text-neutral-500">
                {code.assignedToUid ? (
                  <span className="rounded-md bg-sky-950/60 px-1.5 py-0.5 text-sky-300">
                    {code.assignedToName || code.assignedToMembership || 'Assigned member'}
                  </span>
                ) : (
                  <span className="rounded-md bg-neutral-900 px-1.5 py-0.5">Open to all</span>
                )}
                {code.eligibleCategories?.length ? (
                  <span className="rounded-md bg-neutral-900 px-1.5 py-0.5">
                    {code.eligibleCategories.length} categories
                  </span>
                ) : null}
                {code.minimumSpend ? (
                  <span className="rounded-md bg-neutral-900 px-1.5 py-0.5">Min £{code.minimumSpend}</span>
                ) : null}
                {code.expiresAt && (
                  <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(code.expiresAt).toLocaleDateString('en-GB')}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-neutral-900 pt-2 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1">
                  {code.usageLimit ? (
                    <>
                      Used {code.timesUsed}/{code.usageLimit}
                    </>
                  ) : (
                    <>
                      Used {code.timesUsed} <InfinityIcon className="w-3 h-3" />
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleDisabled(code)}
                    title={code.status === 'active' ? 'Disable code' : 'Enable code'}
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(code)}
                    title="Edit"
                    className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(code)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-950/60 hover:text-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                {editingId ? 'Edit Discount Code' : 'New Discount Code'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-900 bg-rose-950/50 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs font-semibold text-neutral-400">
                Code
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 font-mono text-sm text-white focus:border-amber-500 outline-none"
                  placeholder="STK-10OFF"
                />
              </label>

              <label className="col-span-2 text-xs font-semibold text-neutral-400">
                Title
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                  placeholder="Summer service offer"
                />
              </label>

              <label className="col-span-2 text-xs font-semibold text-neutral-400">
                Description (optional)
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                  placeholder="Applies to workshop labour"
                />
              </label>

              <div className="text-xs font-semibold text-neutral-400">
                Type
                <div className="mt-1 flex gap-2">
                  {(['percent', 'fixed'] as DiscountCodeType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-bold ${
                        form.type === t
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-neutral-700 bg-black text-neutral-400'
                      }`}
                    >
                      {t === 'percent' ? '% Percent' : '£ Fixed'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-xs font-semibold text-neutral-400">
                {form.type === 'percent' ? 'Percentage off' : 'Amount off (£)'}
                <input
                  type="number"
                  min={0}
                  step={form.type === 'percent' ? 1 : 0.01}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </label>

              <label className="text-xs font-semibold text-neutral-400">
                Expires (optional)
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </label>

              <label className="text-xs font-semibold text-neutral-400">
                Usage limit (0 = unlimited)
                <input
                  type="number"
                  min={0}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </label>

              <label className="text-xs font-semibold text-neutral-400">
                Minimum spend (£, optional)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.minimumSpend}
                  onChange={(e) => setForm({ ...form, minimumSpend: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                />
              </label>

              <label className="col-span-2 text-xs font-semibold text-neutral-400">
                Reserve for one member (optional)
                <select
                  value={form.assignedToUid}
                  onChange={(e) => handleAssignedChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white focus:border-amber-500 outline-none"
                >
                  <option value="">Open to all customers</option>
                  {customers.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.displayName} ({c.membershipNumber})
                    </option>
                  ))}
                </select>
              </label>

              <div className="col-span-2 text-xs font-semibold text-neutral-400">
                Eligible categories (none = all)
                <div className="mt-1 flex flex-wrap gap-2">
                  {CATEGORY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleCategory(opt.id)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium ${
                        form.eligibleCategories.includes(opt.id)
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-neutral-700 bg-black text-neutral-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="col-span-2 flex items-center gap-2 text-xs font-semibold text-neutral-400">
                <input
                  type="checkbox"
                  checked={form.status === 'active'}
                  onChange={(e) => setForm({ ...form, status: e.target.checked ? 'active' : 'disabled' })}
                  className="h-4 w-4 accent-amber-500"
                />
                Active (scannable at the till)
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-neutral-800 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pressable flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
              >
                <Save className="w-4 h-4" /> {editingId ? 'Save changes' : 'Create code'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
