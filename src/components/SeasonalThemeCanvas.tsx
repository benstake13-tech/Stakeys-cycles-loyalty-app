import { useEffect, useRef } from 'react';
import { type AvatarConfig, skinHex, hairHex, clothingHex } from '../shared/types/avatar';

/**
 * Seasonal 3D atmosphere layer.
 *
 * A full-screen, non-interactive canvas that renders a real 3D world for each
 * season — a perspective-projected scene with depth-sorted, per-face lit
 * geometry (buildings, hills, trees, monuments) and a cast of low-poly 3D
 * cyclists riding through it.
 *
 * There is no WebGL dependency and no image assets: everything is vector art
 * projected from 3D world space through a pinhole camera, shaded with a single
 * directional light, and finished with distance fog + a vignette so the scenes
 * read with genuine depth and volume rather than flat cartoon shapes.
 *
 * The theme comes from the shared Supabase setting, so every account sees the
 * same world.
 */

// =============================================================================
// 3D maths
// =============================================================================
export type V3 = { x: number; y: number; z: number };

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
/** Deterministic 32-bit hash, so a given rider seed always rebuilds the same look. */
export const hashSeed = (n: number): number => {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

// --- Colour helpers (always operate in / return hex) --------------------------
function parseColor(c: string): [number, number, number] {
  if (c.startsWith('rgb')) {
    const m = c.match(/\d+/g)!;
    return [+m[0], +m[1], +m[2]];
  }
  const h = c.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
/** Blends a colour toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
  const [r, g, b] = parseColor(hex);
  const t = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}
export const lighten = (hex: string, amount: number) => shade(hex, amount);
export const darken = (hex: string, amount: number) => shade(hex, -amount);
function mixColor(a: string, b: string, t: number) {
  const pa = parseColor(a);
  const pb = parseColor(b);
  return toHex(lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), lerp(pa[2], pb[2], t));
}
function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = parseColor(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// =============================================================================
// Geometry
// =============================================================================
interface Face {
  v: number[]; // indices into Geo.verts
  color: string;
  /** Emissive glow strength (lit windows, lanterns, flames). */
  emissive?: number;
  /** Skip lighting (sky/glow quads). */
  unlit?: boolean;
}

export interface Geo {
  verts: V3[];
  faces: Face[];
}

export interface Transform {
  pos: V3;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  scale?: number | V3;
}

export const emptyGeo = (): Geo => ({ verts: [], faces: [] });

export function addFace(g: Geo, pts: V3[], color: string, opts: Partial<Face> = {}) {
  const idx: number[] = [];
  for (const p of pts) {
    g.verts.push(p);
    idx.push(g.verts.length - 1);
  }
  g.faces.push({ v: idx, color, ...opts });
}

/** Extrudes a convex footprint (x,z pairs) upward along +y. */
function prism(
  pts: [number, number][],
  height: number,
  color: string,
  opts: { top?: string; base?: number; emissive?: number } = {}
): Geo {
  const g = emptyGeo();
  const base = opts.base ?? 0;
  const bottom = pts.map(([x, z]) => v3(x, base, z));
  const top = pts.map(([x, z]) => v3(x, base + height, z));
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    addFace(g, [bottom[i], bottom[j], top[j], top[i]], color);
  }
  addFace(g, top, opts.top || color, { emissive: opts.emissive });
  return g;
}

export function box(w: number, h: number, d: number, color: string, top?: string, emissive?: number): Geo {
  return prism(
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ],
    h,
    color,
    { top, emissive }
  );
}

/** Pyramid roof, base half-size halfW × halfD, apex at y = base + height. */
function pyramid(halfW: number, height: number, color: string, base = 0, halfD = halfW): Geo {
  const g = emptyGeo();
  const apex = v3(0, base + height, 0);
  const c = [
    v3(-halfW, base, -halfD),
    v3(halfW, base, -halfD),
    v3(halfW, base, halfD),
    v3(-halfW, base, halfD),
  ];
  for (let i = 0; i < 4; i++) addFace(g, [c[i], c[(i + 1) % 4], apex], color);
  return g;
}

function cone(radius: number, height: number, color: string, seg = 8, base = 0): Geo {
  const g = emptyGeo();
  const apex = v3(0, base + height, 0);
  const ring: V3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    ring.push(v3(Math.cos(a) * radius, base, Math.sin(a) * radius));
  }
  for (let i = 0; i < seg; i++) addFace(g, [ring[i], ring[(i + 1) % seg], apex], color);
  return g;
}

export function cylinder(radius: number, height: number, color: string, seg = 8, topColor?: string): Geo {
  const g = emptyGeo();
  const bottom: V3[] = [];
  const top: V3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    bottom.push(v3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    top.push(v3(Math.cos(a) * radius, height, Math.sin(a) * radius));
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    addFace(g, [bottom[i], bottom[j], top[j], top[i]], color);
  }
  addFace(g, top, topColor || color);
  return g;
}

/** Low-poly sphere (squashed by `squash` on Y). */
export function sphere(radius: number, color: string, squash = 1, seg = 6, rings = 4): Geo {
  const g = emptyGeo();
  const rows: V3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = (r / rings) * Math.PI;
    const row: V3[] = [];
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * TAU;
      row.push(
        v3(
          Math.sin(phi) * Math.cos(th) * radius,
          Math.cos(phi) * radius * squash,
          Math.sin(phi) * Math.sin(th) * radius
        )
      );
    }
    rows.push(row);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const s2 = (s + 1) % seg;
      addFace(g, [rows[r][s], rows[r][s2], rows[r + 1][s2], rows[r + 1][s]], color);
    }
  }
  return g;
}

/**
 * Rounded cap: the top slice of a sphere. Used for Bitmoji-style hair and
 * headwear so the silhouette reads as a smooth dome rather than faceted blocks.
 */
