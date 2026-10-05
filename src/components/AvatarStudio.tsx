import React, { useRef, useState } from 'react';
import {
  Bike,
  Check,
  Code,
  Download,
  Glasses,
  Save,
  Shirt,
  Shuffle,
  Sliders,
  Smile,
  User,
} from 'lucide-react';
import { AvatarSVG } from './AvatarSVG';
import {
  ACCESSORIES,
  AvatarConfig,
  BIKE_COLORS,
  CLOTHING_COLORS,
  CLOTHING_STYLES,
  DEFAULT_AVATAR,
  EXPRESSIONS,
  EYE_SHAPES,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  PROP_BIKES,
  SKIN_TONES,
  randomAvatar,
} from '../shared/types/avatar';

export interface AvatarStudioProps {
  value?: AvatarConfig | null;
  onSave: (config: AvatarConfig) => Promise<void> | void;
  saving?: boolean;
}

type TabId = 'hair' | 'face' | 'apparel' | 'gear' | 'bikes';

const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'hair', label: 'Hair & Beard', icon: User },
  { id: 'face', label: 'Face & Vibe', icon: Smile },
  { id: 'apparel', label: 'Apparel', icon: Shirt },
  { id: 'gear', label: 'Gear & Specs', icon: Glasses },
  { id: 'bikes', label: 'Rides & Bikes', icon: Bike },
];

const SwatchRow: React.FC<{
  label: string;
  options: { id: string; label: string; hex: string }[];
  value: string;
  onPick: (v: string) => void;
  size?: 'sm' | 'md';
}> = ({ label, options, value, onPick, size = 'md' }) => (
  <div>
    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{label}</div>
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={`${label}: ${o.label}`}
          aria-pressed={value === o.hex}
          onClick={() => onPick(o.hex)}
          style={{ backgroundColor: o.hex }}
          className={`${size === 'sm' ? 'w-8 h-8' : 'w-9 h-9'} rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
            value === o.hex ? 'scale-110 border-emerald-400 ring-2 ring-emerald-500/30' : 'border-neutral-700'
          }`}
        >
          {value === o.hex && <Check className="w-4 h-4 text-white drop-shadow" />}
        </button>
      ))}
    </div>
  </div>
);

