/**
 * Builds the image-generation prompt for a customer's HD Bitmoji-style avatar.
 *
 * Pure and deterministic: the same AvatarConfig (and optional free-text brief)
 * always yields the same prompt, so a saved portrait can be regenerated and so
 * the prompt can be unit-tested without touching the network.
 */

import { type AvatarConfig, bikeHex, clothingHex, hairHex, skinHex } from '../types/avatar';

const HAIR_DESCRIPTORS: Record<AvatarConfig['hairStyle'], string> = {
  messyShort: 'modern textured, swept messy-short hair',
  fadeCut: 'a clean taper fade with slightly longer textured top',
  quiff: 'a voluminous combed-back quiff',
  buzz: 'a close-cropped buzz cut',
};

const FACIAL_HAIR_DESCRIPTORS: Record<AvatarConfig['facialHair'], string> = {
  none: 'a clean-shaven face',
  trimmedBeard: 'a neatly trimmed scruff beard and moustache',
  fullBeard: 'a full well-groomed beard',
  mustache: 'a classic trimmed moustache',
};

const EYE_SHAPE_DESCRIPTORS: Record<AvatarConfig['eyeShape'], string> = {
  friendly: 'bright friendly eyes',
  expressive: 'wide expressive eyes',
  relaxed: 'relaxed half-lidded eyes',
};

const EXPRESSION_DESCRIPTORS: Record<AvatarConfig['expression'], string> = {
  customerSmile: 'a warm welcoming customer smile with visible teeth',
  broadSmile: 'a broad cheerful smile',
  coolMirk: 'a confident, cool smirk',
};

const CLOTHING_DESCRIPTORS: Record<AvatarConfig['clothingStyle'], string> = {
  nikeHoodie: 'a streetwear hoodie',
  stakeysJersey: 'a pro-team cycling jersey with "STAKEYS CYCLES" across the chest',
  tshirt: 'a casual crew-neck mechanic tee',
  jacket: 'an all-weather riding jacket',
};

const ACCESSORY_DESCRIPTORS: Record<AvatarConfig['accessory'], string> = {
  none: '',
  cyclingGlasses: 'wearing sleek wraparound cycling sunglasses',
  helmet: 'wearing a modern aero cycling helmet',
  beanie: 'wearing a snug knitted Stakeys beanie',
};

const PROP_DESCRIPTORS: Record<AvatarConfig['propBike'], string> = {
  none: '',
  roadBike: 'with a lightweight aero road bike',
  mountainBike: 'with a rugged mountain bike',
  eScooter: 'with an urban e-scooter',
};

export interface AvatarPromptInput {
  config: AvatarConfig;
  /** Optional free-text brief the customer types, e.g. "female, late 20s". */
  brief?: string;
}

/**
 * The fixed art-direction preamble. Kept close to the house style so every
 * generated portrait reads as part of the same set.
 */
export const AVATAR_STYLE_PREAMBLE = [
  'Designed by a master graphic designer and digital illustration specialist.',
  'Create an ultra-high-quality, HD Bitmoji-style avatar portrait.',
  'Clean vector art with smooth gradients, a modern vibrant colour palette,',
  'professional soft shading and gentle ambient occlusion, and 8K clarity.',
  'Premium 2D/3D hybrid Bitmoji aesthetic: expressive, vibrant, modern and',
  'polished, but never uncanny or photorealistic.',
].join(' ');

export const AVATAR_FRAMING_CLAUSE =
  'Centered bust-up portrait, head and shoulders fully in frame, looking directly at the camera with a friendly, professional expression. Sharp details, high resolution, vector-level clarity, suitable for profile pictures and branding assets.';

/**
 * Turns an AvatarConfig into the full text prompt for the image model.
 */
export function buildAvatarPrompt({ config, brief }: AvatarPromptInput): string {
  const skin = skinHex(config.skinTone);
  const hair = hairHex(config.hairColor);
  const clothing = clothingHex(config.clothingColor);
  const bike = bikeHex(config.bikeColor);

  const lines: string[] = [];
  lines.push(AVATAR_STYLE_PREAMBLE);

  if (brief && brief.trim()) {
    lines.push(`Customer brief (follow closely): ${brief.trim()}.`);
  }

  const parts: string[] = [];
  parts.push(`skin tone ${skin}`);
  parts.push(HAIR_DESCRIPTORS[config.hairStyle]);
  parts.push(FACIAL_HAIR_DESCRIPTORS[config.facialHair]);
  parts.push(
    `${EYE_SHAPE_DESCRIPTORS[config.eyeShape]} and ${EXPRESSION_DESCRIPTORS[config.expression]}`
  );
  const accessory = ACCESSORY_DESCRIPTORS[config.accessory];
  if (accessory) parts.push(accessory);
  lines.push(`Character: ${parts.join(', ')}.`);

  lines.push(
    `Outfit & vibe: ${CLOTHING_DESCRIPTORS[config.clothingStyle]} in ${clothing}, modern and approachable.`
  );

  const prop = PROP_DESCRIPTORS[config.propBike];
  if (prop) {
    lines.push(`Props: ${prop} in ${bike}, kept in the background so the face stays the focus.`);
  }

  lines.push(`Palette: skin ${skin}, hair ${hair}, outfit ${clothing}${prop ? `, ride ${bike}` : ''}.`);
  lines.push('Background: clean minimalist gradient backdrop, soft emerald ambient glow, uncluttered.');
  lines.push(AVATAR_FRAMING_CLAUSE);

  return lines.join('\n');
}

/** Short label describing the config, handy for alt text and logs. */
export function describeAvatarConfig(config: AvatarConfig): string {
  const bits = [
    config.hairStyle,
    config.clothingStyle,
    config.accessory !== 'none' ? config.accessory : '',
    config.propBike !== 'none' ? config.propBike : '',
  ].filter(Boolean);
  return bits.join(', ');
}