export function sphereCap(
  radius: number,
  color: string,
  opts: { phiStart?: number; phiEnd?: number; squash?: number; seg?: number; rings?: number } = {}
): Geo {
  const g = emptyGeo();
  const phiStart = opts.phiStart ?? 0;
  const phiEnd = opts.phiEnd ?? Math.PI / 2;
  const squash = opts.squash ?? 1;
  const seg = opts.seg ?? 8;
  const rings = opts.rings ?? 3;
  const rows: V3[][] = [];
  for (let r = 0; r <= rings; r++) {
    const phi = lerp(phiStart, phiEnd, r / rings);
    const row: V3[] = [];
    for (let s = 0; s < seg; s++) {
      const th = (s / seg) * TAU;
      row.push(
        v3(
          Math.sin(phi) * Math.cos(th) * radius,
          Math.cos(phi) * radius * squash,
          Math.sin(phi) * Math.sin(th) * radius
        )
      );
    }
    rows.push(row);
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      const s2 = (s + 1) % seg;
      addFace(g, [rows[r][s], rows[r][s2], rows[r + 1][s2], rows[r + 1][s]], color);
    }
  }
  return g;
}

/** Merges `src` into `target` applying an optional transform. */
export function merge(target: Geo, src: Geo, t: Transform = { pos: v3(0, 0, 0) }) {
  const base = target.verts.length;
  const s = t.scale ?? 1;
  const sx = typeof s === 'number' ? s : s.x;
  const sy = typeof s === 'number' ? s : s.y;
  const sz = typeof s === 'number' ? s : s.z;
  const cx = Math.cos(t.rotX || 0);
  const sxr = Math.sin(t.rotX || 0);
  const cy = Math.cos(t.rotY || 0);
  const syr = Math.sin(t.rotY || 0);
  const cz = Math.cos(t.rotZ || 0);
  const szr = Math.sin(t.rotZ || 0);
  for (const v of src.verts) {
    let x = v.x * sx;
    let y = v.y * sy;
    let z = v.z * sz;
    if (t.rotZ) {
      const nx = x * cz - y * szr;
      const ny = x * szr + y * cz;
      x = nx;
      y = ny;
    }
    if (t.rotX) {
      const ny = y * cx - z * sxr;
      const nz = y * sxr + z * cx;
      y = ny;
      z = nz;
    }
    if (t.rotY) {
      const nx = x * cy + z * syr;
      const nz = -x * syr + z * cy;
      x = nx;
      z = nz;
    }
    target.verts.push(v3(x + t.pos.x, y + t.pos.y, z + t.pos.z));
  }
  for (const f of src.faces) target.faces.push({ ...f, v: f.v.map((i) => i + base) });
}

function compose(parts: { geo: Geo; t: Transform }[]): Geo {
  const out = emptyGeo();
  for (const p of parts) merge(out, p.geo, p.t);
  return out;
}

// =============================================================================
// Scenery builders
// =============================================================================
// --- Halloween
function hauntedHouse(s: number): Geo {
  const g = emptyGeo();
  const wall = '#3b3158';
  const roof = '#251a3a';
  merge(g, box(16, 20, 14, wall, darken(wall, 0.15)), { pos: v3(0, 0, 0), scale: s });
  merge(g, box(8, 13, 10, wall, darken(wall, 0.15)), { pos: v3(-11, 0, 2), scale: s });
  merge(g, pyramid(10, 9, roof, 0, 8), { pos: v3(0, 20, 0), scale: s });
  merge(g, pyramid(6, 6, roof, 0, 6), { pos: v3(-11, 13, 2), scale: s });
  for (const [wx, wy] of [
    [-3, 12],
    [4, 6],
    [-11, 7],
  ] as [number, number][]) {
    merge(g, box(2.6, 3.4, 0.5, '#f59e0b', '#fde68a', 0.9), { pos: v3(wx, wy, 7.1), scale: s });
  }
  return g;
}

function grave(s: number): Geo {
  const g = emptyGeo();
  const stone = '#7c8496';
  merge(g, box(3, 5, 1.2, stone, lighten(stone, 0.18)), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(1.5, lighten(stone, 0.18), 1), { pos: v3(0, 5, 0), scale: s });
  return g;
}

function deadTree(s: number): Geo {
  const g = emptyGeo();
  const bark = '#3a2f48';
  merge(g, cylinder(1.1, 16, bark, 6), { pos: v3(0, 0, 0), scale: s });
  for (const [dx, tilt] of [
    [2, 0.8],
    [-2, -0.7],
  ] as [number, number][]) {
    merge(g, cylinder(0.5, 8, bark, 5), { pos: v3(dx, 11, 0), scale: s, rotZ: tilt });
  }
  return g;
}

// --- Christmas
function cabin(s: number, roofColor: string): Geo {
  const g = emptyGeo();
  const wall = '#5b3a24';
  merge(g, box(14, 11, 12, wall, lighten(wall, 0.1)), { pos: v3(0, 0, 0), scale: s });
  merge(g, pyramid(10, 7, roofColor, 0, 8), { pos: v3(0, 11, 0), scale: s });
  merge(g, pyramid(10.5, 6.6, '#f4f8ff', 0.5, 8.4), { pos: v3(0, 11.1, 0), scale: s });
  for (const wx of [-4, 4]) {
    merge(g, box(3, 3.6, 0.5, '#fbbf24', '#fde68a', 0.9), { pos: v3(wx, 5, 6.1), scale: s });
  }
  return g;
}

function pine(s: number): Geo {
  const g = emptyGeo();
  const green = '#1f4d3a';
  merge(g, cylinder(1, 4, '#4b3621', 6), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(7, 9, green, 8, 3), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(5.5, 8, green, 8, 8), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(4, 7, green, 8, 13), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(7.4, 2.6, '#f4f8ff', 8, 8.4), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(5.9, 2.2, '#f4f8ff', 8, 12.6), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(4.4, 2, '#f4f8ff', 8, 17), { pos: v3(0, 0, 0), scale: s });
  return g;
}

