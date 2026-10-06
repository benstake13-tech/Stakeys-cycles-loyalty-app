/**
 * Ambient sky motion: Santa's sleigh flyby, darting bats/owls and firework
 * bursts. All screen-space (cheap, no 3D projection) and driven by an explicit
 * state machine so every "loop" differs a little — sometimes Santa is close and
 * fast, sometimes late, and occasionally he is replaced by an owl silhouette.
 */
import { TAU, clamp, rand } from './sceneKit';

type AmbientKind = 'santa' | 'bats' | 'owls' | 'fireworks' | 'none';

interface Streak {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  vx: number;
  vy: number;
  size: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Firework {
  x: number;
  y: number;
  fuse: number;
  color: string;
  sparks: Spark[];
}

interface Bat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  size: number;
  life: number;
}

/** Optional sleigh-bell chime, created only on the first Christmas flyby. */
let bellAudio: HTMLAudioElement | null = null;
function ringBell() {
  try {
    if (!bellAudio) {
      // A tiny synthesized bell via WebAudio — no asset to download.
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ac = new Ctx();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 2100;
      gain.gain.setValueAtTime(0.0001, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.55);
      osc.onended = () => ac.close();
    }
  } catch {
    // Audio is a nicety; never let it break the scene.
  }
}

export class AmbientDirector {
  private kind: AmbientKind;
  private w = 0;
  private h = 0;
  private t = 0;

  // Santa
  private santaActive = false;
  private santaX = 0;
  private santaY = 0;
  private santaSpeed = 0;
  private santaScale = 1;
  private santaNext = rand(4, 9);
  private trail: Streak[] = [];

  // Bats / owls
  private bats: Bat[] = [];
  private batsNext = rand(1, 3);

  // Fireworks
  private fireworks: Firework[] = [];
  private fwNext = rand(1, 3);

  constructor(kind: AmbientKind) {
    this.kind = kind;
  }

