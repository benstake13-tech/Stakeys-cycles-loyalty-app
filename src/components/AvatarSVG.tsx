import React from 'react';
import { DEFAULT_AVATAR, type AvatarConfig } from '../shared/types/avatar';

export interface AvatarSVGProps {
  config?: AvatarConfig | null;
  svgRef?: React.Ref<SVGSVGElement>;
  className?: string;
}

/**
 * The Stakeys rider avatar: a fully vector, brand-styled character built from
 * an AvatarConfig. Pure SVG so it renders identically everywhere (profile,
 * membership pass, header) and exports cleanly to PNG.
 */
export const AvatarSVG: React.FC<AvatarSVGProps> = ({ config, svgRef, className }) => {
  const {
    skinTone,
    hairStyle,
    hairColor,
    facialHair,
    facialHairColor,
    eyeShape,
    eyeColor,
    expression,
    clothingStyle,
    clothingColor,
    accessory,
    propBike,
    bikeColor,
  } = config || DEFAULT_AVATAR;

  // Gradient ids must be unique per instance so several avatars can share a
  // page without one clobbering another's fills.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const glowId = `glow-${uid}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 600"
      className={className ?? 'w-full h-full drop-shadow-2xl'}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      <defs>
        {/* Background Radial Glow */}
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#090D16" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Backdrop Subtle Ambient Circle */}
      <circle cx="250" cy="300" r="230" fill={`url(#${glowId})`} />
      <ellipse cx="250" cy="550" rx="180" ry="15" fill="#000000" opacity="0.4" />

      {/* ------------------- PROPS / BIKES (Behind or Front) ------------------- */}
      {propBike === 'roadBike' && (
        <g id="road-bike" transform="translate(40, 260)">
          {/* Wheels */}
          <circle cx="90" cy="210" r="75" stroke="#333" strokeWidth="12" fill="none" />
          <circle cx="90" cy="210" r="67" stroke="#111" strokeWidth="4" fill="none" />
          <circle cx="330" cy="210" r="75" stroke="#333" strokeWidth="12" fill="none" />
          <circle cx="330" cy="210" r="67" stroke="#111" strokeWidth="4" fill="none" />
          {/* Spokes */}
          {[0, 30, 60, 90, 120, 150].map((angle, i) => (
            <React.Fragment key={i}>
              <line
                x1={90 + 65 * Math.cos((angle * Math.PI) / 180)}
                y1={210 + 65 * Math.sin((angle * Math.PI) / 180)}
                x2={90 - 65 * Math.cos((angle * Math.PI) / 180)}
                y2={210 - 65 * Math.sin((angle * Math.PI) / 180)}
                stroke="#666"
                strokeWidth="1.5"
              />
              <line
                x1={330 + 65 * Math.cos((angle * Math.PI) / 180)}
                y1={210 + 65 * Math.sin((angle * Math.PI) / 180)}
                x2={330 - 65 * Math.cos((angle * Math.PI) / 180)}
                y2={210 - 65 * Math.sin((angle * Math.PI) / 180)}
                stroke="#666"
                strokeWidth="1.5"
              />
            </React.Fragment>
          ))}
          {/* Frame */}
          <path
            d="M 90 210 L 170 210 L 250 120 L 140 120 Z"
            stroke={bikeColor}
            strokeWidth="12"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M 170 210 L 230 70 L 330 210"
            stroke={bikeColor}
            strokeWidth="10"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Handlebars & Seat */}
          <path d="M 230 70 L 245 50 L 270 65" stroke="#222" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M 135 120 L 120 115 C 100 115 110 125 140 125 Z" fill="#111" />
          {/* Chainset */}
          <circle cx="170" cy="210" r="18" fill="#444" />
          <line x1="90" y1="210" x2="170" y2="210" stroke="#888" strokeWidth="4" />
          {/* Stakeys Branding on Frame */}
          <text
            x="165"
            y="155"
            fill="#FFF"
            fontSize="11"
            fontWeight="900"
            transform="rotate(-38 165 155)"
            letterSpacing="1"
          >
            STAKEYS
          </text>
        </g>
      )}

      {propBike === 'mountainBike' && (
        <g id="mountain-bike" transform="translate(30, 250)">
          {/* Chunky Tires */}
          <circle cx="90" cy="220" r="80" stroke="#222" strokeWidth="18" fill="none" strokeDasharray="12,6" />
          <circle cx="340" cy="220" r="80" stroke="#222" strokeWidth="18" fill="none" strokeDasharray="12,6" />
          {/* Thick MTB Frame */}
          <path
            d="M 90 220 L 180 220 L 260 110 L 150 110 Z"
            stroke={bikeColor}
            strokeWidth="16"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M 180 220 L 240 60 L 340 220" stroke={bikeColor} strokeWidth="14" fill="none" />
          {/* Suspension Fork */}
          <line x1="240" y1="60" x2="340" y2="220" stroke="#999" strokeWidth="8" />
          {/* Wide Handlebar */}
          <line x1="220" y1="50" x2="270" y2="50" stroke="#111" strokeWidth="10" strokeLinecap="round" />
          <text x="175" y="150" fill="#FFF" fontSize="12" fontWeight="900" transform="rotate(-38 175 150)">
            STAKEYS MTB
          </text>
        </g>
      )}

      {propBike === 'eScooter' && (
        <g id="e-scooter" transform="translate(60, 270)">
          {/* Small Wheels */}
          <circle cx="80" cy="230" r="35" stroke="#111" strokeWidth="10" fill="none" />
          <circle cx="300" cy="230" r="35" stroke="#111" strokeWidth="10" fill="none" />
          {/* Deck */}
          <rect x="70" y="215" width="220" height="15" rx="5" fill={bikeColor} />
          {/* Stem */}
          <line x1="280" y1="220" x2="250" y2="40" stroke="#222" strokeWidth="12" strokeLinecap="round" />
          {/* Handlebars */}
          <path d="M 230 40 L 270 40" stroke="#10B981" strokeWidth="8" strokeLinecap="round" />
          <text x="120" y="226" fill="#FFF" fontSize="9" fontWeight="bold">
            STAKEYS E-RIDER
          </text>
        </g>
      )}

      {/* ------------------- BASE BODY & HEAD ------------------- */}
      {/* Neck */}
      <rect x="232" y="230" width="36" height="50" rx="8" fill={skinTone} />
      <path d="M 232 250 Q 250 265 268 250 Z" fill="#000000" opacity="0.08" />

      {/* Head Base */}
      <path
        d="M 190 150 C 190 80, 310 80, 310 150 C 310 215, 290 250, 250 250 C 210 250, 190 215, 190 150 Z"
        fill={skinTone}
      />

      {/* Ears */}
      <circle cx="188" cy="165" r="14" fill={skinTone} />
      <circle cx="188" cy="165" r="8" fill="#000" opacity="0.06" />
      <circle cx="312" cy="165" r="14" fill={skinTone} />
      <circle cx="312" cy="165" r="8" fill="#000" opacity="0.06" />

      {/* ------------------- CLOTHING & TORSO ------------------- */}
      <g id="torso-clothing">
        {clothingStyle === 'nikeHoodie' && (
          <g id="hoodie">
            <path d="M 160 270 C 180 260, 320 260, 340 270 L 360 450 L 140 450 Z" fill={clothingColor} />
            <path
              d="M 215 265 C 235 295, 265 295, 285 265 C 270 310, 230 310, 215 265 Z"
              fill="#111"
              opacity="0.3"
            />
            <line x1="230" y1="280" x2="225" y2="330" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
            <line x1="270" y1="280" x2="275" y2="330" stroke="#FFF" strokeWidth="3" strokeLinecap="round" />
            <path d="M 180 370 L 320 370 L 300 440 L 200 440 Z" fill="#000" opacity="0.15" />
            {/* Nike Swoosh Icon */}
            <path d="M 230 320 C 240 325, 255 315, 265 305 C 255 318, 242 330, 230 320 Z" fill="#FFFFFF" />
          </g>
        )}

        {clothingStyle === 'stakeysJersey' && (
          <g id="stakeys-jersey">
            <path d="M 160 270 C 180 260, 320 260, 340 270 L 355 450 L 145 450 Z" fill="#18181B" />
            <path d="M 160 270 L 200 270 L 180 450 L 145 450 Z" fill="#10B981" />
            <path d="M 340 270 L 300 270 L 320 450 L 355 450 Z" fill="#10B981" />
            <line x1="250" y1="262" x2="250" y2="340" stroke="#10B981" strokeWidth="3" />
            <rect x="195" y="320" width="110" height="35" rx="4" fill="#10B981" />
            <text x="250" y="337" fill="#000" fontSize="11" fontWeight="900" textAnchor="middle" letterSpacing="0.5">
              STAKEYS
            </text>
            <text x="250" y="348" fill="#FFF" fontSize="8" fontWeight="800" textAnchor="middle" letterSpacing="1.5">
              CYCLES
            </text>
          </g>
        )}

        {clothingStyle === 'tshirt' && (
          <g id="tshirt">
            <path d="M 165 270 C 180 260, 320 260, 335 270 L 350 450 L 150 450 Z" fill={clothingColor} />
            <path d="M 220 263 C 235 280, 265 280, 280 263" stroke="#000" opacity="0.2" strokeWidth="4" fill="none" />
            <path d="M 245 320 L 255 320 M 250 315 L 250 335" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}

        {clothingStyle === 'jacket' && (
          <g id="jacket">
            <path d="M 160 270 C 180 260, 320 260, 340 270 L 355 450 L 145 450 Z" fill={clothingColor} />
            <path d="M 210 265 L 250 320 L 200 330 Z" fill="#059669" />
            <path d="M 290 265 L 250 320 L 300 330 Z" fill="#059669" />
            <path d="M 220 280 L 250 320 L 280 280 Z" fill="#18181B" />
          </g>
        )}
      </g>

      {/* ------------------- FACIAL FEATURES ------------------- */}
      <g id="eyebrows">
        <path d="M 205 132 Q 225 124, 238 132" stroke={hairColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M 262 132 Q 275 124, 295 132" stroke={hairColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
      </g>

      <g id="eyes">
        {eyeShape === 'friendly' && (
          <>
            <ellipse cx="222" cy="148" rx="9" ry="10" fill="#FFF" />
            <ellipse cx="278" cy="148" rx="9" ry="10" fill="#FFF" />
            <circle cx="222" cy="148" r="5" fill={eyeColor} />
            <circle cx="278" cy="148" r="5" fill={eyeColor} />
            <circle cx="224" cy="146" r="2" fill="#FFF" />
            <circle cx="280" cy="146" r="2" fill="#FFF" />
          </>
        )}
        {eyeShape === 'expressive' && (
          <>
            <ellipse cx="222" cy="148" rx="11" ry="12" fill="#FFF" />
            <ellipse cx="278" cy="148" rx="11" ry="12" fill="#FFF" />
            <circle cx="222" cy="148" r="6" fill={eyeColor} />
            <circle cx="278" cy="148" r="6" fill={eyeColor} />
            <circle cx="225" cy="144" r="2.5" fill="#FFF" />
            <circle cx="281" cy="144" r="2.5" fill="#FFF" />
          </>
        )}
        {eyeShape === 'relaxed' && (
          <>
            <path d="M 212 150 Q 222 142, 232 150" stroke="#333" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <path d="M 268 150 Q 278 142, 288 150" stroke="#333" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          </>
        )}
      </g>

      <path d="M 250 145 L 246 172 Q 250 177, 255 172" stroke="#000" opacity="0.18" strokeWidth="3" strokeLinecap="round" fill="none" />

      <g id="mouth">
        {expression === 'customerSmile' && (
          <g>
            <path d="M 220 190 Q 250 225, 280 190 C 275 210, 225 210, 220 190 Z" fill="#3A090B" />
            <path d="M 224 192 Q 250 202, 276 192 C 270 198, 230 198, 224 192 Z" fill="#FFFFFF" />
            <path d="M 215 188 Q 212 193, 217 197" stroke="#000" opacity="0.15" strokeWidth="2" fill="none" />
            <path d="M 285 188 Q 288 193, 283 197" stroke="#000" opacity="0.15" strokeWidth="2" fill="none" />
          </g>
        )}
        {expression === 'broadSmile' && (
          <path d="M 222 190 Q 250 218, 278 190" stroke="#222" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
        {expression === 'coolMirk' && (
          <path d="M 228 195 Q 255 200, 278 188" stroke="#222" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
      </g>

      {/* ------------------- FACIAL HAIR ------------------- */}
      <g id="facial-hair">
        {facialHair === 'trimmedBeard' && (
          <g fill={facialHairColor}>
            <path
              d="M 190 160 C 190 225, 210 254, 250 254 C 290 254, 310 225, 310 160 C 304 190, 290 242, 250 242 C 210 242, 196 190, 190 160 Z"
              opacity="0.85"
            />
            <path
              d="M 230 185 C 240 181, 248 184, 250 187 C 252 184, 260 181, 270 185 C 262 192, 252 191, 250 189 C 248 191, 238 192, 230 185 Z"
              opacity="0.9"
            />
            <path d="M 246 204 L 254 204 L 252 212 L 248 212 Z" opacity="0.7" />
          </g>
        )}
        {facialHair === 'fullBeard' && (
          <g fill={facialHairColor}>
            <path d="M 188 155 C 188 240, 205 262, 250 262 C 295 262, 312 240, 312 155 C 302 210, 285 248, 250 248 C 215 248, 198 210, 188 155 Z" />
            <path d="M 225 183 Q 250 180, 275 183 Q 250 196, 225 183 Z" />
          </g>
        )}
        {facialHair === 'mustache' && (
          <path
            d="M 225 185 C 240 180, 248 184, 250 188 C 252 184, 260 180, 275 185 C 262 194, 252 192, 250 190 C 248 192, 238 194, 225 185 Z"
            fill={facialHairColor}
          />
        )}
      </g>

      {/* ------------------- HAIR STYLES ------------------- */}
      <g id="hairstyle" fill={hairColor}>
        {hairStyle === 'messyShort' && (
          <path d="M 185 145 C 175 100, 210 65, 250 65 C 290 65, 325 100, 315 145 C 308 110, 290 82, 250 82 C 210 82, 192 110, 185 145 Z M 210 85 Q 235 60, 265 75 Q 240 70, 210 85 Z M 240 70 Q 275 55, 305 85 Q 270 70, 240 70 Z" />
        )}
        {hairStyle === 'fadeCut' && (
          <path d="M 188 140 C 188 85, 212 68, 250 68 C 288 68, 312 85, 312 140 C 308 100, 285 80, 250 80 C 215 80, 192 100, 188 140 Z" />
        )}
        {hairStyle === 'quiff' && (
          <path d="M 185 135 C 180 80, 210 45, 260 48 C 305 50, 320 85, 315 135 C 305 80, 270 60, 240 75 C 215 90, 195 100, 185 135 Z" />
        )}
        {hairStyle === 'buzz' && (
          <path d="M 188 150 C 185 90, 210 75, 250 75 C 290 75, 315 90, 312 150 Z" opacity="0.4" />
        )}
      </g>

      {/* ------------------- ACCESSORIES ------------------- */}
      <g id="accessories">
        {accessory === 'cyclingGlasses' && (
          <g id="glasses">
            <path d="M 190 138 C 210 132, 290 132, 310 138 L 305 160 C 270 168, 230 168, 195 160 Z" fill="#111" opacity="0.85" />
            <path d="M 188 140 L 312 140" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
            <path d="M 200 142 L 235 142 L 215 158 Z" fill="#FFF" opacity="0.3" />
            <path d="M 260 142 L 295 142 L 275 158 Z" fill="#FFF" opacity="0.3" />
          </g>
        )}
        {accessory === 'helmet' && (
          <g id="cycling-helmet">
            <path d="M 175 140 C 170 60, 210 40, 250 40 C 290 40, 330 60, 325 140 C 310 110, 290 90, 250 90 C 210 90, 190 110, 175 140 Z" fill="#18181B" />
            <path d="M 210 70 Q 230 55, 240 75 Z" fill="#10B981" />
            <path d="M 260 75 Q 270 55, 290 70 Z" fill="#10B981" />
            <path d="M 188 140 L 230 195 L 312 140" stroke="#333" strokeWidth="3" fill="none" />
          </g>
        )}
        {accessory === 'beanie' && (
          <g id="beanie">
            <path d="M 182 145 C 180 75, 210 60, 250 60 C 290 60, 320 75, 318 145 Z" fill="#10B981" />
            <rect x="180" y="125" width="140" height="25" rx="5" fill="#059669" />
            <rect x="235" y="130" width="30" height="15" fill="#18181B" rx="2" />
            <text x="250" y="141" fill="#FFF" fontSize="7" fontWeight="bold" textAnchor="middle">
              SC
            </text>
          </g>
        )}
      </g>
    </svg>
  );
};

export default AvatarSVG;