// --- Spring / Easter
function blossomTree(s: number, bloom: string): Geo {
  const g = emptyGeo();
  merge(g, cylinder(1.2, 12, '#6b4a2b', 6), { pos: v3(0, 0, 0), scale: s });
  for (const [dx, tilt] of [
    [2, 0.7],
    [-2, -0.6],
  ] as [number, number][]) {
    merge(g, cylinder(0.5, 8, '#6b4a2b', 5), { pos: v3(dx, 8, 0), scale: s, rotZ: tilt });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    merge(g, sphere(4, bloom, 0.9), {
      pos: v3(Math.cos(a) * 5, 15 + Math.sin(i) * 1.4, Math.sin(a) * 5),
      scale: s,
    });
  }
  merge(g, sphere(5, lighten(bloom, 0.2), 0.9), { pos: v3(0, 17, 0), scale: s });
  return g;
}

function hill(s: number): Geo {
  const g = emptyGeo();
  merge(g, sphere(40, '#4f9e46', 0.4, 7, 4), { pos: v3(0, -10, 0), scale: s });
  return g;
}

// --- Chinese New Year
function pagoda(s: number): Geo {
  const g = emptyGeo();
  const red = '#c62828';
  const gold = '#e8ad2c';
  for (let i = 0; i < 4; i++) {
    const r = 12 - i * 2.2;
    merge(g, cylinder(r * 0.7, 6, red, 8), { pos: v3(0, i * 7, 0), scale: s });
    merge(g, cone(r, 3.4, gold, 8, 0), { pos: v3(0, i * 7 + 6, 0), scale: s });
  }
  merge(g, cone(1.6, 3, gold, 6, 28), { pos: v3(0, 0, 0), scale: s });
  return g;
}

function lantern(s: number, color: string): Geo {
  const g = emptyGeo();
  merge(g, cylinder(0.3, 6, '#7a2626', 5), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(3.2, color, 0.75), { pos: v3(0, 3, 0), scale: s });
  return g;
}

// --- Valentine's
function gazebo(s: number): Geo {
  const g = emptyGeo();
  const white = '#fff5fa';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    merge(g, cylinder(0.7, 12, white, 6), { pos: v3(Math.cos(a) * 8, 0, Math.sin(a) * 8), scale: s });
  }
  merge(g, cone(10, 8, '#f7c6d9', 10, 12), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(1.6, '#e11d48', 1), { pos: v3(0, 21, 0), scale: s });
  return g;
}

function topiaryHeart(s: number): Geo {
  const g = emptyGeo();
  const leaf = '#4f9459';
  merge(g, cylinder(0.8, 4, '#5b4636', 6), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(4, leaf, 0.9), { pos: v3(-2.4, 7, 0), scale: s });
  merge(g, sphere(4, leaf, 0.9), { pos: v3(2.4, 7, 0), scale: s });
  merge(g, cone(4, 6, leaf, 7, 0), { pos: v3(0, 7, 0), scale: s, rotX: Math.PI });
  return g;
}

// =============================================================================
// Scenes
// =============================================================================
type SeasonKey = 'halloween' | 'christmas' | 'easter' | 'cny' | 'valentines';

export interface Palette {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  ground: string;
  groundAlt: string;
  sun: string;
  sunPos: V3;
  ambient: number;
  /** Draw a star field (night scenes). */
  night?: boolean;
  /** Optional road/path surface colour, drawn in perspective on the ground. */
  road?: string;
}

interface SeasonScene {
  label: string;
  palette: Palette;
  build: (w: number) => Geo[];
  /** Distant silhouette shapes drawn at the horizon, back → front. */
  ridges: { color: string; z: number; radius: number; height: number; count: number }[];
  riders: number;
}

interface Scatter {
  count: number;
  zRange: [number, number];
  make: () => Geo;
  scale?: [number, number];
}

function scatter(w: number, defs: Scatter[]): Geo[] {
  const out: Geo[] = [];
  for (const d of defs) {
    for (let i = 0; i < d.count; i++) {
      const z = rand(d.zRange[0], d.zRange[1]);
      // Spread x in proportion to depth so props fill the frustum instead of
      // bunching off-screen: screen offset ≈ x * (fov / z).
      const x = rand(-1.15, 1.15) * z;
      const s = d.scale ? rand(d.scale[0], d.scale[1]) : 1;
      out.push(compose([{ geo: d.make(), t: { pos: v3(x, 0, z), scale: s, rotY: rand(0, TAU) } }]));
    }
  }
  return out;
}

/**
 * Distant silhouette layer: large soft mounds sitting on the horizon that fill
 * the empty band of sky between the ground line and the real scenery, so the
 * world reads as deep rather than empty.
 */
function buildRidges(ridges: SeasonScene['ridges']): Geo[] {
  const out: Geo[] = [];
  for (const r of ridges) {
    for (let i = 0; i < r.count; i++) {
      const x = rand(-1.6, 1.6) * r.z;
      const s = rand(0.7, 1.35);
      const mound = sphere(r.radius, r.color, r.height / r.radius, 8, 4);
      out.push(compose([{ geo: mound, t: { pos: v3(x, 0, r.z), scale: s } }]));
    }
  }
  return out;
}

