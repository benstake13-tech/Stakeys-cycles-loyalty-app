import { useEffect, useRef } from 'react';

/**
 * Seasonal atmosphere + mischief layer.
 *
 * A full-screen, non-interactive canvas that gives every season a real sense of
 * place — a tinted sky, a ground line, a parallax backdrop (snow-covered houses,
 * gravestones, spring hills…) and drifting weather — then populates it with a
 * cast of cheeky characters who ride bicycles across the scene pulling wheelies,
 * skidding out, tumbling off and laughing at each other, and hurling snowballs,
 * hearts, eggs and firecrackers.
 *
 * The theme comes from the shared Supabase setting, so every account sees the
 * same world. All art is vector-drawn at runtime — there are no image assets.
 */

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface CharSpec {
  kind: string;
  body: string;
  accent: string;
  hat?: string;
  skin?: string;
}

interface ProjectileSpec {
  kind: 'snowball' | 'heart' | 'egg' | 'firecracker' | 'pie';
  color: string;
}

interface SeasonConfig {
  label: string;
  sky: [string, string, string?];
  ground: string; // fill for the ground band
  groundLine: string; // the horizon stroke
  backdrop: 'haunted' | 'snow' | 'spring' | 'lantern' | 'rose';
  weather: ('snow' | 'leaf' | 'blossom' | 'ember' | 'heart' | 'petal')[];
  weatherColors: string[];
  weatherCount: number;
  chars: CharSpec[];
  cast: CharSpec[];
  projectile: ProjectileSpec;
  laughter: string;
}

type SeasonKey = 'halloween' | 'christmas' | 'easter' | 'cny' | 'valentines';

