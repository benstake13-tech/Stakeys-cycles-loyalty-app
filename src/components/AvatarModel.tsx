import React, { useEffect, useRef } from 'react';
import { type AvatarConfig } from '../shared/types/avatar';
import {
  CAM,
  type Camera,
  type DrawFace,
  type Geo,
  type Palette,
  type RiderLook,
  avatarToLook,
  box,
  cylinder,
  darken,
  emptyGeo,
  lighten,
  merge,
  projectGeo,
  riderLook,
  sphere,
  sphereCap,
  v3,
} from './SeasonalThemeCanvas';

/**
 * A standing, rounded Bitmoji-style character built from the same 3D engine the
 * seasonal scenes use, then projected through a fitted portrait camera. Used
 * for the customer profile picture and as the animated figure in the themes.
 *
 * Facing +x in build space; callers rotate it to face the camera.
 */
export function buildStandingBitmoji(
  look: RiderLook,
  t: number,
  extra: { glasses?: AvatarConfig['glasses']; facialHair?: AvatarConfig['facialHair'] } = {}
): Geo {
  const g = emptyGeo();
  const { skin, jersey, hair, hairStyle, headwear } = look;
  const shirt = jersey;
  const shirtTop = lighten(jersey, 0.18);
  const skinShade = darken(skin, 0.1);
  const trousers = '#243043';
  const shoe = '#111827';

  const legZ = 0.95;
  const headY = 18.4;
  const capBase = headY + 1.55;
  const breathe = Math.sin(t * 2.2) * 0.12;

  // Legs — rounded, standing.
  for (const z of [legZ, -legZ]) {
    merge(g, box(2.7, 1.2, 1.8, shoe), { pos: v3(0.6, 0.6, z) }); // shoe
    merge(g, cylinder(0.78, 4.4, trousers, 10), { pos: v3(0, 1.2, z) }); // shin
    merge(g, cylinder(0.98, 4.8, trousers, 10), { pos: v3(0, 5.4, z) }); // thigh
  }
  // Hips.
  merge(g, sphere(2.45, trousers, 1.05, 12, 7), { pos: v3(0, 9.7, 0) });
  // Torso.
  merge(g, sphere(2.5, shirt, 1.4, 12, 8), { pos: v3(0, 12.5 + breathe, 0) });
  merge(g, sphere(2.15, shirtTop, 1.05, 12, 6), { pos: v3(0.45, 14.4 + breathe, 0) });
  // Jersey number panel.
  merge(g, box(0.25, 1.5, 2.2, lighten(shirt, 0.45)), { pos: v3(2.5, 12.4 + breathe, 0) });

  // Arms — one hanging, one optionally raised in a wave.
  const shoulderY = 14.4 + breathe;
  const arm = (z: number, raised: boolean) => {
    const sx = 0.2;
    const sy = shoulderY;
    const hx = raised ? 2.6 : 0.9;
    const hy = raised ? 20.6 : 9.4;
    const len = Math.hypot(hx - sx, hy - sy);
    const ang = Math.atan2(hy - sy, hx - sx);
    merge(g, box(len, 0.95, 0.95, shirt), {
      pos: v3((sx + hx) / 2, (sy + hy) / 2, z * 2.35),
      rotZ: ang,
    });
    merge(g, sphere(0.72, skin, 1, 8, 5), { pos: v3(hx, hy, z * 2.35) });
  };
  arm(1, true); // waving hand (front-left)
  arm(-1, false);

  // Neck.
  merge(g, cylinder(0.9, 1.8, skinShade, 10), { pos: v3(0, 15.2 + breathe, 0) });

  // Head — oversized and round.
  merge(g, sphere(2.75, skin, 1.04, 12, 8), { pos: v3(0.2, headY + breathe, 0) });
  merge(g, sphere(0.6, skinShade, 1, 8, 5), { pos: v3(0.2, headY - 0.2 + breathe, 2.6) });
  merge(g, sphere(0.6, skinShade, 1, 8, 5), { pos: v3(0.2, headY - 0.2 + breathe, -2.6) });
  // Nose.
  merge(g, sphere(0.55, skinShade, 1, 8, 5), { pos: v3(2.75, headY - 0.2 + breathe, 0) });
  // Eyes.
  const eyeY = headY + 0.55 + breathe;
  merge(g, sphere(0.42, '#241a12', 1, 8, 5), { pos: v3(2.45, eyeY, 1.0) });
  merge(g, sphere(0.42, '#241a12', 1, 8, 5), { pos: v3(2.45, eyeY, -1.0) });
  // Mouth — a soft smile.
  merge(g, sphere(0.55, '#3b2418', 0.6, 8, 4), { pos: v3(2.55, headY - 1.3 + breathe, 0) });
  // Eyebrows.
  merge(g, box(0.3, 0.28, 1.0, hair), { pos: v3(2.5, eyeY + 0.95, 1.0) });
  merge(g, box(0.3, 0.28, 1.0, hair), { pos: v3(2.5, eyeY + 0.95, -1.0) });

  // Facial hair.
  if (extra.facialHair && extra.facialHair !== 'none') {
    const fh = hair;
    if (extra.facialHair === 'moustache') {
      merge(g, box(0.3, 0.5, 1.5, fh), { pos: v3(2.6, headY - 0.75 + breathe, 0) });
    } else if (extra.facialHair === 'goatee') {
      merge(g, box(0.35, 1.0, 1.0, fh), { pos: v3(2.6, headY - 1.75 + breathe, 0) });
    } else {
      merge(g, sphere(1.9, fh, 0.7, 10, 5), { pos: v3(1.4, headY - 1.5 + breathe, 0) });
    }
  }

  // Hair / headwear — a rounded cap, matching the riding characters.
  if (headwear === 'helmet') {
    merge(g, sphereCap(2.95, '#e11d48', { phiEnd: Math.PI / 2.15, squash: 0.9, seg: 12, rings: 3 }), {
      pos: v3(0.2, capBase + breathe, 0),
    });
  } else if (headwear === 'beanie') {
    merge(g, sphereCap(2.9, shirt, { phiEnd: Math.PI / 1.75, squash: 0.95, seg: 12, rings: 3 }), {
      pos: v3(0.2, capBase + breathe, 0),
    });
    merge(g, cylinder(2.0, 0.7, lighten(shirt, 0.3), 12), { pos: v3(0.2, capBase - 0.3 + breathe, 0) });
  } else if (headwear === 'cap') {
    merge(g, sphereCap(2.9, shirtTop, { phiEnd: Math.PI / 2.1, squash: 0.9, seg: 12, rings: 3 }), {
      pos: v3(0.2, capBase + breathe, 0),
    });
    merge(g, box(3.4, 0.4, 3.0, shirtTop), { pos: v3(2.4, capBase - 0.4 + breathe, 0), rotZ: 0.16 });
  } else {
    const dome = (r: number, squash: number) =>
      merge(g, sphereCap(r, hair, { phiEnd: Math.PI / 1.95, squash, seg: 12, rings: 3 }), {
        pos: v3(0.2, capBase + breathe, 0),
      });
    if (hairStyle === 'bald') {
      // nothing
    } else if (hairStyle === 'mohawk') {
      for (let i = -2; i <= 2; i++) {
        merge(g, box(0.7, 1.6 - Math.abs(i) * 0.25, 1.4, hair), {
          pos: v3(0.2, capBase + 0.6 + (2 - Math.abs(i)) * 0.2 + breathe, i * 1.0),
        });
      }
    } else if (hairStyle === 'bun') {
      dome(2.85, 0.98);
      merge(g, sphere(1.15, hair, 1, 10, 6), { pos: v3(-0.6, capBase + 1.9 + breathe, 0) });
    } else if (hairStyle === 'ponytail') {
      dome(2.85, 0.98);
      merge(g, sphere(1.05, hair, 1.3, 10, 6), { pos: v3(-2.0, capBase - 0.4 + breathe, 0), rotZ: 0.5 });
    } else if (hairStyle === 'bob') {
      merge(g, sphere(3.05, hair, 1.15, 12, 8), { pos: v3(0.2, capBase - 0.5 + breathe, 0) });
    } else if (hairStyle === 'long') {
      dome(2.9, 1);
      merge(g, box(3.4, 4.6, 4.6, hair), { pos: v3(-1.2, capBase - 2.4 + breathe, 0), rotZ: 0.08 });
    } else if (hairStyle === 'afro') {
      merge(g, sphere(3.55, hair, 1.05, 12, 8), { pos: v3(0.2, capBase + 0.4 + breathe, 0) });
    } else if (hairStyle === 'curly') {
      dome(2.95, 1);
      for (const [ox, oz] of [
        [-0.6, 1.6],
        [1.0, 0.9],
        [1.1, -0.9],
        [-0.6, -1.6],
        [-1.9, 0],
      ] as const) {
        merge(g, sphere(1.0, hair, 1, 8, 5), { pos: v3(0.2 + ox, capBase + 1.4 + breathe, oz) });
      }
    } else if (hairStyle === 'fade') {
      dome(2.7, 0.95);
      merge(g, box(1.2, 1.6, 4.0, darken(hair, 0.15)), { pos: v3(-2.1, capBase - 0.6 + breathe, 0) });
    } else if (hairStyle === 'buzz') {
      merge(g, sphereCap(2.72, hair, { phiEnd: Math.PI / 2.15, squash: 0.9, seg: 12, rings: 3 }), {
        pos: v3(0.2, capBase + breathe, 0),
      });
    } else {
      dome(2.85, 0.98);
    }
  }

  // Glasses.
  if (extra.glasses && extra.glasses !== 'none') {
    const dark = extra.glasses === 'sunglasses';
    const lens = dark ? '#0b0d10' : '#dbeafe';
    const rim = '#1f2937';
    for (const z of [1.0, -1.0]) {
      merge(g, sphere(0.72, lens, 1, 10, 6), { pos: v3(2.55, eyeY, z) });
      merge(g, cylinder(0.78, 0.22, rim, 10), { pos: v3(2.9, eyeY - 0.11, z), rotZ: Math.PI / 2 });
    }
  }

  return g;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function geoBounds(geo: Geo): Bounds {
  const b: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const v of geo.verts) {
    if (v.x < b.minX) b.minX = v.x;
    if (v.x > b.maxX) b.maxX = v.x;
    if (v.y < b.minY) b.minY = v.y;
    if (v.y > b.maxY) b.maxY = v.y;
  }
  return b;
}

