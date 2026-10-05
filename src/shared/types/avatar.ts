/**
 * Stakeys rider avatar.
 *
 * Pure data — the SVG renderer (components/AvatarSVG.tsx) draws from an
 * AvatarConfig, so an avatar is just a small JSON blob we can store on the
 * profile and render identically on the customer and staff builds.
 */

export type AvatarHairStyle = 'messyShort' | 'fadeCut' | 'quiff' | 'buzz';

export type AvatarFacialHair = 'none' | 'trimmedBeard' | 'fullBeard' | 'mustache';

export type AvatarEyeShape = 'friendly' | 'expressive' | 'relaxed';

export type AvatarExpression = 'customerSmile' | 'broadSmile' | 'coolMirk';

export type AvatarClothingStyle = 'nikeHoodie' | 'stakeysJersey' | 'tshirt' | 'jacket';

export type AvatarAccessory = 'none' | 'cyclingGlasses' | 'helmet' | 'beanie';

export type AvatarPropBike = 'none' | 'roadBike' | 'mountainBike' | 'eScooter';

export interface AvatarConfig {
  /** Schema version, so a future change can migrate old avatars. */
  v: 1;
  /** Skin tone as a hex colour. */
  skinTone: string;
  hairStyle: AvatarHairStyle;
  hairColor: string;
  facialHair: AvatarFacialHair;
  facialHairColor: string;
  eyeShape: AvatarEyeShape;
  eyeColor: string;
  expression: AvatarExpression;
  clothingStyle: AvatarClothingStyle;
  clothingColor: string;
  accessory: AvatarAccessory;
  /** The bike the rider is shown with (or none). */
  propBike: AvatarPropBike;
  bikeColor: string;
}

/**
 * A generated HD portrait layered over the vector avatar — the "AI likeness"
 * of the customer. Produced by the image-generation pipeline in
 * `shared/api/avatarImageService.ts` and stored as a base64 data URL on the
 * profile so it renders offline and never needs a public bucket.
 */
export interface AvatarImage {
  /** base64 data URL (image/png) */
  dataUrl: string;
  prompt: string;
  model: string;
  createdAt: string;
}

/** Guard against oversized payloads bloating the profiles row. */
export const MAX_AVATAR_IMAGE_CHARS = 2_500_000;

export function normalizeAvatarImage(raw: unknown): AvatarImage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Partial<AvatarImage>;
  if (typeof o.dataUrl !== 'string' || !o.dataUrl.startsWith('data:image')) return undefined;
  if (o.dataUrl.length > MAX_AVATAR_IMAGE_CHARS) return undefined;
  return {
    dataUrl: o.dataUrl,
    prompt: typeof o.prompt === 'string' ? o.prompt : '',
    model: typeof o.model === 'string' ? o.model : '',
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(0).toISOString(),
  };
}

export interface SwatchOption {
  id: string;
  label: string;
  hex: string;
}

export interface ChoiceOption<T extends string> {
  id: T;
  label: string;
}

export const SKIN_TONES: SwatchOption[] = [
  { id: 'skin1', label: 'Fair Light', hex: '#FDDFD0' },
  { id: 'skin2', label: 'Warm Peach', hex: '#F3C5A5' },
  { id: 'skin3', label: 'Olive Golden', hex: '#D09E74' },
  { id: 'skin4', label: 'Rich Tan', hex: '#A16E4B' },
  { id: 'skin5', label: 'Warm Brown', hex: '#73462A' },
  { id: 'skin6', label: 'Deep Espresso', hex: '#3D2314' },
];

export const HAIR_STYLES: ChoiceOption<AvatarHairStyle>[] = [
  { id: 'messyShort', label: 'Messy Short' },
  { id: 'fadeCut', label: 'Taper Fade' },
  { id: 'quiff', label: 'Voluminous Quiff' },
  { id: 'buzz', label: 'Buzz Cut' },
];

export const HAIR_COLORS: SwatchOption[] = [
  { id: 'hc1', label: 'Espresso Black', hex: '#2C1B18' },
  { id: 'hc2', label: 'Dark Chestnut', hex: '#4A3228' },
  { id: 'hc3', label: 'Warm Amber', hex: '#82481A' },
  { id: 'hc4', label: 'Golden Blonde', hex: '#E2A93A' },
  { id: 'hc5', label: 'Silver Ash', hex: '#8D99AE' },
  { id: 'hc6', label: 'Stakeys Neon Green', hex: '#10B981' },
];

export const FACIAL_HAIR: ChoiceOption<AvatarFacialHair>[] = [
  { id: 'trimmedBeard', label: 'Trimmed Scruff' },
  { id: 'fullBeard', label: 'Full Beard' },
  { id: 'mustache', label: 'Classic Stache' },
  { id: 'none', label: 'Clean Shaven' },
];

export const EYE_SHAPES: ChoiceOption<AvatarEyeShape>[] = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'expressive', label: 'Expressive' },
  { id: 'relaxed', label: 'Relaxed' },
];

export const EXPRESSIONS: ChoiceOption<AvatarExpression>[] = [
  { id: 'customerSmile', label: 'Friendly Customer Smile' },
  { id: 'broadSmile', label: 'Classic Smile' },
  { id: 'coolMirk', label: 'Confident Smirk' },
];

export const CLOTHING_STYLES: ChoiceOption<AvatarClothingStyle>[] = [
  { id: 'nikeHoodie', label: 'Nike Swoosh Hoodie' },
  { id: 'stakeysJersey', label: 'Stakeys Official Jersey' },
  { id: 'tshirt', label: 'Casual Mechanic Tee' },
  { id: 'jacket', label: 'All-Weather Riding Jacket' },
];

