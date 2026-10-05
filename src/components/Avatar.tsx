import React from 'react';
import {
  AvatarConfig,
  DEFAULT_AVATAR,
  normalizeAvatar,
  skinHex,
  hairHex,
  topHex,
  backgroundHex,
} from '../shared/types/avatar';

/**
 * Bitmoji-style avatar renderer. Pure SVG built from an AvatarConfig, so it is
 * deterministic and identical across the customer and staff builds (and in
 * tests / server rendering) with no image assets to load.
 *
 * The canvas is a 120x120 viewBox; everything is positioned relative to a
 * bust centred on x=60.
 */
const HEAD_CX = 60;
const HEAD_CY = 54;

const HairBack: React.FC<{ a: AvatarConfig; color: string }> = ({ a, color }) => {
  switch (a.hairStyle) {
    case 'afro':
      return <circle cx={HEAD_CX} cy={HEAD_CY - 6} r={30} fill={color} />;
    case 'long':
      return <path d={`M34 52 q-4 40 4 52 h44 q8-12 4-52 z`} fill={color} />;
    case 'bob':
      return <path d={`M34 54 q-2 30 6 34 h40 q8-4 6-34 z`} fill={color} />;
    case 'ponytail':
      return (
        <>
          <path d={`M78 44 q22 6 20 34 q-2 14-12 16 q6-24-8-40 z`} fill={color} />
          <circle cx={92} cy={74} r={7} fill={color} />
        </>
      );
    case 'bun':
      return <circle cx={HEAD_CX} cy={26} r={10} fill={color} />;
    default:
      return null;
  }
};

const HairFront: React.FC<{ a: AvatarConfig; color: string }> = ({ a, color }) => {
  switch (a.hairStyle) {
    case 'bald':
      return null;
    case 'buzz':
      return <path d={`M38 46 q0-24 22-24 q22 0 22 24 q-10-12-22-12 q-12 0-22 12 z`} fill={color} />;
    case 'fade':
      return (
        <>
          <path d={`M39 40 q3-20 21-20 q18 0 21 20 q-8-10-21-10 q-13 0-21 10 z`} fill={color} />
          <path d={`M39 44 q-2 6 0 10 M81 44 q2 6 0 10`} stroke={color} strokeWidth={2} opacity={0.35} fill="none" />
        </>
      );
    case 'curly':
      return (
        <g fill={color}>
          {[
            [44, 34],
            [54, 28],
            [66, 28],
            [76, 34],
            [40, 42],
            [80, 42],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={9} />
          ))}
        </g>
      );
    case 'afro':
      return null;
    case 'mohawk':
      return (
        <g fill={color}>
          <path d={`M56 30 q4-20 8 0 q-4-6-8 0 z`} />
          <rect x={56} y={8} width={8} height={26} rx={4} />
        </g>
      );
    case 'bun':
      return <path d={`M38 46 q0-24 22-24 q22 0 22 24 q-10-12-22-12 q-12 0-22 12 z`} fill={color} />;
    case 'ponytail':
      return <path d={`M38 46 q0-24 22-24 q22 0 22 24 q-10-12-22-12 q-12 0-22 12 z`} fill={color} />;
    case 'long':
    case 'bob':
      return <path d={`M37 48 q0-26 23-26 q23 0 23 26 q-9-14-23-14 q-14 0-23 14 z`} fill={color} />;
    case 'short':
    default:
      return <path d={`M38 46 q0-25 22-25 q22 0 22 25 q-9-13-22-13 q-13 0-22 13 z`} fill={color} />;
  }
};

const Eyes: React.FC<{ a: AvatarConfig }> = ({ a }) => {
  const lx = 51;
  const rx = 69;
  const y = 52;
  const ink = '#2B2B2B';
  const arc = (x: number) => (
    <path d={`M${x - 4} ${y + 1} q4 -5 8 0`} stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />
  );
  const dot = (x: number) => <circle cx={x} cy={y} r={2.6} fill={ink} />;
  const line = (x: number) => (
    <path d={`M${x - 4} ${y} h8`} stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />
  );

  switch (a.eyes) {
    case 'wide':
      return (
        <g>
          <circle cx={lx} cy={y} r={4.5} fill="#fff" stroke={ink} strokeWidth={1.4} />
          <circle cx={rx} cy={y} r={4.5} fill="#fff" stroke={ink} strokeWidth={1.4} />
          {dot(lx)}
          {dot(rx)}
        </g>
      );
    case 'sleepy':
      return (
        <g>
          {line(lx)}
          {line(rx)}
        </g>
      );
    case 'wink':
      return (
        <g>
          {arc(lx)}
          {dot(rx)}
        </g>
      );
    case 'happy':
    default:
      return (
        <g>
          {arc(lx)}
          {arc(rx)}
        </g>
      );
  }
};