/**
 * Fits a portrait camera so the standing figure fills the frame with a small
 * margin. The figure is rotated to face the camera (-z) first.
 */
export function fitCamera(rotated: Geo, w: number, h: number, margin = 0.12): Camera {
  const b = geoBounds(rotated);
  const height = Math.max(1, b.maxY - b.minY);
  const width = Math.max(1, b.maxX - b.minX);
  const usable = 1 - margin * 2;
  const scale = Math.min((usable * h) / height, (usable * w) / width);
  const d = CAM.fov / scale;
  return {
    pos: v3((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, -d),
    yaw: 0,
    pitch: 0,
    fov: CAM.fov,
    anchorY: 0.5,
  };
}

const PORTRAIT_PALETTE: Palette = {
  skyTop: '#000000',
  skyHorizon: '#000000',
  fog: '#000000',
  ground: '#000000',
  groundAlt: '#000000',
  sun: '#ffffff',
  sunPos: v3(0, 0, 0),
  ambient: 0.74,
};

export interface AvatarModelProps {
  config?: AvatarConfig | null;
  /** Rendered size in CSS pixels (the figure fills the box). */
  size?: number;
  className?: string;
  title?: string;
  /** Animate the idle motion. Defaults to true. */
  animate?: boolean;
}

/**
 * Bitmoji-style 3D avatar portrait: a real 3D figure lit and projected through
 * the shared engine, gently animated. Falls back to a static frame when the
 * user prefers reduced motion or `animate` is false.
 */
export const AvatarModel: React.FC<AvatarModelProps> = ({
  config,
  size = 96,
  className,
  title = 'Avatar',
  animate = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef<AvatarConfig | undefined>(config ?? undefined);

  useEffect(() => {
    configRef.current = config ?? undefined;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const live = animate && !reduced;

    let raf = 0;
    let t = 0;

    const draw = () => {
      const cfg = configRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const bg = cfg?.background ?? '#0d1015';

      // Character is built facing +x; rotate +90° about Y so it faces the camera.
      const look = cfg
        ? avatarToLook(cfg)
        : riderLook(1, { skin: '#E4B48D', jersey: '#22c55e' });
      const body = buildStandingBitmoji(look, t, {
        glasses: cfg?.glasses,
        facialHair: cfg?.facialHair,
      });
      const rotated = emptyGeo();
      merge(rotated, body, { pos: v3(0, 0, 0), rotY: Math.PI / 2 });
      const cam = fitCamera(rotated, w, h);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const faces: DrawFace[] = [];
      projectGeo(rotated, w, h, PORTRAIT_PALETTE, faces, cam);
      faces.sort((a, b) => b.depth - a.depth);
      for (const f of faces) {
        ctx.beginPath();
        ctx.moveTo(f.pts[0].x, f.pts[0].y);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = f.color;
        if (f.emissive > 0) {
          ctx.shadowColor = f.color;
          ctx.shadowBlur = 8 * f.emissive;
        }
        ctx.fill();
        if (f.emissive > 0) ctx.shadowBlur = 0;
      }

      if (live) {
        t += 0.02;
        raf = requestAnimationFrame(draw);
      }
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [animate, size]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size)}
      height={Math.round(size * 1.15)}
      className={className}
      role="img"
      aria-label={title}
      data-testid="avatar-model"
    />
  );
};
