import React from 'react';

interface StakeysLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'shield' | 'full';
}

export const StakeysLogo: React.FC<StakeysLogoProps> = ({
  className = 'w-10 h-10',
  size,
  variant = 'shield',
}) => {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={style}>
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full drop-shadow-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="shieldInnerClip">
            <path d="M 60 70 C 180 20 320 20 440 70 C 440 260 380 400 250 480 C 120 400 60 260 60 70 Z" />
          </clipPath>
        </defs>

        {/* Outer Emerald Green Shield Contour */}
        <path
          d="M 60 70 C 180 20 320 20 440 70 C 440 260 380 400 250 480 C 120 400 60 260 60 70 Z"
          stroke="#05C147"
          strokeWidth="16"
          fill="#000000"
        />

        {/* Clipped Content */}
        <g clipPath="url(#shieldInnerClip)">
          {/* Top Emerald Green Zone */}
          <rect x="0" y="0" width="500" height="212" fill="#05C147" />

          {/* Bottom Pitch Black Zone */}
          <rect x="0" y="212" width="500" height="290" fill="#050505" />

          {/* Dividing Line */}
          <line x1="45" y1="212" x2="455" y2="212" stroke="#05C147" strokeWidth="4" />

          {/* Top Wordmark: STAKEYS */}
          <text
            x="250"
            y="142"
            textAnchor="middle"
            fontFamily="'Playfair Display', 'Cinzel', serif"
            fontSize="68"
            fontWeight="800"
            letterSpacing="5"
            fill="#000000"
          >
            STAKEYS
          </text>

          {/* Subtitle: cycles & scooter */}
          <text
            x="250"
            y="184"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontSize="30"
            fontWeight="600"
            letterSpacing="2.5"
            fill="#000000"
          >
            cycles &amp; scooter
          </text>

          {/* Scooter Graphic in Bottom Black Field */}
          <g transform="translate(162, 238)" stroke="#05C147" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Front wheel */}
            <circle cx="34" cy="115" r="18" strokeWidth="8" />
            <circle cx="34" cy="115" r="7" strokeWidth="4" />
            <circle cx="34" cy="115" r="3" fill="#05C147" />

            {/* Rear wheel */}
            <circle cx="150" cy="115" r="18" strokeWidth="8" />
            <circle cx="150" cy="115" r="7" strokeWidth="4" />
            <circle cx="150" cy="115" r="3" fill="#05C147" />

            {/* Rear mudguard / brake */}
            <path d="M 132 108 C 137 94 158 94 165 108" strokeWidth="7" />

            {/* Fork & Neck */}
            <path d="M 37 108 L 47 92 L 44 42" strokeWidth="8" />

            {/* Foot Deck & Platform */}
            <path d="M 44 116 L 85 125 L 140 125 L 148 114" strokeWidth="10" />

            {/* Steering Column */}
            <line x1="43" y1="42" x2="41" y2="-4" strokeWidth="7" />

            {/* T-bar Handlebars */}
            <circle cx="41" cy="-7" r="5" fill="#05C147" />
            <line x1="30" y1="-7" x2="52" y2="-7" strokeWidth="7" />
          </g>
        </g>
      </svg>
    </div>
  );
};