const Mouth: React.FC<{ a: AvatarConfig }> = ({ a }) => {
  const ink = '#7A3B3B';
  const y = 66;
  switch (a.mouth) {
    case 'grin':
      return (
        <g>
          <path d={`M52 ${y} q8 9 16 0 z`} fill="#fff" stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      );
    case 'neutral':
      return <path d={`M53 ${y + 1} h14`} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />;
    case 'smirk':
      return (
        <path d={`M52 ${y} q9 6 16-2`} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
      );
    case 'open':
      return <ellipse cx={60} cy={y + 2} rx={5} ry={6} fill={ink} />;
    case 'smile':
    default:
      return (
        <path d={`M52 ${y} q8 7 16 0`} stroke={ink} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      );
  }
};

const FacialHair: React.FC<{ a: AvatarConfig; color: string }> = ({ a, color }) => {
  switch (a.facialHair) {
    case 'stubble':
      return <path d={`M44 58 q16 26 32 0 q-2 18-16 20 q-14-2-16-20 z`} fill={color} opacity={0.28} />;
    case 'moustache':
      return <path d={`M51 61 q9 -4 18 0 q-9 4 -18 0 z`} fill={color} />;
    case 'goatee':
      return (
        <>
          <path d={`M52 61 q8 -3 16 0 q-8 3 -16 0 z`} fill={color} />
          <path d={`M53 70 q7 9 14 0 q-7 5 -14 0 z`} fill={color} />
        </>
      );
    case 'full_beard':
      return <path d={`M43 56 q3 34 17 34 q14 0 17-34 q-6 14-17 14 q-11 0-17-14 z`} fill={color} />;
    case 'none':
    default:
      return null;
  }
};

const Glasses: React.FC<{ a: AvatarConfig }> = ({ a }) => {
  const lx = 51;
  const rx = 69;
  const y = 52;
  if (a.glasses === 'none') return null;
  if (a.glasses === 'sunglasses') {
    return (
      <g>
        <rect x={lx - 8} y={y - 5} width={16} height={10} rx={4} fill="#1C1C1E" />
        <rect x={rx - 8} y={y - 5} width={16} height={10} rx={4} fill="#1C1C1E" />
        <path d={`M${lx + 8} ${y} h${rx - lx - 16}`} stroke="#1C1C1E" strokeWidth={2} />
      </g>
    );
  }
  if (a.glasses === 'sport') {
    return (
      <g>
        <path d={`M${lx - 9} ${y - 3} q9 -4 18 0 q-2 8 -9 8 q-7 0 -9 -8 z`} fill="#7DD3FC" opacity={0.55} stroke="#334155" strokeWidth={1.6} />
        <path d={`M${rx - 9} ${y - 3} q9 -4 18 0 q-2 8 -9 8 q-7 0 -9 -8 z`} fill="#7DD3FC" opacity={0.55} stroke="#334155" strokeWidth={1.6} />
      </g>
    );
  }
  const frame = '#334155';
  if (a.glasses === 'square') {
    return (
      <g stroke={frame} strokeWidth={1.8} fill="rgba(255,255,255,0.35)">
        <rect x={lx - 8} y={y - 6} width={16} height={12} rx={2} />
        <rect x={rx - 8} y={y - 6} width={16} height={12} rx={2} />
        <path d={`M${lx + 8} ${y - 2} h${rx - lx - 16}`} fill="none" />
      </g>
    );
  }
  // round
  return (
    <g stroke={frame} strokeWidth={1.8} fill="rgba(255,255,255,0.35)">
      <circle cx={lx} cy={y} r={8} />
      <circle cx={rx} cy={y} r={8} />
      <path d={`M${lx + 8} ${y - 2} h${rx - lx - 16}`} fill="none" />
    </g>
  );
};

