/**
 * Builds the image-generation prompt for a customer's HD Bitmoji-style avatar.
 *
 * Pure and deterministic: the same AvatarConfig (and optional free-text brief)
 * always yields the same prompt, so a saved portrait can be regenerated and so
 * the prompt can be unit-tested without touching the network.
 */

import {
  type AvatarConfig,
  backgroundHex,
  hairHex,
  skinHex,
  topHex,
} from '../types/avatar';

const SKIN_DESCRIPTORS: Record<AvatarConfig['skinTone'], string> = {
  porcelain: 'very fair porcelain skin with a cool pink undertone',
  fair: 'fair skin with a soft warm undertone',
  light: 'light skin with a warm golden undertone',
  tan: 'light-tan sun-kissed skin',
  olive: 'warm olive skin with golden undertones',
  bronze: 'bronze skin with rich warm undertones',
  brown: 'deep brown skin with warm undertones',
  deep: 'rich deep-brown skin with cool undertones',
};

const HAIR_DESCRIPTORS: Record<AvatarConfig['hairStyle'], string> = {
  bald: 'clean-shaven bald head with a natural scalp sheen',
  buzz: 'close-cropped buzz cut',
  short: 'neatly styled short hair',
  fade: 'crisp faded sides with slightly longer textured top',
  curly: 'springy defined curls',
  afro: 'full rounded afro with natural coily texture',
  bun: 'hair pulled up into a tidy top bun',
  ponytail: 'hair swept into a smooth ponytail',
  long: 'long flowing hair falling past the shoulders',
  bob: 'chin-length blunt bob',
  mohawk: 'short shaved sides with a raised sculpted mohawk crest',
};

const FACIAL_HAIR_DESCRIPTORS: Record<AvatarConfig['facialHair'], string> = {
  none: 'clean-shaven face',
  stubble: 'light even stubble',
  moustache: 'neatly trimmed moustache',
  goatee: 'defined goatee',
  full_beard: 'full well-groomed beard',
};

const GLASSES_DESCRIPTORS: Record<AvatarConfig['glasses'], string> = {
  none: '',
  round: 'wearing round thin-frame glasses',
  square: 'wearing square acetate glasses',
  sport: 'wearing sporty wrap-around cycling glasses',
  sunglasses: 'wearing stylish sunglasses',
};

const HEADWEAR_DESCRIPTORS: Record<AvatarConfig['headwear'], string> = {
  none: '',
  cap: 'wearing a casual cap',
  helmet: 'wearing a sleek modern cycling helmet',
  beanie: 'wearing a snug knitted beanie',
  visor: 'wearing a sporty sun visor',
};

const EYES_DESCRIPTORS: Record<AvatarConfig['eyes'], string> = {
  happy: 'bright friendly eyes with a warm crinkled smile',
  wide: 'wide expressive eyes',
  sleepy: 'relaxed half-lidded eyes',
  wink: 'one eye playfully winking',
};

const MOUTH_DESCRIPTORS: Record<AvatarConfig['mouth'], string> = {
  smile: 'a gentle confident smile',
  grin: 'a broad cheerful grin',
  neutral: 'a calm neutral expression',
  smirk: 'a subtle knowing smirk',
  open: 'a happy open-mouthed laugh',
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
  const top = topHex(config.topColor);
  const headwear = topHex(config.headwearColor);
  const bg = backgroundHex(config.background);

  const lines: string[] = [];
  lines.push(AVATAR_STYLE_PREAMBLE);

  if (brief && brief.trim()) {
    lines.push(`Customer brief (follow closely): ${brief.trim()}.`);
  }

  const parts: string[] = [];
  parts.push(SKIN_DESCRIPTORS[config.skinTone]);
  parts.push(HAIR_DESCRIPTORS[config.hairStyle]);
  parts.push(FACIAL_HAIR_DESCRIPTORS[config.facialHair]);
  parts.push(`${EYES_DESCRIPTORS[config.eyes]} and ${MOUTH_DESCRIPTORS[config.mouth]}`);
  const glasses = GLASSES_DESCRIPTORS[config.glasses];
  if (glasses) parts.push(glasses);
  const headwearDesc = HEADWEAR_DESCRIPTORS[config.headwear];
  if (headwearDesc) parts.push(headwearDesc);
  lines.push(`Character: ${parts.join(', ')}.`);

  const outfit = config.jerseyNumber
    ? `Smart-casual cycling jersey in ${top} with the number "${config.jerseyNumber}" printed on the chest`
    : `Smart-casual top in ${top}`;
  lines.push(`Outfit & vibe: ${outfit}, modern and approachable.`);

  lines.push(
    `Palette: skin ${skin}, hair ${hair}, top ${top}${
      headwearDesc ? `, headwear ${headwear}` : ''
    }.`
  );
  lines.push(`Background: clean minimalist gradient background centred on ${bg}, soft and uncluttered.`);
  lines.push(AVATAR_FRAMING_CLAUSE);

  return lines.join('\n');
}

/** Short label describing the config, handy for alt text and logs. */
export function describeAvatarConfig(config: AvatarConfig): string {
  const bits = [
    config.hairStyle,
    `${config.skinTone} skin`,
    config.headwear !== 'none' ? config.headwear : '',
    config.glasses !== 'none' ? config.glasses : '',
  ].filter(Boolean);
  return bits.join(', ');
}
