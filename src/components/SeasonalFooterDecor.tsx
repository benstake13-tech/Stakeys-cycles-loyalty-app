import React from 'react';
import { themeDecorFor } from '../utils/themeDecor';

const TRAIL_COUNT = 14;
const SPOOK_SLOTS = ['s0', 's1'] as const;
const CRAWLER_SLOTS = ['c0', 'c1'] as const;

/**
 * Themed bottom-border decoration pinned to the bottom of the dashboard: carved
 * corner props, a repeating sweet/candy trail along the baseline, floating
 * spooks and dangling crawlers near the corners.
 *
 * The whole container is `pointer-events: none` and sits above dashboard content
 * via z-index, so every tile and button underneath stays 100% clickable.
 */
export const SeasonalFooterDecor: React.FC<{ theme?: string | null }> = ({ theme }) => {
  const decor = themeDecorFor(theme);
  if (!decor || !theme) return null;

  return (
    <div
      id="halloween-footer-decor"
      data-testid="seasonal-footer"
      className="seasonal-footer"
      aria-hidden="true"
    >
      <div className="seasonal-footer-trail">
        {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
          <span
            key={i}
            className="seasonal-footer-sweet"
            style={{ animationDelay: `${(i % 6) * -0.4}s` }}
          >
            {decor.trail[i % decor.trail.length]}
          </span>
        ))}
      </div>

      <span className="seasonal-footer-prop left">{decor.cornerProp}</span>
      <span className="seasonal-footer-prop right">{decor.cornerProp}</span>

      {decor.spooks.slice(0, 2).map((glyph, i) => (
        <span key={i} className={`seasonal-footer-spook ${SPOOK_SLOTS[i]}`}>
          {glyph}
        </span>
      ))}

      {decor.crawlers.slice(0, 2).map((glyph, i) => (
        <span key={i} className={`seasonal-footer-crawler ${CRAWLER_SLOTS[i]}`}>
          {glyph}
        </span>
      ))}
    </div>
  );
};
