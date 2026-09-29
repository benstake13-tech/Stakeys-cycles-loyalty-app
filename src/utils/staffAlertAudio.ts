/**
 * Stakey's Cycles Staff Booking Audio Alert Synthesizer
 * High-decibel, high-clarity Web Audio API alert ping for workshop terminals.
 * Fires exclusively for staff sessions when a customer submits a repair booking.
 */

class StaffBookingAlertAudio {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('stakeys_staff_booking_sound_enabled');
      if (saved !== null) {
        this.isEnabled = JSON.parse(saved);
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
   * Loud, sharp double-tone workshop bell ping designed to cut through shop floor noise.
   * Chime 1: C6 (1046.5 Hz) + C7 (2093 Hz) -> punchy attack
   * Chime 2: E6 (1318.5 Hz) + G6 (1568 Hz) -> bright high ping
   */
  public playLoudBookingPing(): void {
    if (!this.isEnabled) return;

    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Master output limiter / booster for loud audibility
      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.92, now); // Loud workshop volume
      masterGain.connect(this.ctx.destination);

      // Chime Tone 1: 1046.5 Hz (Bright C6) with metallic transient
      const playTone = (freq: number, startDelay: number, duration: number, peakVol: number) => {
        if (!this.ctx) return;

        const startTime = now + startDelay;
        const osc = this.ctx.createOscillator();
        const overtone = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Fundamental tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // High shimmer overtone (bell/metallic ping)
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(freq * 2.01, startTime);

        // Bandpass filter to sculpt a clean, ringing bell frequency
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.5, startTime);
        filter.Q.setValueAtTime(4.0, startTime);

        // Envelope: ultra-fast transient attack (1ms), natural bell decay
        noteGain.gain.setValueAtTime(0.0001, startTime);
        noteGain.gain.linearRampToValueAtTime(peakVol, startTime + 0.003);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(filter);
        overtone.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(startTime);
        overtone.start(startTime);
        osc.stop(startTime + duration + 0.05);
        overtone.stop(startTime + duration + 0.05);
      };

      // Sound signature: 3-phase rapid workshop alert chime
      // 1. Initial high ping
      playTone(1046.5, 0.0, 0.35, 0.95);
      // 2. Harmonic accent ping
      playTone(1318.5, 0.08, 0.40, 0.90);
      // 3. Final loud piercing high bell ping (E6 / G6 harmonic)
      playTone(1567.98, 0.22, 0.70, 1.0);
      playTone(2093.0, 0.22, 0.50, 0.65);

    } catch (err) {
      console.warn('[STAFF ALERT] AudioContext error while playing loud booking ping:', err);
    }
  }
}

export const staffBookingAudio = new StaffBookingAlertAudio();
