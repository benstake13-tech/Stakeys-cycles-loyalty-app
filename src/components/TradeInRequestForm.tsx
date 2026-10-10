import React, { useState } from 'react';
import { RefreshCw, Camera, CheckCircle2, Send } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { submitTradeInRequest } from '../context/TradeInStore';
import { BIKE_CATEGORY_OPTIONS } from '../data/bikeCatalog';
import toast from 'react-hot-toast';

const CONDITIONS: { id: 'excellent' | 'good' | 'fair' | 'poor'; label: string }[] = [
  { id: 'excellent', label: 'Excellent' },
  { id: 'good', label: 'Good' },
  { id: 'fair', label: 'Fair' },
  { id: 'poor', label: 'Poor / spares' },
];

/**
 * Trade-in / part-exchange request form: the rider describes their old bike and
 * the workshop is notified with a lead it can value and respond to.
 */
export const TradeInRequestForm: React.FC = () => {
  const { currentUser } = useShop();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [category, setCategory] = useState<string>(BIKE_CATEGORY_OPTIONS[0]?.id || 'cycle');
  const [condition, setCondition] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');
  const [notes, setNotes] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [submitted, setSubmitted] = useState(false);

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === 'string' ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      toast.error('Please add at least the brand and model.');
      return;
    }
    submitTradeInRequest({
      customerUid: currentUser?.uid,
      customerName: currentUser?.displayName || 'Guest',
      customerEmail: currentUser?.email || '',
      customerPhone: currentUser?.phoneNumber,
      brand: brand.trim(),
      model: model.trim(),
      year: year.trim() || undefined,
      category,
      condition,
      notes: notes.trim() || undefined,
      photoUrl,
      interestedIn: interestedIn.trim() || undefined,
    });
    setSubmitted(true);
    toast.success('Trade-in request sent — the workshop will be in touch.');
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-[#0d1015] p-10 text-center space-y-3" data-testid="tradein-success">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <div className="font-display text-lg font-bold text-white">Trade-in request received</div>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          The workshop will review your bike, value it and get back to you with an offer.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setBrand('');
            setModel('');
            setYear('');
            setNotes('');
            setInterestedIn('');
            setPhotoUrl(undefined);
          }}
          className="mt-1 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium cursor-pointer"
        >
          Value another bike
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tradein-form">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-amber-400" /> Trade-In / Part-Exchange
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Tell us about your old bike and we'll value it against a new one or a workshop credit.
        </p>
      </div>

      <form onSubmit={submit} className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Brand *</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Giant"
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Model *</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. Escape 3"
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Year (optional)</span>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2019"
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Type</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none"
            >
              {BIKE_CATEGORY_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-neutral-400">Condition</span>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCondition(c.id)}
                className={`px-3.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                  condition === c.id ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300' : 'border-neutral-800 bg-[#090b0e] text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-neutral-400">Anything we should know?</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Mileage, service history, faults, upgrades…"
            className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none resize-none"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-neutral-400">Interested in (optional)</span>
          <input
            value={interestedIn}
            onChange={(e) => setInterestedIn(e.target.value)}
            placeholder="e.g. a hybrid commuter under £800"
            className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none"
          />
        </label>

        <div className="flex items-center gap-3">
          <label className="px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-2 cursor-pointer">
            <Camera className="w-4 h-4" />
            {photoUrl ? 'Photo added' : 'Add a photo'}
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </label>
          {photoUrl && <img src={photoUrl} alt="Trade-in bike" className="w-12 h-12 rounded-lg object-cover border border-neutral-800" />}
        </div>

        <button
          type="submit"
          className="pressable w-full py-3 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4" /> Send trade-in request
        </button>
      </form>
    </div>
  );
};

export default TradeInRequestForm;