// --- Season configuration -----------------------------------------------------
const SEASONS: Record<SeasonKey, SeasonConfig> = {
  halloween: {
    label: 'Halloween',
    sky: ['#1a0f2e', '#2d1b4e', '#4a2560'],
    ground: '#241033',
    groundLine: '#7c3aed',
    backdrop: 'haunted',
    weather: ['leaf'],
    weatherColors: ['#f59e0b', '#a855f7', '#84cc16', '#f97316'],
    weatherCount: 22,
    chars: [
      { kind: 'witch', body: '#2b1b4d', accent: '#7c3aed', hat: '#3b0764', skin: '#f0c8a0' },
      { kind: 'ghost', body: '#e9e4f5', accent: '#c4b5fd', skin: '#e9e4f5' },
      { kind: 'pumpkin', body: '#f97316', accent: '#166534', skin: '#f97316' },
    ],
    cast: [
      { kind: 'witch', body: '#2b1b4d', accent: '#7c3aed', hat: '#3b0764', skin: '#f0c8a0' },
      { kind: 'ghost', body: '#e9e4f5', accent: '#c4b5fd', skin: '#e9e4f5' },
    ],
    projectile: { kind: 'pie', color: '#e2e8f0' },
    laughter: '#c4b5fd',
  },
  christmas: {
    label: 'Christmas',
    sky: ['#0b1a33', '#16324f', '#2b5876'],
    ground: '#eef4ff',
    groundLine: '#c7d7f0',
    backdrop: 'snow',
    weather: ['snow'],
    weatherColors: ['#ffffff', '#e9f2ff', '#dbeafe'],
    weatherCount: 60,
    chars: [
      { kind: 'santa', body: '#dc2626', accent: '#ffffff', hat: '#dc2626', skin: '#f6c9a0' },
      { kind: 'elf', body: '#16a34a', accent: '#facc15', hat: '#16a34a', skin: '#f6c9a0' },
      { kind: 'snowman', body: '#f8fafc', accent: '#f97316', skin: '#f8fafc' },
    ],
    cast: [
      { kind: 'elf', body: '#16a34a', accent: '#facc15', hat: '#16a34a', skin: '#f6c9a0' },
      { kind: 'snowman', body: '#f8fafc', accent: '#f97316', skin: '#f8fafc' },
      { kind: 'elf2', body: '#b91c1c', accent: '#facc15', hat: '#b91c1c', skin: '#f6c9a0' },
    ],
    projectile: { kind: 'snowball', color: '#ffffff' },
    laughter: '#ffffff',
  },
  easter: {
    label: 'Easter',
    sky: ['#bfe6ff', '#dff2ff', '#fde8f4'],
    ground: '#7bc96f',
    groundLine: '#4f9e46',
    backdrop: 'spring',
    weather: ['blossom'],
    weatherColors: ['#f472b6', '#ffffff', '#fbcfe8', '#fff7ed'],
    weatherCount: 34,
    chars: [
      { kind: 'bunny', body: '#fdf2f8', accent: '#f472b6', hat: '#f9a8d4', skin: '#fdf2f8' },
      { kind: 'chick', body: '#facc15', accent: '#fb923c', skin: '#facc15' },
      { kind: 'lamb', body: '#f8fafc', accent: '#a3a3a3', skin: '#f8fafc' },
    ],
    cast: [
      { kind: 'bunny', body: '#fdf2f8', accent: '#f472b6', hat: '#f9a8d4', skin: '#fdf2f8' },
      { kind: 'chick', body: '#facc15', accent: '#fb923c', skin: '#facc15' },
    ],
    projectile: { kind: 'egg', color: '#f472b6' },
    laughter: '#fb7185',
  },
  cny: {
    label: 'Chinese New Year',
    sky: ['#3b0d0d', '#7a1f1f', '#b91c1c'],
    ground: '#3b0d0d',
    groundLine: '#f59e0b',
    backdrop: 'lantern',
    weather: ['ember'],
    weatherColors: ['#ef4444', '#f59e0b', '#fbbf24', '#fca5a5'],
    weatherCount: 30,
    chars: [
      { kind: 'dragon', body: '#dc2626', accent: '#f59e0b', hat: '#b91c1c', skin: '#dc2626' },
      { kind: 'panda', body: '#f8fafc', accent: '#111827', skin: '#f8fafc' },
    ],
    cast: [
      { kind: 'dragon', body: '#dc2626', accent: '#f59e0b', hat: '#b91c1c', skin: '#dc2626' },
      { kind: 'panda', body: '#f8fafc', accent: '#111827', skin: '#f8fafc' },
    ],
    projectile: { kind: 'firecracker', color: '#ef4444' },
    laughter: '#fbbf24',
  },
  valentines: {
    label: "Valentine's Day",
    sky: ['#4a1230', '#7a1f4a', '#b03060'],
    ground: '#3d1029',
    groundLine: '#fb7185',
    backdrop: 'rose',
    weather: ['heart', 'petal'],
    weatherColors: ['#fb7185', '#f472b6', '#f9a8d4', '#fecdd3'],
    weatherCount: 34,
    chars: [
      { kind: 'cupid', body: '#fda4af', accent: '#be123c', hat: '#fb7185', skin: '#f6c9a0' },
      { kind: 'bear', body: '#c084fc', accent: '#fb7185', skin: '#c084fc' },
    ],
    cast: [
      { kind: 'cupid', body: '#fda4af', accent: '#be123c', hat: '#fb7185', skin: '#f6c9a0' },
      { kind: 'bear', body: '#c084fc', accent: '#fb7185', skin: '#c084fc' },
    ],
    projectile: { kind: 'heart', color: '#fb7185' },
    laughter: '#fda4af',
  },
};

// --- Maths helpers ------------------------------------------------------------
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// --- Drawing helpers ----------------------------------------------------------
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, r * 0.09);
  ctx.strokeStyle = 'rgba(148,163,184,0.65)';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos((i / 6) * TAU) * r, Math.sin((i / 6) * TAU) * r);
    ctx.stroke();
  }
  ctx.restore();
}

