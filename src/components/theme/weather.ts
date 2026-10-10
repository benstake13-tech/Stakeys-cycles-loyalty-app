/**
 * Per-theme atmospheric particle system.
 *
 * One flat array of particles is stepped per frame and drawn to a single canvas
 * with no per-particle shadow state except where a theme opts into glow. Each
 * particle carries its own colour so we never switch fill styles needlessly.
 */
import { TAU, pick, rand } from './sceneKit';
import type { SeasonalThemeId } from '../../utils/holidayCalendar';

export type ParticleKind =
  | 'snow'
  | 'leaf'
  | 'blossom'
  | 'ember'
  | 'heart'
  | 'petal'
  | 'rain'
  | 'candy'
  | 'balloon'
  | 'coin';

export interface WeatherSpec {
  kinds: ParticleKind[];
  colors: string[];
  count: number;
  glow: boolean;
  /** Vertical speed multiplier and drift, so themes feel different. */
  speed?: number;
  wind?: number;
}

export interface Particle {
  x: number;
  y: number;
  vy: number;
  vx: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  kind: ParticleKind;
  sway: number;
}

export const WEATHER: Record<Exclude<SeasonalThemeId, 'none'>, WeatherSpec> = {
  halloween: { kinds: ['leaf'], colors: ['#7c3aed', '#4c1d95', '#a16207', '#6b7280'], count: 46, glow: false, speed: 0.9 },
  christmas: { kinds: ['snow'], colors: ['#ffffff', '#e9f2ff', '#dbeafe'], count: 130, glow: false, speed: 1 },
  stpatricks: { kinds: ['leaf', 'coin'], colors: ['#22c55e', '#86efac', '#fbbf24'], count: 64, glow: true, speed: 0.85 },
  newyear: { kinds: ['ember'], colors: ['#fbbf24', '#f472b6', '#38bdf8', '#ffffff'], count: 70, glow: true, speed: 0.7 },
  valentines: { kinds: ['heart', 'petal'], colors: ['#fb7185', '#f472b6', '#f9a8d4', '#fecdd3'], count: 62, glow: false, speed: 0.8 },
  easter: { kinds: ['blossom'], colors: ['#f472b6', '#ffffff', '#fbcfe8', '#fff7ed'], count: 76, glow: false, speed: 0.85 },
  thanksgiving: { kinds: ['leaf'], colors: ['#d97706', '#b45309', '#f59e0b', '#92400e'], count: 70, glow: false, speed: 1.1 },
  cny: { kinds: ['ember'], colors: ['#ef4444', '#f59e0b', '#fbbf24', '#fca5a5'], count: 60, glow: true, speed: 0.7 },
  midautumn: { kinds: ['petal', 'ember'], colors: ['#fcd34d', '#fbbf24', '#fde68a'], count: 54, glow: true, speed: 0.75 },
  diwali: { kinds: ['ember'], colors: ['#fbbf24', '#f97316', '#fca5a5', '#fde68a'], count: 90, glow: true, speed: 0.6 },
  holi: { kinds: ['blossom', 'petal'], colors: ['#f472b6', '#a3e635', '#fbbf24', '#38bdf8', '#c084fc'], count: 96, glow: false, speed: 0.8 },
  eidfitr: { kinds: ['ember', 'petal'], colors: ['#fde68a', '#5eead4', '#a7f3d0'], count: 60, glow: true, speed: 0.7 },
  eidadha: { kinds: ['ember', 'petal'], colors: ['#fde68a', '#5eead4', '#a7f3d0'], count: 60, glow: true, speed: 0.7 },
  hanukkah: { kinds: ['snow', 'ember'], colors: ['#ffffff', '#dbeafe', '#fde68a', '#93c5fd'], count: 90, glow: true, speed: 0.95 },
  cincodemayo: { kinds: ['candy', 'balloon'], colors: ['#e11d48', '#22c55e', '#f59e0b', '#ffffff'], count: 58, glow: false, speed: 0.8 },
  spring: { kinds: ['blossom', 'petal'], colors: ['#f9a8d4', '#fbcfe8', '#fde68a', '#ffffff'], count: 74, glow: false, speed: 0.85 },
  summer: { kinds: ['petal', 'blossom'], colors: ['#fde68a', '#fef3c7', '#fca5a5', '#ffffff'], count: 52, glow: true, speed: 0.9 },
  autumn: { kinds: ['leaf'], colors: ['#d97706', '#b45309', '#f59e0b', '#92400e', '#a16207'], count: 78, glow: false, speed: 1.15 },
  winter: { kinds: ['snow'], colors: ['#ffffff', '#e0ecff', '#cfe0f6'], count: 120, glow: false, speed: 1 },
  mayday: { kinds: ['blossom', 'petal'], colors: ['#f9a8d4', '#fde68a', '#ffffff', '#a3e635'], count: 70, glow: false, speed: 0.85 },
  springbank: { kinds: ['leaf', 'blossom'], colors: ['#86efac', '#fde68a', '#ffffff'], count: 56, glow: false, speed: 0.9 },
  summerbank: { kinds: ['petal', 'balloon'], colors: ['#fca5a5', '#fde68a', '#38bdf8', '#ffffff'], count: 54, glow: false, speed: 0.9 },
  fathersday: { kinds: ['leaf'], colors: ['#38bdf8', '#0ea5e9', '#fde68a', '#e2e8f0'], count: 50, glow: false, speed: 0.9 },
  mothersday: { kinds: ['heart', 'petal'], colors: ['#fb7185', '#f9a8d4', '#fecdd3', '#fde68a'], count: 66, glow: false, speed: 0.8 },
  pancakes: { kinds: ['coin', 'ember'], colors: ['#f5a524', '#eab308', '#fbbf24'], count: 54, glow: true, speed: 0.8 },
  stgeorge: { kinds: ['petal', 'blossom'], colors: ['#ef4444', '#ffffff', '#fca5a5'], count: 60, glow: false, speed: 0.85 },
  aprilsfools: { kinds: ['candy', 'balloon'], colors: ['#a3e635', '#fbbf24', '#38bdf8', '#f472b6'], count: 72, glow: false, speed: 0.85 },
  earthday: { kinds: ['leaf', 'blossom'], colors: ['#22c55e', '#86efac', '#fde68a', '#38bdf8'], count: 66, glow: false, speed: 0.85 },
  backtoschool: { kinds: ['leaf'], colors: ['#d97706', '#b45309', '#f59e0b', '#c2410c'], count: 64, glow: false, speed: 1.05 },
  bonfirenight: { kinds: ['ember'], colors: ['#f97316', '#fbbf24', '#ef4444', '#ffffff'], count: 84, glow: true, speed: 0.7 },
  remembranceday: { kinds: ['petal'], colors: ['#dc2626', '#b91c1c', '#f87171'], count: 60, glow: false, speed: 0.75 },
  boxingday: { kinds: ['snow'], colors: ['#ffffff', '#e9f2ff', '#dbeafe'], count: 100, glow: false, speed: 0.95 },
  januarysales: { kinds: ['coin', 'snow'], colors: ['#fbbf24', '#facc15', '#ffffff', '#dbeafe'], count: 66, glow: true, speed: 0.85 },
  blackfriday: { kinds: ['coin', 'ember'], colors: ['#fbbf24', '#facc15', '#fde047', '#ffffff'], count: 76, glow: true, speed: 0.8 },
  cybermonday: { kinds: ['coin', 'ember'], colors: ['#22d3ee', '#38bdf8', '#67e8f9', '#ffffff'], count: 76, glow: true, speed: 0.8 },
  smallbusinesssaturday: { kinds: ['coin', 'leaf'], colors: ['#fbbf24', '#f59e0b', '#fde68a', '#86efac'], count: 60, glow: true, speed: 0.85 },
  ramadan: { kinds: ['ember', 'petal'], colors: ['#fbbf24', '#5eead4', '#fde68a'], count: 58, glow: true, speed: 0.7 },
  dussehra: { kinds: ['ember'], colors: ['#fbbf24', '#f97316', '#fca5a5', '#fde68a'], count: 80, glow: true, speed: 0.65 },
};

