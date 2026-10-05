/**
 * Bitmoji-style rider avatar.
 *
 * Pure data — the SVG renderer (components/Avatar.tsx) draws from an
 * AvatarConfig, so an avatar is just a small JSON blob we can store on the
 * profile and render identically on the customer and staff builds.
 */

export type AvatarSkinTone =
  | 'porcelain'
  | 'fair'
  | 'light'
  | 'tan'
  | 'olive'
  | 'bronze'
  | 'brown'
  | 'deep';

export type AvatarHairStyle =
  | 'bald'
  | 'buzz'
  | 'short'
  | 'fade'
  | 'curly'
  | 'afro'
  | 'bun'
  | 'ponytail'
  | 'long'
  | 'bob'
  | 'mohawk';

export type AvatarFacialHair = 'none' | 'stubble' | 'moustache' | 'goatee' | 'full_beard';

export type AvatarGlasses = 'none' | 'round' | 'square' | 'sport' | 'sunglasses';

export type AvatarHeadwear = 'none' | 'cap' | 'helmet' | 'beanie' | 'visor';

export type AvatarMouth = 'smile' | 'grin' | 'neutral' | 'smirk' | 'open';

export type AvatarEyes = 'happy' | 'wide' | 'sleepy' | 'wink';

export interface AvatarConfig {
  /** Schema version, so a future change can migrate old avatars. */
  v: 1;
  skinTone: AvatarSkinTone;
  hairStyle: AvatarHairStyle;
  hairColor: string;
  facialHair: AvatarFacialHair;
  glasses: AvatarGlasses;
  headwear: AvatarHeadwear;
  headwearColor: string;
  eyes: AvatarEyes;
  mouth: AvatarMouth;
  /** Jersey / top colour. */
  topColor: string;
  /** Optional race number printed on the jersey. */
  jerseyNumber: string;
  /** Simple backdrop colour behind the bust. */
  background: string;
}

export interface AvatarChoice<T extends string> {
  id: T;
  label: string;
}

export const SKIN_TONES: { id: AvatarSkinTone; label: string; hex: string }[] = [
  { id: 'porcelain', label: 'Porcelain', hex: '#F6D9C6' },
  { id: 'fair', label: 'Fair', hex: '#F0C9A8' },
  { id: 'light', label: 'Light', hex: '#E4B48D' },
  { id: 'tan', label: 'Tan', hex: '#D2A074' },
  { id: 'olive', label: 'Olive', hex: '#B98A5E' },
  { id: 'bronze', label: 'Bronze', hex: '#9C6B45' },
  { id: 'brown', label: 'Brown', hex: '#7A4E2E' },
  { id: 'deep', label: 'Deep', hex: '#5A3720' },
];

export const HAIR_STYLES: AvatarChoice<AvatarHairStyle>[] = [
  { id: 'bald', label: 'Bald' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'short', label: 'Short' },
  { id: 'fade', label: 'Fade' },
  { id: 'curly', label: 'Curly' },
  { id: 'afro', label: 'Afro' },
  { id: 'bun', label: 'Bun' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'long', label: 'Long' },
  { id: 'bob', label: 'Bob' },
  { id: 'mohawk', label: 'Mohawk' },
];

export const HAIR_COLORS: { id: string; label: string; hex: string }[] = [
  { id: 'black', label: 'Black', hex: '#1C1C1E' },
  { id: 'dark_brown', label: 'Dark brown', hex: '#3B2A20' },
  { id: 'brown', label: 'Brown', hex: '#6B4A2E' },
  { id: 'auburn', label: 'Auburn', hex: '#8A4B2A' },
  { id: 'blonde', label: 'Blonde', hex: '#D8B25E' },
  { id: 'ginger', label: 'Ginger', hex: '#C4562B' },
  { id: 'grey', label: 'Grey', hex: '#9AA0A6' },
  { id: 'blue', label: 'Blue', hex: '#3B6FD4' },
  { id: 'pink', label: 'Pink', hex: '#E45BA6' },
  { id: 'purple', label: 'Purple', hex: '#8B5CF6' },
];

export const FACIAL_HAIR: AvatarChoice<AvatarFacialHair>[] = [
  { id: 'none', label: 'Clean' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'goatee', label: 'Goatee' },
  { id: 'full_beard', label: 'Beard' },
];

export const GLASSES: AvatarChoice<AvatarGlasses>[] = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'sport', label: 'Sport' },
  { id: 'sunglasses', label: 'Sunglasses' },
];

export const HEADWEAR: AvatarChoice<AvatarHeadwear>[] = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'helmet', label: 'Helmet' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'visor', label: 'Visor' },
];

export const EYES: AvatarChoice<AvatarEyes>[] = [
  { id: 'happy', label: 'Happy' },
  { id: 'wide', label: 'Wide' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'wink', label: 'Wink' },
];

export const MOUTHS: AvatarChoice<AvatarMouth>[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Grin' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'smirk', label: 'Smirk' },
  { id: 'open', label: 'Open' },
];

