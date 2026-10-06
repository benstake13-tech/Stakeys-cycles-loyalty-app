/**
 * Shared toolkit for the seasonal theme engine.
 *
 * Deliberately React-free: the low-poly 3D "engine" (vector maths, a tiny
 * software renderer and reusable prop builders) that every theme scene composes.
 * Keeping it separate lets each theme module lazy-load on its own and keeps the
 * maths unit-testable in isolation.
 */
export type V3 = { x: number; y: number; z: number };

export const TAU = Math.PI * 2;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
export const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const cross = (a: V3, b: V3): V3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
export function parseColor(c: string): [number, number, number] {
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
export function shade(hex: string, amount: number) {
  const [r, g, b] = parseColor(hex);
  const t = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(r + (t - r) * a, g + (t - g) * a, b + (t - b) * a);
}
export const lighten = (hex: string, amount: number) => shade(hex, amount);
export const darken = (hex: string, amount: number) => shade(hex, -amount);
export function mixColor(a: string, b: string, t: number) {
  const pa = parseColor(a);
  const pb = parseColor(b);
  return toHex(lerp(pa[0], pb[0], t), lerp(pa[1], pb[1], t), lerp(pa[2], pb[2], t));
}
export function withAlpha(hex: string, alpha: number) {
  const [r, g, b] = parseColor(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
export interface Face {
  v: number[];
  color: string;
  emissive?: number;
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
export function prism(
  pts: [number, number][],
  height: number,
  color: string,
  opts: Partial<Face> & { base?: number; top?: string } = {}
): Geo {
  const g = emptyGeo();
  const base = opts.base ?? 0;
  const bottom = pts.map(([x, z]) => v3(x, base, z));
  const top = pts.map(([x, z]) => v3(x, base + height, z));
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    addFace(g, [bottom[i], bottom[j], top[j], top[i]], color, opts);
  }
  addFace(g, bottom.slice().reverse(), darken(color, 0.25), opts);
  addFace(g, top, opts.top ?? color, { ...opts, unlit: true });
  return g;
}

export function box(w: number, h: number, d: number, color: string, top?: string, emissive?: number): Geo {
  const hw = w / 2;
  const hd = d / 2;
  const g = prism(
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ],
    h,
    color,
    { top: top ?? color }
  );
  if (emissive) g.faces.forEach((f) => (f.emissive = emissive));
  return g;
}

export function pyramid(halfW: number, height: number, color: string, base = 0, halfD = halfW): Geo {
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

/** Gable roof: a triangular prism ridge running along z. */
export function gable(halfW: number, height: number, length: number, color: string, base = 0): Geo {
  const g = emptyGeo();
  const hd = length / 2;
  const a = v3(-halfW, base, -hd);
  const b = v3(halfW, base, -hd);
  const c = v3(0, base + height, -hd);
  const d = v3(-halfW, base, hd);
  const e = v3(halfW, base, hd);
  const f = v3(0, base + height, hd);
  addFace(g, [a, b, c], color);
  addFace(g, [e, d, f], color);
  addFace(g, [a, c, f, d], darken(color, 0.08));
  addFace(g, [b, e, f, c], color);
  addFace(g, [a, d, e, b], darken(color, 0.2));
  return g;
}

export function cone(radius: number, height: number, color: string, seg = 8, base = 0): Geo {
  const g = emptyGeo();
  const apex = v3(0, base + height, 0);
  const ring: V3[] = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    ring.push(v3(Math.cos(a) * radius, base, Math.sin(a) * radius));
  }
  for (let i = 0; i < seg; i++) addFace(g, [ring[i], ring[(i + 1) % seg], apex], color);
  addFace(g, ring.slice().reverse(), darken(color, 0.2));
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
  addFace(g, top, topColor ?? color);
  return g;
}

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
    let nx = x * cz - y * szr;
    let ny = x * szr + y * cz;
    x = nx;
    y = ny;
    ny = y * cx - z * sxr;
    const nz = y * sxr + z * cx;
    y = ny;
    z = nz;
    nx = x * cy + z * syr;
    const nz2 = -x * syr + z * cy;
    x = nx;
    z = nz2;
    target.verts.push(v3(x + t.pos.x, y + t.pos.y, z + t.pos.z));
  }
  for (const f of src.faces) {
    target.faces.push({ ...f, v: f.v.map((i) => i + base) });
  }
}

export function compose(parts: { geo: Geo; t: Transform }[]): Geo {
  const g = emptyGeo();
  for (const p of parts) merge(g, p.geo, p.t);
  return g;
}

// ---------------------------------------------------------------------------
// Reusable prop builders
// ---------------------------------------------------------------------------

