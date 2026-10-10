import React, { useMemo, useState } from 'react';
import { Stethoscope, ChevronRight, ChevronLeft, Check, Wrench, ArrowRight } from 'lucide-react';
import { BIKE_ISSUES_CATEGORIES, ALL_BIKE_ISSUES_MAP } from '../data/bikeIssuesCatalog';
import { CustomerBike } from '../types/bikeShop';

interface SymptomCheckerProps {
  /** The customer's bikes, so the rider can attach the fault to a specific ride. */
  bikes?: CustomerBike[];
  /** Called with the mapped issue ids and any free-text notes when the rider books. */
  onComplete: (issueIds: string[], notes: string, bikeId?: string) => void;
  onCancel?: () => void;
}

/**
 * Guided fault triage: the rider picks the area and the symptoms, and the
 * answers map onto the shared bike-issue ids that pre-fill the booking form.
 * Kept intentionally short — three taps to a pre-filled booking.
 */
export const SymptomChecker: React.FC<SymptomCheckerProps> = ({ bikes = [], onComplete, onCancel }) => {
  const [step, setStep] = useState<'bike' | 'area' | 'symptom' | 'review'>('area');
  const [bikeId, setBikeId] = useState<string | undefined>(undefined);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Only offer the e-bike area when the rider actually has an e-bike / scooter.
  const hasElectric = bikes.some((b) => b.category === 'ebike' || b.category === 'electric_scooter');
  const areas = useMemo(
    () => BIKE_ISSUES_CATEGORIES.filter((c) => !c.isEbikeOnly || hasElectric),
    [hasElectric]
  );

  const area = areas.find((a) => a.id === areaId) || null;

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectedItems = selected.map((id) => ALL_BIKE_ISSUES_MAP.get(id)).filter(Boolean);

  const beginWithBikeStep = bikes.length > 0;

  const reset = () => {
    setStep(beginWithBikeStep ? 'bike' : 'area');
    setAreaId(null);
    setSelected([]);
    setNotes('');
  };

  return (
    <div className="space-y-6" data-testid="symptom-checker">
      <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-white">Guided Symptom Checker</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Answer a couple of questions and we'll pre-fill your booking with the right issues.
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5 flex items-center gap-2 text-[11px] font-mono text-neutral-500">
          <span className={step === 'bike' || step === 'area' ? 'text-emerald-400' : ''}>1. Area</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === 'symptom' ? 'text-emerald-400' : ''}>2. Symptoms</span>
          <ChevronRight className="w-3 h-3" />
          <span className={step === 'review' ? 'text-emerald-400' : ''}>3. Review</span>
        </div>
      </div>

      {/* Step: choose bike */}
      {step === 'bike' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">Which ride has the problem?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bikes.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  setBikeId(b.id);
                  setStep('area');
                }}
                className="text-left rounded-xl border border-neutral-800 bg-[#0d1015] hover:border-emerald-500/40 p-4 cursor-pointer"
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">{b.categoryLabel || b.category}</div>
                <div className="font-semibold text-white">{b.brand} {b.model}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setBikeId(undefined);
                setStep('area');
              }}
              className="text-left rounded-xl border border-dashed border-neutral-700 hover:border-emerald-500/40 p-4 cursor-pointer text-neutral-400"
            >
              <div className="font-semibold">Another bike</div>
              <div className="text-xs">Not in my garage</div>
            </button>
          </div>
        </div>
      )}

      {/* Step: choose area */}
      {step === 'area' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">Where is the problem?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {areas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAreaId(a.id);
                  setSelected([]);
                  setStep('symptom');
                }}
                className="text-left rounded-xl border border-neutral-800 bg-[#0d1015] hover:border-emerald-500/40 p-4 cursor-pointer"
              >
                <div className="font-semibold text-white text-sm">{a.title}</div>
                <div className="text-xs text-neutral-400 mt-1">{a.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: choose symptoms */}
      {step === 'symptom' && area && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">What are you seeing or hearing? <span className="text-neutral-500">(choose all that apply)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {area.items.map((item) => {
              const on = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`symptom-${item.id}`}
                  onClick={() => toggle(item.id)}
                  className={`text-left rounded-xl border p-3.5 flex items-center gap-3 cursor-pointer ${
                    on ? 'border-emerald-500/60 bg-emerald-950/30' : 'border-neutral-800 bg-[#0d1015] hover:border-neutral-700'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-500 border-emerald-500 text-neutral-950' : 'border-neutral-600'}`}>
                    {on && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="text-sm text-neutral-200">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-400" htmlFor="symptom-notes">
              Anything else we should know? (optional)
            </label>
            <textarea
              id="symptom-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. started after a wet ride, worse when braking hard…"
              className="w-full rounded-xl border border-neutral-800 bg-[#090b0e] text-neutral-200 text-sm p-3 focus:border-emerald-500/50 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep(beginWithBikeStep ? 'bike' : 'area')}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => setStep('review')}
              disabled={selected.length === 0 && !notes.trim()}
              className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              Review <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step: review */}
      {step === 'review' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">Here's what we'll put on your booking:</p>
          <div className="rounded-xl border border-neutral-800 bg-[#0d1015] p-4 space-y-2">
            {selectedItems.length === 0 ? (
              <div className="text-xs text-neutral-500">No specific symptoms selected.</div>
            ) : (
              <ul className="space-y-1.5">
                {selectedItems.map((item) => (
                  <li key={item!.id} className="flex items-center gap-2 text-sm text-neutral-200">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {item!.label}
                    <span className="text-[10px] font-mono text-neutral-500 ml-auto">{item!.category}</span>
                  </li>
                ))}
              </ul>
            )}
            {notes.trim() && (
              <div className="pt-2 border-t border-neutral-800 text-xs text-neutral-400">
                <span className="font-semibold text-neutral-300">Notes:</span> {notes.trim()}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStep('symptom')}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium cursor-pointer"
              >
                Start over
              </button>
              <button
                type="button"
                data-testid="symptom-book"
                onClick={() => onComplete(selected, notes.trim(), bikeId)}
                className="px-4 py-2 rounded-lg bg-[#05C147] hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" /> Book with these issues
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-neutral-500 hover:text-neutral-300 cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default SymptomChecker;