const SCENES: Record<SeasonKey, SeasonScene> = {
  halloween: {
    label: 'Halloween',
    palette: {
      skyTop: '#1b1140',
      skyHorizon: '#5a3a86',
      fog: '#3d2c5e',
      ground: '#3a2d55',
      groundAlt: '#4a3c68',
      sun: '#ffd97a',
      sunPos: v3(-160, 240, 420),
      ambient: 0.5,
      night: true,
      road: '#241c38',
    },
    ridges: [
      { color: '#241a3d', z: 900, radius: 240, height: 150, count: 5 },
      { color: '#33254f', z: 560, radius: 180, height: 110, count: 6 },
    ],
    riders: 4,
    build: (w) =>
      scatter(w, [
        { count: 4, zRange: [230, 600], make: () => hauntedHouse(1), scale: [1.1, 1.8] },
        { count: 8, zRange: [110, 660], make: () => grave(1), scale: [0.9, 1.5] },
        { count: 9, zRange: [90, 700], make: () => deadTree(1), scale: [1, 1.8] },
      ]),
  },
  christmas: {
    label: 'Christmas',
    palette: {
      skyTop: '#0a1b3a',
      skyHorizon: '#4a7aa8',
      fog: '#33506f',
      ground: '#eef4ff',
      groundAlt: '#d3e3f8',
      sun: '#f2f7ff',
      sunPos: v3(180, 260, 400),
      ambient: 0.6,
      road: '#b9c9e0',
    },
    ridges: [
      { color: '#26405c', z: 900, radius: 230, height: 140, count: 5 },
      { color: '#33506f', z: 560, radius: 170, height: 100, count: 6 },
    ],
    riders: 4,
    build: (w) =>
      scatter(w, [
        { count: 4, zRange: [240, 620], make: () => cabin(1, pick(['#b91c1c', '#0e7490', '#7c3aed'])), scale: [1.1, 1.7] },
        { count: 12, zRange: [70, 720], make: () => pine(1), scale: [1, 1.9] },
      ]),
  },
  easter: {
    label: 'Easter',
    palette: {
      skyTop: '#3f9fdc',
      skyHorizon: '#eaf6fd',
      fog: '#cfe8f5',
      ground: '#63b054',
      groundAlt: '#7cc96a',
      sun: '#fff6cf',
      sunPos: v3(-190, 300, 430),
      ambient: 0.78,
      road: '#c9a06a',
    },
    ridges: [
      { color: '#7dbd78', z: 1000, radius: 300, height: 120, count: 5 },
      { color: '#66ac61', z: 620, radius: 210, height: 80, count: 6 },
    ],
    riders: 5,
    build: (w) =>
      scatter(w, [
        { count: 4, zRange: [360, 780], make: () => hill(1), scale: [1.2, 2] },
        { count: 9, zRange: [90, 680], make: () => blossomTree(1, pick(['#f9a8d4', '#fbcfe8', '#fda4af'])), scale: [1, 1.6] },
      ]),
  },
  cny: {
    label: 'Chinese New Year',
    palette: {
      skyTop: '#3a0c0c',
      skyHorizon: '#c23232',
      fog: '#7d1f1f',
      ground: '#5c1a16',
      groundAlt: '#6d211c',
      sun: '#fbbf24',
      sunPos: v3(130, 250, 400),
      ambient: 0.5,
      night: true,
      road: '#3f1512',
    },
    ridges: [
      { color: '#3d1110', z: 900, radius: 240, height: 140, count: 5 },
      { color: '#541715', z: 560, radius: 180, height: 100, count: 6 },
    ],
    riders: 4,
    build: (w) =>
      scatter(w, [
        { count: 5, zRange: [220, 660], make: () => pagoda(1), scale: [1.1, 1.9] },
        { count: 16, zRange: [80, 600], make: () => lantern(1, pick(['#ef4444', '#f59e0b', '#dc2626'])), scale: [0.9, 1.6] },
      ]),
  },
  valentines: {
    label: "Valentine's Day",
    palette: {
      skyTop: '#4a1236',
      skyHorizon: '#cf5580',
      fog: '#8f3560',
      ground: '#662047',
      groundAlt: '#7a2754',
      sun: '#fecdd3',
      sunPos: v3(-130, 250, 410),
      ambient: 0.56,
      night: true,
      road: '#4a1730',
    },
    ridges: [
      { color: '#3f1229', z: 900, radius: 240, height: 140, count: 5 },
      { color: '#571a3a', z: 560, radius: 180, height: 100, count: 6 },
    ],
    riders: 4,
    build: (w) =>
      scatter(w, [
        { count: 4, zRange: [240, 640], make: () => gazebo(1), scale: [1.1, 1.7] },
        { count: 12, zRange: [90, 620], make: () => topiaryHeart(1), scale: [0.95, 1.6] },
      ]),
  },
};

// =============================================================================
// Camera & projection
// =============================================================================
export interface Projected {
  x: number;
  y: number;
  depth: number;
  scale: number;
}

export interface Camera {
  pos: V3;
  yaw: number;
  pitch: number;
  fov: number;
  /** Screen-space vertical anchor (0 = top, 1 = bottom). */
  anchorY?: number;
}

export const CAM: Camera = { pos: v3(0, 55, -20), yaw: 0, pitch: 0.14, fov: 300 };

export function project(p: V3, w: number, h: number, cam: Camera = CAM): Projected | null {
  const dx = p.x - cam.pos.x;
  const dy = p.y - cam.pos.y;
  const dz = p.z - cam.pos.z;
  const cy = Math.cos(-cam.yaw);
  const sy = Math.sin(-cam.yaw);
  const x = dx * cy + dz * sy;
  const z1 = -dx * sy + dz * cy;
  const cp = Math.cos(-cam.pitch);
  const sp = Math.sin(-cam.pitch);
  const y = dy * cp - z1 * sp;
  const z2 = dy * sp + z1 * cp;
  if (z2 < 6) return null;
  const scale = cam.fov / z2;
  return { x: w / 2 + x * scale, y: h * (cam.anchorY ?? 0.56) - y * scale, depth: z2, scale };
}

export interface DrawFace {
  pts: { x: number; y: number }[];
  color: string;
  depth: number;
  emissive: number;
}

const SUN_DIR = norm(v3(-0.42, 0.84, -0.34));
const FAR = 1700;

/** Screen point for a world position, or null when behind the camera. */
function screenOf(x: number, y: number, z: number, w: number, h: number) {
  const p = project(v3(x, y, z), w, h);
  return p ? { x: p.x, y: p.y } : null;
}

/**
 * Perspective road/path on the ground plane, with a centre dashed line and
 * lighter shoulders. Drawn before world geometry so scenery paints over it.
 */
function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const half = 150;
  const nearZ = 30;
  const farZ = 1350;
  const nl = screenOf(-half, 0, nearZ, w, h);
  const nr = screenOf(half, 0, nearZ, w, h);
  const fl = screenOf(-half, 0, farZ, w, h);
  const fr = screenOf(half, 0, farZ, w, h);
  if (!nl || !nr || !fl || !fr) return;

  ctx.beginPath();
  ctx.moveTo(nl.x, nl.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Shoulder highlight lines
  ctx.strokeStyle = withAlpha('#ffffff', 0.12);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.moveTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.stroke();

  // Centre dashes: short quads marching toward the horizon.
  for (let z = 60; z < farZ; z += 130) {
    const a = screenOf(-6, 0.5, z, w, h);
    const b = screenOf(6, 0.5, z, w, h);
    const c = screenOf(6, 0.5, z + 60, w, h);
    const d = screenOf(-6, 0.5, z + 60, w, h);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = withAlpha('#ffffff', 0.5);
    ctx.fill();
  }
}