/** Parametric townhouse: body + gable roof + a grid of glowing windows. */
export function building(opts: {
  w: number;
  h: number;
  d: number;
  wall: string;
  roof: string;
  roofH?: number;
  window?: string;
  windowGlow?: number;
  stories?: number;
  cols?: number;
  snow?: string;
}): Geo {
  const g = emptyGeo();
  const { w, h, d, wall, roof } = opts;
  const win = opts.window ?? '#f6b73c';
  const glow = opts.windowGlow ?? 0.85;
  merge(g, box(w, h, d, wall, lighten(wall, 0.06)), { pos: v3(0, 0, 0) });
  const roofH = opts.roofH ?? h * 0.42;
  merge(g, gable(w / 2 + 0.4, roofH, d + 0.6, roof, 0), { pos: v3(0, h, 0) });
  if (opts.snow) merge(g, gable(w / 2 + 0.6, roofH * 0.9, d + 0.8, opts.snow, 0.4), { pos: v3(0, h + 0.15, 0) });
  const stories = opts.stories ?? 2;
  const cols = opts.cols ?? 2;
  const zf = d / 2 + 0.02;
  for (let s = 0; s < stories; s++) {
    const wy = h * ((s + 0.62) / (stories + 0.2));
    for (let c = 0; c < cols; c++) {
      const wx = (c - (cols - 1) / 2) * (w / (cols + 0.4));
      merge(g, box(w / (cols + 1.4), h / (stories * 2.6), 0.5, win, lighten(win, 0.3), glow), {
        pos: v3(wx, wy, zf),
      });
    }
  }
  return g;
}

/** A tall pine / conifer, optionally snow-laden. */
export function pine(s: number, snow = false): Geo {
  const g = emptyGeo();
  const green = '#1f4d3a';
  merge(g, cylinder(1, 4, '#4b3621', 6), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(7, 9, green, 8, 3), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(5.5, 8, green, 8, 8), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(4, 7, green, 8, 13), { pos: v3(0, 0, 0), scale: s });
  if (snow) {
    merge(g, cone(7.4, 2.6, '#f4f8ff', 8, 8.4), { pos: v3(0, 0, 0), scale: s });
    merge(g, cone(5.9, 2.2, '#f4f8ff', 8, 12.6), { pos: v3(0, 0, 0), scale: s });
    merge(g, cone(4.4, 2, '#f4f8ff', 8, 17), { pos: v3(0, 0, 0), scale: s });
  }
  return g;
}

export function bareTree(s: number, bark = '#3a2f48'): Geo {
  const g = emptyGeo();
  merge(g, cylinder(1.1, 16, bark, 6), { pos: v3(0, 0, 0), scale: s });
  for (const [dx, tilt] of [
    [2, 0.8],
    [-2, -0.7],
    [1, 0.4],
  ] as [number, number][]) {
    merge(g, cylinder(0.5, 8, bark, 5), { pos: v3(dx, 11, 0), scale: s, rotZ: tilt });
  }
  return g;
}

