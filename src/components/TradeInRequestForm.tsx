import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bike,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { submitTradeInRequest, SellAnglePhoto } from '../context/TradeInStore';
import { getOfferPrices, syncOfferPricesFromSupabase } from '../context/OfferPriceBook';
import { diagnoseFault, isBikeVisionConfigured } from '../api/visionService';
import { compressImageFile } from '../utils/imageCompress';
import { valueBike } from '../utils/bikeValuation';
import toast from 'react-hot-toast';

/**
 * The seven guided angles. Together they let the AI read the make, model,
 * drivetrain, frame serial and battery, so it can identify the bike and price it
 * without a workshop visit.
 */
export const SELL_ANGLES: { id: string; label: string; hint: string }[] = [
  { id: 'drive-side', label: 'Drive side', hint: 'Right side — gears & chain facing the camera' },
  { id: 'non-drive-side', label: 'Non-drive side', hint: 'Left side of the whole bike' },
  { id: 'front', label: 'Front-on', hint: 'Straight on at the front wheel' },
  { id: 'rear', label: 'Rear-on', hint: 'Straight on at the back wheel' },
  { id: 'cockpit', label: 'Cockpit & badge', hint: 'Bars, stem and the brand head badge' },
  { id: 'drivetrain', label: 'Drivetrain', hint: 'Close-up of chain, cassette & derailleur' },
  { id: 'serial', label: 'Serial & battery', hint: 'Frame number under the bottom bracket (and battery on an e-bike)' },
];

interface Props {
  /** Tighter spacing for the embedded website page. */
  compact?: boolean;
  /**
   * Seed the form from a bike the customer already has in their garage, so
   * "Sell this bike" pre-fills the brand/model/condition instead of making them
   * type it again.
   */
  prefill?: SellBikePrefill | null;
}

export interface SellBikePrefill {
  /** Garage bike id, used to detect a change of target. */
  id?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  category?: string;
  colour?: string;
}

type SpecRow = { label: string; value: string };
type SpecSection = { title: string; rows: SpecRow[] };

const SPEC_CATEGORY_ORDER = [
  'Drivetrain',
  'Brakes',
  'Suspension / Fork',
  'Wheels & Tires',
  'Cockpit & Controls',
  'Electrical / Battery',
];

const clean = (v: unknown): string => String(v ?? '').trim();
const isUnknown = (s: string) => !s || /^unknown\s*\/?\s*to be inspected$/i.test(s);

/**
 * Turn the AI's identification into readable spec sections. This is the point of
 * the seven photos — the customer sees every component the AI could read off
 * their bike, grouped the way a mechanic thinks about it.
 */
