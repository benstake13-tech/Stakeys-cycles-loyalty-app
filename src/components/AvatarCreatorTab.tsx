/**
 * Avatar Creator — the staff-only studio for Virtual Stakey.
 *
 * Staff design the helper character here (name, look, outfit, voice and
 * personality). The saved config is what the customer app renders as the
 * animated, speaking helper. Live preview updates as you edit.
 */
import React, { useMemo, useState } from 'react';
import { Bot, Check, Palette, RotateCcw, Save, Sparkles, Volume2 } from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import type { StakeyAvatarConfig } from '../shared/types/bikeShop';
import { StakeyAvatar } from './StakeyAvatar';
import {
  AVATAR_BODY_OPTIONS,
  AVATAR_HAIR_COLOR_OPTIONS,
  AVATAR_HAIR_STYLE_OPTIONS,
  AVATAR_OUTFIT_COLOR_OPTIONS,
  AVATAR_OUTFIT_OPTIONS,
  AVATAR_SKIN_OPTIONS,
  AVATAR_SPECIES_OPTIONS,
  AVATAR_VOICE_STYLE_OPTIONS,
  DEFAULT_ACCENT,
  DEFAULT_STAKEY_AVATAR,
  HAIR_COLOR_HEX,
  OUTFIT_COLOR_HEX,
  SKIN_HEX,
} from '../shared/data/stakeyAvatar';
import { isSpeechSupported, primeVoices, speak } from '../shared/utils/stakeyVoice';
import { isStakeyAiConfigured } from '../shared/utils/stakeyAssistant';

interface PillProps<T extends string> {
  options: { id: T; label: string; species?: StakeyAvatarConfig['species'][] }[];
  value: T;
  onChange: (v: T) => void;
  species?: StakeyAvatarConfig['species'];
}

