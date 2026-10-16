import React, { useId } from 'react';

// ============================================================================
// Types & Interface Definitions
// ============================================================================

export type BackdropGradient =
  | 'sunset' | 'ocean' | 'cyberpunk' | 'emerald' | 'solar' | 'midnight' | 'rose' | 'forest';
export type SkinTone = 'porcelain' | 'warm_beige' | 'honey' | 'golden_tan' | 'chocolate' | 'espresso' | 'rose_beige' | 'deep_mahogany';
export type HairStyle =
  | 'none' | 'crop' | 'pompadour' | 'waves' | 'bun' | 'afro' | 'bob' | 'beanie'
  | 'cycling_cap' | 'undercut' | 'long_straight' | 'ponytail' | 'braids' | 'locs' | 'curly_top' | 'top_knot';
export type HairColor = 'onyx' | 'espresso_brown' | 'golden_blonde' | 'auburn_red' | 'platinum_silver' | 'cyber_neon' | 'copper' | 'ash_brown' | 'teal';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'mustache' | 'goatee';
export type EyesStyle = 'kind' | 'focused' | 'playful' | 'chill';
export type ExpressionStyle = 'smile' | 'grin' | 'excited' | 'neutral';
export type GlassesStyle =
  | 'none' | 'round_wireframe' | 'square_nerd' | 'sporty_cycling' | 'retro_cat' | 'aviator';
export type AccessoryStyle = 'none' | 'earbuds' | 'stud' | 'headset' | 'scarf';
export type ClothingStyle = 'dungarees' | 'collar' | 'hoodie' | 'brand_tee' | 'tank' | 'varsity' | 'mechanic' | 'hi_vis' | 'bunny' | 'elf' | 'skeleton' | 'racing_kit' | 'leather_jacket' | 'rain_shell' | 'wizard' | 'chef' | 'paramedic' | 'firefighter' | 'astronaut' | 'pirate' | 'superhero' | 'pumpkin' | 'stakeys_apron';
export type FaceShape = 'soft' | 'oval' | 'square' | 'round' | 'heart' | 'angular';
export type AvatarProp = 'none' | 'wrench' | 'coffee' | 'medal' | 'pump' | 'clipboard' | 'pizza' | 'wand';
export type AvatarVehicle = 'none' | 'bicycle' | 'scooter' | 'electric_dirt_bike';
export type EyeColor = 'brown' | 'blue' | 'green' | 'amber' | 'gray' | 'violet';
export type FaceDetail = 'none' | 'freckles' | 'beauty_mark' | 'rosy_cheeks';
export type BodyShape = 'slim' | 'balanced' | 'broad';
export type AvatarPose = 'casual' | 'ready' | 'leaning';
export type BrowStyle = 'natural' | 'bold' | 'arched' | 'determined';
export type NoseStyle = 'soft' | 'button' | 'strong';

export interface FaceAvatarConfig {
  backdrop: BackdropGradient;
  skinTone: SkinTone;
  hairStyle: HairStyle;
  hairColor: HairColor;
  facialHair: FacialHair;
  eyesStyle: EyesStyle;
  expression: ExpressionStyle;
  glasses: GlassesStyle;
  accessory: AccessoryStyle;
  clothing: ClothingStyle;
  clothingColor?: string; // Custom hex or palette index
  faceShape?: FaceShape;
  prop?: AvatarProp;
  vehicle?: AvatarVehicle;
  eyeColor?: EyeColor;
  faceDetail?: FaceDetail;
  bodyShape?: BodyShape;
  pose?: AvatarPose;
  browStyle?: BrowStyle;
  noseStyle?: NoseStyle;
}

// ============================================================================
// Metadata Lists for Customization
// ============================================================================

export const BACKDROP_OPTIONS: { id: BackdropGradient; name: string; colors: [string, string] }[] = [
  { id: 'sunset', name: 'Sunset Glow', colors: ['#FF5E62', '#FF9966'] },
  { id: 'ocean', name: 'Ocean Breeze', colors: ['#00F2FE', '#4FACFE'] },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', colors: ['#F355DA', '#7000FF'] },
  { id: 'emerald', name: 'Emerald Forest', colors: ['#10B981', '#064E3B'] },
  { id: 'solar', name: 'Solar Flare', colors: ['#FF8C00', '#F12711'] },
  { id: 'midnight', name: 'Midnight', colors: ['#1F2937', '#111827'] },
  { id: 'rose', name: 'Rose Quartz', colors: ['#FBC2EB', '#A18CD1'] },
  { id: 'forest', name: 'Forest Trail', colors: ['#134E5E', '#71B280'] },
];

export const SKIN_TONE_OPTIONS: { id: SkinTone; name: string; base: string; shadow: string }[] = [
  { id: 'porcelain', name: 'Porcelain', base: '#FFE5D9', shadow: '#F4C0B0' },
  { id: 'warm_beige', name: 'Warm Beige', base: '#F3C69D', shadow: '#D09E71' },
  { id: 'honey', name: 'Honey', base: '#D29F6F', shadow: '#B27D4C' },
  { id: 'golden_tan', name: 'Golden Tan', base: '#B07C4D', shadow: '#8C5A2C' },
  { id: 'chocolate', name: 'Chocolate', base: '#784B29', shadow: '#583011' },
  { id: 'espresso', name: 'Espresso', base: '#4E2C10', shadow: '#311703' },
  { id: 'rose_beige', name: 'Rose Beige', base: '#E3B4A0', shadow: '#BC8576' },
  { id: 'deep_mahogany', name: 'Deep Mahogany', base: '#603328', shadow: '#3E211B' },
];

export const HAIR_STYLE_OPTIONS: { id: HairStyle; name: string }[] = [
  { id: 'none', name: 'None / Bald' },
  { id: 'crop', name: 'Textured Crop' },
  { id: 'pompadour', name: 'Pompadour Quiff' },
  { id: 'waves', name: 'Flowing Waves' },
  { id: 'bun', name: 'High Bun' },
  { id: 'afro', name: 'Fluffy Afro' },
  { id: 'bob', name: 'Classic Bob' },
  { id: 'beanie', name: 'Cozy Beanie' },
  { id: 'cycling_cap', name: "Stakey's Cycling Cap" },
  { id: 'undercut', name: 'Swept Undercut' },
  { id: 'long_straight', name: 'Long & Straight' },
  { id: 'ponytail', name: 'Workshop Ponytail' },
  { id: 'braids', name: 'Braided Crown' },
  { id: 'locs', name: 'Textured Locs' },
  { id: 'curly_top', name: 'Curly Top' },
  { id: 'top_knot', name: 'Mechanic Top Knot' },
];

export const HAIR_COLOR_OPTIONS: { id: HairColor; name: string; colors: [string, string] }[] = [
  { id: 'onyx', name: 'Onyx Black', colors: ['#1E1E24', '#0F0F12'] },
  { id: 'espresso_brown', name: 'Espresso', colors: ['#543D2B', '#322216'] },
  { id: 'golden_blonde', name: 'Honey Blonde', colors: ['#F2C94C', '#D4AF37'] },
  { id: 'auburn_red', name: 'Auburn Red', colors: ['#C0392B', '#8E1C0E'] },
  { id: 'platinum_silver', name: 'Platinum', colors: ['#E2E8F0', '#94A3B8'] },
  { id: 'cyber_neon', name: 'Cyber Pink', colors: ['#EC4899', '#BE185D'] },
  { id: 'copper', name: 'Copper', colors: ['#D97745', '#994729'] },
  { id: 'ash_brown', name: 'Ash Brown', colors: ['#9A8172', '#63534A'] },
  { id: 'teal', name: 'Deep Teal', colors: ['#19B8A6', '#08766D'] },
];