function buildSpecSections(r: any): SpecSection[] {
  if (!r) return [];
  const sections: SpecSection[] = [];

  const idRows: SpecRow[] = [];
  const push = (label: string, v: unknown) => {
    const s = clean(v);
    if (!isUnknown(s)) idRows.push({ label, value: s });
  };
  push('Brand', r.make);
  push('Model', r.model);
  push('Type', r.categoryLabel || r.type);
  push('Year', r.year);
  push('Colour', r.colour);
  push('Frame material', r.frameMaterial);
  push('Serial number', r.serialNumber);
  const p = r.positioning || {};
  push('Frame size', p.frameSizeEstimate);
  push('Wheel size', p.wheelSize || r.wheelSizeAndSpecs);
  push('Tyre size', p.tyreSize);
  push('Valve type', p.valveType);
  push('Riding style', p.ridingStyle);
  push('Rider fit', p.riderFit);
  push('Cockpit', p.cockpitSetup);
  push('Saddle', p.saddleSetup);
  if (idRows.length) sections.push({ title: 'Identification', rows: idRows });

  const ek = r.electricKit || {};
  if (ek.isElectric) {
    const eRows: SpecRow[] = [];
    const epush = (label: string, v: unknown) => {
      const s = clean(v);
      if (s) eRows.push({ label, value: s });
    };
    epush('System', ek.systemType);
    epush('Motor', [ek.motorBrand, ek.motorWatts].map(clean).filter(Boolean).join(' '));
    epush('Motor position', ek.motorPosition);
    epush('Battery', [ek.batteryBrand, ek.batteryVolts].map(clean).filter(Boolean).join(' '));
    epush('Battery location', ek.batteryLocation);
    epush('Controller', ek.controllerNotes);
    if (ek.isAftermarketConversion) epush('Note', 'Aftermarket conversion');
    if (eRows.length) sections.push({ title: 'Electric kit', rows: eRows });
  }

  const specs: any[] = Array.isArray(r.mainSpecs) ? r.mainSpecs : [];
  const byCat = new Map<string, SpecRow[]>();
  for (const s of specs) {
    const cat = clean(s?.category) || 'Other';
    const name = clean(s?.componentName) || clean(s?.componentId) || 'Component';
    const bits = [s?.currentPart, s?.specValue, s?.brand, s?.model].map(clean).filter(Boolean);
    const value = bits.join(' · ') || '—';
    const cond = s?.condition ? ` (${clean(s.condition).replace(/_/g, ' ')})` : '';
    const arr = byCat.get(cat) ?? [];
    arr.push({ label: name, value: `${value}${cond}` });
    byCat.set(cat, arr);
  }
  for (const cat of SPEC_CATEGORY_ORDER) {
    const rows = byCat.get(cat);
    if (rows) sections.push({ title: cat, rows });
  }
  for (const [cat, rows] of byCat) {
    if (!SPEC_CATEGORY_ORDER.includes(cat)) sections.push({ title: cat, rows });
  }

  return sections;
}

/**
 * "Sell Your Bike": the customer photographs their bike from seven guided
 * angles, the AI identifies it, and an instant indicative offer is produced
 * from the workshop's price book. The lead lands in the staff inbox with every
 * photo and the AI read attached.
 */
