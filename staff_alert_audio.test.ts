import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom has no Web Audio API, so we stand in a minimal AudioContext that records
// the oscillators the synth schedules. Everything under test — the note
// frequencies, partials and envelope wiring — is the real production code; only
// the platform boundary is faked.
type Rec = { type: string; freq: number; started: number };

function installAudioRecorder() {
  const oscillators: Rec[] = [];

  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });

  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    destination = { connect: vi.fn() } as any;
    resume = vi.fn(async () => {});
    createGain() {
      return { gain: param(), connect: vi.fn() };
    }
    createDynamicsCompressor() {
      return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: vi.fn() };
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: param(), Q: param(), connect: vi.fn() };
    }
    createOscillator() {
      const rec: Rec = { type: 'sine', freq: 0, started: 0 };
      oscillators.push(rec);
      return {
        get type() {
          return rec.type;
        },
        set type(v: string) {
          rec.type = v;
        },
        frequency: { setValueAtTime: (v: number) => (rec.freq = v) },
        connect: vi.fn(),
        start: (t: number) => (rec.started = t),
        stop: vi.fn(),
      } as any;
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext as any);
  return oscillators;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules(); // the audio helper is a stateful singleton
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('staffAlertAudio booking chime', () => {
  it('schedules a warm 4-note ascending arpeggio (A-major) with bell partials', async () => {
    const oscillators = installAudioRecorder();
    const { staffBookingAudio } = await import('./src/utils/staffAlertAudio');

    expect(() => staffBookingAudio.playLoudBookingPing()).not.toThrow();

    // 4 strikes × 4 partials each.
    expect(oscillators).toHaveLength(16);

    const roots = [880.0, 1108.73, 1318.51, 1760.0];
    for (const root of roots) {
      expect(oscillators.some((o) => Math.abs(o.freq - root) < 0.01)).toBe(true);
      // Octave partial present for every strike.
      expect(oscillators.some((o) => Math.abs(o.freq - root * 2.01) < 0.05)).toBe(true);
    }

    // The old piercing top note (C7) is gone.
    expect(oscillators.some((o) => Math.abs(o.freq - 2093) < 1)).toBe(false);
  });

  it('does not schedule anything when the chime is muted', async () => {
    const oscillators = installAudioRecorder();
    const { staffBookingAudio } = await import('./src/utils/staffAlertAudio');
    staffBookingAudio.setSoundEnabled(false);
    staffBookingAudio.playLoudBookingPing();
    expect(oscillators).toHaveLength(0);
  });
});