export function blossomTree(s: number, bloom: string): Geo {
  const g = emptyGeo();
  merge(g, cylinder(1.2, 12, '#6b4a2b', 6), { pos: v3(0, 0, 0), scale: s });
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

export function lantern(s: number, color: string): Geo {
  const g = emptyGeo();
  merge(g, cylinder(0.3, 6, '#7a2626', 5), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(3.2, color, 0.75), { pos: v3(0, 3, 0), scale: s });
  return g;
}

export function pagoda(s: number): Geo {
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

export function gazebo(s: number): Geo {
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

export function topiaryHeart(s: number): Geo {
  const g = emptyGeo();
  const leaf = '#4f9459';
  merge(g, cylinder(0.8, 4, '#5b4636', 6), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(4, leaf, 0.9), { pos: v3(-2.4, 7, 0), scale: s });
  merge(g, sphere(4, leaf, 0.9), { pos: v3(2.4, 7, 0), scale: s });
  merge(g, cone(4, 6, leaf, 7, 0), { pos: v3(0, 7, 0), scale: s, rotX: Math.PI });
  return g;
}

export function pumpkin(s: number, orange = '#ea580c'): Geo {
  const g = emptyGeo();
  merge(g, sphere(2, orange, 0.85, 8, 6), { pos: v3(0, 1.7, 0), scale: s });
  merge(g, cylinder(0.3, 1.2, '#166534', 4), { pos: v3(0, 3.2, 0), scale: s, rotZ: 0.3 });
  return g;
}

export function gravestone(s: number): Geo {
  const g = emptyGeo();
  const stone = '#7c8496';
  merge(g, box(3, 5, 1.2, stone, lighten(stone, 0.18)), { pos: v3(0, 0, 0), scale: s });
  merge(g, sphere(1.5, lighten(stone, 0.18), 1), { pos: v3(0, 5, 0), scale: s });
  return g;
}

/** Eid tent / marquee. */
export function tent(s: number, cloth: string): Geo {
  const g = emptyGeo();
  merge(g, box(16, 2, 14, cloth, lighten(cloth, 0.1)), { pos: v3(0, 0, 0), scale: s });
  merge(g, cone(11, 8, lighten(cloth, 0.18), 4, 0), { pos: v3(0, 2, 0), scale: s, rotY: Math.PI / 4 });
  merge(g, cylinder(0.3, 4, '#d4af37', 4), { pos: v3(0, 10, 0), scale: s });
  return g;
}

/** Hanukkah menorah with nine candles. */
export function menorah(s: number): Geo {
  const g = emptyGeo();
  const gold = '#d4af37';
  merge(g, cylinder(3, 1, gold, 8), { pos: v3(0, 0, 0), scale: s });
  merge(g, cylinder(0.6, 14, gold, 6), { pos: v3(0, 1, 0), scale: s });
  for (let i = -4; i <= 4; i++) {
    merge(g, cylinder(0.4, 7, gold, 5), { pos: v3(i * 1.8, 2, 0), scale: s });
    merge(g, box(0.7, 1.6, 0.7, '#fff2c0', '#ffffff', 1), { pos: v3(i * 1.8, 9, 0), scale: s });
  }
  return g;
}

/** Cinco de Mayo / festival pole with papel picado flags. */
export function fiestaPole(s: number): Geo {
  const g = emptyGeo();
  merge(g, cylinder(0.5, 16, '#7c4a21', 6), { pos: v3(0, 0, 0), scale: s });
  for (let i = 0; i < 5; i++) {
    merge(g, box(3, 1.6, 0.2, pick(['#e11d48', '#f59e0b', '#22c55e', '#3b82f6']), '#ffffff', 0.4), {
      pos: v3(0, 14 - i * 2.4, 1.6),
      scale: s,
    });
  }
  return g;
}

// ---------------------------------------------------------------------------
// Scene descriptors
// ---------------------------------------------------------------------------
export interface Palette {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  ground: string;
  groundAlt: string;
  sun: string;
  sunPos: V3;
  ambient: number;
  night?: boolean;
  road?: string;
}

export interface SeasonScene {
  label: string;
  palette: Palette;
  build: (w: number) => Geo[];
  ridges: { color: string; z: number; radius: number; height: number; count: number }[];
  /** Ambient motion the canvas can render (Santa sleigh, bats, fireworks…). */
  ambient?: 'santa' | 'bats' | 'owls' | 'fireworks' | 'none';
}

export interface Scatter {
  count: number;
  zRange: [number, number];
  make: () => Geo;
  scale?: [number, number];
}

export function scatter(defs: Scatter[]): Geo[] {
  const out: Geo[] = [];
  for (const d of defs) {
    for (let i = 0; i < d.count; i++) {
      const z = rand(d.zRange[0], d.zRange[1]);
      const x = rand(-1.15, 1.15) * z;
      const s = d.scale ? rand(d.scale[0], d.scale[1]) : 1;
      out.push(compose([{ geo: d.make(), t: { pos: v3(x, 0, z), scale: s, rotY: rand(0, TAU) } }]));
    }
  }
  return out;
}

export function buildRidges(ridges: SeasonScene['ridges']): Geo[] {
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

// ---------------------------------------------------------------------------
// Camera & projection (close, low-angle, immersive)
// ---------------------------------------------------------------------------
export interface Projected {
  x: number;
  y: number;
  depth: number;
  scale: number;
}
export interface DrawFace {
  pts: { x: number; y: number }[];
  color: string;
  depth: number;
  emissive: number;
}

/** Camera sits low and slightly back, tilted up, so buildings loom overhead. */
export const CAM = { pos: v3(0, 22, -34), yaw: 0, pitch: 0.2, fov: 300 };
export const SUN_DIR = norm(v3(-0.42, 0.84, -0.34));
export const FAR = 1800;

export function project(p: V3, w: number, h: number): Projected | null {
  const dx = p.x - CAM.pos.x;
  const dy = p.y - CAM.pos.y;
  const dz = p.z - CAM.pos.z;
  const cy = Math.cos(-CAM.yaw);
  const sy = Math.sin(-CAM.yaw);
  const x = dx * cy + dz * sy;
  const z1 = -dx * sy + dz * cy;
  const cp = Math.cos(-CAM.pitch);
  const sp = Math.sin(-CAM.pitch);
  const y = dy * cp - z1 * sp;
  const z2 = dy * sp + z1 * cp;
  if (z2 < 6) return null;
  const scale = CAM.fov / z2;
  return { x: w / 2 + x * scale, y: h * 0.56 - y * scale, depth: z2, scale };
}

export function screenOf(x: number, y: number, z: number, w: number, h: number) {
  const p = project(v3(x, y, z), w, h);
  return p ? { x: p.x, y: p.y } : null;
}

export function projectGeo(geo: Geo, w: number, h: number, pal: Palette, out: DrawFace[]) {
  const projected: (Projected | null)[] = new Array(geo.verts.length);
  for (let i = 0; i < geo.verts.length; i++) projected[i] = project(geo.verts[i], w, h);
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

export function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
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
  ctx.strokeStyle = withAlpha('#ffffff', 0.12);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(nl.x, nl.y);
  ctx.moveTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y);
  ctx.stroke();
}
