import React, { useEffect, useRef, useState } from 'react';
import { themeDecorFor, decorDismissKey } from '../utils/themeDecor';

/** How long the close animation runs before the banner unmounts. */
const CLOSE_MS = 460;
/** How long the click feedback shake lasts. */
const SHAKE_MS = 500;

const WEB_SLOTS = ['tl', 'tr', 'bl', 'br'] as const;
const FLYER_SLOTS = ['f0', 'f1', 'f2', 'f3'] as const;

/**
 * Swinging, dismissible seasonal hero banner. Renders only when the active
 * theme has decor (see `themeDecorFor`); the surrounding wrapper is
 * `pointer-events: none` so the empty space never blocks dashboard clicks — only
 * the sign itself is interactive.
 *
 * Dismissal is remembered per theme in localStorage, so closing Halloween does
 * not suppress Christmas.
 */
export const SeasonalHeroBanner: React.FC<{ theme?: string | null }> = ({ theme }) => {
  const decor = themeDecorFor(theme);
  const [dismissed, setDismissed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [shaking, setShaking] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-check the stored dismissal whenever the active theme changes.
  useEffect(() => {
    setClosing(false);
    if (!theme) {
      setDismissed(false);
      return;
    }
    let stored = false;
    try {
      stored = localStorage.getItem(decorDismissKey(theme)) === '1';
    } catch {
      /* no storage (SSR/tests) */
    }
    setDismissed(stored);
  }, [theme]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    []
  );

  if (!decor || !theme || dismissed) return null;

  const close = () => {
    setClosing(true);
    try {
      localStorage.setItem(decorDismissKey(theme), '1');
    } catch {
      /* ignore */
    }
    // Collapse the layout height, then unmount so nothing lingers.
    closeTimer.current = setTimeout(() => setDismissed(true), CLOSE_MS);
  };

  const wobble = () => {
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), SHAKE_MS);
  };

  return (
    <div
      className={`seasonal-hero${closing ? ' is-closing' : ''}`}
      data-testid="seasonal-hero"
    >
      <div className="seasonal-hero-inner">
        <span className="chain-left" aria-hidden="true" />
        <span className="chain-right" aria-hidden="true" />

        <div
          id="halloween-hero-banner"
          data-testid="seasonal-hero-sign"
          className={`seasonal-hero-sign${shaking ? ' is-shaking' : ''}`}
          role="region"
          aria-label={decor.label}
          title="Tap the sign!"
        >
          <div className="sign-face" onClick={wobble}>
            {WEB_SLOTS.map((slot) => (
              <span key={slot} className={`seasonal-hero-web ${slot}`} aria-hidden="true">
                {decor.web}
              </span>
            ))}

            {decor.flyers.slice(0, 4).map((glyph, i) => (
              <span key={i} className={`seasonal-hero-flyer ${FLYER_SLOTS[i]}`} aria-hidden="true">
                {glyph}
              </span>
            ))}

            <h2 className="sign-heading">{decor.heading}</h2>
            <p className="sign-subtext">{decor.subtext}</p>

            <button
              type="button"
              className="seasonal-hero-close"
              data-testid="seasonal-hero-close"
              aria-label="Dismiss banner"
              title="Dismiss banner"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
