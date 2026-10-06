import { useEffect, useRef } from 'react';
import {
  DrawFace,
  Geo,
  Palette,
  TAU,
  buildRidges,
  clamp,
  drawRoad,
  project,
  projectGeo,
  withAlpha,
} from './theme/sceneKit';
import { sceneFor } from './theme/scenes';
import { AmbientDirector } from './theme/ambient';
import { Particle, drawParticle, makeParticle, stepParticle, weatherFor } from './theme/weather';
import type { SeasonalThemeId } from '../utils/holidayCalendar';

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
  phase: number;
}

const MAX_DPR = 1.5; // cap the backing-store scale so 4K screens stay smooth

/**
 * Full-screen, non-interactive software-rendered world for the active seasonal
 * theme. Layers, back to front: sky → stars → moon → ground → road → scenery →
 * weather → fog → vignette, with an optional ambient sky mover (Santa, bats,
 * fireworks) composited before the weather.
 */
export const SeasonalThemeCanvas = ({ theme }: { theme?: SeasonalThemeId | string }) => {
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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    let scene: Geo[] = [];
    let cachedScene: DrawFace[] = [];
    let particles: Particle[] = [];
    let stars: Star[] = [];
    let lastKey: string | undefined = '__init__';
    const faces: DrawFace[] = [];
    const ambient = new AmbientDirector('none');

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastKey = '__resize__';
      ambient.resize(w, h);
    };

    const reset = () => {
      const key = themeRef.current;
      const s = sceneFor(key);
      if (!s) {
        scene = [];
        particles = [];
        stars = [];
        cachedScene = [];
        ctx.clearRect(0, 0, w, h);
        ambient.setKind('none');
        return;
      }
      scene = [...buildRidges(s.ridges), ...s.build(w)];
      const spec = weatherFor(key);
      particles = spec ? Array.from({ length: spec.count }, () => makeParticle(spec, w, h)) : [];
      stars = s.palette.night
        ? Array.from({ length: 120 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h * 0.5,
            r: 0.6 + Math.random() * 1.3,
            tw: 0.4 + Math.random() * 1.2,
            phase: Math.random() * TAU,
          }))
        : [];
      cachedScene = [];
      for (const g of scene) projectGeo(g, w, h, s.palette, cachedScene);
      ambient.setKind((s.ambient ?? 'none') as any);
    };

    // --- Sky helpers ------------------------------------------------------
    const drawSky = (pal: Palette) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
      sky.addColorStop(0, pal.skyTop);
      sky.addColorStop(1, pal.skyHorizon);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * 0.7);
    };

    const drawStars = (tsec: number) => {
      if (!stars.length) return;
      ctx.fillStyle = '#ffffff';
      for (const st of stars) {
        ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(tsec * st.tw + st.phase));
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawMoon = (pal: Palette) => {
      const sun = project(pal.sunPos, w, h);
      if (!sun) return;
      const r = clamp(sun.scale * 24, 14, 84);
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
      // Hazy craters for the big night moons.
      if (pal.night && r > 30) {
        ctx.fillStyle = withAlpha('#000000', 0.06);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 1;
          ctx.beginPath();
          ctx.arc(sun.x + Math.cos(a) * r * 0.4, sun.y + Math.sin(a) * r * 0.4, r * 0.18, 0, TAU);
          ctx.fill();
        }
      }
    };

    // --- Main loop --------------------------------------------------------
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const key = themeRef.current;
      const s = sceneFor(key);
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

      drawSky(pal);
      if (pal.night) drawStars(now / 1000);
      drawMoon(pal);

      // Ground from the true horizon down.
      const horizonY = project({ x: 0, y: 0, z: 6000 }, w, h)?.y ?? h * 0.55;
      const grd = ctx.createLinearGradient(0, horizonY, 0, h);
      grd.addColorStop(0, pal.groundAlt);
      grd.addColorStop(1, pal.ground);
      ctx.fillStyle = grd;
      ctx.fillRect(0, horizonY, w, h - horizonY);
      if (pal.road) drawRoad(ctx, w, h, pal.road);

      // Scenery (cached) painted far → near.
      faces.length = 0;
      for (const f of cachedScene) faces.push(f);
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

      // Ambient sky movers (Santa, bats, fireworks).
      ambient.update(dt, reducedMotion);
      ambient.draw(ctx);

      // Weather.
      const spec = weatherFor(key);
      if (spec && !reducedMotion) {
        for (const p of particles) {
          stepParticle(p, spec, w, h);
          drawParticle(ctx, p, spec);
        }
      }

      // Fog band + vignette.
      const fog = ctx.createLinearGradient(0, h * 0.42, 0, horizonY + 20);
      fog.addColorStop(0, withAlpha(pal.fog, 0));
      fog.addColorStop(1, withAlpha(pal.fog, 0.42));
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.42, w, horizonY + 20 - h * 0.42);

      const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.34, w / 2, h * 0.5, Math.max(w, h) * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

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

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};
