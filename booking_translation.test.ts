import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BOOKING_LANGUAGES,
  BOOKING_PHRASES,
  getPhrases,
  isRtlLanguage,
  loadSavedLanguage,
  saveLanguage,
  LanguageCode,
} from './src/utils/bookingTranslator';
import { translateToEnglish, translateBookingNotes } from './src/api/translationService';

describe('bookingTranslator phrase book', () => {
  it('offers the languages the local rider communities actually speak', () => {
    const codes = BOOKING_LANGUAGES.map((l) => l.code);
    // The shop's core non-English rider languages must all be present.
    for (const expected of ['pl', 'ro', 'lt', 'bg', 'pt', 'pa', 'ur', 'ar', 'uk', 'ru', 'tr', 'sq', 'es']) {
      expect(codes).toContain(expected);
    }
  });

  it('has a dictionary for every offered language', () => {
    for (const lang of BOOKING_LANGUAGES) {
      expect(BOOKING_PHRASES[lang.code]).toBeTruthy();
      expect(getPhrases(lang.code)).toBe(BOOKING_PHRASES[lang.code]);
    }
  });

  it('does not leave a translated label equal to English (a silent fall-back)', () => {
    const en = BOOKING_PHRASES.en;
    // 'Email' is a genuine loanword in several of these languages, so it is not
    // asserted to differ; the other labels must not silently fall back.
    const labelKeys: (keyof typeof en)[] = [
      'formHeading',
      'fullName',
      'describeProblem',
      'preferredDate',
      'preferredTime',
      'submitBooking',
    ];
    for (const lang of BOOKING_LANGUAGES) {
      if (lang.code === 'en') continue;
      const dict = BOOKING_PHRASES[lang.code];
      for (const key of labelKeys) {
        expect(dict[key], `${lang.code}.${key} should differ from English`).not.toBe(en[key]);
      }
    }
  });

  it('marks the right-to-left languages', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('ur')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
    expect(isRtlLanguage('pl')).toBe(false);
  });

  it('falls back to English for an unknown code', () => {
    expect(getPhrases('nonsense' as LanguageCode)).toBe(BOOKING_PHRASES.en);
  });
});

describe('booking language preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to English', () => {
    expect(loadSavedLanguage()).toBe('en');
  });

  it('remembers a saved language', () => {
    saveLanguage('pl');
    expect(loadSavedLanguage()).toBe('pl');
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem('stakeys_booking_language', 'klingon');
    expect(loadSavedLanguage()).toBe('en');
  });
});

describe('translationService', () => {
  // The test env loads `.env.local`, which now carries VITE_GEMINI_API_KEY.
  // These tests must never touch the network, so pin the key empty for the
  // configured/unconfigured paths and unstub afterwards.
  beforeEach(() => {
    vi.stubEnv('VITE_GEMINI_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the input unchanged for English', async () => {
    expect(await translateToEnglish('Rear brake is spongy', 'en')).toBe('Rear brake is spongy');
  });

  it('returns the input unchanged when empty', async () => {
    expect(await translateToEnglish('   ', 'pl')).toBe('');
  });

  it('falls back to the original text when translation is unconfigured', async () => {
    // No key in scope, so the network path is skipped and the rider's own words
    // are preserved rather than lost.
    const original = 'Tylny hamulec jest miękki';
    expect(await translateToEnglish(original, 'pl')).toBe(original);
  });

  it('translateBookingNotes is a pass-through for English', async () => {
    const out = await translateBookingNotes(
      { notes: 'n', problemNotes: 'p', accessNotes: 'a', additionalDetails: 'd' },
      'en'
    );
    expect(out).toEqual({ notes: 'n', problemNotes: 'p', accessNotes: 'a', additionalDetails: 'd' });
  });

  it('translateBookingNotes normalises missing fields to empty strings', async () => {
    const out = await translateBookingNotes({}, 'pl');
    expect(out).toEqual({ notes: '', problemNotes: '', accessNotes: '', additionalDetails: '' });
  });
});