export function projectGeo(
  geo: Geo,
  w: number,
  h: number,
  pal: Palette,
  out: DrawFace[],
  cam: Camera = CAM
) {
  const projected: (Projected | null)[] = new Array(geo.verts.length);
  for (let i = 0; i < geo.verts.length; i++) projected[i] = project(geo.verts[i], w, h, cam);

  for (const f of geo.faces) {
    const pts: { x: number; y: number }[] = [];
    let depth = 0;
    let ok = true;
    for (const vi of f.v) {
      const p = projected[vi];
      if (!p) {
        ok = false;
        break;
      }
      pts.push({ x: p.x, y: p.y });
      depth += p.depth;
    }
    if (!ok) continue;
    depth /= f.v.length;
    if (depth > FAR) continue;

    let color = f.color;
    if (!f.unlit) {
      const a = geo.verts[f.v[0]];
      const b = geo.verts[f.v[1]];
      const c = geo.verts[f.v[2]];
      const n = norm(cross(sub(b, a), sub(c, a)));
      const lambert = Math.abs(dot(n, SUN_DIR));
      const lum = clamp(pal.ambient + lambert * (1 - pal.ambient), 0.12, 1.28);
      color = lum >= 1 ? lighten(f.color, clamp(lum - 1, 0, 0.4)) : darken(f.color, 1 - lum);
    }
    const fogT = clamp((depth - 300) / 950, 0, 0.8);
    if (fogT > 0.01) color = mixColor(color, pal.fog, fogT);

    out.push({ pts, color, depth, emissive: f.emissive ?? 0 });
  }
}

// =============================================================================
// Riders — rounded, Bitmoji-style 3D characters on bicycles
// =============================================================================
export interface RiderLook {
  skin: string;
  jersey: string;
  hair: string;
  hairStyle:
    | 'bald'
    | 'buzz'
    | 'short'
    | 'fade'
    | 'curly'
    | 'afro'
    | 'bun'
    | 'ponytail'
    | 'long'
    | 'bob'
    | 'mohawk'
    | 'messyShort'
    | 'fadeCut'
    | 'quiff';
  /** Which item rides on the head: a bike helmet, beanie, cap or nothing. */
  headwear: 'helmet' | 'beanie' | 'cap' | 'none';
}

interface Rider {
  x: number;
  z: number;
  dir: number;
  speed: number;
  t: number;
  /** Deterministic identity — the look is rebuilt from this each frame. */
  seed: number;
  look: RiderLook;
  scale: number;
  bike: Geo;
}

const BIKE_FRAME = '#d3dae6';
const BIKE_DARK = '#1c2431';

export const RIDER_SKINS = ['#F6D9C6', '#F0C9A8', '#E4B48D', '#D2A074', '#B98A5E', '#9C6B45', '#7A4E2E', '#5A3720'];
const RIDER_JERSEYS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#14b8a6'];
const RIDER_HAIR = ['#2b2118', '#4a3222', '#6b4423', '#a5673f', '#d9a066', '#1f1f1f', '#8d5524', '#e6c8a0'];
const RIDER_HEADWEAR: RiderLook['headwear'][] = ['helmet', 'helmet', 'helmet', 'cap', 'beanie', 'none'];

/** Rebuilds a rider's look deterministically from its seed. */
export function riderLook(
  seed: number,
  overrides: Partial<Pick<RiderLook, 'skin' | 'jersey' | 'hair' | 'hairStyle' | 'headwear'>> = {}
): RiderLook {
  const h = (salt: number) => hashSeed(seed + salt * 0x9e3779b1);
  const pickFrom = <T,>(arr: T[], salt: number): T => arr[h(salt) % arr.length];
  const headwear = pickFrom(RIDER_HEADWEAR, 4);
  const hairStyle = (['short', 'bun', 'mohawk', 'bald', 'short'] as RiderLook['hairStyle'][])[
    h(5) % 5
  ];
  return {
    skin: overrides.skin ?? pickFrom(RIDER_SKINS, 1),
    jersey: overrides.jersey ?? pickFrom(RIDER_JERSEYS, 2),
    hair: overrides.hair ?? pickFrom(RIDER_HAIR, 3),
    headwear: overrides.headwear ?? headwear,
    hairStyle: overrides.hairStyle ?? hairStyle,
  };
}

/**
 * Maps a customer's avatar config onto a 3D rider look, so the character they
 * design in the studio is the same one that rides through the seasonal themes.
 */
export function avatarToLook(config: AvatarConfig): RiderLook {
  const headwear: RiderLook['headwear'] =
    config.accessory === 'helmet' ? 'helmet' : config.accessory === 'beanie' ? 'beanie' : 'none';
  // Fold the face choices into the seed so two configs with the same hair and
  // colours still diverge when expression or eyes differ.
  let seed = 2166136261;
  const s = `${config.eyeShape}|${config.expression}|${config.facialHair}|${config.eyeColor}`;
  for (let i = 0; i < s.length; i++) {
    seed ^= s.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return riderLook(seed >>> 0, {
    skin: skinHex(config.skinTone),
    jersey: clothingHex(config.clothingColor),
    hair: hairHex(config.hairColor),
    hairStyle: config.hairStyle,
    headwear,
  });
}

/** A bicycle in the local XZ plane, facing +x, wheels resting on y = 0. */
export function buildBike(frameColor: string): Geo {
  const g = emptyGeo();
  const R = 3.2;
  const wb = 7.5;
  for (const wx of [-wb, wb]) {
    merge(g, cylinder(R, 0.5, BIKE_DARK, 12, '#0b1220'), { pos: v3(wx, R, 0), rotX: Math.PI / 2 });
    merge(g, cylinder(R * 0.76, 0.64, BIKE_FRAME, 12, '#94a3b8'), { pos: v3(wx, R, 0), rotX: Math.PI / 2 });
  }
  const tube = (x1: number, y1: number, x2: number, y2: number, c: string) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    merge(g, box(len, 0.55, 0.55, c), { pos: v3((x1 + x2) / 2, (y1 + y2) / 2, 0), rotZ: ang });
  };
  tube(-wb, R, -0.5, R + 5, frameColor); // down tube
  tube(-0.5, R + 5, wb, R, frameColor); // top tube
  tube(-wb, R, wb, R, frameColor); // chain stay
  tube(-0.5, R + 5, 0.2, R, frameColor); // seat tube
  merge(g, box(1.2, 0.6, 3.6, BIKE_DARK), { pos: v3(wb - 1, R + 6.4, 0) }); // bars
  merge(g, box(1.9, 0.5, 1.3, BIKE_DARK), { pos: v3(-0.6, R + 6.3, 0) }); // saddle
  return g;
}

