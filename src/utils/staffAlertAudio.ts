/**
 * Stakey's Cycles Staff Booking Audio Alert Synthesizer
 * High-decibel, high-clarity Web Audio API alert ping for workshop terminals.
 * Fires exclusively for staff sessions when a customer submits a repair booking.
 * 
 * Engineered for maximum acoustic penetration and high RMS loudness in busy workshops.
 */

export type WorkshopAudioVolume = 'normal' | 'loud' | 'max_workshop';

class StaffBookingAlertAudio {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volumeLevel: WorkshopAudioVolume = 'max_workshop';

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

      // Helper function to synthesize rich, multi-layered chime strikes
      const triggerChimeStrike = (
        baseFreq: number,
        startDelay: number,
        duration: number,
        strikePower: number
      ) => {
        if (!this.ctx) return;
        const strikeTime = now + startDelay;

        // Layer A: Pure fundamental bell sine
        const oscA = this.ctx.createOscillator();
        oscA.type = 'sine';
        oscA.frequency.setValueAtTime(baseFreq, strikeTime);

        // Layer B: Bright metallic overtone (harmonic sparkle)
        const oscB = this.ctx.createOscillator();
        oscB.type = 'triangle';
        oscB.frequency.setValueAtTime(baseFreq * 2.02, strikeTime);

        // Layer C: High-frequency resonant bell ring
        const oscC = this.ctx.createOscillator();
        oscC.type = 'sine';
        oscC.frequency.setValueAtTime(baseFreq * 3.01, strikeTime);

        // Layer D: Acoustic transient bite (filtered triangle wave for sharp click attack)
        const oscD = this.ctx.createOscillator();
        oscD.type = 'triangle';
        oscD.frequency.setValueAtTime(baseFreq * 0.5, strikeTime);

        // Bandpass filter for bright, piercing workshop frequency response (1.2kHz - 3.5kHz range)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(Math.min(4200, baseFreq * 1.8), strikeTime);
        filter.Q.setValueAtTime(3.0, strikeTime);

        // Envelope shaper: Instant sharp attack, punchy decay
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, strikeTime);
        gainNode.gain.linearRampToValueAtTime(strikePower * 0.95, strikeTime + 0.003);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, strikeTime + duration);

        oscA.connect(gainNode);
        oscB.connect(filter);
        oscC.connect(filter);
        oscD.connect(gainNode);

        filter.connect(gainNode);
        gainNode.connect(masterGain);

        oscA.start(strikeTime);
        oscB.start(strikeTime);
        oscC.start(strikeTime);
        oscD.start(strikeTime);

        const stopTime = strikeTime + duration + 0.06;
        oscA.stop(stopTime);
        oscB.stop(stopTime);
        oscC.stop(stopTime);
        oscD.stop(stopTime);
      };

      // Signature 4-Stage High-Decibel Workshop Alert Pattern:
      // Rapid ascending sequence with maximum human ear sensitivity (~1kHz to 2.4kHz)
      // Strike 1: 1046.5 Hz (High C6)
      triggerChimeStrike(1046.5, 0.00, 0.35, 1.0);
      // Strike 2: 1318.5 Hz (Bright E6)
      triggerChimeStrike(1318.5, 0.14, 0.40, 1.1);
      // Strike 3: 1568.0 Hz (Piercing G6 - Climax chime)
      triggerChimeStrike(1568.0, 0.28, 0.55, 1.25);
      // Strike 4: 2093.0 Hz (High C7 - Lingering bell resonance)
      triggerChimeStrike(2093.0, 0.38, 0.85, 1.3);

    } catch (err) {
      console.warn('[STAFF ALERT] Web Audio synthesizer error:', err);
    }
  }
}

export const staffBookingAudio = new StaffBookingAlertAudio();
