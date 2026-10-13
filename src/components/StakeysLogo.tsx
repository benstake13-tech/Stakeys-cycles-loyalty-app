import React, { useState } from 'react';
import { officialLogoUrl } from '../lib/imageStorage';

interface StakeysLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'shield' | 'full';
}

/** Shared branding across the customer and staff editions.
 * The approved logo file must exist in Supabase Storage at branding/official-logo.png.
 */
export const StakeysLogo: React.FC<StakeysLogoProps> = ({
  className = 'w-10 h-10',
  size,
  variant = 'shield',
}) => {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={style}>
      {failed ? (
        <span role="img" aria-label="Stakey's Cycles" className="text-emerald-500 text-center font-black text-[10px] leading-tight">STAKEY'S<br />CYCLES</span>
      ) : (
        <img
          src={officialLogoUrl()}
          alt="Stakey's Cycles official logo"
          className="w-full h-full object-contain drop-shadow-md"
          loading="eager"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};