const Headwear: React.FC<{ a: AvatarConfig; color: string }> = ({ a, color }) => {
  switch (a.headwear) {
    case 'cap':
      return (
        <g fill={color}>
          <path d={`M37 42 q0-24 23-24 q23 0 23 24 q-23-8-46 0 z`} />
          <path d={`M83 40 q16 1 16 8 q-8 2-18-2 z`} />
        </g>
      );
    case 'helmet':
      return (
        <g>
          <path d={`M36 44 q0-28 24-28 q24 0 24 28 q-24-10-48 0 z`} fill={color} />
          <path d={`M36 44 q24-10 48 0`} stroke="rgba(255,255,255,0.5)" strokeWidth={2} fill="none" />
          <path d={`M40 50 q-4 10 2 16`} stroke={color} strokeWidth={3} fill="none" />
          <path d={`M80 50 q4 10-2 16`} stroke={color} strokeWidth={3} fill="none" />
        </g>
      );
    case 'beanie':
      return (
        <g fill={color}>
          <path d={`M36 46 q0-30 24-30 q24 0 24 30 q-24-8-48 0 z`} />
          <rect x={36} y={42} width={48} height={8} rx={4} fill="rgba(255,255,255,0.25)" />
        </g>
      );
    case 'visor':
      return (
        <g fill={color}>
          <path d={`M37 34 q23-14 46 0 q-23-6-46 0 z`} />
          <path d={`M83 32 q14 1 15 7 q-8 2-17-2 z`} />
        </g>
      );
    case 'none':
    default:
      return null;
  }
};

export interface AvatarProps {
  config?: AvatarConfig | null;
  size?: number;
  className?: string;
  title?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ config, size = 96, className, title }) => {
  const a = config ? normalizeAvatar(config) : DEFAULT_AVATAR;
  const skin = skinHex(a.skinTone);
  const hair = hairHex(a.hairColor);
  const top = topHex(a.topColor);
  const bg = backgroundHex(a.background);

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title || 'Rider avatar'}
      data-testid="rider-avatar"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id={`av-clip-${a.skinTone}-${a.hairStyle}-${size}`}>
          <rect x="0" y="0" width="120" height="120" rx="60" />
        </clipPath>
      </defs>
      <g clipPath={`url(#av-clip-${a.skinTone}-${a.hairStyle}-${size})`}>
        <rect x="0" y="0" width="120" height="120" fill={bg} />

        {/* Torso / jersey */}
        <path d={`M18 120 q6-30 42-30 q36 0 42 30 z`} fill={top} />
        <path d={`M60 90 q-6 0-6 6 v24 h12 v-24 q0-6-6-6 z`} fill="rgba(255,255,255,0.14)" />

        {/* Neck */}
        <rect x={52} y={72} width={16} height={16} rx={5} fill={skin} />
        <path d={`M52 80 q8 8 16 0 v-8 h-16 z`} fill="rgba(0,0,0,0.08)" />

        <HairBack a={a} color={hair} />

        {/* Head */}
        <ellipse cx={HEAD_CX} cy={HEAD_CY} rx={22} ry={25} fill={skin} />
        <ellipse cx={38} cy={56} rx={4} ry={5} fill={skin} />
        <ellipse cx={82} cy={56} rx={4} ry={5} fill={skin} />

        <HairFront a={a} color={hair} />

        {/* Brows */}
        <path d={`M46 45 q5-3 10 0`} stroke={hair} strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d={`M64 45 q5-3 10 0`} stroke={hair} strokeWidth={2} fill="none" strokeLinecap="round" />

        <Eyes a={a} />
        <path d={`M60 55 q2 4-1 6 q1 1 3 1`} stroke="rgba(0,0,0,0.25)" strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <Mouth a={a} />
        <FacialHair a={a} color={hair} />
        <Glasses a={a} />
        <Headwear a={a} color={topHex(a.headwearColor)} />

        {/* Jersey number */}
        {a.jerseyNumber ? (
          <text
            x={60}
            y={112}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="rgba(255,255,255,0.9)"
            fontFamily="monospace"
          >
            {a.jerseyNumber}
          </text>
        ) : null}
      </g>
    </svg>
  );
};

export default Avatar;