/** The bicycle frame, drawn around origin with wheels at +/- wheelBase. */
function bike(ctx: CanvasRenderingContext2D, s: number, spin: number, cheeky: boolean) {
  const wb = 26 * s;
  const r = 12 * s;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 5;
  wheel(ctx, -wb, 0, r, spin);
  wheel(ctx, wb, 0, r, spin);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-wb, 0);
  ctx.lineTo(-2 * s, -16 * s);
  ctx.lineTo(10 * s, -16 * s);
  ctx.lineTo(wb, 0);
  ctx.moveTo(-2 * s, -16 * s);
  ctx.lineTo(4 * s, 0);
  ctx.lineTo(-wb, 0);
  ctx.moveTo(10 * s, -16 * s);
  ctx.lineTo(14 * s, -26 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9 * s, -27 * s);
  ctx.lineTo(19 * s, -27 * s + (cheeky ? -3 * s : 0));
  ctx.stroke();
  ctx.restore();
}

function bell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(x, y, 3.5, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A cheeky open-mouthed laugh, used while characters jeer at each other. */
function laughFace(ctx: CanvasRenderingContext2D, headY: number, strength: number) {
  if (strength <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(strength, 0, 1);
  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(2, headY - 2, 1.5, 0, TAU); // eye
  ctx.fill();
  ctx.beginPath(); // wide laughing mouth
  ctx.arc(2, headY + 2, 4.5, 0.05, Math.PI - 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Character drawing --------------------------------------------------------
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  spec: CharSpec,
  t: number,
  laugh: number
) {
  const { kind, body, accent, hat, skin } = spec;
  const squat = Math.sin(t * 9) * 1.2;

  if (kind === 'witch' || kind === 'dragon' || kind === 'santa') {
    const glow = ctx.createRadialGradient(8, -34, 2, 8, -34, 52);
    glow.addColorStop(
      0,
      kind === 'dragon' ? 'rgba(239,68,68,0.45)' : 'rgba(251,191,36,0.4)'
    );
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(8, -34, 52, 0, TAU);
    ctx.fill();
  }

  // Body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -18 + squat, 9, 12, 0, 0, TAU);
  ctx.fill();

  // Arm gripping the bars
  ctx.strokeStyle = body;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(3, -20 + squat);
  ctx.lineTo(15, -25);
  ctx.stroke();

  // Legs pedalling
  const ped = Math.sin(t * 12) * 6;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-1, -8 + squat);
  ctx.lineTo(ped, 2);
  ctx.stroke();

  const headY = -34 + squat;

  if (kind === 'ghost') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, headY, 10, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, headY + 6);
    for (let i = 0; i <= 6; i++) {
      const x = -10 + (i / 6) * 20;
      ctx.lineTo(x, headY + 16 + Math.sin(t * 8 + i) * 3);
    }
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(-3, headY - 1, 1.6, 0, TAU);
    ctx.arc(3, headY - 1, 1.6, 0, TAU);
    ctx.fill();
    return;
  }

  // Head
  ctx.fillStyle = skin || '#f6c9a0';
  ctx.beginPath();
  ctx.arc(0, headY, 8, 0, TAU);
  ctx.fill();

  // Mouth: grin by default, big laugh when jeering.
  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(2, headY + 2, 4, 0.1, Math.PI - 0.3);
  ctx.stroke();
  laughFace(ctx, headY, laugh);

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(2, headY - 2, 1.4, 0, TAU);
  ctx.fill();

  // Headwear / features per character
  ctx.fillStyle = hat || accent;
  if (kind === 'witch' || kind === 'santa' || kind === 'elf' || kind === 'elf2') {
    ctx.beginPath();
    ctx.moveTo(-9, headY - 5);
    ctx.lineTo(9, headY - 5);
    ctx.lineTo(2, headY - 22);
    ctx.closePath();
    ctx.fill();
    if (kind === 'santa' || kind === 'elf' || kind === 'elf2') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2, headY - 22, 2.4, 0, TAU);
      ctx.fill();
      if (kind === 'santa') ctx.fillRect(-9, headY - 6, 18, 3);
    }
  } else if (kind === 'bunny') {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(-3, headY - 12, 2.5, 9, -0.2, 0, TAU);
    ctx.ellipse(3, headY - 12, 2.5, 9, 0.2, 0, TAU);
    ctx.fill();
  } else if (kind === 'cupid') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(-8, -24, 7, 4, -0.5, 0, TAU);
    ctx.ellipse(8, -24, 7, 4, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY - 12, 5, 0, TAU);
    ctx.stroke();
  } else if (kind === 'dragon') {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-5, headY - 6);
    ctx.lineTo(-8, headY - 16);
    ctx.lineTo(-2, headY - 8);
    ctx.moveTo(5, headY - 6);
    ctx.lineTo(8, headY - 16);
    ctx.lineTo(2, headY - 8);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, headY + 1, 4, 3, 0, 0, TAU);
    ctx.fill();
  } else if (kind === 'chick') {
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.moveTo(6, headY);
    ctx.lineTo(12, headY + 2);
    ctx.lineTo(6, headY + 4);
    ctx.fill();
  } else if (kind === 'pumpkin') {
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, headY - 8);
    ctx.lineTo(0, headY - 14);
    ctx.stroke();
  } else if (kind === 'lamb' || kind === 'snowman' || kind === 'panda' || kind === 'bear') {
    // fluffy / rounded silhouette accents
    ctx.fillStyle = kind === 'panda' || kind === 'bear' ? accent : body;
    if (kind === 'snowman') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(6, headY);
      ctx.lineTo(12, headY + 2);
      ctx.lineTo(6, headY + 4);
      ctx.fill();
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, headY - 2, 1.4, 0, TAU);
      ctx.stroke();
    } else if (kind === 'panda') {
      ctx.beginPath();
      ctx.ellipse(-4, headY - 4, 3, 4, 0, 0, TAU);
      ctx.ellipse(4, headY - 4, 3, 4, 0, 0, TAU);
      ctx.fill();
    } else if (kind === 'bear') {
      ctx.beginPath();
      ctx.arc(-6, headY - 6, 3, 0, TAU);
      ctx.arc(6, headY - 6, 3, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, headY - 7, 9, 5, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// --- Backdrop & ground --------------------------------------------------------
interface Prop {
  kind: string;
  x: number;
  y: number;
  s: number;
  seed: number;
  color?: string;
}

function makeBackdrop(cfg: SeasonConfig, w: number, h: number, horizon: number): Prop[] {
  const props: Prop[] = [];
  const n = Math.max(3, Math.round(w / 260));
  for (let i = 0; i < n; i++) {
    const x = rand(0, w);
    const s = rand(0.7, 1.3);
    if (cfg.backdrop === 'snow') {
      props.push({ kind: 'house', x, y: horizon, s, seed: rand(0, 10), color: pick(['#e11d48', '#0e7490', '#7c3aed', '#b45309']) });
    } else if (cfg.backdrop === 'haunted') {
      props.push({ kind: Math.random() < 0.5 ? 'house' : 'grave', x, y: horizon, s, seed: rand(0, 10), color: '#3b2a5a' });
    } else if (cfg.backdrop === 'spring') {
      props.push({ kind: Math.random() < 0.6 ? 'tree' : 'hill', x, y: horizon, s, seed: rand(0, 10), color: pick(['#f472b6', '#fb7185', '#a3e635']) });
    } else {
      props.push({ kind: Math.random() < 0.5 ? 'tree' : 'hill', x, y: horizon, s, seed: rand(0, 10), color: pick(cfg.weatherColors) });
    }
  }
  props.push({ kind: 'moon', x: w * 0.8, y: horizon * 0.28, s: 1, seed: 0, color: cfg.groundLine });
  return props;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, cfg: SeasonConfig, props: Prop[]) {
  for (const p of props) {
    if (p.kind === 'moon') {
      if (cfg.backdrop !== 'haunted' && cfg.backdrop !== 'snow') continue;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fef9c3';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * p.s, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 46 * p.s, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (p.kind === 'house') {
      const w = 60 * p.s;
      const hh = 46 * p.s;
      const x = p.x - w / 2;
      const y = p.y - hh;
      // walls
      ctx.fillStyle = cfg.backdrop === 'snow' ? '#e6eefc' : p.color || '#3b2a5a';
      ctx.fillRect(x, y, w, hh);
      // roof
      ctx.fillStyle = cfg.backdrop === 'snow' ? '#dfe8f7' : withAlpha('#000000', 0.35);
      ctx.beginPath();
      ctx.moveTo(x - 6 * p.s, y);
      ctx.lineTo(p.x, y - 24 * p.s);
      ctx.lineTo(x + w + 6 * p.s, y);
      ctx.closePath();
      ctx.fill();
      if (cfg.backdrop === 'snow') {
        // snow caps on roof + a warm lit window
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x - 6 * p.s, y);
        ctx.lineTo(p.x, y - 24 * p.s);
        ctx.lineTo(x + w + 6 * p.s, y);
        ctx.lineTo(x + w + 2 * p.s, y - 3 * p.s);
        ctx.lineTo(p.x, y - 26 * p.s);
        ctx.lineTo(x - 2 * p.s, y - 3 * p.s);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = cfg.backdrop === 'snow' ? '#fbbf24' : '#fbbf24';
      const ww = 14 * p.s;
      ctx.fillRect(p.x - ww / 2, y + hh * 0.34, ww, ww * 0.9);
      continue;
    }
    if (p.kind === 'grave') {
      const g = 20 * p.s;
      ctx.fillStyle = '#4c3b6e';
      ctx.beginPath();
      ctx.moveTo(p.x - g / 2, p.y);
      ctx.lineTo(p.x - g / 2, p.y - g);
      ctx.arc(p.x, p.y - g, g / 2, Math.PI, 0);
      ctx.lineTo(p.x + g / 2, p.y);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    if (p.kind === 'tree') {
      const th = 34 * p.s;
      ctx.strokeStyle = '#5b4636';
      ctx.lineWidth = 4 * p.s;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - th);
      ctx.stroke();
      ctx.fillStyle = p.color || '#f472b6';
      ctx.beginPath();
      ctx.arc(p.x, p.y - th - 6, 14 * p.s, 0, TAU);
      ctx.arc(p.x - 10 * p.s, p.y - th, 10 * p.s, 0, TAU);
      ctx.arc(p.x + 10 * p.s, p.y - th, 10 * p.s, 0, TAU);
      ctx.fill();
      continue;
    }
    if (p.kind === 'hill') {
      ctx.fillStyle = withAlpha(cfg.groundLine, 0.18);
      ctx.beginPath();
      ctx.arc(p.x, p.y + 10, 40 * p.s, Math.PI, 0);
      ctx.fill();
      continue;
    }
  }
}

// --- Particles ----------------------------------------------------------------
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  kind: string;
  sway: number;
}

function makeParticle(cfg: SeasonConfig, w: number, h: number): Particle {
  const kind = pick(cfg.weather);
  return {
    x: rand(0, w),
    y: rand(-h * 0.2, h),
    size: rand(4, 9),
    vy: rand(0.5, 1.9) * (kind === 'heart' ? 0.7 : 1),
    vx: rand(-0.6, 0.6) + (kind === 'ember' ? rand(-0.3, 0.3) : 0),
    rot: rand(0, TAU),
    spin: rand(-0.05, 0.05),
    color: pick(cfg.weatherColors),
    kind,
    sway: rand(0.5, 1.6),
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  const s = p.size;
  if (p.kind === 'snow') {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'leaf') {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 0.32, 0, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'blossom' || p.kind === 'petal') {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.cos((i / 5) * TAU) * s * 0.35, Math.sin((i / 5) * TAU) * s * 0.35, s * 0.34, s * 0.24, (i / 5) * TAU, 0, TAU);
      ctx.fill();
    }
  } else if (p.kind === 'ember') {
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.4, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'heart') {
    const q = s * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, q);
    ctx.bezierCurveTo(q, 0, q * 1.6, -q, 0, -q * 1.6);
    ctx.bezierCurveTo(-q * 1.6, -q, -q, 0, 0, q);
    ctx.fill();
  }
  ctx.restore();
}

