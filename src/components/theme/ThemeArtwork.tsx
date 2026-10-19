import { useId } from 'react';
import type { WorldSpec } from './worldCatalog';
import { shopPhotoFor } from './shopPhotos';

/** Seasonal photographs keep their existing composition; the storefront sign is layered in dimensional SVG. */
export function ThemeArtwork({ world }: { world: WorldSpec }) {
  const uid = useId().replace(/:/g, '');
  const face = `shop-sign-face-${uid}`;
  const metal = `shop-sign-metal-${uid}`;
  const gloss = `shop-sign-gloss-${uid}`;
  const shadow = `shop-sign-shadow-${uid}`;
  return (
    <svg className="theme-artwork" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={face} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#315b43" />
          <stop offset="48%" stopColor="#163b29" />
          <stop offset="100%" stopColor="#092319" />
        </linearGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8e6a6" />
          <stop offset="28%" stopColor="#c7a45a" />
          <stop offset="72%" stopColor="#8b682d" />
          <stop offset="100%" stopColor="#f0d68c" />
        </linearGradient>
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".24" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity=".035" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".12" />
        </linearGradient>
        <filter id={shadow} x="-20%" y="-30%" width="140%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" />
          <feOffset dx="0" dy="10" />
          <feComponentTransfer><feFuncA type="linear" slope=".6" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <image href={shopPhotoFor(world.id)} width="1672" height="941" />
      <g className="theme-signage" filter={`url(#${shadow})`} transform="matrix(1 0.035 0 1 0 -30)">
        <path d="M733 83 L1419 83 L1440 96 L1440 161 L1419 174 L733 174 L712 161 L712 96 Z" fill="#071b12" opacity=".88" transform="translate(0 8)" />
        <path d="M733 78 L1419 78 L1440 91 L1440 156 L1419 169 L733 169 L712 156 L712 91 Z" fill={`url(#${metal})`} />
        <path d="M737 84 L1417 84 L1433 94 L1433 152 L1417 162 L737 162 L719 152 L719 94 Z" fill={`url(#${face})`} stroke="#f5df9c" strokeWidth="1.5" />
        <path d="M737 84 L1417 84 L1433 94 L1433 110 L719 110 L719 94 Z" fill={`url(#${gloss})`} />
        <path d="M751 91 L1407 91" stroke="#fff3c2" strokeOpacity=".36" strokeWidth="1.5" />
        <text className="theme-shop-sign" x="1076" y="137" textAnchor="middle" textLength="642" lengthAdjust="spacingAndGlyphs">STAKEY’S CYCLES</text>
        <path d="M756 153 L1399 153" stroke="#d8b45a" strokeOpacity=".8" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
