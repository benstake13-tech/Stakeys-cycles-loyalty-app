import React, { useId } from 'react';

// ============================================================================
// Types & Interface Definitions
// ============================================================================

export type BackdropGradient =
  | 'sunset' | 'ocean' | 'cyberpunk' | 'emerald' | 'solar' | 'midnight' | 'rose' | 'forest';
export type SkinTone = 'porcelain' | 'warm_beige' | 'honey' | 'golden_tan' | 'chocolate' | 'espresso';
export type HairStyle =
  | 'none' | 'crop' | 'pompadour' | 'waves' | 'bun' | 'afro' | 'bob' | 'beanie'
  | 'cycling_cap' | 'undercut' | 'long_straight';
export type HairColor = 'onyx' | 'espresso_brown' | 'golden_blonde' | 'auburn_red' | 'platinum_silver' | 'cyber_neon';
export type FacialHair = 'none' | 'stubble' | 'beard' | 'mustache' | 'goatee';
export type EyesStyle = 'kind' | 'focused' | 'playful' | 'chill';
export type ExpressionStyle = 'smile' | 'grin' | 'excited' | 'neutral';
export type GlassesStyle =
  | 'none' | 'round_wireframe' | 'square_nerd' | 'sporty_cycling' | 'retro_cat' | 'aviator';
export type AccessoryStyle = 'none' | 'earbuds' | 'stud' | 'headset' | 'scarf';
export type ClothingStyle = 'dungarees' | 'collar' | 'hoodie' | 'brand_tee' | 'tank' | 'varsity';

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
];

export const HAIR_COLOR_OPTIONS: { id: HairColor; name: string; colors: [string, string] }[] = [
  { id: 'onyx', name: 'Onyx Black', colors: ['#1E1E24', '#0F0F12'] },
  { id: 'espresso_brown', name: 'Espresso', colors: ['#543D2B', '#322216'] },
  { id: 'golden_blonde', name: 'Honey Blonde', colors: ['#F2C94C', '#D4AF37'] },
  { id: 'auburn_red', name: 'Auburn Red', colors: ['#C0392B', '#8E1C0E'] },
  { id: 'platinum_silver', name: 'Platinum', colors: ['#E2E8F0', '#94A3B8'] },
  { id: 'cyber_neon', name: 'Cyber Pink', colors: ['#EC4899', '#BE185D'] },
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
  const clothing = CLOTHING_OPTIONS[Math.abs(hash >> 9) % CLOTHING_OPTIONS.length].id;
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
  const glassesOpt = GLASSES_OPTIONS.find((o) => o.id === config.glasses) || GLASSES_OPTIONS[0];
  const clothColor = config.clothingColor || CLOTHING_COLORS[0];

  const bgGradientUrl = 'url(#bg-' + componentId + ')';
  const skinGradientUrl = 'url(#skin-' + componentId + ')';
  const hairGradientUrl = 'url(#hair-' + componentId + ')';
  const sportyLensGradientUrl = 'url(#sporty-lens-' + componentId + ')';
  const beanieRibPatternUrl = 'url(#beanie-rib-' + componentId + ')';

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
            <circle cx="82" cy="96" r="4.8" fill={bgGradientUrl} />
            <circle cx="82" cy="96" r="2.5" fill="#111827" />
            <circle cx="84.5" cy="93.8" r="1.3" fill="#ffffff" />

            <ellipse cx="118" cy="96" rx="9" ry="6.5" fill="#ffffff" />
            <circle cx="118" cy="96" r="4.8" fill={bgGradientUrl} />
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
            <circle cx="82" cy="96" r="4.8" fill={bgGradientUrl} />
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
            <ellipse cx="82" cy="96" rx="4.5" ry="3.2" fill="#111827" />
            <circle cx="83.8" cy="95.2" r="1" fill="#ffffff" />
            <path d="M 72 94 Q 82 93 92 95 Z" fill={skinOpt.shadow} />

            <ellipse cx="118" cy="97" rx="9" ry="4" fill="#ffffff" />
            <ellipse cx="118" cy="96" rx="4.5" ry="3.2" fill="#111827" />
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
      className={"rounded-2xl shadow-md overflow-hidden " + className}
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
      {renderClothing()}

      {/* 4. BASE FACE & EARS */}
      <circle cx="58" cy="98" r="9" fill={skinGradientUrl} />
      <path d="M 58 94 A 5 5 0 0 0 58 102" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />

      <circle cx="142" cy="98" r="9" fill={skinGradientUrl} />
      <path d="M 142 94 A 5 5 0 0 1 142 102" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />

      <rect
        x="61"
        y="56"
        width="78"
        height="84"
        rx="36"
        fill={skinGradientUrl}
      />

      <ellipse cx="73" cy="114" rx="6" ry="3.5" fill="#FF8A8A" opacity="0.25" />
      <ellipse cx="127" cy="114" rx="6" ry="3.5" fill="#FF8A8A" opacity="0.25" />

      {/* 5. EYES & EYEBROWS */}
      {renderEyes()}

      {/* 6. NOSE */}
      <path
        d="M 97 101 Q 100 108 103 101 Q 100 108 105 108"
        fill="none"
        stroke="rgba(0, 0, 0, 0.22)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

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
    </svg>
  );
};
