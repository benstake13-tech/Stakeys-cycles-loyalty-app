import React, { useEffect, useMemo, useRef, useState } from 'react';
import { themeDecorFor, decorDismissKey } from '../utils/themeDecor';

/** How long the close animation runs before the banner unmounts. */
const CLOSE_MS = 460;
/** How long the click feedback shake lasts. */
const SHAKE_MS = 500;
/** Peak swing angle (degrees) and one full back-and-forth period (ms). */
const SWING_DEG = 4.2;
const SWING_PERIOD_MS = 4200;

const WEB_SLOTS = ['tl', 'tr', 'bl', 'br'] as const;
const FLYER_SLOTS = ['f0', 'f1', 'f2', 'f3'] as const;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The pendulum angle (degrees) at `elapsedMs` into the animation. Pure so the
 * motion is unit-testable without a real rAF clock; the component feeds it the
 * rAF timestamp. `paused` (pointer over the sign) parks it upright.
 */
export const swingAngle = (elapsedMs: number, paused = false): number =>
  paused ? 0 : Math.sin((elapsedMs / SWING_PERIOD_MS) * Math.PI * 2) * SWING_DEG;

/**
 * Two hanging chains drawn from a single point at the top-centre down to the two
 * top corners of the sign. Drawn in SVG (not CSS) so the whole swing is a React
 * transform — no keyframes, and the geometry stays crisp at any width.
 */
const Chains: React.FC = () => (
  <svg className="seasonal-banner-chains" viewBox="0 0 520 78" preserveAspectRatio="none" aria-hidden="true">
    {[
      'M260 0 C 240 30, 132 40, 96 74',
      'M260 0 C 280 30, 388 40, 424 74',
    ].map((d, i) => (
      <g key={i}>
        <path d={d} fill="none" stroke="#2a2f3a" strokeWidth="5" strokeLinecap="round" />
        <path d={d} fill="none" stroke="#c3cad6" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
      </g>
    ))}
    <circle cx="260" cy="3" r="6" fill="#c3cad6" stroke="#2a2f3a" strokeWidth="2" />
  </svg>
);

/**
 * Ambient particle layer for the sign: flyers drift (and flap) across the banner
 * area, fully React-driven via requestAnimationFrame. Non-interactive.
 */
const AmbientCanvas: React.FC<{ glyphs: string[] }> = ({ glyphs }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const glyphRef = useRef(glyphs);
  glyphRef.current = glyphs;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = prefersReducedMotion();

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const dprCap = 1.5;

    interface Flyer { x: number; y: number; vx: number; vy: number; s: number; p: number; g: string }
    let flyers: Flyer[] = [];

    const spawn = (): Flyer => ({
      x: Math.random() * w,
      y: 20 + Math.random() * Math.max(1, h - 70),
      vx: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.5),
      vy: (Math.random() - 0.5) * 0.25,
      s: 16 + Math.random() * 12,
      p: Math.random() * Math.PI * 2,
      g: glyphRef.current[Math.floor(Math.random() * glyphRef.current.length)] || '🦇',
    });

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(3, Math.min(6, Math.round(w / 200)));
      flyers = Array.from({ length: count }, spawn);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const f of flyers) {
        if (!reduced) {
          f.x += f.vx;
          f.y += f.vy;
          f.p += 0.09;
          if (f.x < -40) f.x = w + 40;
          if (f.x > w + 40) f.x = -40;
          if (f.y < 10) f.y = 10;
          if (f.y > h - 30) f.y = h - 30;
        }
        const flap = Math.sin(f.p) * 0.35;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(flap);
        ctx.font = `${f.s}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.85;
        ctx.fillText(f.g, 0, 0);
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="seasonal-banner-canvas" aria-hidden="true" />;
};

/**
 * Graphical, swinging seasonal banner shown at the very top of EVERY surface.
 *
 * The pendulum is driven in React (a rAF loop writing `rotate(...)` to the sign),
 * not by CSS keyframes: it pauses while the pointer is over the sign and
 * respects `prefers-reduced-motion`. The wrapper is `pointer-events: none` so the
 * empty space around the sign never blocks page clicks — only the sign is
 * interactive. Dismissal is remembered per theme.
 */
export const SeasonalHeroBanner: React.FC<{ theme?: string | null }> = ({ theme }) => {
  const decor = themeDecorFor(theme);
  const [dismissed, setDismissed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [shaking, setShaking] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signRef = useRef<HTMLDivElement | null>(null);
  const hoverRef = useRef(false);

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

  // React-driven pendulum: one rAF loop, paused on hover / reduced-motion.
  useEffect(() => {
    if (!decor || dismissed || prefersReducedMotion()) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const sign = signRef.current;
      if (sign) {
        sign.style.transform = `rotate(${swingAngle(now - start, hoverRef.current).toFixed(3)}deg)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [decor, dismissed]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    []
  );

  const flyerGlyphs = useMemo(() => (decor ? Array.from(new Set(decor.flyers)) : []), [decor]);

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
      className={`seasonal-banner${closing ? ' is-closing' : ''}`}
      data-testid="seasonal-hero"
    >
      <div className="seasonal-banner-inner">
        <AmbientCanvas glyphs={flyerGlyphs} />
        <Chains />

        <div
          id="halloween-hero-banner"
          data-testid="seasonal-hero-sign"
          ref={signRef}
          className={`seasonal-banner-sign${shaking ? ' is-shaking' : ''}`}
          role="region"
          aria-label={decor.label}
          title="Tap the sign!"
          onPointerEnter={() => {
            hoverRef.current = true;
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
          }}
        >
          <div className="seasonal-banner-face" onClick={wobble}>
            {WEB_SLOTS.map((slot) => (
              <span key={slot} className={`seasonal-banner-web ${slot}`} aria-hidden="true">
                {decor.web}
              </span>
            ))}

            {decor.flyers.slice(0, 4).map((glyph, i) => (
              <span key={i} className={`seasonal-banner-flyer ${FLYER_SLOTS[i]}`} aria-hidden="true">
                {glyph}
              </span>
            ))}

            <h2 className="seasonal-banner-heading">{decor.heading}</h2>
            <p className="seasonal-banner-subtext">{decor.subtext}</p>

            <button
              type="button"
              className="seasonal-banner-close"
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