export function weatherFor(theme: string | undefined): WeatherSpec | null {
  if (!theme || theme === 'none') return null;
  return WEATHER[theme as Exclude<SeasonalThemeId, 'none'>] ?? null;
}

export function makeParticle(spec: WeatherSpec, w: number, h: number): Particle {
  const kind = pick(spec.kinds);
  const speed = spec.speed ?? 1;
  return {
    x: rand(-w * 0.2, w * 1.2),
    y: rand(-h * 0.2, h),
    vy: rand(0.6, 2.3) * speed * (kind === 'heart' ? 0.7 : 1),
    vx: rand(-0.5, 0.5),
    size: rand(4, 10),
    rot: rand(0, TAU),
    spin: rand(-0.06, 0.06),
    color: pick(spec.colors),
    kind,
    sway: rand(0.5, 1.8),
  };
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, spec: WeatherSpec) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  const s = p.size;
  if (spec.glow) {
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
  }
  switch (p.kind) {
    case 'snow':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.5, 0, TAU);
      ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.62, s * 0.3, 0, 0, TAU);
      ctx.fill();
      break;
    case 'blossom':
    case 'petal':
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(
          Math.cos((i / 5) * TAU) * s * 0.34,
          Math.sin((i / 5) * TAU) * s * 0.34,
          s * 0.32,
          s * 0.22,
          (i / 5) * TAU,
          0,
          TAU
        );
        ctx.fill();
      }
      break;
    case 'ember':
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.4, 0, TAU);
      ctx.fill();
      break;
    case 'heart': {
      const q = s * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, q);
      ctx.bezierCurveTo(q, 0, q * 1.6, -q, 0, -q * 1.6);
      ctx.bezierCurveTo(-q * 1.6, -q, -q, 0, 0, q);
      ctx.fill();
      break;
    }
    case 'rain':
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.6);
      ctx.lineTo(0, s * 0.6);
      ctx.stroke();
      break;
    case 'candy':
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(s * 0.5, 0);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = s * 0.3;
      ctx.stroke();
      break;
    case 'balloon':
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.4, s * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.5);
      ctx.lineTo(0, s * 0.9);
      ctx.stroke();
      break;
    case 'coin':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.42, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Advance one particle, wrapping it to the top when it leaves the screen. */
export function stepParticle(p: Particle, spec: WeatherSpec, w: number, h: number) {
  p.y += p.vy;
  p.x += p.vx + Math.sin(p.y * 0.02 + p.rot * 8) * 0.3 * p.sway;
  p.rot += p.spin;
  if (p.y > h + 30) Object.assign(p, makeParticle(spec, w, h), { y: -30 });
  else if (p.x < -40) p.x = w + 30;
  else if (p.x > w + 40) p.x = -30;
}
