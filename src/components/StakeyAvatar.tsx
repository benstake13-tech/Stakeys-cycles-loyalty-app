/**
 * Virtual Stakey — the helper character.
 *
 * A single illustrated image (`/brand/stakeys-avatar.svg`) shown inside the
 * `.avatar-container` frame. Staff no longer build the character feature by
 * feature; they just name it and choose how it behaves. The `talking` prop
 * adds a subtle pulse while the helper speaks.
 */
import React from 'react';
import type { StakeyAvatarConfig } from '../shared/types/bikeShop';

export const STAKEY_AVATAR_SRC = '/brand/stakeys-avatar.svg';

export interface StakeyAvatarProps {
  config: StakeyAvatarConfig;
  size?: number;
  /** When true, run the talking animation (e.g. while speaking). */
  talking?: boolean;
  className?: string;
}

export function StakeyAvatar({ config, size = 120, talking = false, className }: StakeyAvatarProps) {
  return (
    <span className={`avatar-container ${className || ''}`} style={{ width: size, height: size }}>
      <img
        src={STAKEY_AVATAR_SRC}
        alt={`${config.name}, your helper`}
        className={`stakeys-avatar${talking ? ' stakeys-avatar--talking' : ''}`}
        draggable={false}
      />
    </span>
  );
}