/**
 * A rounded, big-headed Bitmoji-style rider on the bike, facing +x. Arms and
 * legs cycle with `t` so the character reads as alive at any camera distance.
 */
export function buildBitmojiRider(look: RiderLook, t: number): Geo {
  const g = emptyGeo();
  const { skin, jersey, hair, hairStyle, headwear } = look;
  const shirt = jersey;
  const shirtTop = lighten(jersey, 0.18);
  const skinShade = darken(skin, 0.1);

  // Head — oversized and round, the signature Bitmoji proportion.
  const headY = 15.4;
  merge(g, sphere(2.75, skin, 1.04, 12, 8), { pos: v3(1.0, headY, 0) });
  // Ears.
  merge(g, sphere(0.6, skinShade, 1, 8, 5), { pos: v3(1.0, headY - 0.2, 2.6) });
  merge(g, sphere(0.6, skinShade, 1, 8, 5), { pos: v3(1.0, headY - 0.2, -2.6) });
  // Smiling mouth (a soft dark oval on the +z-facing cheek).
  merge(g, sphere(0.5, '#3b2418', 0.55, 8, 4), { pos: v3(1.2, headY - 1.25, 2.35) });

  // Hair / headwear sit as a rounded cap on top of the skull.
  const capBase = headY + 1.55;
  if (headwear === 'helmet') {
    merge(g, sphereCap(2.95, '#e11d48', { phiEnd: Math.PI / 2.15, squash: 0.9, seg: 12, rings: 3 }), {
      pos: v3(1.0, capBase, 0),
    });
    merge(g, box(3.0, 0.5, 0.5, lighten('#e11d48', 0.35)), { pos: v3(1.0, capBase + 0.5, 2.55), rotZ: 0.12 });
  } else if (headwear === 'beanie') {
    merge(g, sphereCap(2.9, shirt, { phiEnd: Math.PI / 1.75, squash: 0.95, seg: 12, rings: 3 }), {
      pos: v3(1.0, capBase, 0),
    });
    merge(g, cylinder(2.0, 0.7, lighten(shirt, 0.3), 12), { pos: v3(1.0, capBase - 0.3, 0) });
    merge(g, sphere(0.8, '#ffffff', 1, 8, 5), { pos: v3(1.0, capBase + 2.9, 0) });
  } else if (headwear === 'cap') {
    merge(g, sphereCap(2.9, shirtTop, { phiEnd: Math.PI / 2.1, squash: 0.9, seg: 12, rings: 3 }), {
      pos: v3(1.0, capBase, 0),
    });
    merge(g, box(3.4, 0.4, 3.0, shirtTop), { pos: v3(3.2, capBase - 0.4, 0), rotZ: 0.16 });
  } else {
    // Hair, shaped by style.
    const dome = (r: number, squash: number) =>
      merge(g, sphereCap(r, hair, { phiEnd: Math.PI / 1.95, squash, seg: 12, rings: 3 }), {
        pos: v3(1.0, capBase, 0),
      });
    if (hairStyle === 'bald') {
      // nothing
    } else if (hairStyle === 'mohawk') {
      for (let i = -2; i <= 2; i++) {
        merge(g, box(0.7, 1.6 - Math.abs(i) * 0.25, 1.4, hair), {
          pos: v3(1.0, capBase + 0.6 + (2 - Math.abs(i)) * 0.2, i * 1.0),
        });
      }
    } else if (hairStyle === 'bun') {
      dome(2.85, 0.98);
      merge(g, sphere(1.15, hair, 1, 10, 6), { pos: v3(0.2, capBase + 1.9, 0) });
    } else if (hairStyle === 'ponytail') {
      dome(2.85, 0.98);
      merge(g, sphere(1.05, hair, 1.3, 10, 6), { pos: v3(-1.4, capBase - 0.4, 0), rotZ: 0.5 });
    } else if (hairStyle === 'bob') {
      merge(g, sphere(3.05, hair, 1.15, 12, 8), { pos: v3(1.0, capBase - 0.5, 0) });
    } else if (hairStyle === 'long') {
      dome(2.9, 1);
      merge(g, box(3.4, 4.6, 4.6, hair), { pos: v3(-0.6, capBase - 2.4, 0), rotZ: 0.08 });
    } else if (hairStyle === 'afro') {
      merge(g, sphere(3.55, hair, 1.05, 12, 8), { pos: v3(1.0, capBase + 0.4, 0) });
    } else if (hairStyle === 'curly') {
      dome(2.95, 1);
      for (const [ox, oz] of [
        [0.2, 1.6],
        [1.8, 0.9],
        [1.9, -0.9],
        [0.2, -1.6],
        [-1.1, 0],
      ] as const) {
        merge(g, sphere(1.0, hair, 1, 8, 5), { pos: v3(1.0 + ox, capBase + 1.4, oz) });
      }
    } else if (hairStyle === 'fade' || hairStyle === 'fadeCut') {
      dome(2.7, 0.95);
      merge(g, box(1.2, 1.6, 4.0, darken(hair, 0.15)), { pos: v3(-1.3, capBase - 0.6, 0) });
    } else if (hairStyle === 'buzz') {
      merge(g, sphereCap(2.72, hair, { phiEnd: Math.PI / 2.15, squash: 0.9, seg: 12, rings: 3 }), {
        pos: v3(1.0, capBase, 0),
      });
    } else if (hairStyle === 'quiff') {
      dome(2.9, 1);
      merge(g, box(3.0, 1.8, 4.2, hair), { pos: v3(0.2, capBase + 1.2, 0), rotZ: 0.22 });
    } else {
      // short / messyShort / default
      dome(2.85, 0.98);
    }
  }

  // Neck.
  merge(g, cylinder(0.85, 1.4, skinShade, 10), { pos: v3(0.9, 12.9, 0) });
  // Torso — rounded, leaning forward from the saddle.
  merge(g, sphere(2.15, shirt, 1.25, 12, 7), { pos: v3(0.15, 11.2, 0) });
  merge(g, sphere(2.0, shirtTop, 1.1, 12, 6), { pos: v3(1.0, 12.1, 0) });
  // Jersey number hint (a light panel).
  merge(g, box(1.9, 1.3, 0.2, lighten(shirt, 0.45)), { pos: v3(0.4, 11.4, 2.05) });

  // Arms reaching for the handlebars, pedalling counterphase.
  const arm = (z: number) => {
    const sx = 1.0;
    const sy = 12.1;
    const hx = 6.1;
    const hy = 10.6;
    const len = Math.hypot(hx - sx, hy - sy);
    const ang = Math.atan2(hy - sy, hx - sx);
    merge(g, box(len, 0.85, 0.85, skin), { pos: v3((sx + hx) / 2, (sy + hy) / 2, z * 1.15), rotZ: ang });
    merge(g, sphere(0.55, skinShade, 1, 8, 5), { pos: v3(hx, hy, z * 1.15) });
  };
  arm(1);
  arm(-1);

  // Legs — rounded thighs and shins driving the pedals.
  const ped = Math.sin(t * 9) * 1.5;
  const leg = (z: number, phase: number) => {
    const hipX = -0.6;
    const hipY = 9.9;
    const kneeX = 0.4 + phase * 0.9;
    const kneeY = 7.4;
    const footX = -0.3 + phase;
    const footY = 4.6;
    const seg = (x1: number, y1: number, x2: number, y2: number, r: number, c: string) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      merge(g, box(len, r, r, c), { pos: v3((x1 + x2) / 2, (y1 + y2) / 2, z * 0.95), rotZ: ang });
    };
    seg(hipX, hipY, kneeX, kneeY, 1.15, BIKE_DARK);
    seg(kneeX, kneeY, footX, footY, 0.95, BIKE_DARK);
    merge(g, sphere(0.7, skin, 1, 8, 5), { pos: v3(footX, footY, z * 0.95) });
  };
  leg(1, ped);
  leg(-1, -ped);

  return g;
}

