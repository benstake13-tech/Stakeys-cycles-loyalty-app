import React, { useState } from 'react';
import { FaceAvatar, getDeterministicConfig } from './FaceAvatar';
import { AvatarEditorModal } from './AvatarEditorModal';
import { useShop } from '../context/ShopContext';

/**
 * Session-only preview of the avatar system, reached with `?avatar=1`.
 *
 * It mounts the real `AvatarEditorModal` and `FaceAvatar` components, so what
 * you see is exactly what a customer gets in "My Garage & Pass" — no login and
 * no write to the profile. Nothing here is persisted.
 */

const PRESET_SEEDS = [
  'Aisha',
  'Ben',
  'Carlos',
  'Dee',
  'Ewan',
  'Fatima',
  'Grace',
  'Hassan',
  'Ivy',
  'Jonas',
  'Kira',
  'Liam',
];

export const AvatarPreviewStage: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const [heroName, setHeroName] = useState('Preview Rider');
  const [heroConfig, setHeroConfig] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  const panel = isDark ? 'bg-neutral-900/60 border-neutral-800' : 'bg-white border-neutral-200';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#090b0e] text-neutral-100' : 'bg-slate-50 text-neutral-900'} font-['Plus_Jakarta_Sans',sans-serif] px-4 py-8`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Avatar Creator — Preview</h1>
            <p className={`text-xs mt-1 ${muted}`}>
              Session preview only (<code className="font-mono">?avatar=1</code>). Nothing is saved to a profile.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
          >
            Open Avatar Creator
          </button>
        </div>

        <div className={`mt-6 rounded-2xl border p-6 flex items-center gap-6 flex-wrap ${panel}`}>
          <FaceAvatar seed={heroName} configString={heroConfig} size={140} />
          <div>
            <div className="text-lg font-bold">{heroName}</div>
            <div className={`text-xs ${muted}`}>Current look — edit it with the button above.</div>
            <div className={`mt-2 text-[11px] font-mono break-all max-w-md ${muted}`}>
              {heroConfig ? heroConfig : 'deterministic default (no saved config)'}
            </div>
          </div>
        </div>

        <h2 className="mt-8 text-sm font-black uppercase tracking-widest">Auto-generated variety</h2>
        <p className={`text-xs mt-1 ${muted}`}>Every member gets a deterministic avatar from their name — these are 12 sample seeds.</p>
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {PRESET_SEEDS.map((seed) => (
            <button
              key={seed}
              type="button"
              onClick={() => {
                setHeroName(seed);
                setHeroConfig(undefined);
              }}
              className={`rounded-2xl border p-3 flex flex-col items-center gap-2 cursor-pointer transition-transform hover:scale-105 ${panel}`}
              title={`Use "${seed}" as the preview avatar`}
            >
              <FaceAvatar seed={seed} size={72} />
              <span className={`text-[11px] font-bold ${muted}`}>{seed}</span>
            </button>
          ))}
        </div>

        <p className={`mt-6 text-[11px] ${muted}`}>
          Config sample: <code className="font-mono">{JSON.stringify(getDeterministicConfig('Aisha'))}</code>
        </p>
      </div>

      {editing && (
        <AvatarEditorModal
          name={heroName}
          currentConfigString={heroConfig}
          onSave={(configString) => {
            setHeroConfig(configString);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
};