// --- Entities -----------------------------------------------------------------
interface Rider {
  spec: CharSpec;
  x: number;
  y: number;
  baseY: number;
  dir: number;
  speed: number;
  t: number;
  laugh: number;
  state: 'ride' | 'skid' | 'fall';
  stateT: number;
  skidLeft: number;
  fallAngle: number;
  respawnIn: number;
}

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  kind: ProjectileSpec['kind'];
  life: number;
  rot: number;
}

interface Burst {
  x: number;
  y: number;
  t: number;
  life: number;
  color: string;
  kind: string;
}

export const SeasonalThemeCanvas = ({ theme }: { theme?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<string | undefined>(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    let horizon = h * 0.7;
    let riders: Rider[] = [];
    let particles: Particle[] = [];
    let props: Prop[] = [];
    let projectiles: Projectile[] = [];
    let bursts: Burst[] = [];
    let lastTheme: SeasonConfig | null = null;
    let fighterIdx = 0;
    let fightTimer = 90;

    const spawnRiders = (cfg: SeasonConfig) => {
      const count = clamp(Math.round(w / 360), 3, 6);
      riders = Array.from({ length: count }, (_, i) => {
        const spec = cfg.chars[i % cfg.chars.length];
        const dir = Math.random() < 0.25 ? -1 : 1;
        const y = rand(horizon + 24, h - 30);
        return {
          spec,
          x: dir === 1 ? rand(-w * 0.3, w) : rand(w * 0.6, w * 1.3),
          y,
          baseY: y,
          dir,
          speed: rand(1.0, 2.0),
          t: rand(0, 100),
          laugh: 0,
          state: 'ride',
          stateT: 0,
          skidLeft: 0,
          fallAngle: 0,
          respawnIn: 0,
        } as Rider;
      });
    };

    const reset = () => {
      const cfg = SEASONS[themeRef.current as SeasonKey];
      if (!cfg) {
        riders = [];
        particles = [];
        props = [];
        projectiles = [];
        bursts = [];
        ctx.clearRect(0, 0, w, h);
        return;
      }
      horizon = h * 0.7;
      props = makeBackdrop(cfg, w, h, horizon);
      particles = Array.from({ length: cfg.weatherCount }, () => makeParticle(cfg, w, h));
      projectiles = [];
      bursts = [];
      spawnRiders(cfg);
    };

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      reset();
    };
    window.addEventListener('resize', resize);

    /** Throw the seasonal projectile from one rider at another. */
    const throwAt = (cfg: SeasonConfig, from: Rider, to: Rider) => {
      const dx = to.x - from.x;
      const dy = to.y - 40 - from.y;
      const dist = Math.hypot(dx, dy);
      const speed = 9;
      projectiles.push({
        x: from.x + from.dir * 20,
        y: from.y - 40,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed - 2.2,
        r: cfg.projectile.kind === 'heart' ? 7 : 6,
        color: cfg.projectile.kind === 'egg' ? pick(cfg.weatherColors) : cfg.projectile.color,
        kind: cfg.projectile.kind,
        life: 140,
        rot: 0,
      });
    };

    const updateFight = (cfg: SeasonConfig) => {
      fightTimer -= 1;
      if (fightTimer > 0 || riders.length < 2) return;
      fightTimer = rand(80, 220);
      const from = riders[(fighterIdx++) % riders.length];
      const others = riders.filter((r) => r !== from);
      const to = pick(others);
      from.dir = to.x >= from.x ? 1 : -1;
      throwAt(cfg, from, to);
    };

    const impact = (cfg: SeasonConfig, x: number, y: number, kind: string) => {
      bursts.push({ x, y, t: 0, life: 34, color: cfg.laughter, kind });
      // the nearest rider reacts — falls off, then laughs
      let nearest: Rider | null = null;
      let best = 90;
      for (const r of riders) {
        if (r.state !== 'ride') continue;
        const d = Math.hypot(r.x - x, r.y - y);
        if (d < best) {
          best = d;
          nearest = r;
        }
      }
      if (nearest) {
        nearest.state = 'fall';
        nearest.stateT = 0;
        nearest.fallAngle = 0;
        nearest.laugh = 0;
      }
    };

    const draw = () => {
      const cfg = SEASONS[themeRef.current as SeasonKey];
      if (cfg !== lastTheme) {
        lastTheme = cfg;
        reset();
      }
      if (!cfg) {
        ctx.clearRect(0, 0, w, h);
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);

      // Sky gradient
      const g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, cfg.sky[0]);
      g.addColorStop(0.6, cfg.sky[1]);
      g.addColorStop(1, cfg.sky[2] || cfg.sky[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, horizon);

      drawBackdrop(ctx, cfg, props);

      // Ground band
      ctx.fillStyle = cfg.ground;
      ctx.fillRect(0, horizon, w, h - horizon);
      ctx.strokeStyle = cfg.groundLine;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(w, horizon);
      ctx.stroke();

      // Weather
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y * 0.02 + p.rot * 8) * 0.3 * p.sway;
        p.rot += p.spin;
        if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
          Object.assign(p, makeParticle(cfg, w, h), { y: -20 });
        }
        drawParticle(ctx, p);
      }

      updateFight(cfg);

      // Projectiles
      for (const j of projectiles) {
        j.life -= 1;
        j.vy += 0.18;
        j.x += j.vx;
        j.y += j.vy;
        j.rot += 0.2;
        ctx.save();
        ctx.translate(j.x, j.y);
        ctx.rotate(j.rot);
        ctx.fillStyle = j.color;
        if (j.kind === 'snowball') {
          ctx.beginPath();
          ctx.arc(0, 0, j.r, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(148,163,184,0.5)';
          ctx.beginPath();
          ctx.arc(-j.r * 0.3, -j.r * 0.3, j.r * 0.3, 0, TAU);
          ctx.fill();
        } else if (j.kind === 'heart') {
          const q = j.r;
          ctx.beginPath();
          ctx.moveTo(0, q);
          ctx.bezierCurveTo(q, 0, q * 1.6, -q, 0, -q * 1.6);
          ctx.bezierCurveTo(-q * 1.6, -q, -q, 0, 0, q);
          ctx.fill();
        } else if (j.kind === 'egg') {
          ctx.beginPath();
          ctx.ellipse(0, 0, j.r * 0.8, j.r * 1.1, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, j.r * 0.7, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        if (j.kind === 'firecracker' && j.life % 3 === 0) {
          bursts.push({ x: j.x, y: j.y, t: 0, life: 12, color: '#fbbf24', kind: 'spark' });
        }
        if (j.life <= 0 || j.y > horizon - 4) {
          impact(cfg, j.x, Math.max(horizon - 4, j.y), j.kind);
          j.life = -1;
        }
      }
      projectiles = projectiles.filter((j) => j.life > 0);

      // Bursts (impact puffs) — bright and readable so the mischief lands.
      for (const b of bursts) {
        b.t += 1;
        const k = b.t / b.life;
        ctx.save();
        ctx.globalAlpha = clamp(1 - k, 0, 1);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        if (b.kind === 'spark') {
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            ctx.beginPath();
            ctx.arc(b.x + Math.cos(a) * k * 20, b.y + Math.sin(a) * k * 20, 3 * (1 - k) + 1.5, 0, TAU);
            ctx.fill();
          }
        } else {
          // central flash + radiating shards
          ctx.beginPath();
          ctx.arc(b.x, b.y, 10 * (1 - k) + 2, 0, TAU);
          ctx.fill();
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * TAU;
            ctx.beginPath();
            ctx.arc(b.x + Math.cos(a) * k * 34, b.y + Math.sin(a) * k * 34, 4 * (1 - k) + 1, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }
      bursts = bursts.filter((b) => b.t < b.life);

      // Riders
      for (const r of riders) {
        r.t += 0.03;

        if (r.state === 'ride') {
          const wobble = 1 + Math.sin(r.t * 3) * 0.15;
          r.x += r.dir * r.speed * wobble;
          const isWheelie = Math.sin(r.t * 0.7 + r.x * 0.01) > 0.72;
          const hop = isWheelie ? Math.abs(Math.sin(r.t * 6)) * 7 : Math.abs(Math.sin(r.t * 8)) * 1.6;
          const tilt = isWheelie ? r.dir * -0.24 : 0;

          ctx.save();
          ctx.translate(r.x, r.baseY - hop);
          ctx.rotate(tilt);
          ctx.scale(r.dir, 1);
          bike(ctx, 1.5, r.x * 0.09, isWheelie);
          drawCharacter(ctx, r.spec, r.t, r.laugh);
          ctx.restore();

          // Random skid: kick up dust/spray and lurch the front wheel.
          if (Math.random() < 0.0022) {
            r.state = 'skid';
            r.stateT = 0;
            r.skidLeft = rand(22, 40);
          }
        } else if (r.state === 'skid') {
          r.stateT += 1;
          r.skidLeft -= 1;
          const j = Math.sin(r.stateT * 1.2) * 4;
          ctx.save();
          ctx.translate(r.x + j, r.baseY);
          ctx.rotate(r.dir * -0.12 + Math.sin(r.stateT * 0.5) * 0.04);
          ctx.scale(r.dir, 1);
          bike(ctx, 1.5, r.stateT * 0.4, true);
          drawCharacter(ctx, r.spec, r.t + 1, r.laugh);
          // spray behind the rear wheel
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = cfg.groundLine;
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(-26 - i * 6, 2 + Math.sin(r.stateT + i) * 3, 3 - i * 0.4, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
          if (r.skidLeft <= 0) {
            r.state = 'ride';
            r.stateT = 0;
          }
        } else if (r.state === 'fall') {
          r.stateT += 1;
          const p = clamp(r.stateT / 40, 0, 1);
          r.fallAngle = r.dir * lerp(0, Math.PI / 2.1, easeInOut(p));
          const lieY = r.baseY;
          ctx.save();
          ctx.translate(r.x, lieY);
          ctx.rotate(r.fallAngle);
          ctx.scale(r.dir, 1);
          bike(ctx, 1.5, r.t * 0.5, true);
          drawCharacter(ctx, r.spec, r.t + 2, clamp((r.stateT - 24) / 12, 0, 1));
          ctx.restore();
          if (r.stateT > 70) {
            r.state = 'ride';
            r.stateT = 0;
            r.laugh = 0;
            r.baseY = rand(horizon + 24, h - 30);
            r.y = r.baseY;
            r.x = r.dir === 1 ? rand(-w * 0.2, -60) : rand(w + 40, w * 1.2);
          }
        }

        r.laugh = clamp(r.laugh + (r.state === 'fall' && r.stateT > 24 ? 0.06 : 0), 0, 1);

        // bell ring, sometimes
        if (Math.sin(r.t * 2 + r.x * 0.05) > 0.97) bell(ctx, r.x + r.dir * 11, r.baseY - 30);

        // recycle once off-screen while riding
        if (r.state === 'ride') {
          if (r.dir === 1 && r.x > w + 80) r.x = rand(-w * 0.4, -80);
          if (r.dir === -1 && r.x < -80) r.x = rand(w + 40, w * 1.4);
        }
      }

      // Cozy vignette — gently frames the scene and adds depth.
      const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // Snow-globe glass: a soft glare streak makes the world feel enclosed.
      if (cfg.backdrop === 'snow') {
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(w * 0.24, h * 0.2, w * 0.14, h * 0.5, -0.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    reset();
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};
