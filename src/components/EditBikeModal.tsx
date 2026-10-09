import React, { useMemo, useState } from 'react';
import { X, Save, Bike as BikeIcon, Loader2 } from 'lucide-react';
import { CustomerBike } from '../types/bikeShop';
import { BIKE_CATEGORY_OPTIONS } from '../data/bikeCatalog';
import {
  BikeIdentityFields,
  BikeIdentityValue,
  identityFromBike,
  toBikeDetails,
  resolveModel,
} from './BikeIdentityFields';

interface EditBikeModalProps {
  bike: CustomerBike;
  /** Persist the edited identity. Return false to keep the modal open. */
  onSave: (patch: Partial<CustomerBike>) => Promise<boolean>;
  onClose: () => void;
  /** Title tweak: the staff dossier edits other people's bikes. */
  title?: string;
  subtitle?: string;
}

/**
 * Manual "Edit bike details" form. Shared by the customer garage and the staff
 * customer dossier so a mis-scanned or mis-typed bike can be corrected by hand
 * from either side, using the same catalogue-aware identity fields as booking.
 */
export const EditBikeModal: React.FC<EditBikeModalProps> = ({
  bike,
  onSave,
  onClose,
  title = 'Edit bike details',
  subtitle,
}) => {
  const [value, setValue] = useState<BikeIdentityValue>(() => identityFromBike(bike));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<BikeIdentityValue>) => setValue((prev) => ({ ...prev, ...p }));

  const categoryOptions = useMemo(
    () => BIKE_CATEGORY_OPTIONS.find((c) => c.id === value.category),
    [value.category]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const model = resolveModel(value);
    if (!model || !model.trim()) {
      setError('Enter a model name so the workshop knows what to work on.');
      return;
    }
    setSaving(true);
    try {
      const ok = await onSave({
        category: value.category,
        categoryLabel: categoryOptions ? categoryOptions.title.split(' ')[0] : bike.categoryLabel,
        brand: value.brand,
        model: model.trim(),
        year: value.year || undefined,
        colour: value.colour.trim() || undefined,
        serialNumber: value.serialNumber.trim() || undefined,
        frameSizeOrNotes: value.frameSize.trim() || undefined,
        bikeDetails: toBikeDetails(value),
      });
      if (ok) onClose();
    } catch {
      setError('Could not save the bike details. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-['Plus_Jakarta_Sans',sans-serif]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl bg-[#0e1217] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
        data-testid="edit-bike-modal"
      >
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <BikeIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                {title}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {subtitle || 'Correct the make, model, colour, serial and e-bike conversion details. Everything you change is saved to the workshop record.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-700 bg-rose-950/60 px-3 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <BikeIdentityFields value={value} onChange={patch} idPrefix="edit-bike" />

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="pressable inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving' : 'Save details'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