export const EYE_COLOR_OPTIONS: { id: EyeColor; name: string; color: string }[] = [
  { id: 'brown', name: 'Brown', color: '#6D3C21' },
  { id: 'blue', name: 'Blue', color: '#3488C6' },
  { id: 'green', name: 'Green', color: '#278657' },
  { id: 'amber', name: 'Amber', color: '#C77A18' },
  { id: 'gray', name: 'Gray', color: '#77808A' },
  { id: 'violet', name: 'Violet', color: '#8254B8' },
];
export const FACE_DETAIL_OPTIONS: { id: FaceDetail; name: string }[] = [
  { id: 'none', name: 'Clear skin' }, { id: 'freckles', name: 'Freckles' },
  { id: 'beauty_mark', name: 'Beauty mark' }, { id: 'rosy_cheeks', name: 'Rosy cheeks' },
];
export const BODY_SHAPE_OPTIONS: { id: BodyShape; name: string }[] = [
  { id: 'slim', name: 'Slim' }, { id: 'balanced', name: 'Balanced' }, { id: 'broad', name: 'Broad' },
];
export const AVATAR_POSE_OPTIONS: { id: AvatarPose; name: string }[] = [
  { id: 'casual', name: 'Easygoing' }, { id: 'ready', name: 'Workshop ready' }, { id: 'leaning', name: 'Confident lean' },
];
export const BROW_STYLE_OPTIONS: { id: BrowStyle; name: string }[] = [
  { id: 'natural', name: 'Natural' }, { id: 'bold', name: 'Bold' }, { id: 'arched', name: 'Arched' }, { id: 'determined', name: 'Determined' },
];
export const NOSE_STYLE_OPTIONS: { id: NoseStyle; name: string }[] = [
  { id: 'soft', name: 'Soft' }, { id: 'button', name: 'Button' }, { id: 'strong', name: 'Strong' },
];

export const FACIAL_HAIR_OPTIONS: { id: FacialHair; name: string }[] = [
  { id: 'none', name: 'Clean Shaven' },
  { id: 'stubble', name: "Five O'Clock Shadow" },
  { id: 'beard', name: 'Full Workshop Beard' },
  { id: 'mustache', name: 'Sleek Mustache' },
  { id: 'goatee', name: 'Mechanic Goatee' },
];

export const EYES_OPTIONS: { id: EyesStyle; name: string }[] = [
  { id: 'kind', name: 'Friendly Kind' },
  { id: 'focused', name: 'Focused / Bright' },
  { id: 'playful', name: 'Playful / Winking' },
  { id: 'chill', name: 'Chill / Relaxed' },
];

export const EXPRESSION_OPTIONS: { id: ExpressionStyle; name: string }[] = [
  { id: 'smile', name: 'Warm Smile' },
  { id: 'grin', name: 'Confident Grin' },
  { id: 'excited', name: 'Vibrant Excited' },
  { id: 'neutral', name: 'Focused / Calm' },
];

export const GLASSES_OPTIONS: { id: GlassesStyle; name: string; color: string }[] = [
  { id: 'none', name: 'No Eyewear', color: 'transparent' },
  { id: 'round_wireframe', name: 'Round Wireframe', color: '#D4AF37' },
  { id: 'square_nerd', name: 'Square Nerd', color: '#0F172A' },
  { id: 'sporty_cycling', name: 'Sporty Cycling Wraps', color: '#10B981' },
  { id: 'retro_cat', name: 'Retro Cat-Eye', color: '#EF4444' },
  { id: 'aviator', name: 'Aviator Shades', color: '#B45309' },
];

export const ACCESSORY_OPTIONS: { id: AccessoryStyle; name: string }[] = [
  { id: 'none', name: 'No Accessories' },
  { id: 'earbuds', name: 'Wireless Earbuds' },
  { id: 'stud', name: 'Silver Earring' },
  { id: 'headset', name: 'Shop Comms Headset' },
  { id: 'scarf', name: 'Rider Scarf' },
];

export const CLOTHING_OPTIONS: { id: ClothingStyle; name: string }[] = [
  { id: 'dungarees', name: "Workshop Dungarees" },
  { id: 'collar', name: "Stakey's Polo Shirt" },
  { id: 'hoodie', name: "Cozy Hoodie" },
  { id: 'brand_tee', name: "Cycling Logo Tee" },
  { id: 'tank', name: "Sleeveless Jersey" },
  { id: 'varsity', name: "Varsity Jacket" },
  { id: 'mechanic', name: 'Workshop Mechanic' },
  { id: 'hi_vis', name: 'Hi-vis Technician' },
  { id: 'bunny', name: 'Easter Bunny Suit' },
  { id: 'elf', name: 'Festive Workshop Elf' },
  { id: 'skeleton', name: 'Glow Skeleton' },
  { id: 'racing_kit', name: 'Road Racing Kit' },
  { id: 'leather_jacket', name: 'Biker Leather Jacket' },
  { id: 'rain_shell', name: 'All-Weather Shell' },
  { id: 'wizard', name: 'Workshop Wizard' },
  { id: 'chef', name: 'Workshop Chef' },
  { id: 'paramedic', name: 'Cycle Paramedic' },
  { id: 'firefighter', name: 'Firefighter' },
  { id: 'astronaut', name: 'Orbit Explorer' },
  { id: 'pirate', name: 'Pedal Pirate' },
  { id: 'superhero', name: 'Salford Superhero' },
  { id: 'pumpkin', name: 'Pumpkin Patch' },
  { id: 'stakeys_apron', name: "Stakey's Workshop Apron" },
];

export const FACE_SHAPE_OPTIONS: { id: FaceShape; name: string }[] = [
  { id: 'soft', name: 'Soft Round' }, { id: 'oval', name: 'Classic Oval' }, { id: 'square', name: 'Strong Square' },
  { id: 'round', name: 'Round' }, { id: 'heart', name: 'Heart' }, { id: 'angular', name: 'Angular' },
];
export const PROP_OPTIONS: { id: AvatarProp; name: string }[] = [
  { id: 'none', name: 'No prop' }, { id: 'wrench', name: 'Workshop wrench' }, { id: 'coffee', name: 'Coffee cup' }, { id: 'medal', name: 'Champion medal' },
  { id: 'pump', name: 'Track pump' }, { id: 'clipboard', name: 'Workshop checklist' },
  { id: 'pizza', name: 'Pizza break' }, { id: 'wand', name: 'Magic wand' },
];
export const VEHICLE_OPTIONS: { id: AvatarVehicle; name: string }[] = [
  { id: 'none', name: 'None' }, { id: 'bicycle', name: 'Bicycle' }, { id: 'scooter', name: 'E-scooter' }, { id: 'electric_dirt_bike', name: 'Electric dirt bike' },
];

export const CLOTHING_COLORS = [
  '#05C147', // Stakeys Emerald
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#4B5563', // Charcoal
];

// ============================================================================
// Hashing & Parsing Utilities
// ============================================================================

