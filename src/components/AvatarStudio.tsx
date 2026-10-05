import React, { useState } from 'react';
import { Shuffle, Check, Save } from 'lucide-react';
import { AvatarModel } from './AvatarModel';
import {
  AvatarConfig,
  BACKGROUNDS,
  DEFAULT_AVATAR,
  EYES,
  FACIAL_HAIR,
  GLASSES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  MOUTHS,
  SKIN_TONES,
  TOP_COLORS,
  randomAvatar,
} from '../shared/types/avatar';

type SwatchGroup = {
  label: string;
  options: { id: string; label: string; hex: string }[];
  /** Which AvatarConfig field this group edits. */
  key: 'hairColor' | 'headwearColor' | 'topColor' | 'background';
};

const SwatchRow: React.FC<{
  label: string;
  options: { id: string; label: string; hex: string }[];
  value: string;
  onPick: (v: string) => void;
}> = ({ label, options, value, onPick }) => (
  <div>
    <div className="text-xs font-medium text-neutral-300 mb-1.5">{label}</div>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={`${label}: ${o.label}`}
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
            value === o.id ? 'border-emerald-400 ring-2 ring-emerald-400/40' : 'border-neutral-700'
          }`}
          style={{ backgroundColor: o.hex }}
        />
      ))}
    </div>
  </div>
);

const ChoiceRow: React.FC<{
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
}> = ({ label, options, value, onPick }) => (
  <div>
    <div className="text-xs font-medium text-neutral-300 mb-1.5">{label}</div>
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors ${
            value === o.id
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
              : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

export interface AvatarStudioProps {
  value?: AvatarConfig | null;
  onSave: (config: AvatarConfig) => Promise<void> | void;
  saving?: boolean;
}

/**
 * Bitmoji-style avatar editor: live preview plus pickers for every part. The
 * parent owns persistence; this only produces a valid AvatarConfig.
 */
export const AvatarStudio: React.FC<AvatarStudioProps> = ({ value, onSave, saving }) => {
  const [draft, setDraft] = useState<AvatarConfig>(value || DEFAULT_AVATAR);
  const patch = (p: Partial<AvatarConfig>) => setDraft((d) => ({ ...d, ...p }));

  const swatchGroups: SwatchGroup[] = [
    { label: 'Hair colour', options: HAIR_COLORS, key: 'hairColor' },
    { label: 'Jersey colour', options: TOP_COLORS, key: 'topColor' },
    { label: 'Headwear colour', options: TOP_COLORS, key: 'headwearColor' },
    { label: 'Backdrop', options: BACKGROUNDS, key: 'background' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Preview */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-4 flex flex-col items-center gap-3 sticky top-20">
          <AvatarModel config={draft} size={180} title="Your avatar preview" className="rounded-2xl" />
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setDraft(randomAvatar())}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 text-xs font-semibold hover:text-white cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" /> Surprise me
            </button>
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_AVATAR)}
              className="px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-400 text-xs font-semibold hover:text-white cursor-pointer"
            >
              Reset
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
          >
            {saving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save avatar'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-5">
        <SwatchRow
          label="Skin tone"
          options={SKIN_TONES}
          value={draft.skinTone}
          onPick={(v) => patch({ skinTone: v as AvatarConfig['skinTone'] })}
        />
        <ChoiceRow
          label="Hair style"
          options={HAIR_STYLES}
          value={draft.hairStyle}
          onPick={(v) => patch({ hairStyle: v as AvatarConfig['hairStyle'] })}
        />
        <ChoiceRow
          label="Facial hair"
          options={FACIAL_HAIR}
          value={draft.facialHair}
          onPick={(v) => patch({ facialHair: v as AvatarConfig['facialHair'] })}
        />
        <ChoiceRow
          label="Glasses"
          options={GLASSES}
          value={draft.glasses}
          onPick={(v) => patch({ glasses: v as AvatarConfig['glasses'] })}
        />
        <ChoiceRow
          label="Headwear"
          options={HEADWEAR}
          value={draft.headwear}
          onPick={(v) => patch({ headwear: v as AvatarConfig['headwear'] })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <ChoiceRow
            label="Eyes"
            options={EYES}
            value={draft.eyes}
            onPick={(v) => patch({ eyes: v as AvatarConfig['eyes'] })}
          />
          <ChoiceRow
            label="Mouth"
            options={MOUTHS}
            value={draft.mouth}
            onPick={(v) => patch({ mouth: v as AvatarConfig['mouth'] })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5" htmlFor="avatar-jersey">
            Jersey number (optional)
          </label>
          <input
            id="avatar-jersey"
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={draft.jerseyNumber}
            onChange={(e) => patch({ jerseyNumber: e.target.value.replace(/[^0-9]/g, '') })}
            placeholder="e.g. 07"
            className="w-32 bg-[#090b0e] border border-neutral-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {swatchGroups.map((g) => (
          <SwatchRow
            key={g.key}
            label={g.label}
            options={g.options}
            value={draft[g.key]}
            onPick={(v) => patch({ [g.key]: v } as Partial<AvatarConfig>)}
          />
        ))}
      </div>
    </div>
  );
};

export default AvatarStudio;
