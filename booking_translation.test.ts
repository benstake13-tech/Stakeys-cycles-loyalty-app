import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BOOKING_LANGUAGES,
  BOOKING_PHRASES,
  getPhrases,
  isRtlLanguage,
  loadSavedLanguage,
  saveLanguage,
  languageEnglishName,
  LanguageCode,
} from './src/utils/bookingTranslator';
import {
  translateToEnglish,
  translateBookingNotes,
  detectAndTranslateToEnglish,
  detectTextLanguage,
  translateBookingNotesWithOriginal,
} from './src/api/translationService';

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

describe('languageEnglishName', () => {
  it('renders a human English name for a supported code', () => {
    expect(languageEnglishName('pl')).toBe('Polish');
    expect(languageEnglishName('ar')).toBe('Arabic');
    expect(languageEnglishName('en')).toBe('English');
  });

  it('falls back to the raw code for an unknown language', () => {
    expect(languageEnglishName('klingon')).toBe('klingon');
  });
});

describe('detectTextLanguage', () => {
  it('spots Cyrillic text regardless of the form UI language', () => {
    expect(detectTextLanguage('Зaдний тормоз мягкий')).toBe('uk');
  });

  it('spots Arabic-script text', () => {
    expect(detectTextLanguage('الفرامل الخلفية ضعيفة')).toBe('ar');
  });

  it('spots Urdu (RTL non-Arabic) text', () => {
    expect(detectTextLanguage('پچھلا بریک نرم لگتا ہے')).toBe('ur');
  });

  it('spots Punjabi (Gurmukhi) text', () => {
    expect(detectTextLanguage('ਪਿਛਲਾ ਬ੍ਰੇਕ ਨਰਮ ਲੱਗਦਾ ਹੈ')).toBe('pa');
  });

  it('returns undefined for Latin script it cannot pin to one dialect', () => {
    expect(detectTextLanguage('Rear brake is spongy')).toBeUndefined();
  });

  it('returns undefined for empty/whitespace input', () => {
    expect(detectTextLanguage('   ')).toBeUndefined();
    expect(detectTextLanguage('')).toBeUndefined();
  });
});

describe('detectAndTranslateToEnglish', () => {
  it('returns input unchanged for empty text', async () => {
    expect(await detectAndTranslateToEnglish('   ', 'pl')).toEqual({ text: '', detected: undefined });
  });

  it('keeps the input when the UI language is English', async () => {
    expect(await detectAndTranslateToEnglish('I need my bike by Friday', 'en')).toEqual({ text: 'I need my bike by Friday', detected: undefined });
  });

  it('translates Cyrillic free text even when the form UI is English (language mismatch fallback)', async () => {
    // No Gemini key in the test env — the raw text is the only thing we can
    // assert; the detection (Cyrillic → uk) is what proves the fallback path.
    const out = await detectAndTranslateToEnglish('Зaдний тормоз мягкий', 'en');
    expect(out.detected).toBe('uk');
    expect(out.text).toBe('Зaдний тормоз мягкий');
  });
});

describe('translateBookingNotesWithOriginal', () => {
  it('is a direct pass-through when the form is in English', async () => {
    const out = await translateBookingNotesWithOriginal(
      { notes: 'n', problemNotes: 'p', accessNotes: 'a', additionalDetails: 'd' },
      'en'
    );
    expect(out.translated).toEqual({ notes: 'n', problemNotes: 'p', accessNotes: 'a', additionalDetails: 'd' });
    expect(out.original).toEqual({ notes: 'n', problemNotes: 'p', accessNotes: 'a', additionalDetails: 'd' });
    expect(out.languageDetected).toBeUndefined();
  });

  it('keeps the original native text alongside the English, even when unconfigured', async () => {
    // No VITE_GEMINI_API_KEY → translation falls back to the raw text, but the
    // original field must still carry the rider's words for the staff toggle.
    const out = await translateBookingNotesWithOriginal(
      { notes: 'Manualne pedały', problemNotes: 'Tylny hamulec miękki' },
      'pl'
    );
    expect(out.original).toEqual({ notes: 'Manualne pedały', problemNotes: 'Tylny hamulec miękki', accessNotes: '', additionalDetails: '' });
    expect(out.translated.problemNotes).toBe('Tylny hamulec miękki');
  });

  it('surfaces a single detected language when all fields agree', async () => {
    const out = await translateBookingNotesWithOriginal(
      { notes: 'Зaметки на русском', problemNotes: 'Тормоз' },
      'pl'
    );
    expect(out.languageDetected).toBe('uk');
  });

  it('omits language_detected when fields disagree', async () => {
    const out = await translateBookingNotesWithOriginal(
      { notes: 'Зaметки на русском', problemNotes: 'الفرامل الأمامية' },
      'pl'
    );
    expect(out.languageDetected).toBeUndefined();
  });
});
