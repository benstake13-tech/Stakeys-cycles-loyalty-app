import React from 'react';
import { type AvatarConfig } from '../shared/types/avatar';
import { AvatarSVG } from './AvatarSVG';

export interface AvatarModelProps {
  config?: AvatarConfig | null;
  /** Rendered size in CSS pixels (the figure fills a square box). */
  size?: number;
  className?: string;
  title?: string;
  /** Accepted for API compatibility; the SVG renderer has no motion. */
  animate?: boolean;
}

/**
 * Public avatar renderer — the Stakeys SVG character. Used everywhere a
 * customer's avatar appears (profile, header, membership pass). Accepts an
 * optional `config`; when absent a default look is shown.
 */
export const AvatarModel: React.FC<AvatarModelProps> = ({
  config,
  size = 96,
  className,
  title = 'Avatar',
}) => (
  <div
    className={className}
    style={{ width: size, height: size }}
    role="img"
    aria-label={title}
    data-testid="avatar-model"
  >
    <AvatarSVG config={config} className="w-full h-full" />
  </div>
);

export default AvatarModel;
