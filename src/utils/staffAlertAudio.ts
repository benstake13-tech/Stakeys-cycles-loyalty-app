/**
 * Stakey's Cycles Staff Booking Audio Alert Synthesizer
 * A warm, recognisable Web Audio "booking chime" for workshop terminals.
 * Fires exclusively for staff sessions when a customer submits a repair booking.
 * 
 * Built for clarity and loudness in busy workshops, but voiced as a pleasant
 * ascending bell arpeggio rather than a piercing beep.
 */

export type WorkshopAudioVolume = 'normal' | 'loud' | 'max_workshop';

class StaffBookingAlertAudio {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volumeLevel: WorkshopAudioVolume = 'max_workshop';
  private stinger: HTMLAudioElement | null = null;
  private stingerBroken = false;

  constructor() {
    try {
      const savedEnabled = localStorage.getItem('stakeys_staff_booking_sound_enabled');
      if (savedEnabled !== null) {
        this.isEnabled = JSON.parse(savedEnabled);
      }
      const savedVolume = localStorage.getItem('stakeys_staff_audio_volume');
      if (savedVolume === 'normal' || savedVolume === 'loud' || savedVolume === 'max_workshop') {
        this.volumeLevel = savedVolume;
      }
    } catch {}
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('stakeys_staff_booking_sound_enabled', JSON.stringify(enabled));
    } catch {}
  }

  public toggleSound(): boolean {
    this.setSoundEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public getVolumeLevel(): WorkshopAudioVolume {
    return this.volumeLevel;
  }

  public setVolumeLevel(level: WorkshopAudioVolume) {
    this.volumeLevel = level;
    try {
      localStorage.setItem('stakeys_staff_audio_volume', level);
    } catch {}
  }

  public cycleVolumeLevel(): WorkshopAudioVolume {
    const next: Record<WorkshopAudioVolume, WorkshopAudioVolume> = {
      normal: 'loud',
      loud: 'max_workshop',
      max_workshop: 'normal',
    };
    const nextLevel = next[this.volumeLevel] || 'max_workshop';
    this.setVolumeLevel(nextLevel);
    return nextLevel;
  }

  /**
   * Request native browser push notification permission for the staff workstation
   */
  public async requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
      const perm = await Notification.requestPermission();
      return perm;
    } catch {
      return Notification.permission;
    }
  }

  /**
   * Dispatches a native browser desktop/mobile notification if granted
   */
  public dispatchPushNotification(title: string, body: string) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'stakeys-new-booking',
          requireInteraction: true,
        });
        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      }
    } catch (e) {
      console.warn('[STAFF ALERT] Could not dispatch native push notification:', e);
    }
  }

  /**
   * Plays the workshop booking alert.
   *
   * Prefers the produced stinger at /booking-chime.wav (sax riff + bike bell +
   * DT Swiss ratchet + voiceover). If that file is missing or cannot play, it
   * falls back to the synthesised bell arpeggio so a booking is never silent.
   */
  public playBookingAlert(): void {
    if (!this.isEnabled) return;

    if (!this.stingerBroken && typeof Audio !== 'undefined') {
      try {
        if (!this.stinger) {
          this.stinger = new Audio('/booking-chime.wav');
          this.stinger.preload = 'auto';
        }
        this.stinger.currentTime = 0;
        this.stinger.volume = this.volumeLevel === 'normal' ? 0.7 : 1.0;
        const played = this.stinger.play();
        if (played && typeof played.then === 'function') {
          played.catch(() => this.fallbackToSynth());
        }
        return;
      } catch {
        this.stingerBroken = true;
      }
    }
    this.playLoudBookingPing();
  }

  private fallbackToSynth(): void {
    this.stingerBroken = true;
    this.playLoudBookingPing();
  }

  /**
   * Ultra-Loud, Penetrating Workshop Alert Chime
   * Uses multi-harmonic frequency stacking and dynamic compression
   * to deliver maximum acoustic energy and cut through air compressors, tools, and background music.
   */
  public playLoudBookingPing(): void {
    if (!this.isEnabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Calculate gain multiplier based on volumeLevel setting
      const volMultiplier =
        this.volumeLevel === 'max_workshop' ? 2.2 : this.volumeLevel === 'loud' ? 1.6 : 1.0;

      // 1. Studio-grade Master Dynamics Compressor & Limiter to prevent clipping while maxing RMS loudness
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, now);
      compressor.knee.setValueAtTime(6, now);
      compressor.ratio.setValueAtTime(14, now);
      compressor.attack.setValueAtTime(0.001, now);
      compressor.release.setValueAtTime(0.08, now);

      // 2. High-makeup master booster stage
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.95 * volMultiplier, now);

      masterGain.connect(compressor);
      compressor.connect(this.ctx.destination);

      // Warm bell voice: a fundamental plus soft octave/12th partials, shaped
      // with a gentle attack and a long exponential tail so it reads as a
      // pleasant chime rather than a piercing beep.
      const triggerChimeStrike = (
        baseFreq: number,
        startDelay: number,
        duration: number,
        strikePower: number
      ) => {
        if (!this.ctx) return;
        const strikeTime = now + startDelay;

        const partials: Array<{ ratio: number; level: number }> = [
          { ratio: 1.0, level: 0.9 },
          { ratio: 2.01, level: 0.32 },
          { ratio: 3.02, level: 0.12 },
          { ratio: 0.5, level: 0.28 }, // soft body an octave below
        ];

        // A gentle lowpass keeps the chime warm instead of shrill.
        const tone = this.ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.setValueAtTime(5200, strikeTime);
        tone.Q.setValueAtTime(0.7, strikeTime);

        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, strikeTime);
        voiceGain.gain.linearRampToValueAtTime(strikePower, strikeTime + 0.012);
        voiceGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + duration);

        for (const partial of partials) {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq * partial.ratio, strikeTime);

          const partialGain = this.ctx.createGain();
          partialGain.gain.setValueAtTime(partial.level, strikeTime);
          // Higher partials fade faster, like a real struck bell.
          partialGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + duration * 0.7);

          osc.connect(partialGain);
          partialGain.connect(tone);
          osc.start(strikeTime);
          osc.stop(strikeTime + duration + 0.08);
        }

        tone.connect(voiceGain);
        voiceGain.connect(masterGain);
      };

      // Signature booking motif: a cheerful ascending A-major arpeggio that ends
      // on a bright, lingering sparkle — recognisable as "new booking" while
      // still cutting through workshop noise.
      triggerChimeStrike(880.0, 0.0, 0.55, 1.0); // A5
      triggerChimeStrike(1108.73, 0.15, 0.55, 1.0); // C#6
      triggerChimeStrike(1318.51, 0.3, 0.7, 1.1); // E6
      triggerChimeStrike(1760.0, 0.45, 1.1, 1.15); // A6 (sparkle tail)

    } catch (err) {
      console.warn('[STAFF ALERT] Web Audio synthesizer error:', err);
    }
  }
}

export const staffBookingAudio = new StaffBookingAlertAudio();