export const SellYourBikeForm: React.FC<Props> = ({ compact = false, prefill = null }) => {
  // Pull the workshop's latest price book when the customer opens the form, so a
  // price staff just set in the terminal is used here even if this device already
  // cached an older copy.
  useEffect(() => {
    void syncOfferPricesFromSupabase(true);
  }, []);

  const { currentUser } = useShop();
  const fileRef = useRef<HTMLInputElement>(null);
  const targetAngle = useRef<string>(SELL_ANGLES[0].id);

  const [photos, setPhotos] = useState<Record<string, SellAnglePhoto | undefined>>({});
  const [notes, setNotes] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [declaredCondition, setDeclaredCondition] = useState<'excellent' | 'good' | 'fair' | 'poor' | ''>('');
  const [prefillActive, setPrefillActive] = useState(false);

  // Seed from a garage bike the first time the customer taps "Sell this bike",
  // and re-seed whenever they switch to a different bike.
  useEffect(() => {
    if (!prefill) return;
    setBrand(prefill.brand?.trim() || '');
    setModel(prefill.model?.trim() || '');
    setNotes((prev) => {
      const seed = [prefill.colour && `Colour: ${prefill.colour}`, prefill.year && `Year: ${prefill.year}`]
        .filter(Boolean)
        .join('. ');
      return prev.trim() ? prev : seed;
    });
    setPrefillActive(true);
  }, [prefill?.id]);

  const configured = isBikeVisionConfigured();
  const capturedCount = SELL_ANGLES.filter((a) => photos[a.id]).length;

  const orderedPhotos = useMemo(
    () => SELL_ANGLES.map((a) => photos[a.id]).filter(Boolean) as SellAnglePhoto[],
    [photos]
  );

  const openPicker = (angle: string) => {
    targetAngle.current = angle;
    fileRef.current?.click();
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    const angle = SELL_ANGLES.find((a) => a.id === targetAngle.current) || SELL_ANGLES[0];
    const compressed = await compressImageFile(file);
    setPhotos((prev) => ({ ...prev, [angle.id]: { angle: angle.id, label: angle.label, dataUrl: compressed.dataUrl } }));
    setResult(null);
    setError('');
  };

  const clearPhoto = (angle: string) => {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[angle];
      return next;
    });
    setResult(null);
  };

  const runAnalysis = useCallback(async () => {
    const images: { data: string; mimeType: string }[] = orderedPhotos.map((p) => ({ data: p.dataUrl.split(',').pop() || '', mimeType: 'image/jpeg' }));
    if (!images.length) return;
    setAnalyzing(true);
    setError('');
    try {
      const analysis = await diagnoseFault({ images: images as never[], userNotes: notes });
      setResult(analysis);
      setBrand(analysis.make && analysis.make !== 'Unknown / To Be Inspected' ? analysis.make : '');
      setModel(analysis.model && analysis.model !== 'Unknown / To Be Inspected' ? analysis.model : '');
    } catch (err: any) {
      setError(err?.message || 'Could not identify the bike. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  }, [orderedPhotos, notes]);

  const valuation = useMemo(() => {
    if (!result && !brand && !model) return null;
    return valueBike(
      {
        make: brand || result?.make,
        model: model || result?.model,
        type: result?.type,
        year: result?.year,
        overallCondition: result?.overallCondition,
        declaredCondition: declaredCondition || undefined,
        confidence: result?.confidence,
        coverage: result?.coverage,
        faults: result?.faults,
        obviousProblems: result?.obviousProblems,
        cosmeticIssues: result?.cosmeticIssues,
        electricKit: result?.electricKit,
      },
      getOfferPrices()
    );
  }, [result, brand, model, declaredCondition]);

  // Every component the AI read off the seven photos — the point of the capture.
  const specSections = useMemo(() => buildSpecSections(result), [result]);
  const specCount = useMemo(
    () => specSections.reduce((n, s) => n + s.rows.length, 0),
    [specSections]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      toast.error('We need the brand and model before we can make an offer.');
      return;
    }
    submitTradeInRequest({
      customerUid: currentUser?.uid,
      customerName: currentUser?.displayName || 'Guest',
      customerEmail: currentUser?.email || '',
      customerPhone: currentUser?.phoneNumber,
      brand: brand.trim(),
      model: model.trim(),
      year: result?.year || (prefill?.year != null ? String(prefill.year) : undefined),
      category: result?.type || prefill?.category || 'cycle',
      condition: declaredCondition || valuation?.condition || 'good',
      notes: notes.trim() || undefined,
      photoUrl: orderedPhotos[0]?.dataUrl,
      photos: orderedPhotos,
      aiIdentification: result || undefined,
      offerEstimate: valuation?.offer ?? undefined,
      offerMin: valuation?.minOffer ?? undefined,
      offerMax: valuation?.maxOffer ?? undefined,
      offerConfidence: valuation?.confidence,
      offerRationale: valuation?.rationale,
    });
    setSubmitted(true);
    toast.success('Bike submitted — we’ll be in touch with your offer.');
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-[#0d1015] p-10 text-center space-y-3" data-testid="tradein-success">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
        <div className="font-display text-lg font-bold text-white">Your bike has been submitted</div>
        {valuation?.offer != null && <div className="text-3xl font-black text-emerald-400">£{valuation.offer}</div>}
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">
          {valuation?.offer != null
            ? 'That’s our indicative offer based on your photos. The workshop will confirm the final figure when they check the bike over.'
            : 'The workshop will review your photos, identify the bike and get back to you with an offer.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setPhotos({});
            setResult(null);
            setNotes('');
            setBrand('');
            setModel('');
          }}
          className="mt-1 px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium cursor-pointer"
        >
          Sell another bike
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tradein-form">
      <div>
        <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
          <Bike className="w-5 h-5 text-emerald-400" /> Sell Your Bike
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Take seven photos from the angles below and our AI will identify your bike and make you an offer.
        </p>
      </div>

      {prefillActive && prefill && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2.5 text-xs text-emerald-200" data-testid="sell-prefill-banner">
          <Bike className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Selling your <strong className="font-semibold">{`${prefill.brand ?? ''} ${prefill.model ?? ''}`.trim() || 'garage bike'}</strong> — details filled in below. Add photos for an instant offer.
          </span>
          <button type="button" onClick={() => setPrefillActive(false)} aria-label="Dismiss" className="shrink-0 hover:bg-white/10 rounded p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {!configured && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-200">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>AI photo identification isn’t configured on this build. Add a VITE_GEMINI_API_KEY to enable instant offers.</span>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-700 bg-rose-950/60 px-3 py-2.5 text-xs text-rose-200">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss" className="shrink-0 hover:bg-white/10 rounded p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Seven guided angle slots */}
      <div className="surface-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Photos</span>
          <span className="text-xs font-mono text-emerald-400">{capturedCount} / {SELL_ANGLES.length}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {SELL_ANGLES.map((angle, index) => {
            const shot = photos[angle.id];
            return (
              <div key={angle.id} className="space-y-1.5">
                <div
                  className={`relative aspect-square overflow-hidden rounded-xl border-2 border-dashed ${shot ? 'border-neutral-700' : 'border-neutral-700/80 bg-neutral-950/60'}`}
                  data-testid={`sell-angle-${angle.id}`}
                >
                  {shot ? (
                    <>
                      <img src={shot.dataUrl} alt={angle.label} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => clearPhoto(angle.id)}
                        aria-label={`Remove ${angle.label}`}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-emerald-500 p-0.5 text-neutral-950">
                        <Check className="h-3 w-3" />
                      </span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPicker(angle.id)}
                      className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1.5 p-2 text-center"
                    >
                      <Camera className="h-6 w-6 text-emerald-400" />
                      <span className="text-[10px] font-bold text-white leading-tight">{index + 1}. {angle.label}</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] leading-snug text-neutral-500">{angle.hint}</p>
              </div>
            );
          })}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="sell-photo-input"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={runAnalysis}
          disabled={!capturedCount || analyzing}
          className="pressable w-full py-3 rounded-xl bg-[#05C147] hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Identifying your bike…' : `Identify my bike (${capturedCount}/${SELL_ANGLES.length} photos)`}
        </button>
        {capturedCount > 0 && capturedCount < SELL_ANGLES.length && (
          <p className="text-[11px] text-neutral-500 text-center">
            Tip: all seven angles give the most accurate read, but you can identify with fewer.
          </p>
        )}
      </div>

      {/* AI result + instant offer */}
      {result && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-transparent p-5 space-y-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Identified bike</div>
              <div className="text-lg font-black text-white">{result.make} {result.model}</div>
              {result.summary && <p className="text-[11px] text-neutral-400 mt-0.5">{result.summary}</p>}
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-sm font-bold text-emerald-400">{Math.round((result.confidence || 0) * 100)}%</div>
              <div className="text-[10px] text-neutral-500">confidence</div>
            </div>
          </div>

          {valuation?.offer != null ? (
            <div className="rounded-xl border border-emerald-500/30 bg-[#0b0e13] p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Indicative offer</div>
              <div className="text-3xl font-black text-emerald-400">£{valuation.offer}</div>
              {valuation.minOffer != null && valuation.maxOffer != null && (
                <div className="text-xs text-neutral-400">Range £{valuation.minOffer}–£{valuation.maxOffer}</div>
              )}
              {valuation.needsStaffReview && (
                <div className="mt-2 text-[11px] text-amber-300 flex items-center gap-1.5">
                  <CircleAlert className="w-3.5 h-3.5" /> Subject to a quick workshop check.
                </div>
              )}
            </div>
          ) : (
            <div className="surface-panel p-4 text-xs text-neutral-400">
              {valuation?.matchLevel && valuation.matchLevel !== 'none'
                ? 'Our workshop hasn’t published a price for this bike and condition yet — they’ll price it by hand.'
                : 'We couldn’t match this bike to the price book automatically — the workshop will price it by hand.'}
            </div>
          )}

          {valuation?.conditionPrices?.length ? (
            <div className="surface-panel p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Price by condition</div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {valuation.conditionPrices.map((cp) => (
                  <div
                    key={cp.condition}
                    className={`rounded-lg border p-2 ${
                      valuation.condition === cp.condition ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-neutral-800'
                    }`}
                  >
                    <div className="text-[10px] capitalize text-neutral-400">{cp.condition}</div>
                    <div className={`font-mono text-sm font-bold ${valuation.condition === cp.condition ? 'text-emerald-300' : 'text-neutral-300'}`}>
                      {cp.price != null
                        ? `£${cp.price}${cp.maxPrice != null && cp.maxPrice > cp.price ? `–£${cp.maxPrice}` : ''}`
                        : '—'}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 mt-2">
                Your condition: <span className="capitalize text-neutral-300">{valuation.condition}</span>
                {declaredCondition ? ' (as you selected)' : ' (as read from your photos)'}. Every figure is what our
                workshop pays for that grade.
              </p>
            </div>
          ) : null}

          {specCount > 0 ? (
            <div className="surface-panel p-3 space-y-3" data-testid="sell-specs">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  What we read from your photos
                </div>
                <div className="text-[10px] text-neutral-500">{specCount} details detected</div>
              </div>
              {specSections.map((section) => (
                <div key={section.title}>
                  <div className="text-[11px] font-semibold text-emerald-300/90 mb-1">{section.title}</div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    {section.rows.map((row, i) => (
                      <div key={`${row.label}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-neutral-900/80 pb-0.5">
                        <dt className="text-[11px] text-neutral-500 shrink-0">{row.label}</dt>
                        <dd className="text-[11px] text-neutral-200 text-right">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              {Array.isArray(result?.notVisible) && result.notVisible.length ? (
                <p className="text-[10px] text-neutral-500">
                  Couldn’t see from the photos (we’ll check at intake): {result.notVisible.join(', ')}.
                </p>
              ) : null}
            </div>
          ) : null}

          {result?.cosmeticIssues?.length ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3" data-testid="sell-damage">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-1.5">Damage &amp; wear we spotted</div>
              <ul className="text-[11px] text-neutral-300 space-y-0.5 list-disc pl-4">
                {result.cosmeticIssues.map((c: any, i: number) => (
                  <li key={i}>
                    {c.type}
                    {c.location ? ` — ${c.location}` : ''}
                    {c.severity ? ` (${c.severity})` : ''}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-neutral-500 mt-1.5">
                Noted for the workshop — our offer already reflects your bike’s condition grade.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Confirm brand</span>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Giant"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-neutral-400">Confirm model</span>
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Escape 3"
                className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
            </label>
          </div>

          {valuation?.rationale?.length ? (
            <ul className="text-[11px] text-neutral-400 space-y-0.5 list-disc pl-4">
              {valuation.rationale.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          ) : null}
        </div>
      )}

      {/* Details + submit — always visible so the customer can type them directly. */}
      <form onSubmit={submit} className="surface-panel p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Brand *</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Giant"
              className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-400">Model *</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Escape 3"
              className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none" />
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-neutral-400">Condition</span>
          <div className="flex flex-wrap gap-2">
            {(['excellent', 'good', 'fair', 'poor'] as const).map((c) => (
              <button key={c} type="button" onClick={() => setDeclaredCondition(c)}
                className={`px-3.5 py-2 rounded-lg border text-xs font-semibold capitalize cursor-pointer ${declaredCondition === c ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-300' : 'border-neutral-800 bg-[#090b0e] text-neutral-300 hover:border-neutral-700'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-semibold text-neutral-400">Anything we should know? (optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Mileage, service history, faults, upgrades…"
            className="w-full surface-panel text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none resize-none" />
        </label>
        <button type="submit"
          className="pressable w-full py-3 rounded-xl bg-[#05C147] hover:bg-emerald-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer">
          <Send className="w-4 h-4" /> Submit my bike for an offer
        </button>
      </form>
    </div>
  );
};

/** Backwards-compatible alias for the former trade-in component name. */
export const TradeInRequestForm = SellYourBikeForm;

export default SellYourBikeForm;
