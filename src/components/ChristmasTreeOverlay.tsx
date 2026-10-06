import { useEffect, useRef } from 'react';

/**
 * Foreground Christmas tree that sits over the UI. It sways gently in the cold
 * draft, and a click/tap near it fires a gust that bends it out of the way with a
 * spring (damped harmonic oscillator) before it settles back.
 *
 * All motion is applied through a single CSS transform updated from one
 * requestAnimationFrame loop, so the compositor does the work (translate3d /
 * rotate) and we never thrash layout.
 */
export const ChristmasTreeOverlay = () => {
  const treeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = treeRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Spring state: angle (rad), angular velocity, plus a resting sway phase.
    let angle = 0;
    let vel = 0;
    let sway = 0;
    const stiffness = 9; // lower = looser, slower settle
    const damping = 2.4;
    let gustImpulse = 0;
    let last = performance.now();
    let raf = 0;

    const onPointerDown = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.5;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      // Only react when the interaction is near the tree.
      if (dist > Math.max(r.width, r.height) * 1.15) return;
      const dir = e.clientX < cx ? 1 : -1; // push the tree away from the pointer
      gustImpulse = dir * 0.9;
      vel += gustImpulse;
      spawnSnowBurst(e.clientX, e.clientY, dir);
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reducedMotion) {
        // Natural draft sway + spring toward rest.
        sway += dt;
        const draft = Math.sin(sway * 0.7) * 0.012 + Math.sin(sway * 1.9) * 0.004;
        const accel = -stiffness * (angle - draft) - damping * vel;
        vel += accel * dt;
        angle += vel * dt;
      }
      el.style.transform = `translate3d(-50%,0,0) rotate(${(angle * 57.2958).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <div
      ref={treeRef}
      aria-hidden="true"
      className="fixed bottom-0 left-[2%] z-30 pointer-events-none select-none"
      style={{ width: 'clamp(180px, 26vw, 420px)', transformOrigin: '50% 100%', willChange: 'transform' }}
    >
      <svg viewBox="0 0 200 320" className="w-full h-auto drop-shadow-2xl">
        <defs>
          <linearGradient id="xmasTree" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f6b3f" />
            <stop offset="100%" stopColor="#0f3d24" />
          </linearGradient>
        </defs>
        <rect x="92" y="272" width="16" height="42" rx="4" fill="#5b3a24" />
        {[0, 1, 2, 3].map((i) => (
          <polygon
            key={i}
            points={`100,${40 + i * 58} ${40 + i * 12},${120 + i * 52} ${160 - i * 12},${120 + i * 52}`}
            fill="url(#xmasTree)"
          />
        ))}
        {/* Snow caps */}
        {[0, 1, 2, 3].map((i) => (
          <polygon
            key={`s${i}`}
            points={`100,${40 + i * 58} ${72 + i * 8},${92 + i * 50} ${128 - i * 8},${92 + i * 50}`}
            fill="#eaf2ff"
            opacity="0.55"
          />
        ))}
        {/* Aged warm ornaments */}
        {[
          [86, 96, '#f6b73c'],
          [118, 118, '#e2564a'],
          [70, 158, '#f2d06b'],
          [132, 176, '#e2564a'],
          [92, 212, '#f6b73c'],
          [118, 236, '#e2564a'],
        ].map(([cx, cy, c], i) => (
          <circle key={`o${i}`} cx={cx as number} cy={cy as number} r="6" fill={c as string}>
            <animate attributeName="opacity" values="0.7;1;0.7" dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {/* Dim string lights */}
        <path d="M100 50 Q70 110 62 168 Q56 220 92 262" fill="none" stroke="#f6b73c" strokeWidth="1.4" opacity="0.6" />
        <path d="M100 50 Q130 110 138 168 Q144 220 108 262" fill="none" stroke="#f6b73c" strokeWidth="1.4" opacity="0.6" />
        {/* Star topper */}
        <polygon points="100,8 106,26 126,26 110,38 116,58 100,46 84,58 90,38 74,26 94,26" fill="#ffe08a" />
      </svg>
    </div>
  );
};

/** A short-lived snow/ember burst at a screen point (gust feedback). */
function spawnSnowBurst(x: number, y: number, dir: number) {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:0;height:0;z-index:31;pointer-events:none`;
  document.body.appendChild(host);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const size = 3 + Math.random() * 4;
    s.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${
      Math.random() < 0.3 ? '#f6b73c' : '#ffffff'
    };opacity:0.9;transform:translate3d(0,0,0);will-change:transform,opacity`;
    host.appendChild(s);
    const ang = Math.random() * Math.PI - Math.PI / 2;
    const dist = 40 + Math.random() * 90;
    const dx = Math.cos(ang) * dist * dir + dir * 30;
    const dy = -Math.abs(Math.sin(ang) * dist) + 30;
    s.animate(
      [
        { transform: 'translate3d(0,0,0)', opacity: 0.9 },
        { transform: `translate3d(${dx}px, ${dy}px, 0)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(0.2,0.6,0.3,1)', fill: 'forwards' }
    );
  }
  setTimeout(() => host.remove(), 1300);
}
