import React from 'react';

/**
 * Ambient "OS" backdrop for the staff surface: a faint engineering grid plus
 * three slow colour blooms. Purely decorative and non-interactive — it is
 * `pointer-events: none` and only animates transform/opacity so it stays on the
 * compositor and never repaints the panels above it.
 */
export const AmbientBackdrop: React.FC = () => (
  <div className="os-backdrop" aria-hidden="true">
    <span className="os-bloom emerald" />
    <span className="os-bloom sky" />
    <span className="os-bloom amber" />
  </div>
);

export default AmbientBackdrop;