/** Simple stable hash function for mapping seeds to deterministic configurations */
export function getDeterministicConfig(seed: string, fallbackColor?: string): FaceAvatarConfig {
  const cleanSeed = (seed || 'Stakey').trim();
  let hash = 0;
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = cleanSeed.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  function selectOption<T>(list: T[]): T {
    return list[hash % list.length];
  }

  // We can also let the backdrop color reflect the legacy fallback color if provided!
  let backdrop = selectOption(BACKDROP_OPTIONS).id;
  if (fallbackColor && fallbackColor.startsWith('#')) {
    if (fallbackColor.toUpperCase() === '#05C147' || fallbackColor.toUpperCase() === '#059669') {
      backdrop = 'emerald';
    } else if (fallbackColor.toUpperCase().startsWith('#F')) {
      backdrop = 'sunset';
    } else if (fallbackColor.toUpperCase().startsWith('#3') || fallbackColor.toUpperCase().startsWith('#4')) {
      backdrop = 'ocean';
    }
  }

  // Create deterministic indexes based on different shifts of the hash
  const skinTone = SKIN_TONE_OPTIONS[Math.abs(hash >> 1) % SKIN_TONE_OPTIONS.length].id;
  const hairStyle = HAIR_STYLE_OPTIONS[Math.abs(hash >> 2) % HAIR_STYLE_OPTIONS.length].id;
  const hairColor = HAIR_COLOR_OPTIONS[Math.abs(hash >> 3) % HAIR_COLOR_OPTIONS.length].id;
  const facialHair = FACIAL_HAIR_OPTIONS[Math.abs(hash >> 4) % FACIAL_HAIR_OPTIONS.length].id;
  const eyesStyle = EYES_OPTIONS[Math.abs(hash >> 5) % EYES_OPTIONS.length].id;
  const expression = EXPRESSION_OPTIONS[Math.abs(hash >> 6) % EXPRESSION_OPTIONS.length].id;
  const glasses = GLASSES_OPTIONS[Math.abs(hash >> 7) % GLASSES_OPTIONS.length].id;
  const accessory = ACCESSORY_OPTIONS[Math.abs(hash >> 8) % ACCESSORY_OPTIONS.length].id;
  // Keep the original default wardrobe stable when new outfits are appended.
  const clothing = CLOTHING_OPTIONS[Math.abs(hash >> 9) % 15].id;
  const clothingColor = CLOTHING_COLORS[Math.abs(hash >> 10) % CLOTHING_COLORS.length];

  return {
    backdrop,
    skinTone,
    hairStyle,
    hairColor,
    facialHair,
    eyesStyle,
    expression,
    glasses,
    accessory,
    clothing,
    clothingColor,
    faceShape: FACE_SHAPE_OPTIONS[Math.abs(hash >> 11) % FACE_SHAPE_OPTIONS.length].id,
    prop: 'none',
    vehicle: 'none',
    eyeColor: EYE_COLOR_OPTIONS[Math.abs(hash >> 12) % EYE_COLOR_OPTIONS.length].id,
    faceDetail: 'none',
    bodyShape: 'balanced',
    pose: 'casual',
    browStyle: 'natural',
    noseStyle: 'soft',
  };
}

/** Safely parse or generate a FaceAvatarConfig from a saved string */
export function parseConfigString(configString?: string, seed: string = 'Stakey'): FaceAvatarConfig {
  if (!configString) {
    return getDeterministicConfig(seed);
  }

  try {
    const trimmed = configString.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed) as Partial<FaceAvatarConfig>;
      // Merge over the deterministic default so a partial config (or a saved
      // config missing a newer field) never silently drops options to
      // undefined and renders a broken avatar.
      return { ...getDeterministicConfig(seed), ...parsed };
    }
  } catch (e) {
    // Fall back to deterministic options if parsing fails
  }

  // If it is just a plain hex color, use it as fallback backdrop hint
  return getDeterministicConfig(seed, configString);
}

// ============================================================================
// React Component Rendering
// ============================================================================

interface FaceAvatarProps {
  seed: string;
  configString?: string;
  config?: FaceAvatarConfig;
  size?: number;
  className?: string;
}

