import { useEffect, useRef } from 'react';
import type { WeatherKind } from '../../utils/weatherService';

/**
 * A small, self-contained animated sky for a single forecast day.
 *
 * Layers, back to front: sky gradient → sun/moon → drifting clouds →
 * precipitation → fog band → wind streaks → lightning → vignette. It renders
 * one static frame when the user prefers reduced motion, and scales its backing
 * store with the device pixel ratio (capped) so it stays crisp.
 */

interface SkyPalette {
  top: string;
  bottom: string;
  sun: string;
  sunGlow: string;
  cloud: string;
  cloudDark: string;
  precip: string;
  fog: string;
}

const DAY: SkyPalette = {
  top: '#2f80d8',
  bottom: '#bfe3f7',
  sun: '#fff3c4',
  sunGlow: 'rgba(255, 236, 160, 0.55)',
  cloud: 'rgba(255,255,255,0.95)',
  cloudDark: 'rgba(196,214,230,0.95)',
  precip: 'rgba(214,236,255,0.9)',
  fog: 'rgba(226,236,244,0.75)',
};

const NIGHT: SkyPalette = {
  top: '#0b1a33',
  bottom: '#274469',
  sun: '#e8eefc',
  sunGlow: 'rgba(200, 218, 255, 0.35)',
  cloud: 'rgba(150,170,200,0.6)',
  cloudDark: 'rgba(96,118,150,0.7)',
  precip: 'rgba(170,200,235,0.85)',
  fog: 'rgba(140,160,185,0.6)',
};

const GREY: SkyPalette = {
  top: '#5b6b7d',
  bottom: '#9aa8b6',
  sun: '#e7edf3',
  sunGlow: 'rgba(230, 238, 246, 0.28)',
  cloud: 'rgba(224,231,238,0.92)',
  cloudDark: 'rgba(150,163,178,0.95)',
  precip: 'rgba(206,222,236,0.9)',
  fog: 'rgba(196,207,218,0.8)',
};

const STORM: SkyPalette = {
  top: '#1f2733',
  bottom: '#4a5563',
  sun: '#aab6c4',
  sunGlow: 'rgba(170, 182, 196, 0.2)',
  cloud: 'rgba(150,160,175,0.9)',
  cloudDark: 'rgba(80,90,105,0.95)',
  precip: 'rgba(180,198,216,0.9)',
  fog: 'rgba(120,132,148,0.6)',
};

const SNOW_SKY: SkyPalette = {
  top: '#6d7f96',
  bottom: '#c3cfda',
  sun: '#eef3f9',
  sunGlow: 'rgba(238, 243, 249, 0.3)',
  cloud: 'rgba(240,245,250,0.95)',
  cloudDark: 'rgba(170,182,196,0.95)',
  precip: 'rgba(255,255,255,0.95)',
  fog: 'rgba(226,233,240,0.85)',
};

export function skyPaletteFor(kind: WeatherKind, isDay: boolean): SkyPalette {
  switch (kind) {
    case 'clear':
      return isDay ? DAY : NIGHT;
    case 'partly':
      return isDay ? { ...DAY, bottom: '#a9d4ef' } : { ...NIGHT, bottom: '#1d3355' };
    case 'cloudy':
    case 'overcast':
      return isDay ? GREY : { ...GREY, top: '#39424f', bottom: '#6b7787' };
    case 'fog':
      return isDay ? { ...GREY, bottom: '#c3ccd6' } : { ...GREY, top: '#4a545f' };
    case 'drizzle':
    case 'rain':
    case 'showers':
      return isDay ? { ...GREY, top: '#46525f', bottom: '#7d8b9a' } : STORM;
    case 'heavy_rain':
    case 'thunder':
      return STORM;
    case 'sleet':
    case 'snow':
      return SNOW_SKY;
    default:
      return isDay ? GREY : NIGHT;
  }
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  puffs: number;
}

interface Drop {
  x: number;
  y: number;
  v: number;
  len: number;
  drift: number;
}

interface Flake {
  x: number;
  y: number;
  v: number;
  r: number;
  sway: number;
  phase: number;
}

interface Streak {
  x: number;
  y: number;
  len: number;
  v: number;
  alpha: number;
}

const MAX_DPR = 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function precipitationFor(kind: WeatherKind): { drops: number; flakes: number } {
  switch (kind) {
    case 'drizzle':
      return { drops: 34, flakes: 0 };
    case 'rain':
    case 'showers':
      return { drops: 90, flakes: 0 };
    case 'heavy_rain':
      return { drops: 170, flakes: 0 };
    case 'thunder':
      return { drops: 150, flakes: 0 };
    case 'snow':
      return { drops: 0, flakes: 120 };
    case 'sleet':
      return { drops: 50, flakes: 60 };
    default:
      return { drops: 0, flakes: 0 };
  }
}