export const CLOTHING_COLORS: SwatchOption[] = [
  { id: 'cc1', label: 'Stakeys Stealth Black', hex: '#18181B' },
  { id: 'cc2', label: 'Stakeys Racing Green', hex: '#059669' },
  { id: 'cc3', label: 'Neon Lime', hex: '#10B981' },
  { id: 'cc4', label: 'Slate Gray', hex: '#475569' },
  { id: 'cc5', label: 'Crisp White', hex: '#F8FAFC' },
  { id: 'cc6', label: 'Racing Blue', hex: '#2563EB' },
];

export const ACCESSORIES: ChoiceOption<AvatarAccessory>[] = [
  { id: 'none', label: 'No Accessory' },
  { id: 'cyclingGlasses', label: 'Cycling Sunglasses' },
  { id: 'helmet', label: 'Aero Helmet' },
  { id: 'beanie', label: 'Stakeys Beanie' },
];

export const PROP_BIKES: ChoiceOption<AvatarPropBike>[] = [
  { id: 'none', label: 'No Ride' },
  { id: 'roadBike', label: 'Stakeys Road Bike' },
  { id: 'mountainBike', label: 'Stakeys MTB' },
  { id: 'eScooter', label: 'Stakeys E-Scooter' },
];

export const BIKE_COLORS: SwatchOption[] = [
  { id: 'bc1', label: 'Stakeys Emerald Green', hex: '#059669' },
  { id: 'bc2', label: 'Matte Stealth Black', hex: '#27272A' },
  { id: 'bc3', label: 'Neon Electric Green', hex: '#10B981' },
  { id: 'bc4', label: 'Flame Red', hex: '#DC2626' },
  { id: 'bc5', label: 'Cyber Yellow', hex: '#EAB308' },
];

export const DEFAULT_AVATAR: AvatarConfig = {
  v: 1,
  skinTone: '#F3C5A5',
  hairStyle: 'messyShort',
  hairColor: '#4A3228',
  facialHair: 'trimmedBeard',
  facialHairColor: '#4A3228',
  eyeShape: 'friendly',
  eyeColor: '#4A3228',
  expression: 'customerSmile',
  clothingStyle: 'nikeHoodie',
  clothingColor: '#18181B',
  accessory: 'none',
  propBike: 'roadBike',
  bikeColor: '#059669',
};

/** Resolves a catalogue id to its hex, or passes a raw hex straight through. */
export function swatchHex(options: SwatchOption[], id: string): string {
  return options.find((o) => o.id === id)?.hex || id;
}

export const skinHex = (id: string): string => swatchHex(SKIN_TONES, id);
export const hairHex = (id: string): string => swatchHex(HAIR_COLORS, id);
export const clothingHex = (id: string): string => swatchHex(CLOTHING_COLORS, id);
export const bikeHex = (id: string): string => swatchHex(BIKE_COLORS, id);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A random, always-valid avatar — the "Surprise me" button. */
export function randomAvatar(): AvatarConfig {
  const hairColor = pick(HAIR_COLORS).hex;
  return {
    v: 1,
    skinTone: pick(SKIN_TONES).hex,
    hairStyle: pick(HAIR_STYLES).id,
    hairColor,
    facialHair: pick(FACIAL_HAIR).id,
    facialHairColor: hairColor,
    eyeShape: pick(EYE_SHAPES).id,
    eyeColor: pick(HAIR_COLORS).hex,
    expression: pick(EXPRESSIONS).id,
    clothingStyle: pick(CLOTHING_STYLES).id,
    clothingColor: pick(CLOTHING_COLORS).hex,
    accessory: pick(ACCESSORIES).id,
    propBike: pick(PROP_BIKES).id,
    bikeColor: pick(BIKE_COLORS).hex,
  };
}

const oneOf = <T extends string>(value: unknown, allowed: readonly { id: T }[], fallback: T): T =>
  allowed.some((a) => a.id === value) ? (value as T) : fallback;

const str = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value ? value : fallback;

/**
 * Coerce anything read back from storage into a valid AvatarConfig. A missing
 * or corrupt blob yields the default rather than a half-drawn face. Older
 * avatars stored a different (named-field) schema, so any unknown value falls
 * back to the default for that field.
 */
export function normalizeAvatar(raw: unknown): AvatarConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<AvatarConfig>;
  return {
    v: 1,
    skinTone: str(o.skinTone, DEFAULT_AVATAR.skinTone),
    hairStyle: oneOf(o.hairStyle, HAIR_STYLES, DEFAULT_AVATAR.hairStyle),
    hairColor: str(o.hairColor, DEFAULT_AVATAR.hairColor),
    facialHair: oneOf(o.facialHair, FACIAL_HAIR, DEFAULT_AVATAR.facialHair),
    facialHairColor: str(o.facialHairColor, DEFAULT_AVATAR.facialHairColor),
    eyeShape: oneOf(o.eyeShape, EYE_SHAPES, DEFAULT_AVATAR.eyeShape),
    eyeColor: str(o.eyeColor, DEFAULT_AVATAR.eyeColor),
    expression: oneOf(o.expression, EXPRESSIONS, DEFAULT_AVATAR.expression),
    clothingStyle: oneOf(o.clothingStyle, CLOTHING_STYLES, DEFAULT_AVATAR.clothingStyle),
    clothingColor: str(o.clothingColor, DEFAULT_AVATAR.clothingColor),
    accessory: oneOf(o.accessory, ACCESSORIES, DEFAULT_AVATAR.accessory),
    propBike: oneOf(o.propBike, PROP_BIKES, DEFAULT_AVATAR.propBike),
    bikeColor: str(o.bikeColor, DEFAULT_AVATAR.bikeColor),
  };
}