function OptionPills<T extends string>({ options, value, onChange, species }: PillProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options
        .filter((o) => !species || !o.species || o.species.includes(species))
        .map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
              value === o.id
                ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                : 'bg-white/5 text-neutral-300 border-white/10 hover:border-emerald-500/40'
            }`}
          >
            {o.label}
          </button>
        ))}
    </div>
  );
}

function Swatch<T extends string>({
  options,
  value,
  onChange,
  colors,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  colors: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.label}
          aria-label={o.label}
          onClick={() => onChange(o.id)}
          className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 ${
            value === o.id ? 'border-white ring-2 ring-emerald-400/60' : 'border-white/20'
          }`}
          style={{ background: colors[o.id] }}
        />
      ))}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d1015] border border-neutral-800 rounded-2xl p-5">
      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export const AvatarCreatorTab: React.FC = () => {
  const { stakeyAvatar, updateStakeyAvatar } = useShop();
  const [draft, setDraft] = useState<StakeyAvatarConfig>(stakeyAvatar);
  const [saved, setSaved] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const aiReady = useMemo(() => isStakeyAiConfigured(), []);
  const speechReady = useMemo(() => isSpeechSupported(), []);
  const set = <K extends keyof StakeyAvatarConfig>(key: K, value: StakeyAvatarConfig[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateStakeyAvatar(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const handlePreviewVoice = async () => {
    if (!speechReady) return;
    primeVoices();
    setSpeaking(true);
    await speak(
      `Hi, I'm ${draft.name || 'Stakey'}. I can help you book a repair and use your loyalty stamps.`,
      draft.voiceStyle
    );
    setSpeaking(false);
  };

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Banner */}
      <div className="bg-[#0d1015] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              Virtual Stakey — Avatar Creator
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              AI HELPER
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                aiReady
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              {aiReady ? 'GEMINI LIVE' : 'LOCAL ANSWERS'}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
            Design the animated helper your customers meet. He greets them, answers questions, speaks aloud and walks
            them to the right screen. Saved to the shared backend so the customer app shows the same character.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_STAKEY_AVATAR })}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 text-neutral-300 border border-white/10 hover:border-white/30 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-neutral-950 hover:bg-emerald-400 cursor-pointer flex items-center gap-1.5"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Saved' : 'Save avatar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Live preview */}
        <div className="bg-gradient-to-b from-[#0d1015] to-[#0a0d11] border border-neutral-800 rounded-3xl p-6 sticky top-4">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div
                className="absolute inset-0 -z-10 rounded-full blur-2xl opacity-40"
                style={{ background: draft.accentColor || DEFAULT_ACCENT }}
              />
              <StakeyAvatar config={draft} size={190} talking={speaking} />
            </div>
            <p className="mt-2 text-lg font-black text-white">{draft.name || 'Stakey'}</p>
            <p className="text-[11px] text-neutral-400 capitalize">
              {draft.species} · {draft.outfit} · {draft.voiceStyle} voice
            </p>

            <div className="mt-4 w-full space-y-2">
              <label className="flex items-center justify-between text-xs font-semibold text-neutral-300 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 cursor-pointer">
                <span className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Show helper to customers
                </span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => set('enabled', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
              <label
                className={`flex items-center justify-between text-xs font-semibold rounded-xl px-3.5 py-2.5 border ${
                  speechReady ? 'text-neutral-300 bg-white/5 border-white/10 cursor-pointer' : 'text-neutral-600 bg-white/5 border-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> Speak answers aloud
                </span>
                <input
                  type="checkbox"
                  disabled={!speechReady}
                  checked={draft.voiceEnabled}
                  onChange={(e) => set('voiceEnabled', e.target.checked)}
                  className="w-4 h-4 accent-emerald-500"
                />
              </label>
              <button
                type="button"
                onClick={handlePreviewVoice}
                disabled={!speechReady}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/5 text-neutral-200 border border-white/10 hover:border-emerald-500/40 disabled:opacity-40 cursor-pointer"
              >
                {speaking ? 'Speaking…' : '▶ Preview voice'}
              </button>
              {!speechReady && (
                <p className="text-[10px] text-neutral-500 text-center">
                  This browser has no speech voices available.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Identity" icon={<Sparkles className="w-4 h-4 text-emerald-400" />}>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Helper name</label>
              <input
                value={draft.name}
                maxLength={40}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Stakey"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500/60 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Character</label>
              <OptionPills options={AVATAR_SPECIES_OPTIONS} value={draft.species} onChange={(v) => set('species', v)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Build</label>
              <OptionPills options={AVATAR_BODY_OPTIONS} value={draft.body} onChange={(v) => set('body', v)} />
            </div>
          </Section>

          <Section title="Head" icon={<Palette className="w-4 h-4 text-emerald-400" />}>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Hair / headwear</label>
              <OptionPills
                options={AVATAR_HAIR_STYLE_OPTIONS}
                value={draft.hairStyle}
                onChange={(v) => set('hairStyle', v)}
                species={draft.species}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Hair colour</label>
              <Swatch
                options={AVATAR_HAIR_COLOR_OPTIONS}
                value={draft.hairColor}
                onChange={(v) => set('hairColor', v)}
                colors={HAIR_COLOR_HEX}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Skin tone</label>
              <Swatch
                options={AVATAR_SKIN_OPTIONS}
                value={draft.skin}
                onChange={(v) => set('skin', v)}
                colors={SKIN_HEX}
              />
            </div>
          </Section>

          <Section title="Outfit" icon={<Palette className="w-4 h-4 text-emerald-400" />}>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Style</label>
              <OptionPills options={AVATAR_OUTFIT_OPTIONS} value={draft.outfit} onChange={(v) => set('outfit', v)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Colour</label>
              <Swatch
                options={AVATAR_OUTFIT_COLOR_OPTIONS}
                value={draft.outfitColor}
                onChange={(v) => set('outfitColor', v)}
                colors={Object.fromEntries(
                  Object.entries(OUTFIT_COLOR_HEX).map(([k, v]) => [k, v.base])
                ) as Record<StakeyAvatarConfig['outfitColor'], string>}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Business accent</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={draft.accentColor || DEFAULT_ACCENT}
                  onChange={(e) => set('accentColor', e.target.value)}
                  className="w-10 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                />
                <span className="text-xs font-mono text-neutral-400">{draft.accentColor || DEFAULT_ACCENT}</span>
              </div>
            </div>
          </Section>

          <Section title="Voice & personality" icon={<Volume2 className="w-4 h-4 text-emerald-400" />}>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Voice style</label>
              <OptionPills
                options={AVATAR_VOICE_STYLE_OPTIONS}
                value={draft.voiceStyle}
                onChange={(v) => set('voiceStyle', v)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                Personality &amp; guidance (tells the AI how to behave)
              </label>
              <textarea
                value={draft.persona}
                rows={6}
                onChange={(e) => set('persona', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-emerald-500/60 outline-none resize-y"
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};
