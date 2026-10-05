/**
 * Browser speech for Virtual Stakey.
 *
 * Uses the Web Speech API (`window.speechSynthesis`) so no API key or network
 * is needed and nothing leaves the device. Speech is opt-in (a staff toggle) and
 * degrades silently when the browser has no voices installed.
 */
import type { StakeyAvatarVoiceStyle } from '../types/bikeShop';
import { VOICE_STYLE_SETTINGS } from '../data/stakeyAvatar';

export const isSpeechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

let cachedVoices: SpeechSynthesisVoice[] = [];

/** Voices load asynchronously in most browsers; cache them once available. */
export function primeVoices(): void {
  if (!isSpeechSupported()) return;
  const load = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
  load();
  if (cachedVoices.length === 0) {
    window.speechSynthesis.addEventListener('voiceschanged', load, { once: true });
  }
}

function pickVoice(style: StakeyAvatarVoiceStyle): SpeechSynthesisVoice | undefined {
  if (cachedVoices.length === 0 && isSpeechSupported()) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  const english = cachedVoices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = english.length > 0 ? english : cachedVoices;
  if (pool.length === 0) return undefined;
  // Deterministic-ish variety: prefer a named voice for each style so the same
  // character always sounds consistent on a given device.
  const preferred: Record<StakeyAvatarVoiceStyle, RegExp> = {
    warm: /female|samantha|karen|moira|tessa|zira|aria/i,
    bright: /google uk english female|female|victoria/i,
    calm: /daniel|alex|male|google uk english male/i,
    energetic: /google us english|female|zira/i,
  };
  return pool.find((v) => preferred[style].test(v.name)) || pool[0];
}

/**
 * Speak `text`. Returns a promise that resolves when speech finishes (or
 * immediately when unsupported/disabled), so callers can animate the mouth for
 * exactly as long as the words last.
 */
export function speak(text: string, style: StakeyAvatarVoiceStyle): Promise<void> {
  return new Promise((resolve) => {
    if (!isSpeechSupported() || !text.trim()) {
      resolve();
      return;
    }
    const settings = VOICE_STYLE_SETTINGS[style] || VOICE_STYLE_SETTINGS.warm;
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(style);
    if (voice) utter.voice = voice;
    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    utter.volume = 1;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
}

export function stopSpeaking(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}