export const FaceAvatar: React.FC<FaceAvatarProps> = ({
  seed,
  configString,
  config: passedConfig,
  size = 48,
  className = '',
}) => {
  const componentId = useId().replace(/:/g, '-'); // Safe CSS/SVG identifier

  // Determine final configuration
  const config = passedConfig || parseConfigString(configString, seed);

  // Get option details
  const bgOpt = BACKDROP_OPTIONS.find((o) => o.id === config.backdrop) || BACKDROP_OPTIONS[3];
  const skinOpt = SKIN_TONE_OPTIONS.find((o) => o.id === config.skinTone) || SKIN_TONE_OPTIONS[1];
  const hairColorOpt = HAIR_COLOR_OPTIONS.find((o) => o.id === config.hairColor) || HAIR_COLOR_OPTIONS[0];
  const eyeColorOpt = EYE_COLOR_OPTIONS.find((o) => o.id === config.eyeColor) || EYE_COLOR_OPTIONS[0];
  const glassesOpt = GLASSES_OPTIONS.find((o) => o.id === config.glasses) || GLASSES_OPTIONS[0];
  const clothColor = config.clothingColor || CLOTHING_COLORS[0];

  const bgGradientUrl = 'url(#bg-' + componentId + ')';
  const skinGradientUrl = 'url(#skin-' + componentId + ')';
  const hairGradientUrl = 'url(#hair-' + componentId + ')';
  const sportyLensGradientUrl = 'url(#sporty-lens-' + componentId + ')';
  const beanieRibPatternUrl = 'url(#beanie-rib-' + componentId + ')';
  const bodyScale = config.bodyShape === 'slim' ? 0.92 : config.bodyShape === 'broad' ? 1.08 : 1;
  const poseAngle = config.pose === 'ready' ? -2 : config.pose === 'leaning' ? 3 : 0;
  const modelTransform = `translate(100 130) rotate(${poseAngle}) scale(${bodyScale} 1) translate(-100 -130)`;

  // Extract conditional JSX rendering to clean helper functions
  // This modularizes the SVG components and prevents shell validation warnings
  const renderClothing = () => {
    switch (config.clothing) {
      case 'dungarees':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 160 200 L 40 200 Z" fill="#374151" />
            <path d="M 64 170 Q 100 168 136 170 L 142 200 L 58 200 Z" fill="#1E293B" />
            <path d="M 66 163 L 78 165 L 75 200 L 63 200 Z" fill="#059669" />
            <path d="M 134 163 L 122 165 L 125 200 L 137 200 Z" fill="#059669" />
            <circle cx="72" cy="178" r="4" fill="#F59E0B" />
            <circle cx="128" cy="178" r="4" fill="#F59E0B" />
            <path d="M 90 182 H 110 V 198 Q 100 204 90 198 Z" fill="#0F172A" opacity="0.3" />
            <path d="M 100 186 L 100 194" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
            <circle cx="100" cy="186" r="3" fill="none" stroke="#D1D5DB" strokeWidth="1.5" />
          </>
        );
      case 'collar':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 158 200 L 42 200 Z" fill={clothColor} />
            <rect x="96" y="166" width="8" height="34" fill="rgba(0, 0, 0, 0.15)" rx="2" />
            <circle cx="100" cy="172" r="1.5" fill="#ffffff" />
            <circle cx="100" cy="184" r="1.5" fill="#ffffff" />
            <polygon points="68,162 96,178 86,161" fill={clothColor} filter="brightness(1.15)" />
            <polygon points="132,162 104,178 114,161" fill={clothColor} filter="brightness(1.15)" />
            <polygon points="90,157 100,168 110,157" fill="#111827" opacity="0.4" />
          </>
        );
      case 'hoodie':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 158 200 L 42 200 Z" fill={clothColor} />
            <path d="M 64 160 C 64 160, 100 180, 136 160 Z" fill="rgba(0,0,0,0.15)" />
            <path d="M 72 158 C 72 178, 128 178, 128 158 C 135 168, 132 182, 124 186 C 114 192, 86 192, 76 186 C 68 182, 65 168, 72 158 Z" fill={clothColor} filter="brightness(0.85)" />
            <path d="M 94 172 Q 91 185 91 193" fill="none" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 106 172 Q 109 185 109 193" fill="none" stroke="#E2E8F0" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="91" cy="193" r="1.8" fill="#F59E0B" />
            <circle cx="109" cy="193" r="1.8" fill="#F59E0B" />
          </>
        );
      case 'brand_tee':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 158 200 L 42 200 Z" fill="#374151" />
            <path d="M 74 158 C 74 174, 126 174, 126 158" fill="none" stroke="#1F2937" strokeWidth="3" />
            <g transform="translate(100, 180) scale(0.65)" opacity="0.35">
              <circle cx="-16" cy="4" r="7" fill="none" stroke="#ffffff" strokeWidth="2.5" />
              <circle cx="16" cy="4" r="7" fill="none" stroke="#ffffff" strokeWidth="2.5" />
              <polyline points="-16,4 0,-12 16,4" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="0,-12 0,4 16,4" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="-16" y1="4" x2="-2" y2="4" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              <polyline points="0,-12 -6,-18 -12,-18" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
              <line x1="-3" y1="-8" x2="3" y2="-8" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </>
        );
      case 'tank':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 158 200 L 42 200 Z" fill={clothColor} />
            <path d="M 66 158 C 70 176, 130 176, 134 158 C 128 150, 72 150, 66 158 Z" fill={skinGradientUrl} />
            <path d="M 50 160 Q 100 155 150 160 L 152 168 Q 100 163 48 168 Z" fill="rgba(255,255,255,0.12)" />
            <path d="M 96 162 Q 100 176 104 162" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
          </>
        );
      case 'varsity':
        return (
          <>
            <path d="M 50 160 Q 100 155 150 160 L 158 200 L 42 200 Z" fill="#F3F4F6" />
            <path d="M 58 160 Q 100 156 142 160 L 144 176 Q 100 172 56 176 Z" fill={clothColor} />
            <rect x="96" y="166" width="8" height="34" rx="2" fill="#D1D5DB" />
            <circle cx="100" cy="172" r="1.6" fill="#9CA3AF" />
            <circle cx="100" cy="184" r="1.6" fill="#9CA3AF" />
            <polygon points="70,162 96,176 88,161" fill="#F3F4F6" />
            <polygon points="130,162 104,176 112,161" fill="#F3F4F6" />
            <circle cx="126" cy="184" r="5" fill={clothColor} filter="brightness(0.85)" />
            <text x="126" y="187" textAnchor="middle" fontSize="6" fontWeight="bold" fill="#ffffff">S</text>
          </>
        );
      case 'mechanic':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#18221d"/><path d="M72 158L94 169 86 178 62 164M128 158L106 169 114 178 138 164" fill="#35463c"/><path d="M98 169h4v31h-4z" fill="#05C147"/><path d="M58 186h20v11H58z" fill="#27372f" stroke="#61796a"/></g>;
      case 'hi_vis':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#d5ef48"/><path d="M58 175h84v7H58zm-3 15h90v7H55z" fill="#f7f7e8" opacity=".9"/><path d="M92 162h16v7H92z" fill="#24352b"/></g>;
      case 'bunny':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#f4eee8"/><path d="M70 170q30-18 60 0v28H70z" fill="#fff" stroke="#d8c8bb" strokeWidth="2"/><circle cx="100" cy="181" r="8" fill="#f5a7b2"/><path d="M85 170l-8-12 14 6m24 6 8-12-14 6" fill="#f7dfe2" stroke="#d7aeb6" strokeWidth="2"/><path d="M89 199q11-8 22 0" fill="none" stroke="#05C147" strokeWidth="4"/></g>;
      case 'elf':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#126b3a"/><path d="M50 160Q100 155 150 160l4 9H46z" fill="#c52f37"/><path d="M67 179h66v6H67zM67 193h66v6H67z" fill="#f3d168"/><path d="M90 163h20v9H90z" fill="#d8b658"/><circle cx="100" cy="168" r="3" fill="#6b4812"/></g>;
      case 'skeleton':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#171a1b" stroke="#dcebdc" strokeWidth="2"/><path d="M100 166v26m-18-17 18 6 18-6m-31 15 13-5 13 5" fill="none" stroke="#f4fff4" strokeWidth="3"/><circle cx="100" cy="198" r="3" fill="#bdeec5"/></g>;
      case 'racing_kit':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill={clothColor}/><path d="M50 160q50 10 100 0l-3 13q-47 8-94 0z" fill="#111a16"/><path d="M58 180h84v4H58zm-3 10h90v4H55z" fill="#f2f5ed"/><path d="M96 162h8v35h-8z" fill="#05C147"/><circle cx="100" cy="177" r="5" fill="#102016" stroke="#effff4" strokeWidth="1.5"/></g>;
      case 'leather_jacket':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#202122"/><path d="M79 159L98 171 88 183 73 160M121 159L102 171 112 183 127 160" fill="#343638" stroke="#a5a5a5" strokeWidth="1"/><path d="M99 170v29" stroke="#d5d7d8" strokeWidth="2"/><path d="M63 178h19m36 0h19" stroke="#9b9c9c" strokeWidth="2"/><circle cx="77" cy="179" r="2" fill="#d8bf70"/><circle cx="123" cy="179" r="2" fill="#d8bf70"/></g>;
      case 'rain_shell':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill={clothColor}/><path d="M67 158q33 21 66 0" fill="none" stroke="#263d4b" strokeWidth="5"/><path d="M100 167v33" stroke="#dceef4" strokeWidth="2" strokeDasharray="3 2"/><path d="M55 184h17m56 0h17" stroke="#f4d86e" strokeWidth="5"/><path d="M68 161l-7 14m71-14 7 14" stroke="rgba(255,255,255,.36)" strokeWidth="2"/></g>;
      case 'wizard':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#43246f"/><path d="M74 161l26 12 26-12-11 39H85z" fill="#321a5b" stroke="#c7a6ff" strokeWidth="2"/><path d="M100 177l3 6h7l-5.5 4.5 2 7-6.5-4-6.5 4 2-7L90 183h7z" fill="#ffe27a"/><path d="M65 179h12m46 0h12" stroke="#8ae4bd" strokeWidth="2"/></g>;
      case 'chef':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#f8fafc"/><path d="M79 159l28 18v23H78z" fill="#e2e8f0" stroke="#94a3b8"/><path d="M78 162l14 10-9 7m25-17-9 10 11 7" fill="none" stroke="#475569" strokeWidth="2"/>{[181,192].map(y => <g key={y}><circle cx="88" cy={y} r="2" fill="#1e293b"/><circle cx="103" cy={y} r="2" fill="#1e293b"/></g>)}<path d="M119 180h20v11h-20z" fill="#fff" stroke="#cbd5e1"/></g>;
      case 'paramedic':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#12614e"/><path d="M57 174h86v5H57m-2 12h90v5H55" fill="#d8f4e4"/><path d="M100 164v36" stroke="#092e27" strokeWidth="3"/><rect x="115" y="179" width="17" height="15" rx="3" fill="#fff"/><path d="M123.5 182v9m-4.5-4.5h9" stroke="#12614e" strokeWidth="3"/></g>;
      case 'firefighter':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#b89963"/><path d="M55 177h90v9H55" fill="#e7ed3e"/><path d="M55 180h90v3H55" fill="#e5e7eb"/><path d="M100 163v37" stroke="#332c23" strokeWidth="4"/><path d="M76 163v37m48-37v37" stroke="#312b25" strokeWidth="5"/><rect x="112" y="170" width="18" height="7" rx="1" fill="#332c23"/></g>;
      case 'astronaut':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#e7edf5"/><path d="M72 159q28 18 56 0" fill="none" stroke="#94a3b8" strokeWidth="8"/><path d="M72 159q28 18 56 0" fill="none" stroke="#334155" strokeWidth="3"/><rect x="83" y="178" width="34" height="19" rx="4" fill="#374151" stroke="#94a3b8" strokeWidth="2"/><rect x="88" y="182" width="13" height="8" rx="1" fill="#67e8f9"/><circle cx="110" cy="185" r="3" fill="#fb923c"/><path d="M56 184h16m56 0h16" stroke="#f97316" strokeWidth="4"/></g>;
      case 'pirate':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#f5e6c8"/><path d="M60 160l24 3 7 37H42m98-40-24 3-7 37h49" fill="#542c33" stroke="#b78b4e" strokeWidth="2"/><path d="M94 165l12 8-12 7 12 7-12 7" fill="none" stroke="#403027" strokeWidth="2"/><path d="M45 194h110v6H45" fill="#d45142"/></g>;
      case 'superhero':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill={clothColor}/><path d="M50 160l26 2-11 38H42m108-40-26 2 11 38h23" fill="#d63c4b"/><path d="M100 172l17 7-5 13-12 7-12-7-5-13z" fill="#fcd34d" stroke="#fff3ba"/><path d="M105 176l-10 10h9l-9 10" fill="none" stroke="#d63c4b" strokeWidth="3" strokeLinejoin="round"/></g>;
      case 'pumpkin':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill="#ed8022"/><path d="M65 161q-10 20-5 39m24-40q-7 20-4 40m36-40q7 20 4 40m15-39q10 20 5 39" fill="none" stroke="#b64b16" strokeWidth="2"/><path d="M75 159l10 12 15-9 15 9 10-12" fill="#2b6e3e"/><path d="M84 179l9 7H81zm32 0-9 7h12zM88 191l6 3 6-3 6 3 6-3-5 8H93z" fill="#302017"/></g>;
      case 'stakeys_apron':
        return <g><path d="M50 160Q100 155 150 160L158 200H42Z" fill={clothColor}/><path d="M77 158h7l-3 19h38l-3-19h7l5 42H72z" fill="#15251e" stroke="#709983"/><path d="M84 187h32v13H84z" fill="#223d2e" stroke="#05c147"/><path d="M90 187v13m20-13v13" stroke="#8fb6a0"/><text x="100" y="183" textAnchor="middle" fontSize="5" fontWeight="bold" fill="#63ef9a">STAKEY'S</text></g>;
      default:
        return null;
    }
  };

  const renderEyes = () => {
    switch (config.eyesStyle) {
      case 'kind':
        return (
          <>
            <path d="M 74 98 Q 83 91 90 98" fill="none" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 110 98 Q 117 91 126 98" fill="none" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 71 88 Q 81 81 89 86" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 111 86 Q 119 81 129 88" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
          </>
        );
      case 'focused':
        return (
          <>
            <ellipse cx="82" cy="96" rx="9" ry="6.5" fill="#ffffff" />
            <circle cx="82" cy="96" r="4.8" fill={eyeColorOpt.color} />
            <circle cx="82" cy="96" r="2.5" fill="#111827" />
            <circle cx="84.5" cy="93.8" r="1.3" fill="#ffffff" />

            <ellipse cx="118" cy="96" rx="9" ry="6.5" fill="#ffffff" />
            <circle cx="118" cy="96" r="4.8" fill={eyeColorOpt.color} />
            <circle cx="118" cy="96" r="2.5" fill="#111827" />
            <circle cx="120.5" cy="93.8" r="1.3" fill="#ffffff" />

            <path d="M 72 85 Q 81 82 89 86" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
            <path d="M 111 86 Q 119 82 128 85" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case 'playful':
        return (
          <>
            <ellipse cx="82" cy="96" rx="9" ry="6.5" fill="#ffffff" />
            <circle cx="82" cy="96" r="4.8" fill={eyeColorOpt.color} />
            <circle cx="82" cy="96" r="2.5" fill="#111827" />
            <circle cx="84.5" cy="93.8" r="1.3" fill="#ffffff" />

            <path d="M 110 97 Q 118 104 126 97" fill="none" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />

            <path d="M 71 84 Q 81 82 89 87" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
            <path d="M 111 83 Q 119 77 127 82" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case 'chill':
        return (
          <>
            <ellipse cx="82" cy="97" rx="9" ry="4" fill="#ffffff" />
            <ellipse cx="82" cy="96" rx="4.5" ry="3.2" fill={eyeColorOpt.color} />
            <circle cx="83.8" cy="95.2" r="1" fill="#ffffff" />
            <path d="M 72 94 Q 82 93 92 95 Z" fill={skinOpt.shadow} />

            <ellipse cx="118" cy="97" rx="9" ry="4" fill="#ffffff" />
            <ellipse cx="118" cy="96" rx="4.5" ry="3.2" fill={eyeColorOpt.color} />
            <circle cx="119.8" cy="95.2" r="1" fill="#ffffff" />
            <path d="M 108 94 Q 118 93 128 95 Z" fill={skinOpt.shadow} />

            <line x1="72" y1="87" x2="90" y2="88" stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
            <line x1="110" y1="88" x2="128" y2="87" stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
          </>
        );
      default:
        return null;
    }
  };

  const renderBrowDetail = () => {
    if (!config.browStyle || config.browStyle === 'natural') return null;
    const strokeWidth = config.browStyle === 'bold' ? 4.5 : 2.6;
    const browPaths = config.browStyle === 'arched'
      ? ['M 71 86 Q 80 77 91 86', 'M 109 86 Q 120 77 129 86']
      : config.browStyle === 'determined'
        ? ['M 71 88 Q 81 82 92 86', 'M 108 86 Q 119 82 129 88']
        : ['M 71 86 Q 81 79 91 86', 'M 109 86 Q 119 79 129 86'];
    return <g fill="none" stroke="#221916" strokeWidth={strokeWidth} strokeLinecap="round">
      {browPaths.map((d) => <path key={d} d={d} />)}
    </g>;
  };

  const renderMouth = () => {
    switch (config.expression) {
      case 'smile':
        return (
          <g transform="translate(100, 119)">
            <path d="M -12 0 Q 0 16 12 0 Q 0 3 -12 0 Z" fill="#7F1D1D" />
            <path d="M -9 0.8 Q 0 4.5 9 0.8 L 7 -1 H -7 Z" fill="#ffffff" />
            <path d="M -7 9 Q 0 5 7 9 Q 0 14 -7 9 Z" fill="#F43F5E" />
            <path d="M -14 -1 Q -11 0 -10 1" fill="none" stroke="#4C0519" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 14 -1 Q 11 0 10 1" fill="none" stroke="#4C0519" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      case 'grin':
        return (
          <path d="M 89 122 Q 100 128 111 122" fill="none" stroke="#111827" strokeWidth="3.2" strokeLinecap="round" />
        );
      case 'excited':
        return (
          <g transform="translate(100, 118)">
            <path d="M -14 0 A 14 14 0 0 0 14 0 Z" fill="#4C0519" />
            <path d="M -12 1 Q 0 6 12 1 L 10 -1 H -10 Z" fill="#ffffff" />
            <path d="M -8 10 C -5 6, 5 6, 8 10 C 6 13, -6 13, -8 10 Z" fill="#FDA4AF" />
          </g>
        );
      case 'neutral':
        return (
          <line x1="91" y1="123" x2="109" y2="123" stroke="#111827" strokeWidth="3.2" strokeLinecap="round" />
        );
      default:
        return null;
    }
  };

  const renderFacialHair = () => {
    switch (config.facialHair) {
      case 'stubble':
        return (
          <path d="M 62 90 C 62 125, 138 125, 138 90 C 138 140, 62 140, 62 90 Z" fill="rgba(15, 23, 42, 0.14)" />
        );
      case 'beard':
        return (
          <path d="M 61 90 C 58 124, 76 148, 100 148 C 124 148, 142 124, 139 90 C 130 106, 117 114, 100 114 C 83 114, 70 106, 61 90 Z" fill={hairGradientUrl} />
        );
      case 'mustache':
        return (
          <path d="M 85 116 Q 100 111 115 116 Q 100 121 85 116 Z" fill={hairGradientUrl} />
        );
      case 'goatee':
        return (
          <path d="M 94 127 H 106 L 100 139 Z" fill={hairGradientUrl} />
        );
      default:
        return null;
    }
  };

  const renderHair = () => {
    switch (config.hairStyle) {
      case 'crop':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 61 74 C 54 50, 146 50, 139 74 C 134 68, 66 68, 61 74 Z" />
            <path d="M 61 74 L 64 88 H 61 Z" />
            <path d="M 139 74 L 136 88 H 139 Z" />
          </g>
        );
      case 'pompadour':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 58 76 C 45 28, 100 15, 134 26 C 150 33, 145 76, 140 76 C 130 58, 116 52, 100 52 C 84 52, 70 58, 58 76 Z" />
            <path d="M 70 50 Q 100 35 125 42 Q 100 48 70 50 Z" fill="rgba(255, 255, 255, 0.15)" />
            <path d="M 60 74 L 63 88 H 60 Z" />
            <path d="M 140 74 L 137 88 H 140 Z" />
          </g>
        );
      case 'waves':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 62 70 C 42 60, 40 100, 48 135 C 53 135, 58 110, 64 85 Z" />
            <path d="M 138 70 C 158 60, 160 100, 152 135 C 147 135, 142 110, 136 85 Z" />
            <path d="M 60 72 C 54 42, 146 42, 140 72 C 128 64, 72 64, 60 72 Z" />
          </g>
        );
      case 'bun':
        return (
          <g fill={hairGradientUrl}>
            <circle cx="100" cy="38" r="16" />
            <circle cx="100" cy="38" r="11" fill="none" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2.5" />
            <path d="M 60 74 C 54 48, 146 48, 140 74 Z" />
            <path d="M 60 74 L 63 88 H 60 Z" />
            <path d="M 140 74 L 137 88 H 140 Z" />
          </g>
        );
      case 'afro':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 61 74 Q 40 65 52 45 Q 52 15 82 25 Q 100 10 118 25 Q 148 15 148 45 Q 160 65 139 74 Q 148 95 136 112 Q 120 120 100 116 Q 80 120 64 112 Q 52 95 61 74 Z" />
            <circle cx="70" cy="40" r="18" fill="rgba(255,255,255,0.06)" />
            <circle cx="130" cy="40" r="18" fill="rgba(255,255,255,0.06)" />
            <circle cx="100" cy="30" r="22" fill="rgba(255,255,255,0.06)" />
          </g>
        );
      case 'bob':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 61 70 C 50 65, 52 105, 56 122 C 60 122, 65 105, 63 85 Z" />
            <path d="M 139 70 C 150 65, 148 105, 144 122 C 140 122, 135 105, 137 85 Z" />
            <path d="M 60 72 C 54 44, 146 44, 140 72 C 130 65, 70 65, 60 72 Z" />
          </g>
        );
      case 'beanie':
        return (
          <g>
            <path d="M 52 74 C 42 35, 158 35, 148 74 Z" fill={hairGradientUrl} />
            <rect x="48" y="68" width="104" height="14" rx="4" fill={hairGradientUrl} filter="brightness(1.15)" />
            <rect x="48" y="68" width="104" height="14" rx="4" fill={beanieRibPatternUrl} />
            <circle cx="100" cy="32" r="10" fill={hairGradientUrl} />
            <circle cx="100" cy="32" r="10" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </g>
        );
      case 'cycling_cap':
        return (
          <g>
            <path d="M 52 74 C 45 42, 155 42, 148 74 Z" fill="#1F2937" />
            <path d="M 94 44 C 94 44, 100 68, 100 75 C 100 68, 106 44, 106 44 Z" fill="#05C147" />
            <path d="M 44 72 C 40 72, 35 84, 30 87 C 48 94, 90 94, 136 84 C 144 82, 152 72, 156 72 Q 100 84 44 72 Z" fill="#111827" />
            <circle cx="100" cy="56" r="5" fill="#05C147" />
            <circle cx="100" cy="56" r="3.5" fill="#1F2937" />
            <polygon points="98,56 102,56 100,53" fill="#05C147" />
          </g>
        );
      case 'undercut':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 58 76 C 48 40, 152 36, 142 60 C 150 68, 146 78, 140 76 C 132 58, 116 50, 100 50 C 86 50, 74 56, 66 70 C 64 76, 62 80, 58 76 Z" />
            <path d="M 138 60 C 152 56, 156 70, 150 78 C 148 72, 144 66, 138 64 Z" />
            <path d="M 62 72 C 60 80, 58 86, 57 90 L 61 90 C 63 84, 65 78, 66 74 Z" />
            <path d="M 60 70 Q 100 58 138 66 Q 100 64 60 70 Z" fill="rgba(255,255,255,0.14)" />
          </g>
        );
      case 'long_straight':
        return (
          <g fill={hairGradientUrl}>
            <path d="M 62 70 C 46 66, 42 120, 46 158 C 52 160, 58 150, 60 130 C 56 110, 58 86, 62 70 Z" />
            <path d="M 138 70 C 154 66, 158 120, 154 158 C 148 160, 142 150, 140 130 C 144 110, 142 86, 138 70 Z" />
            <path d="M 60 72 C 52 40, 148 40, 140 72 C 128 62, 72 62, 60 72 Z" />
            <path d="M 70 62 Q 100 50 130 62 Q 100 58 70 62 Z" fill="rgba(255,255,255,0.12)" />
          </g>
        );
      case 'ponytail':
        return (
          <g fill={hairGradientUrl}>
            <path d="M132 61q21-12 23 9l-4 42q-8 9-15-1l4-34q-7-3-10-8z" />
            <path d="M60 72q-7-30 40-31 47 0 40 34-17-14-39-14-24 0-41 11z" />
            <path d="M62 68q-2 10 0 19l-5 8-3-18zM138 68q2 10 0 19l5 8 3-18z" />
            <path d="M68 57q31-24 63 0" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
            <path d="M134 69l7 4" stroke="#D4AF37" strokeWidth="4" />
          </g>
        );
      case 'braids':
        return (
          <g fill={hairGradientUrl} stroke={hairColorOpt.colors[1]} strokeWidth="1.2">
            <path d="M58 73q-6-27 10-33v26q-4 12-8 27l-6-1zM142 73q6-27-10-33v26q4 12 8 27l6-1z" />
            <path d="M60 69q0-31 40-31t40 31q-18-12-40-12T60 69z" />
            <path d="M55 80l10 6-8 6 9 5-8 6 8 5M145 80l-10 6 8 6-9 5 8 6-8 5" fill="none" strokeWidth="3" strokeLinecap="round" />
            <path d="M55 105l7 1m81-1-7 1" stroke="#05C147" strokeWidth="4" />
          </g>
        );
      case 'locs':
        return (
          <g fill={hairGradientUrl}>
            <path d="M59 76q-7-30 15-37t53 0q20 9 14 37-19-12-41-12T59 76z" />
            {[-1, 0, 1].map((n) => <g key={n}>
              <path d={`M${65 + n * 13} 61q-7 19 0 34t0 32q-5 5-9 0 5-16-1-31t2-33z`} />
              <path d={`M${136 + n * 6} 61q7 19 0 34t0 32q5 5 9 0-5-16 1-31t-2-33z`} />
            </g>)}
            <circle cx="76" cy="48" r="4" fill="#D4AF37" /><circle cx="124" cy="48" r="4" fill="#D4AF37" />
          </g>
        );
      case 'curly_top':
        return (
          <g fill={hairGradientUrl}>
            <path d="M59 76q-8-26 17-34 29-19 53 0 20 9 12 34-21-11-41-11T59 76z" />
            {[0, 1, 2, 3, 4, 5, 6].map((n) => <circle key={n} cx={66 + n * 11} cy={48 + (n % 2) * 4} r="8" />)}
            <path d="M63 72q37-17 74 0" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="2" />
          </g>
        );
      case 'top_knot':
        return (
          <g fill={hairGradientUrl}>
            <path d="M60 75q-7-31 40-33t40 33q-18-10-40-10T60 75z" />
            <circle cx="100" cy="30" r="13" />
            <path d="M91 30q9-7 18 0" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="2" />
            <path d="M61 72v14m78-14v14" stroke="#B7A58A" strokeWidth="2" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderGlasses = () => {
    switch (config.glasses) {
      case 'round_wireframe':
        return (
          <g stroke={glassesOpt.color} strokeWidth="2.2" fill="none">
            <circle cx="82" cy="96" r="14" />
            <circle cx="118" cy="96" r="14" />
            <path d="M 96 96 Q 100 93 104 96" strokeLinecap="round" />
            <line x1="68" y1="96" x2="58" y2="94" strokeLinecap="round" />
            <line x1="132" y1="96" x2="142" y2="94" strokeLinecap="round" />
            <path d="M 74 88 L 86 104" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 110 88 L 122 104" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      case 'square_nerd':
        return (
          <g stroke={glassesOpt.color} strokeWidth="3" fill="none">
            <rect x="67" y="83" width="30" height="25" rx="5" />
            <rect x="103" y="83" width="30" height="25" rx="5" />
            <line x1="97" y1="89" x2="103" y2="89" strokeLinecap="round" />
            <line x1="67" y1="88" x2="58" y2="86" strokeLinecap="round" />
            <line x1="133" y1="88" x2="142" y2="86" strokeLinecap="round" />
            <path d="M 74 87 L 85 101" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="3" strokeLinecap="round" />
            <path d="M 110 87 L 121 101" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      case 'sporty_cycling':
        return (
          <g>
            <path d="M 58 87 C 80 83, 120 83, 142 87 C 146 88, 143 103, 131 103 C 114 103, 106 94, 100 94 C 94 94, 86 103, 69 103 C 57 103, 54 88, 58 87 Z" fill={sportyLensGradientUrl} />
            <path d="M 58 87 C 80 83, 120 83, 142 87 C 146 88, 143 103, 131 103 C 114 103, 106 94, 100 94 C 94 94, 86 103, 69 103 C 57 103, 54 88, 58 87 Z" fill="none" stroke="#000000" strokeWidth="2.5" strokeLinejoin="round" />
            <path d="M 68 91 Q 100 86 132 91" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 'retro_cat':
        return (
          <g stroke={glassesOpt.color} strokeWidth="3" fill="none">
            <path d="M 64 85 Q 82 82 96 89 Q 94 106 78 106 Q 64 100 64 85 Z" />
            <path d="M 136 85 Q 118 82 104 89 Q 106 106 122 106 Q 136 100 136 85 Z" />
            <path d="M 96 89 Q 100 87 104 89" strokeLinecap="round" />
            <path d="M 64 85 L 58 83" strokeLinecap="round" />
            <path d="M 136 85 L 142 83" strokeLinecap="round" />
            <path d="M 72 88 L 84 100" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="2.5" />
            <path d="M 112 88 L 124 100" stroke="rgba(255, 255, 255, 0.28)" strokeWidth="2.5" />
          </g>
        );
      case 'aviator':
        return (
          <g>
            <path d="M 62 88 Q 100 83 138 88 Q 138 104 116 105 Q 104 105 100 98 Q 96 105 84 105 Q 62 104 62 88 Z" fill="rgba(20,20,25,0.72)" />
            <path d="M 62 88 Q 100 83 138 88 Q 138 104 116 105 Q 104 105 100 98 Q 96 105 84 105 Q 62 104 62 88 Z" fill="none" stroke={glassesOpt.color} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M 62 88 L 56 86" stroke={glassesOpt.color} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 138 88 L 144 86" stroke={glassesOpt.color} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 72 92 Q 100 87 128 92" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderAccessories = () => {
    switch (config.accessory) {
      case 'earbuds':
        return (
          <>
            <circle cx="58" cy="100" r="3.5" fill="#ffffff" />
            <rect x="55" y="99" width="3" height="7" rx="1" fill="#ffffff" />
            <circle cx="142" cy="100" r="3.5" fill="#ffffff" />
            <rect x="142" y="99" width="3" height="7" rx="1" fill="#ffffff" />
          </>
        );
      case 'stud':
        return (
          <>
            <circle cx="58" cy="107" r="2" fill="#E5E7EB" />
            <circle cx="58" cy="107" r="0.8" fill="#ffffff" />
          </>
        );
      case 'headset':
        return (
          <>
            <path d="M 60 68 A 45 45 0 0 1 140 68" fill="none" stroke="#4B5563" strokeWidth="2.2" />
            <rect x="140" y="90" width="4" height="15" rx="1.5" fill="#111827" />
            <rect x="56" y="90" width="5" height="16" rx="2" fill="#111827" />
            <path d="M 58 100 L 80 115" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="115" r="2.8" fill="#1F2937" />
            <circle cx="80" cy="115" r="1.2" fill="#05C147" />
          </>
        );
      case 'scarf':
        return (
          <>
            <path d="M 74 158 Q 100 172 126 158 Q 128 170 122 178 Q 100 188 78 178 Q 72 170 74 158 Z" fill="#B91C1C" />
            <path d="M 74 158 Q 100 172 126 158" fill="none" stroke="#7F1D1D" strokeWidth="2" />
            <path d="M 104 174 Q 108 190 102 200 L 116 200 Q 120 186 114 174 Z" fill="#991B1B" />
            <path d="M 108 178 L 110 196 M 113 178 L 115 194" stroke="#7F1D1D" strokeWidth="1.2" />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`${seed}'s avatar`}
      className={"rounded-2xl shadow-md overflow-hidden " + (size >= 120 ? 'avatar-idle ' : '') + className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id={"bg-" + componentId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={bgOpt.colors[0]} />
          <stop offset="100%" stopColor={bgOpt.colors[1]} />
        </linearGradient>

        {/* Skin shading gradient */}
        <linearGradient id={"skin-" + componentId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={skinOpt.base} />
          <stop offset="100%" stopColor={skinOpt.shadow} />
        </linearGradient>

        {/* Hair gradient */}
        <linearGradient id={"hair-" + componentId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={hairColorOpt.colors[0]} />
          <stop offset="100%" stopColor={hairColorOpt.colors[1]} />
        </linearGradient>

        {/* Sporty glasses reflective lens */}
        <linearGradient id={"sporty-lens-" + componentId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF3E96" />
          <stop offset="35%" stopColor="#FF8C00" />
          <stop offset="70%" stopColor="#00FFCC" />
          <stop offset="100%" stopColor="#1E90FF" />
        </linearGradient>

        {/* Beanie fold texture pattern */}
        <pattern id={"beanie-rib-" + componentId} width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="1" y1="0" x2="1" y2="6" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        </pattern>

        {/* Studio key-light: a soft radial highlight behind the head */}
        <radialGradient id={"glow-" + componentId} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Bottom vignette for depth */}
        <linearGradient id={"vignette-" + componentId} x1="0%" y1="55%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {/* 1. BACKDROP BACKGROUND */}
      <rect width="200" height="200" fill={bgGradientUrl} />

      {/* Studio key-light glow */}
      <rect width="200" height="200" fill={'url(#glow-' + componentId + ')'} />
      {/* Bottom vignette */}
      <rect width="200" height="200" fill={'url(#vignette-' + componentId + ')'} />

      {/* The portrait layers share a controllable silhouette scale and pose. */}
      <g transform={modelTransform} data-avatar-model="true">

      {/* 2. NECK & SHOULDERS */}
      {/* Neck */}
      <rect
        x="86"
        y="126"
        width="28"
        height="32"
        rx="6"
        fill={skinGradientUrl}
      />
      {/* Neck chin-shadow overlay */}
      <path
        d="M 86 128 C 86 142, 114 142, 114 128"
        fill="rgba(0, 0, 0, 0.16)"
      />

      {/* 3. CLOTHING */}
      <g aria-label={CLOTHING_OPTIONS.find(o => o.id === config.clothing)?.name || 'Clothing'}>
        {renderClothing()}
        <path d="M50 164l-6 34m106-34 6 34" fill="none" stroke="#000" strokeOpacity=".16" strokeWidth="3"/>
      </g>

      {/* 4. BASE FACE & EARS */}
      <circle cx="58" cy="98" r="9" fill={skinGradientUrl} />
      <path d="M 58 94 A 5 5 0 0 0 58 102" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      <path d="M57 96q2-3 4 0m-4 4q2 3 4 0" fill="none" stroke={skinOpt.shadow} strokeWidth="1" opacity=".75" />

      <circle cx="142" cy="98" r="9" fill={skinGradientUrl} />
      <path d="M 142 94 A 5 5 0 0 1 142 102" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
      <path d="M139 96q2-3 4 0m-4 4q2 3 4 0" fill="none" stroke={skinOpt.shadow} strokeWidth="1" opacity=".75" />

      {config.faceShape === 'heart' ? (
        <path d="M100 140C91 132 61 111 61 86C61 68 73 56 87 56C94 56 98 60 100 65C103 60 107 56 114 56C128 56 139 68 139 86C139 111 109 132 100 140Z" fill={skinGradientUrl} />
      ) : config.faceShape === 'angular' ? (
        <path d="M61 69Q61 56 75 56H125Q139 56 139 69L134 112 100 140 66 112Z" fill={skinGradientUrl} />
      ) : config.faceShape === 'round' ? (
        <ellipse cx="100" cy="98" rx="40" ry="42" fill={skinGradientUrl} />
      ) : (
        <rect x="61" y="56" width="78" height="84" rx={config.faceShape === 'square' ? 25 : config.faceShape === 'oval' ? 33 : 39} fill={skinGradientUrl} />
      )}

      <path d="M68 72q5-8 13-8" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" />
      <path d="M131 67q6 4 7 10" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="73" cy="114" rx="7" ry="4" fill="#FF8A8A" opacity={config.faceDetail === 'rosy_cheeks' ? 0.48 : 0.2} />
      <ellipse cx="127" cy="114" rx="7" ry="4" fill="#FF8A8A" opacity={config.faceDetail === 'rosy_cheeks' ? 0.48 : 0.2} />
      {config.faceDetail === 'freckles' && <g fill={skinOpt.shadow} opacity=".92">
        <circle cx="68" cy="111" r="1.2"/><circle cx="74" cy="109" r="1"/><circle cx="80" cy="112" r="1.1"/>
        <circle cx="120" cy="112" r="1.1"/><circle cx="126" cy="109" r="1"/><circle cx="132" cy="111" r="1.2"/>
      </g>}
      {config.faceDetail === 'beauty_mark' && <circle cx="128" cy="116" r="1.6" fill={skinOpt.shadow} />}

      {/* 5. EYES & EYEBROWS */}
      {renderEyes()}
      {renderBrowDetail()}

      {/* 6. NOSE */}
      {config.noseStyle === 'button' ? (
        <path d="M94 106q6 5 12 0" fill="none" stroke={skinOpt.shadow} strokeWidth="2.5" strokeLinecap="round" />
      ) : config.noseStyle === 'strong' ? (
        <path d="M96 97q2 11 7 12h-5" fill="none" stroke={skinOpt.shadow} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M97 101q3 8 6 2l2 5" fill="none" stroke="rgba(0,0,0,.24)" strokeWidth="2" strokeLinecap="round" />
      )}

      {/* 7. EXPRESSION / MOUTH */}
      {renderMouth()}

      {/* 8. FACIAL HAIR */}
      {renderFacialHair()}

      {/* 9. HAIR STYLES */}
      {renderHair()}

      {/* 10. GLASSES */}
      {renderGlasses()}

      {/* 11. ACCESSORIES */}
      {renderAccessories()}
      </g>

      {/* Stakey's brand mark and selected ride are compact, readable profile badges. */}
      {(config.clothing === 'collar' || config.clothing === 'brand_tee' || config.clothing === 'dungarees') && (
        <g aria-label="Stakey's Cycles uniform mark">
          <circle cx="125" cy="181" r="9" fill="#07130d" stroke="#45e58a" strokeWidth="1.5" />
          <circle cx="120" cy="184" r="2.2" fill="none" stroke="#fff" strokeWidth="1" />
          <circle cx="130" cy="184" r="2.2" fill="none" stroke="#fff" strokeWidth="1" />
          <path d="M120 184l4-6 6 6h-5l-1-3" fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
        </g>
      )}
      {config.vehicle && config.vehicle !== 'none' && (
        <g transform="translate(154 151)" aria-label={config.vehicle.replaceAll('_', ' ')}>
          <circle cx="7" cy="29" r="5" fill="#101713" stroke="#62efa0" strokeWidth="2" />
          <circle cx="31" cy="29" r="5" fill="#101713" stroke="#62efa0" strokeWidth="2" />
          {config.vehicle === 'bicycle' && <path d="M7 29l9-14 8 14H7l7-10h9m0 0-4-6h5" fill="none" stroke="#f4fff8" strokeWidth="2" strokeLinejoin="round" />}
          {config.vehicle === 'scooter' && <path d="M7 29h22l-3-16h5M13 29l4-13" fill="none" stroke="#f4fff8" strokeWidth="2.5" strokeLinecap="round" />}
          {config.vehicle === 'electric_dirt_bike' && <path d="M7 29l7-13h10l7 13M13 16l-2-5h8l4 5m-9 2 7 6" fill="none" stroke="#f4fff8" strokeWidth="2.5" strokeLinejoin="round" />}
        </g>
      )}
      {config.prop && config.prop !== 'none' && (
        <g transform="translate(18 159)" aria-label={config.prop}>
          <circle cx="12" cy="12" r="11" fill="#0b1911" stroke="#5de995" strokeWidth="1.5" />
          {config.prop === 'wrench' && <path d="M7 17l7-7m-3-4a5 5 0 0 0 6 6l-7 7-3-3 7-7a5 5 0 0 1-6-6l3 3 3-1 1-3-3-3z" fill="none" stroke="#effff4" strokeWidth="1.5" strokeLinejoin="round" />}
          {config.prop === 'coffee' && <g fill="none" stroke="#effff4" strokeWidth="1.5"><path d="M7 8h11v9H7zM18 10h2a2 2 0 0 1 0 4h-2M9 5q-2-2 0-3m5 3q-2-2 0-3" /></g>}
          {config.prop === 'pump' && <g fill="none" stroke="#effff4" strokeWidth="1.6" strokeLinecap="round"><path d="M8 5h8m-4 0v14m-5 1h10M15 9q8-2 5 8"/><path d="M10 10h4v7h-4z" fill="#34d878"/></g>}
          {config.prop === 'clipboard' && <g><rect x="5" y="5" width="14" height="16" rx="2" fill="#e2e8f0"/><rect x="9" y="3" width="6" height="4" rx="1" fill="#34d878"/><path d="m8 11 1 1 2-2m-3 6 1 1 2-2m2-4h3m-3 5h3" fill="none" stroke="#17543b" strokeWidth="1.2"/></g>}
          {config.prop === 'pizza' && <g><path d="M5 5q8-4 15 3L8 21z" fill="#f6ce62" stroke="#c47c32"/><path d="M5 5q8-4 15 3" fill="none" stroke="#e99d48" strokeWidth="3"/><circle cx="10" cy="10" r="2" fill="#c74c3b"/><circle cx="13" cy="14" r="1.6" fill="#c74c3b"/></g>}
          {config.prop === 'wand' && <g><path d="m5 21 9-11" stroke="#d4bafc" strokeWidth="3"/><path d="m16 2 2 4 4 1-3 3v5l-4-3-4 1 1-5-2-3 5 1z" fill="#ffe27a"/><path d="M4 5v4m-2-2h4" stroke="#90efc1"/></g>}
          {config.prop === 'medal' && <g><path d="M8 3h8l-2 8h-4z" fill="#34d878"/><circle cx="12" cy="15" r="5" fill="#ffd76b" stroke="#fff0b0"/><path d="m12 12 1 2h2l-2 1.5.7 2.2-1.7-1.3-1.7 1.3.7-2.2-2-1.5h2z" fill="#fff"/></g>}
        </g>
      )}
    </svg>
  );
};