export const TOP_COLORS: { id: string; label: string; hex: string }[] = [
  { id: 'emerald', label: 'Emerald', hex: '#05C147' },
  { id: 'forest', label: 'Forest', hex: '#166534' },
  { id: 'navy', label: 'Navy', hex: '#1E3A8A' },
  { id: 'sky', label: 'Sky', hex: '#38BDF8' },
  { id: 'red', label: 'Red', hex: '#DC2626' },
  { id: 'amber', label: 'Amber', hex: '#F59E0B' },
  { id: 'purple', label: 'Purple', hex: '#7C3AED' },
  { id: 'charcoal', label: 'Charcoal', hex: '#334155' },
];

export const BACKGROUNDS: { id: string; label: string; hex: string }[] = [
  { id: 'mint', label: 'Mint', hex: '#D1FAE5' },
  { id: 'sky', label: 'Sky', hex: '#DBEAFE' },
  { id: 'sunset', label: 'Sunset', hex: '#FFE4C7' },
  { id: 'lilac', label: 'Lilac', hex: '#EDE9FE' },
  { id: 'slate', label: 'Slate', hex: '#E2E8F0' },
];

const SKIN_BY_ID = new Map(SKIN_TONES.map((s) => [s.id, s.hex]));
const HAIR_HEX_BY_ID = new Map(HAIR_COLORS.map((c) => [c.id, c.hex]));
const TOP_HEX_BY_ID = new Map(TOP_COLORS.map((c) => [c.id, c.hex]));
const BG_HEX_BY_ID = new Map(BACKGROUNDS.map((c) => [c.id, c.hex]));

export const skinHex = (id: AvatarSkinTone): string => SKIN_BY_ID.get(id) || SKIN_TONES[2].hex;
export const hairHex = (id: string): string => HAIR_HEX_BY_ID.get(id) || id || HAIR_COLORS[2].hex;
export const topHex = (id: string): string => TOP_HEX_BY_ID.get(id) || id || TOP_COLORS[0].hex;
export const backgroundHex = (id: string): string => BG_HEX_BY_ID.get(id) || id || BACKGROUNDS[0].hex;

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  skinTone: 'light',
  hairStyle: 'short',
  hairColor: 'dark_brown',
  facialHair: 'none',
  glasses: 'none',
  headwear: 'none',
  headwearColor: 'emerald',
  eyes: 'happy',
  mouth: 'smile',
  topColor: 'emerald',
  jerseyNumber: '',
  background: 'mint',
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A random, always-valid avatar — the "Surprise me" button. */
export function randomAvatar(): AvatarConfig {
  return {
    v: 1,
    skinTone: pick(SKIN_TONES).id,
    hairStyle: pick(HAIR_STYLES).id,
    hairColor: pick(HAIR_COLORS).id,
    facialHair: pick(FACIAL_HAIR).id,
    glasses: pick(GLASSES).id,
    headwear: pick(HEADWEAR).id,
    headwearColor: pick(TOP_COLORS).id,
    eyes: pick(EYES).id,
    mouth: pick(MOUTHS).id,
    topColor: pick(TOP_COLORS).id,
    jerseyNumber: String(Math.floor(Math.random() * 99) + 1),
    background: pick(BACKGROUNDS).id,
  };
}

const oneOf = <T extends string>(value: unknown, allowed: readonly { id: T }[], fallback: T): T =>
  allowed.some((a) => a.id === value) ? (value as T) : fallback;

/**
 * Coerce anything read back from storage into a valid AvatarConfig. A missing
 * or corrupt blob yields the default rather than a half-drawn face.
 */
export function normalizeAvatar(raw: unknown): AvatarConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<AvatarConfig>;
  return {
    v: 1,
    skinTone: oneOf(o.skinTone, SKIN_TONES, DEFAULT_AVATAR.skinTone),
    hairStyle: oneOf(o.hairStyle, HAIR_STYLES, DEFAULT_AVATAR.hairStyle),
    hairColor: typeof o.hairColor === 'string' && o.hairColor ? o.hairColor : DEFAULT_AVATAR.hairColor,
    facialHair: oneOf(o.facialHair, FACIAL_HAIR, DEFAULT_AVATAR.facialHair),
    glasses: oneOf(o.glasses, GLASSES, DEFAULT_AVATAR.glasses),
    headwear: oneOf(o.headwear, HEADWEAR, DEFAULT_AVATAR.headwear),
    headwearColor:
      typeof o.headwearColor === 'string' && o.headwearColor
        ? o.headwearColor
        : DEFAULT_AVATAR.headwearColor,
    eyes: oneOf(o.eyes, EYES, DEFAULT_AVATAR.eyes),
    mouth: oneOf(o.mouth, MOUTHS, DEFAULT_AVATAR.mouth),
    topColor: typeof o.topColor === 'string' && o.topColor ? o.topColor : DEFAULT_AVATAR.topColor,
    jerseyNumber:
      typeof o.jerseyNumber === 'string' ? o.jerseyNumber.slice(0, 3) : DEFAULT_AVATAR.jerseyNumber,
    background:
      typeof o.background === 'string' && o.background ? o.background : DEFAULT_AVATAR.background,
  };
}