// =============================================================================
// Weather particles (parallax, screen-space)
// =============================================================================
interface Particle {
  x: number;
  y: number;
  vy: number;
  vx: number;
  size: number;
  rot: number;
  spin: number;
  color: string;
  kind: string;
  sway: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
  phase: number;
}

interface WeatherSpec {
  kinds: ('snow' | 'leaf' | 'blossom' | 'ember' | 'heart' | 'petal')[];
  colors: string[];
  count: number;
  glow: boolean;
}

const WEATHER: Record<SeasonKey, WeatherSpec> = {
  halloween: { kinds: ['leaf'], colors: ['#f59e0b', '#a855f7', '#84cc16', '#f97316'], count: 42, glow: false },
  christmas: { kinds: ['snow'], colors: ['#ffffff', '#e9f2ff', '#dbeafe'], count: 120, glow: false },
  easter: { kinds: ['blossom'], colors: ['#f472b6', '#ffffff', '#fbcfe8', '#fff7ed'], count: 72, glow: false },
  cny: { kinds: ['ember'], colors: ['#ef4444', '#f59e0b', '#fbbf24', '#fca5a5'], count: 58, glow: true },
  valentines: { kinds: ['heart', 'petal'], colors: ['#fb7185', '#f472b6', '#f9a8d4', '#fecdd3'], count: 62, glow: false },
};

