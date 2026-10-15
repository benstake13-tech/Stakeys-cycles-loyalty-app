import React from 'react';
import type { MilestoneKind } from '../utils/milestoneAnimations';
import './milestoneAnimations.css';

/** Transparent vector recreation of the uploaded capped, mint-green cyclist. */
export function MilestoneArtwork({ kind, animate = true }: { kind: MilestoneKind; animate?: boolean }) {
  return <svg viewBox="0 0 420 220" fill="none" aria-hidden="true" className={`stakeys-milestone-art ${animate ? 'is-playing' : ''}`} data-variant={kind}>
    <g className="milestone-cyclist" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="#05d76b" strokeWidth="3">
        {[104, 260].map(x => <g key={x} className="milestone-wheel" style={{ transformOrigin: `${x}px 156px` }}>
          <circle cx={x} cy="156" r="42"/><path d={`M${x-42} 156h84 M${x} 114v84 M${x-30} 126l60 60 M${x-30} 186l60-60`} strokeWidth="1" opacity=".45"/>
        </g>)}
        <path d="M104 156l46-81 40 81H104l116-67 40 67-30-89h15 M141 75h25" strokeWidth="4"/>
      </g>
      <path className="milestone-leg-back" d="M151 72l43 42-29 43" stroke="#098f58" strokeWidth="9"/>
      <path d="M149 72l17-41 22-24" stroke="#8affba" strokeWidth="14"/>
      <path d="M177 20l61 49 M149 72l52 10" stroke="#8affba" strokeWidth="8"/>
      <path className="milestone-leg" d="M201 82l-9 53h10" stroke="#8affba" strokeWidth="8"/>
      <circle cx="192" cy="0" r="14" fill="#8affba" transform="translate(0 0)"/>
      <path d="M178-5h34" stroke="#05d76b" strokeWidth="4"/>
    </g>
    <g className="milestone-result" stroke="#05d76b" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'garage' ? <><path d="M140 100l70-50 70 50v80H140z"/><path d="M165 180v-64h90v64 M170 135h80 M170 153h80" strokeWidth="3"/></> :
       kind === 'listing' ? <><path d="M150 65h95l35 50-70 65-60-60z"/><circle cx="175" cy="90" r="7"/><path d="M210 105v38m-19-19h38"/></> :
       kind === 'sale' ? <><circle cx="210" cy="115" r="62"/><path d="M178 116l23 23 43-49"/><path d="M140 60l-12-12m152 12 12-12"/></> :
       kind === 'reward' || kind === 'voucher' ? <><rect x="143" y="80" width="134" height="90" rx="12"/><path d="M210 80v90 M143 110h134 M210 80c-55-40-45-66-16-36l16 36c55-40 45-66 16-36z"/></> :
       kind === 'prize' ? <><path d="M175 55h70v45c0 50-70 50-70 0z M175 65h-25c0 40 12 45 30 45 M245 65h25c0 40-12 45-30 45 M210 137v35m-30 0h60"/></> :
       <><circle cx="210" cy="115" r="62" opacity=".25"/><path d="M170 115l28 28 52-58"/></>}
    </g>
  </svg>;
}
