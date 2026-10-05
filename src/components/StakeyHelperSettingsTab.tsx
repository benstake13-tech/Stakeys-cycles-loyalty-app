/**
 * Stakey Helper — the staff-only settings panel for Virtual Stakey.
 *
 * The character artwork is fixed; staff choose the helper's name, how it
 * sounds and how it behaves. The saved config is what the customer app renders
 * as the speaking helper.
 */
import React, { useMemo, useState } from 'react';
import { Bot, Check, RotateCcw, Save, Sparkles, Volume2 } from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';
import type { StakeyAvatarConfig } from '../shared/types/bikeShop';
import { StakeyAvatar } from './StakeyAvatar';
import {
  AVATAR_VOICE_STYLE_OPTIONS,
  DEFAULT_STAKEY_AVATAR,
} from '../shared/data/stakeyAvatar';
import { isSpeechSupported, primeVoices, speak } from '../shared/utils/stakeyVoice';
import { isStakeyAiConfigured } from '../shared/utils/stakeyAssistant';

function OptionPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
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

export const StakeyHelperSettingsTab: React.FC = () => {
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
              Virtual Stakey — Helper
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
            Set up the helper your customers meet. It greets them, answers questions, speaks aloud and walks them to the
            right screen. Saved to the shared backend so the customer app shows the same helper.
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
            {saved ? 'Saved' : 'Save helper'}
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
                style={{ background: '#05C147' }}
              />
              <StakeyAvatar config={draft} size={190} talking={speaking} />
            </div>
            <p className="mt-2 text-lg font-black text-white">{draft.name || 'Stakey'}</p>
            <p className="text-[11px] text-neutral-400 capitalize">{draft.voiceStyle} voice</p>

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
            <p className="text-[11px] text-neutral-500">
              The helper uses the workshop's illustrated character, so there is nothing else to build here.
            </p>
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
