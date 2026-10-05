/**
 * Virtual Stakey — avatar option metadata, colour palettes and defaults.
 *
 * This module is shared by both builds: the staff-only terminal uses it to
 * author the character, and the customer build uses it to render the helper.
 * The actual character drawing lives in `src/components/StakeyAvatar.tsx`; this
 * file only describes the choices and the persisted config shape.
 */
import type {
  StakeyAvatarConfig,
  StakeyAvatarSpecies,
  StakeyAvatarBody,
  StakeyAvatarHairStyle,
  StakeyAvatarHairColor,
  StakeyAvatarSkin,
  StakeyAvatarOutfit,
  StakeyAvatarOutfitColor,
  StakeyAvatarVoiceStyle,
} from '../types/bikeShop';

export interface AvatarOption<T extends string> {
  id: T;
  label: string;
  /** Only offer the option for these species (omitted = both). */
  species?: StakeyAvatarSpecies[];
}

export const AVATAR_SPECIES_OPTIONS: AvatarOption<StakeyAvatarSpecies>[] = [
  { id: 'human', label: 'Person' },
  { id: 'robot', label: 'Robot' },
];

export const AVATAR_BODY_OPTIONS: AvatarOption<StakeyAvatarBody>[] = [
  { id: 'slim', label: 'Slim' },
  { id: 'regular', label: 'Regular' },
  { id: 'stocky', label: 'Stocky' },
];

export const AVATAR_HAIR_STYLE_OPTIONS: AvatarOption<StakeyAvatarHairStyle>[] = [
  { id: 'short', label: 'Short', species: ['human'] },
  { id: 'cap', label: 'Cap', species: ['human'] },
  { id: 'bun', label: 'Bun', species: ['human'] },
  { id: 'spiky', label: 'Spiky', species: ['human'] },
  { id: 'bald', label: 'Bald', species: ['human'] },
  { id: 'beanie', label: 'Beanie', species: ['human'] },
  { id: 'helmet', label: 'Helmet', species: ['human'] },
  { id: 'antenna', label: 'Antenna', species: ['robot'] },
];

export const AVATAR_HAIR_COLOR_OPTIONS: AvatarOption<StakeyAvatarHairColor>[] = [
  { id: 'black', label: 'Black' },
  { id: 'brown', label: 'Brown' },
  { id: 'blonde', label: 'Blonde' },
  { id: 'ginger', label: 'Ginger' },
  { id: 'grey', label: 'Grey' },
  { id: 'green', label: 'Green' },
  { id: 'teal', label: 'Teal' },
  { id: 'pink', label: 'Pink' },
];

export const AVATAR_SKIN_OPTIONS: AvatarOption<StakeyAvatarSkin>[] = [
  { id: 'light', label: 'Light' },
  { id: 'tan', label: 'Tan' },
  { id: 'medium', label: 'Medium' },
  { id: 'deep', label: 'Deep' },
];

export const AVATAR_OUTFIT_OPTIONS: AvatarOption<StakeyAvatarOutfit>[] = [
  { id: 'overalls', label: 'Overalls' },
  { id: 'tee', label: 'T-Shirt' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'polo', label: 'Polo' },
];

export const AVATAR_OUTFIT_COLOR_OPTIONS: AvatarOption<StakeyAvatarOutfitColor>[] = [
  { id: 'emerald', label: 'Emerald' },
  { id: 'navy', label: 'Navy' },
  { id: 'coral', label: 'Coral' },
  { id: 'charcoal', label: 'Charcoal' },
  { id: 'mustard', label: 'Mustard' },
];

export const AVATAR_VOICE_STYLE_OPTIONS: AvatarOption<StakeyAvatarVoiceStyle>[] = [
  { id: 'warm', label: 'Warm & friendly' },
  { id: 'bright', label: 'Bright & upbeat' },
  { id: 'calm', label: 'Calm & steady' },
  { id: 'energetic', label: 'Energetic' },
];

export const HAIR_COLOR_HEX: Record<StakeyAvatarHairColor, string> = {
  black: '#1c1f24',
  brown: '#6b4423',
  blonde: '#d9b06a',
  ginger: '#c1440e',
  grey: '#9aa1a9',
  green: '#3fb950',
  teal: '#0aa3a3',
  pink: '#e2559b',
};

export const SKIN_HEX: Record<StakeyAvatarSkin, string> = {
  light: '#f3d3b5',
  tan: '#e0b088',
  medium: '#b57a4e',
  deep: '#7a4a2b',
};

export const OUTFIT_COLOR_HEX: Record<StakeyAvatarOutfitColor, { base: string; dark: string }> = {
  emerald: { base: '#05C147', dark: '#048a33' },
  navy: { base: '#27406b', dark: '#1b2c4a' },
  coral: { base: '#e2554b', dark: '#b23b34' },
  charcoal: { base: '#3a3f46', dark: '#26292e' },
  mustard: { base: '#e0a92b', dark: '#b07f14' },
};

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
  species: 'human',
  body: 'regular',
  hairStyle: 'cap',
  hairColor: 'brown',
  skin: 'tan',
  outfit: 'overalls',
  outfitColor: 'emerald',
  accentColor: DEFAULT_ACCENT,
  voiceStyle: 'warm',
  voiceEnabled: false,
  persona:
    "You are Stakey, the friendly virtual helper for Stakey's Cycles & Scooter, a bike and e-scooter workshop. " +
    'Be warm, concise and practical. Help customers book a repair, understand services and pricing, use the loyalty ' +
    'stamp card, find their way around the app, and look after their bike. Never invent prices or promises — if you ' +
    "are unsure, offer to pass the customer to a mechanic.",
};

/**
 * Merge a partial/stored config over the defaults, dropping unknown keys so a
 * malformed stored row can never crash the renderer.
 */
export function normalizeStakeyAvatarConfig(raw: unknown): StakeyAvatarConfig {
  const base = DEFAULT_STAKEY_AVATAR;
  if (!raw || typeof raw !== 'object') return { ...base };
  const r = raw as Partial<Record<keyof StakeyAvatarConfig, unknown>>;
  const pick = <K extends keyof StakeyAvatarConfig>(key: K, valid: readonly string[]): StakeyAvatarConfig[K] => {
    const v = r[key];
    return (typeof v === 'string' && valid.includes(v) ? (v as StakeyAvatarConfig[K]) : base[key]);
  };
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 40) : base.name,
    species: pick('species', AVATAR_SPECIES_OPTIONS.map((o) => o.id)),
    body: pick('body', AVATAR_BODY_OPTIONS.map((o) => o.id)),
    hairStyle: pick('hairStyle', AVATAR_HAIR_STYLE_OPTIONS.map((o) => o.id)),
    hairColor: pick('hairColor', AVATAR_HAIR_COLOR_OPTIONS.map((o) => o.id)),
    skin: pick('skin', AVATAR_SKIN_OPTIONS.map((o) => o.id)),
    outfit: pick('outfit', AVATAR_OUTFIT_OPTIONS.map((o) => o.id)),
    outfitColor: pick('outfitColor', AVATAR_OUTFIT_COLOR_OPTIONS.map((o) => o.id)),
    accentColor: typeof r.accentColor === 'string' && r.accentColor.trim() ? r.accentColor.trim() : base.accentColor,
    voiceStyle: pick('voiceStyle', AVATAR_VOICE_STYLE_OPTIONS.map((o) => o.id)),
    voiceEnabled: typeof r.voiceEnabled === 'boolean' ? r.voiceEnabled : base.voiceEnabled,
    persona: typeof r.persona === 'string' ? r.persona.slice(0, 2000) : base.persona,
  };
}
