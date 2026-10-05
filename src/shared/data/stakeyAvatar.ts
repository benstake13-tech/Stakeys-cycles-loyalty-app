/**
 * Virtual Stakey — helper metadata, voice palettes and defaults.
 *
 * This module is shared by both builds: the staff-only terminal uses it to
 * configure the helper, and the customer build uses it to render it. The
 * character artwork itself is a single image (`public/brand/stakeys-avatar.svg`);
 * this file only describes the behaviour the staff can tune and the persisted
 * config shape.
 */
import type { StakeyAvatarConfig, StakeyAvatarVoiceStyle } from '../types/bikeShop';

export interface AvatarOption<T extends string> {
  id: T;
  label: string;
}

export const AVATAR_VOICE_STYLE_OPTIONS: AvatarOption<StakeyAvatarVoiceStyle>[] = [
  { id: 'warm', label: 'Warm & friendly' },
  { id: 'bright', label: 'Bright & upbeat' },
  { id: 'calm', label: 'Calm & steady' },
  { id: 'energetic', label: 'Energetic' },
];

/** Brand green, kept for the helper UI accents. */
export const DEFAULT_ACCENT = '#05C147';

/** Staff pick a "voice style"; these map onto the browser speech engine. */
export const VOICE_STYLE_SETTINGS: Record<
  StakeyAvatarVoiceStyle,
  { rate: number; pitch: number; label: string }
> = {
  warm: { rate: 0.98, pitch: 1.0, label: 'Warm & friendly' },
  bright: { rate: 1.08, pitch: 1.18, label: 'Bright & upbeat' },
  calm: { rate: 0.9, pitch: 0.92, label: 'Calm & steady' },
  energetic: { rate: 1.18, pitch: 1.25, label: 'Energetic' },
};

export const DEFAULT_STAKEY_AVATAR: StakeyAvatarConfig = {
  enabled: true,
  name: 'Stakey',
  voiceStyle: 'warm',
  voiceEnabled: false,
  persona:
    "You are Stakey, the friendly virtual helper for Stakey's Cycles & Scooter, a bike and e-scooter workshop. " +
    'Be warm, concise and practical. Help customers book a repair, understand services and pricing, use the loyalty ' +
    'stamp card, find their way around the app, and look after their bike. Never invent prices or promises — if you ' +
    'are unsure, offer to pass the customer to a mechanic.',
};

/**
 * Merge a partial/stored config over the defaults, dropping unknown keys so a
 * malformed stored row can never crash the renderer.
 */
export function normalizeStakeyAvatarConfig(raw: unknown): StakeyAvatarConfig {
  const base = DEFAULT_STAKEY_AVATAR;
  if (!raw || typeof raw !== 'object') return { ...base };
  const r = raw as Partial<Record<keyof StakeyAvatarConfig, unknown>>;
  const validVoices = AVATAR_VOICE_STYLE_OPTIONS.map((o) => o.id);
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : base.name,
    voiceStyle:
      typeof r.voiceStyle === 'string' && validVoices.includes(r.voiceStyle as StakeyAvatarVoiceStyle)
        ? (r.voiceStyle as StakeyAvatarVoiceStyle)
        : base.voiceStyle,
    voiceEnabled: typeof r.voiceEnabled === 'boolean' ? r.voiceEnabled : base.voiceEnabled,
    persona: typeof r.persona === 'string' ? r.persona.slice(0, 2000) : base.persona,
  };
}