const ChoiceRow: React.FC<{
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (v: string) => void;
  cols?: string;
}> = ({ label, options, value, onPick, cols = 'grid-cols-2 sm:grid-cols-4' }) => (
  <div>
    <div className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{label}</div>
    <div className={`grid ${cols} gap-3`}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onPick(o.id)}
          className={`p-3 rounded-xl border text-xs font-medium text-left cursor-pointer transition-colors ${
            value === o.id
              ? 'border-emerald-400 bg-emerald-500/10 text-white font-bold'
              : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

function downloadBlob(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Serialises the SVG, paints it onto a canvas and downloads a high-res PNG. */
function exportPng(svg: SVGSVGElement) {
  const data = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      downloadBlob(canvas.toDataURL('image/png'), `stakeys-avatar-${Date.now()}.png`);
    }
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

/**
 * Stakeys avatar editor: live SVG preview plus tabbed pickers for every part.
 * The parent owns persistence; this only produces a valid AvatarConfig and
 * offers PNG / SVG / JSON export of the current look.
 */
export const AvatarStudio: React.FC<AvatarStudioProps> = ({ value, onSave, saving }) => {
  const [draft, setDraft] = useState<AvatarConfig>(value || DEFAULT_AVATAR);
  const [tab, setTab] = useState<TabId>('hair');
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const patch = (p: Partial<AvatarConfig>) => setDraft((d) => ({ ...d, ...p }));

  const copySvg = () => {
    if (!svgRef.current) return;
    navigator.clipboard?.writeText(new XMLSerializer().serializeToString(svgRef.current));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const saveConfig = () => {
    downloadBlob(
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(draft, null, 2)),
      'stakeys-avatar-config.json'
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      {/* Live preview */}
      <div className="space-y-3">
        <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] p-4 flex flex-col items-center gap-3 lg:sticky lg:top-20">
          <div className="w-full max-w-[300px] aspect-[5/6] flex items-center justify-center">
            <AvatarSVG config={draft} svgRef={svgRef} className="w-full h-full drop-shadow-2xl" />
          </div>
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setDraft(randomAvatar())}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-emerald-400 text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
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
          <div className="flex w-full gap-2 text-xs">
            <button
              type="button"
              onClick={() => svgRef.current && exportPng(svgRef.current)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 font-medium hover:text-white cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> PNG
            </button>
            <button
              type="button"
              onClick={copySvg}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 font-medium hover:text-white cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5 text-emerald-400" />}
              {copied ? 'Copied!' : 'SVG'}
            </button>
            <button
              type="button"
              onClick={saveConfig}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-800 bg-neutral-900 text-neutral-300 font-medium hover:text-white cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> JSON
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
      <div className="rounded-2xl border border-neutral-800 bg-[#0d1015] overflow-hidden">
        <nav className="flex items-center border-b border-neutral-800 bg-[#090b0e]/50 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 cursor-pointer transition-colors ${
                  active
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="p-6 space-y-6">
          {tab === 'hair' && (
            <>
              <ChoiceRow
                label="Hairstyle"
                options={HAIR_STYLES}
                value={draft.hairStyle}
                onPick={(v) => patch({ hairStyle: v as AvatarConfig['hairStyle'] })}
              />
              <SwatchRow
                label="Hair Colour"
                options={HAIR_COLORS}
                value={draft.hairColor}
                onPick={(v) => patch({ hairColor: v })}
              />
              <div className="pt-4 border-t border-neutral-800 space-y-6">
                <ChoiceRow
                  label="Beard & Facial Hair"
                  options={FACIAL_HAIR}
                  value={draft.facialHair}
                  onPick={(v) => patch({ facialHair: v as AvatarConfig['facialHair'] })}
                />
                {draft.facialHair !== 'none' && (
                  <SwatchRow
                    label="Facial Hair Colour"
                    options={HAIR_COLORS}
                    value={draft.facialHairColor}
                    onPick={(v) => patch({ facialHairColor: v })}
                    size="sm"
                  />
                )}
              </div>
            </>
          )}

          {tab === 'face' && (
            <>
              <SwatchRow
                label="Skin Tone"
                options={SKIN_TONES}
                value={draft.skinTone}
                onPick={(v) => patch({ skinTone: v })}
              />
              <div className="pt-4 border-t border-neutral-800">
                <ChoiceRow
                  label="Facial Expression"
                  options={EXPRESSIONS}
                  value={draft.expression}
                  onPick={(v) => patch({ expression: v as AvatarConfig['expression'] })}
                  cols="grid-cols-1 sm:grid-cols-3"
                />
              </div>
              <div className="pt-4 border-t border-neutral-800 space-y-6">
                <ChoiceRow
                  label="Eye Shape"
                  options={EYE_SHAPES}
                  value={draft.eyeShape}
                  onPick={(v) => patch({ eyeShape: v as AvatarConfig['eyeShape'] })}
                  cols="grid-cols-3"
                />
                <SwatchRow
                  label="Eye Colour"
                  options={HAIR_COLORS}
                  value={draft.eyeColor}
                  onPick={(v) => patch({ eyeColor: v })}
                  size="sm"
                />
              </div>
            </>
          )}

          {tab === 'apparel' && (
            <>
              <ChoiceRow
                label="Apparel Style"
                options={CLOTHING_STYLES}
                value={draft.clothingStyle}
                onPick={(v) => patch({ clothingStyle: v as AvatarConfig['clothingStyle'] })}
                cols="grid-cols-2"
              />
              <div className="pt-4 border-t border-neutral-800">
                <SwatchRow
                  label="Apparel Colour Palette"
                  options={CLOTHING_COLORS}
                  value={draft.clothingColor}
                  onPick={(v) => patch({ clothingColor: v })}
                />
              </div>
            </>
          )}

          {tab === 'gear' && (
            <ChoiceRow
              label="Headwear & Glasses"
              options={ACCESSORIES}
              value={draft.accessory}
              onPick={(v) => patch({ accessory: v as AvatarConfig['accessory'] })}
            />
          )}

          {tab === 'bikes' && (
            <>
              <ChoiceRow
                label="Select Your Bike / Ride"
                options={PROP_BIKES}
                value={draft.propBike}
                onPick={(v) => patch({ propBike: v as AvatarConfig['propBike'] })}
                cols="grid-cols-2 sm:grid-cols-4"
              />
              <div className="pt-4 border-t border-neutral-800">
                <SwatchRow
                  label="Frame Colour"
                  options={BIKE_COLORS}
                  value={draft.bikeColor}
                  onPick={(v) => patch({ bikeColor: v })}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarStudio;