function makeParticle(spec: WeatherSpec, w: number, h: number): Particle {
  const kind = pick(spec.kinds);
  return {
    x: rand(-w * 0.2, w * 1.2),
    y: rand(-h * 0.2, h),
    vy: rand(0.6, 2.3) * (kind === 'heart' ? 0.7 : 1),
    vx: rand(-0.5, 0.5),
    size: rand(4, 10),
    rot: rand(0, TAU),
    spin: rand(-0.06, 0.06),
    color: pick(spec.colors),
    kind,
    sway: rand(0.5, 1.8),
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, spec: WeatherSpec) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  const s = p.size;
  if (spec.glow) {
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
  }
  if (p.kind === 'snow') {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.5, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'leaf') {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.62, s * 0.3, 0, 0, TAU);
    ctx.fill();
  } else if (p.kind === 'blossom' || p.kind === 'petal') {
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

// =============================================================================
// Component
// =============================================================================
export const SeasonalThemeCanvas = ({
  theme,
  avatar,
}: {
  theme?: string;
  avatar?: AvatarConfig | null;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef<string | undefined>(theme);
  const avatarRef = useRef<AvatarConfig | null | undefined>(avatar);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    avatarRef.current = avatar;
  }, [avatar]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    let scene: Geo[] = [];
    let cachedScene: DrawFace[] = [];
    let particles: Particle[] = [];
    let stars: Star[] = [];
    let riders: Rider[] = [];
    let lastKey: string | undefined = '__init__';
    let lastAvatarKey: string | undefined;
    const faces: DrawFace[] = [];

    const spawnRiders = (n: number) => {
      const heroLook = avatarRef.current ? avatarToLook(avatarRef.current) : null;
      riders = Array.from({ length: n }, (_, i) => {
        // The customer's own avatar leads the pack, so the character they built
        // is the one riding through the theme.
        if (i === 0 && heroLook) {
          const z = rand(150, 520);
          return {
            x: rand(-0.5, 0.5) * z,
            z,
            dir: 1,
            speed: rand(1.8, 2.6),
            t: rand(0, 100),
            seed: 1,
            look: heroLook,
            scale: 1.15,
            bike: buildBike(heroLook.jersey),
          };
        }
        const seed = (Math.random() * 0x7fffffff) | 0;
        const look = riderLook(seed);
        const z = rand(150, 520);
        return {
          x: rand(-0.7, 0.7) * z,
          z,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: rand(1.8, 3.6),
          t: rand(0, 100),
          seed,
          look,
          scale: rand(0.95, 1.3),
          bike: buildBike(look.jersey),
        };
      });
    };

    const reset = () => {
      const key = themeRef.current as SeasonKey;
      const s = SCENES[key];
      if (!s) {
        scene = [];
        particles = [];
        riders = [];
        ctx.clearRect(0, 0, w, h);
        return;
      }
      lastAvatarKey = JSON.stringify(avatarRef.current ?? null);
      scene = [...buildRidges(s.ridges), ...s.build(w)];
      const spec = WEATHER[key];
      particles = Array.from({ length: spec.count }, () => makeParticle(spec, w, h));
      stars = s.palette.night
        ? Array.from({ length: 130 }, () => ({
            x: rand(0, w),
            y: rand(0, h * 0.5),
            r: rand(0.6, 1.9),
            tw: rand(0.4, 1.6),
            phase: rand(0, TAU),
          }))
        : [];
      spawnRiders(s.riders);
      // Camera is fixed, so the static scenery can be projected once per build.
      cachedScene = [];
      for (const g of scene) projectGeo(g, w, h, s.palette, cachedScene);
    };

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      reset();
    };
    window.addEventListener('resize', resize);

    const draw = () => {
      const key = themeRef.current as SeasonKey;
      const s = SCENES[key];
      // The customer's avatar can change while the canvas is mounted; refresh
      // the cast so the hero rider always matches what they saved.
      const avatarKey = JSON.stringify(avatarRef.current ?? null);
      if (avatarKey !== lastAvatarKey) {
        lastAvatarKey = avatarKey;
        if (s) spawnRiders(s.riders);
      }
      if (key !== lastKey) {
        lastKey = key;
        reset();
      }
      if (!s) {
        ctx.clearRect(0, 0, w, h);
        raf = requestAnimationFrame(draw);
        return;
      }
      const pal = s.palette;

      // --- Sky --------------------------------------------------------------
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
      sky.addColorStop(0, pal.skyTop);
      sky.addColorStop(1, pal.skyHorizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.68);

      // --- Stars (night skies) ---------------------------------------------
      if (stars.length) {
        const tsec = performance.now() / 1000;
        for (const st of stars) {
          const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(tsec * st.tw + st.phase));
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(st.x, st.y, st.r, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // --- Celestial body ---------------------------------------------------
      const sun = project(pal.sunPos, w, h);
      if (sun) {
        const r = clamp(sun.scale * 24, 14, 72);
        const glow = ctx.createRadialGradient(sun.x, sun.y, r * 0.2, sun.x, sun.y, r * 4);
        glow.addColorStop(0, withAlpha(pal.sun, 0.5));
        glow.addColorStop(1, withAlpha(pal.sun, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, r * 4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = pal.sun;
        ctx.beginPath();
        ctx.arc(sun.x, sun.y, r, 0, TAU);
        ctx.fill();
      }

      // --- Ground (from the true horizon down) ------------------------------
      const horizonY = project(v3(0, 0, 6000), w, h)?.y ?? h * 0.55;
      const grd = ctx.createLinearGradient(0, horizonY, 0, h);
      grd.addColorStop(0, pal.groundAlt);
      grd.addColorStop(1, pal.ground);
      ctx.fillStyle = grd;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // --- Road / path ------------------------------------------------------
      if (pal.road) drawRoad(ctx, w, h, pal.road);

      // --- Project world ----------------------------------------------------
      faces.length = 0;
      for (const f of cachedScene) faces.push(f);

      for (const r of riders) {
        r.t += 0.02;
        const bob = Math.abs(Math.sin(r.t * 4)) * 0.5;
        const rg = emptyGeo();
        merge(rg, r.bike, { pos: v3(0, 0, 0) });
        merge(rg, buildBitmojiRider(r.look, r.t), { pos: v3(0, 0, 0) });
        const placed = emptyGeo();
        merge(placed, rg, {
          pos: v3(r.x, bob, r.z),
          rotY: r.dir === 1 ? 0 : Math.PI,
          scale: r.scale,
        });
        projectGeo(placed, w, h, pal, faces);
        // Travel + wrap at the world-space frustum edge (screen offset ≈ x*fov/z).
        r.x += r.dir * r.speed;
        const edge = 0.85 * (r.z / CAM.fov);
        if (r.dir === 1 && r.x > edge) {
          r.x = -edge;
          r.z = rand(150, 520);
        } else if (r.dir === -1 && r.x < -edge) {
          r.x = edge;
          r.z = rand(150, 520);
        }
      }

      // --- Painter's algorithm (far → near) ---------------------------------
      faces.sort((a, b) => b.depth - a.depth);
      for (const f of faces) {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = f.color;
        if (f.emissive > 0) {
          ctx.shadowColor = f.color;
          ctx.shadowBlur = 20 * f.emissive;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // --- Weather ----------------------------------------------------------
      const spec = WEATHER[key];
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.y * 0.02 + p.rot * 8) * 0.3 * p.sway;
        p.rot += p.spin;
        if (p.y > h + 30) Object.assign(p, makeParticle(spec, w, h), { y: -30 });
        drawParticle(ctx, p, spec);
      }

      // --- Atmosphere: fog band + vignette ----------------------------------
      const fog = ctx.createLinearGradient(0, h * 0.4, 0, horizonY + 20);
      fog.addColorStop(0, withAlpha(pal.fog, 0));
      fog.addColorStop(1, withAlpha(pal.fog, 0.4));
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.4, w, horizonY + 20 - h * 0.4);

      const vg = ctx.createRadialGradient(
        w / 2,
        h * 0.5,
        Math.min(w, h) * 0.34,
        w / 2,
        h * 0.5,
        Math.max(w, h) * 0.78
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

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