  setKind(kind: AmbientKind) {
    this.kind = kind;
    this.bats = [];
    this.fireworks = [];
    this.trail = [];
    this.santaActive = false;
    this.santaNext = rand(3, 8);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  /** dt in seconds. */
  update(dt: number, reducedMotion: boolean) {
    this.t += dt;
    if (reducedMotion) return;

    if (this.kind === 'santa') this.updateSanta(dt);
    else if (this.kind === 'bats' || this.kind === 'owls') this.updateBats(dt);
    else if (this.kind === 'fireworks') this.updateFireworks(dt);
  }

  private updateSanta(dt: number) {
    // Schedule a flyby; each is varied (delay, height, speed, scale).
    if (!this.santaActive) {
      this.santaNext -= dt;
      if (this.santaNext <= 0) {
        this.santaActive = true;
        this.santaX = -this.w * 0.15;
        this.santaY = this.h * rand(0.08, 0.24);
        this.santaSpeed = this.w * rand(0.09, 0.16);
        this.santaScale = rand(0.7, 1.5); // "closer and faster" variation
        this.santaNext = rand(7, 16);
        ringBell();
      }
      return;
    }
    this.santaX += this.santaSpeed * dt;
    this.santaY += Math.sin(this.t * 2.4) * 6 * dt;
    // Glittering golden dust trail.
    if (Math.random() < 0.9) {
      this.trail.push({
        x: this.santaX,
        y: this.santaY + rand(-6, 6),
        life: 1,
        maxLife: 1,
        color: Math.random() < 0.3 ? '#fff7cc' : '#fbbf24',
        vx: rand(-14, -2),
        vy: rand(-6, 6),
        size: rand(1.5, 3.5),
      });
    }
    if (this.santaX > this.w * 1.2) this.santaActive = false;

    for (const s of this.trail) {
      s.life -= dt * 0.7;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.trail = this.trail.filter((s) => s.life > 0);
  }

  private updateBats(dt: number) {
    this.batsNext -= dt;
    if (this.batsNext <= 0) {
      this.batsNext = rand(1.6, 5);
      const fromLeft = Math.random() < 0.5;
      const count = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < count; i++) {
        this.bats.push({
          x: fromLeft ? -30 - i * 20 : this.w + 30 + i * 20,
          y: this.h * rand(0.06, 0.4),
          vx: (fromLeft ? 1 : -1) * this.w * rand(0.12, 0.22),
          vy: rand(-14, 14),
          phase: rand(0, TAU),
          size: rand(0.6, 1.4),
          life: 8,
        });
      }
    }
    for (const b of this.bats) {
      b.x += b.vx * dt;
      b.y += Math.sin(this.t * 6 + b.phase) * 40 * dt + b.vy * dt;
      b.life -= dt;
    }
    this.bats = this.bats.filter((b) => b.life > 0 && b.x > -80 && b.x < this.w + 80);
  }

  private updateFireworks(dt: number) {
    this.fwNext -= dt;
    if (this.fwNext <= 0) {
      this.fwNext = rand(0.8, 2.6);
      const palette = ['#fbbf24', '#f472b6', '#38bdf8', '#a3e635', '#ffffff', '#ef4444'];
      this.fireworks.push({
        x: this.w * rand(0.15, 0.85),
        y: this.h * rand(0.06, 0.3),
        fuse: rand(0.6, 1.3),
        color: palette[(Math.random() * palette.length) | 0],
        sparks: [],
      });
    }
    for (const f of this.fireworks) {
      if (f.fuse > 0) {
        f.fuse -= dt;
      } else if (!f.sparks.length) {
        const n = 26 + ((Math.random() * 20) | 0);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const sp = rand(40, 130);
          f.sparks.push({
            x: f.x,
            y: f.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rand(0.8, 1.6),
            maxLife: 1.6,
            color: Math.random() < 0.25 ? '#ffffff' : f.color,
          });
        }
      }
      for (const s of f.sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 60 * dt;
        s.life -= dt;
      }
      f.sparks = f.sparks.filter((s) => s.life > 0);
    }
    this.fireworks = this.fireworks.filter((f) => f.fuse > 0 || f.sparks.length);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.kind === 'santa') this.drawSanta(ctx);
    else if (this.kind === 'bats' || this.kind === 'owls') this.drawBats(ctx, this.kind === 'owls');
    else if (this.kind === 'fireworks') this.drawFireworks(ctx);
  }

  private drawSanta(ctx: CanvasRenderingContext2D) {
    // Dust trail first (behind the sleigh).
    for (const s of this.trail) {
      ctx.globalAlpha = clamp(s.life, 0, 1) * 0.9;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!this.santaActive) return;

    ctx.save();
    ctx.translate(this.santaX, this.santaY);
    ctx.scale(this.santaScale, this.santaScale);
    ctx.fillStyle = '#0b0f1a';
    // Sleigh
    ctx.beginPath();
    ctx.moveTo(-26, 6);
    ctx.lineTo(-2, 6);
    ctx.lineTo(4, 0);
    ctx.lineTo(-30, 0);
    ctx.closePath();
    ctx.fill();
    // Runner
    ctx.strokeStyle = '#0b0f1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-32, 9);
    ctx.quadraticCurveTo(-16, 12, 0, 8);
    ctx.stroke();
    // Santa
    ctx.beginPath();
    ctx.arc(-14, -6, 4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.lineTo(-8, -2);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fill();
    // Reindeer (two, simplified silhouettes)
    for (const [rx, ry] of [
      [-46, -2],
      [-56, 0],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.ellipse(rx, ry, 7, 3, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rx + 5, ry - 2);
      ctx.lineTo(rx + 9, ry - 9);
      ctx.lineTo(rx + 3, ry - 4);
      ctx.closePath();
      ctx.fill();
    }
    // Tether line
    ctx.strokeStyle = 'rgba(11,15,26,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-28, 2);
    ctx.lineTo(-46, -1);
    ctx.stroke();
    ctx.restore();
  }

  private drawBats(ctx: CanvasRenderingContext2D, owls: boolean) {
    for (const b of this.bats) {
      ctx.save();
      ctx.translate(b.x, b.y);
      const flap = Math.sin(this.t * 18 + b.phase);
      ctx.scale(b.vx > 0 ? 1 : -1, 1);
      ctx.fillStyle = 'rgba(8,6,16,0.9)';
      ctx.beginPath();
      if (owls) {
        ctx.ellipse(0, 0, 4 * b.size, 6 * b.size, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(-1.6 * b.size, -1.4 * b.size, 0.9 * b.size, 0, TAU);
        ctx.arc(1.6 * b.size, -1.4 * b.size, 0.9 * b.size, 0, TAU);
        ctx.fill();
      } else {
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-8 * b.size, -6 * b.size - flap * 4, -16 * b.size, flap * 3);
        ctx.quadraticCurveTo(-8 * b.size, 2, 0, 2 * b.size);
        ctx.quadraticCurveTo(8 * b.size, 2, 16 * b.size, flap * 3);
        ctx.quadraticCurveTo(8 * b.size, -6 * b.size - flap * 4, 0, 0);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawFireworks(ctx: CanvasRenderingContext2D) {
    for (const f of this.fireworks) {
      if (f.fuse > 0) {
        // Rising shell.
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y + f.fuse * 40, 2.2, 0, TAU);
        ctx.fill();
      }
      for (const s of f.sparks) {
        ctx.globalAlpha = clamp(s.life / s.maxLife, 0, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