export const WeatherScene = ({
  kind,
  isDay = true,
  className = '',
  animate = true,
}: {
  kind: WeatherKind;
  isDay?: boolean;
  className?: string;
  animate?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kindRef = useRef<WeatherKind>(kind);
  const isDayRef = useRef<boolean>(isDay);

  useEffect(() => {
    kindRef.current = kind;
  }, [kind]);
  useEffect(() => {
    isDayRef.current = isDay;
  }, [isDay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const shouldAnimate = animate && !reduced;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let clouds: Cloud[] = [];
    let drops: Drop[] = [];
    let flakes: Flake[] = [];
    let streaks: Streak[] = [];
    let lastKind: WeatherKind | null = null;
    let flash = 0;
    let nextFlash = rand(1.5, 5);

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = Math.max(1, Math.floor(rect?.width || canvas.clientWidth || 300));
      h = Math.max(1, Math.floor(rect?.height || canvas.clientHeight || 160));
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build(kindRef.current);
    };

    const build = (k: WeatherKind) => {
      lastKind = k;
      const cloudCount =
        k === 'clear' ? 1 : k === 'partly' ? 3 : k === 'overcast' || k === 'heavy_rain' || k === 'thunder' ? 7 : 5;
      clouds = Array.from({ length: cloudCount }, () => ({
        x: rand(-w * 0.2, w * 1.1),
        y: rand(h * 0.08, h * 0.5),
        scale: rand(0.6, 1.5),
        speed: rand(0.06, 0.28) * (k === 'clear' ? 0.5 : 1),
        puffs: 3 + ((Math.random() * 3) | 0),
      }));

      const { drops: nDrops, flakes: nFlakes } = precipitationFor(k);
      drops = Array.from({ length: nDrops }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        v: rand(5, 10),
        len: rand(6, 14),
        drift: rand(-0.6, -1.6),
      }));
      flakes = Array.from({ length: nFlakes }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        v: rand(0.5, 1.6),
        r: rand(1.2, 2.8),
        sway: rand(0.3, 1.1),
        phase: rand(0, Math.PI * 2),
      }));
      streaks =
        k === 'clear' || k === 'partly'
          ? []
          : Array.from({ length: 8 }, () => ({
              x: rand(0, w),
              y: rand(0, h),
              len: rand(24, 70),
              v: rand(1.4, 3.2),
              alpha: rand(0.06, 0.16),
            }));
    };

    const drawSky = (p: SkyPalette) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, p.top);
      g.addColorStop(1, p.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const drawSun = (p: SkyPalette) => {
      const cx = w * 0.78;
      const cy = h * 0.24;
      const r = Math.min(w, h) * 0.11;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
      glow.addColorStop(0, p.sunGlow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.sun;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawCloud = (c: Cloud, p: SkyPalette, t: number) => {
      const x = ((c.x + t * c.speed * 18) % (w + 200)) - 100;
      const s = c.scale;
      const baseR = 16 * s;
      ctx.fillStyle = p.cloud;
      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 12;
      for (let i = 0; i < c.puffs; i++) {
        const px = x + i * baseR * 0.85;
        const py = c.y + Math.sin(i * 1.3) * 5 * s;
        const r = baseR * (1 - i * 0.08);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.cloudDark;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.ellipse(
        x + baseR * (c.puffs - 1) * 0.4,
        c.y + baseR * 0.7,
        baseR * (c.puffs * 0.8),
        baseR * 0.5,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawPrecip = (p: SkyPalette, dt: number) => {
      if (drops.length) {
        ctx.strokeStyle = p.precip;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (const d of drops) {
          if (shouldAnimate) {
            d.y += d.v * dt;
            d.x += d.drift * dt;
            if (d.y > h) {
              d.y = -d.len;
              d.x = rand(0, w);
            }
            if (d.x < 0) d.x += w;
          }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d.drift * 1.6, d.y + d.len);
        }
        ctx.stroke();
      }
      if (flakes.length) {
        ctx.fillStyle = p.precip;
        for (const f of flakes) {
          if (shouldAnimate) {
            f.y += f.v * dt;
            f.phase += 0.02;
            f.x += Math.sin(f.phase) * f.sway;
            if (f.y > h) {
              f.y = -4;
              f.x = rand(0, w);
            }
          }
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawFog = (p: SkyPalette) => {
      const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, p.fog);
      ctx.fillStyle = g;
      ctx.fillRect(0, h * 0.4, w, h * 0.6);
    };

    const drawStreaks = (dt: number) => {
      if (!streaks.length) return;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for (const s of streaks) {
        if (shouldAnimate) {
          s.x += s.v * dt * 3;
          if (s.x > w + s.len) {
            s.x = -s.len;
            s.y = rand(0, h);
          }
        }
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const drawVignette = () => {
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        Math.min(w, h) * 0.35,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    let last = 0;
    const frame = (ts: number) => {
      const dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;
      const t = ts / 1000;
      const k = kindRef.current;
      if (k !== lastKind) build(k);
      const p = skyPaletteFor(k, isDayRef.current);

      drawSky(p);
      drawSun(p);
      for (const c of clouds) drawCloud(c, p, t);
      drawPrecip(p, dt);
      drawStreaks(dt);

      if (k === 'fog' || k === 'overcast' || k === 'heavy_rain' || k === 'snow' || k === 'sleet') drawFog(p);

      if (k === 'thunder') {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = rand(2.5, 7);
        }
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
          ctx.fillRect(0, 0, w, h);
          flash = Math.max(0, flash - dt * 3.2);
        }
      }

      drawVignette();

      if (shouldAnimate) raf = requestAnimationFrame(frame);
    };

    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement);
    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [animate]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
