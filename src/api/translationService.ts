/**
 * Machine translation of a rider's typed notes into English for the workshop.
 *
 * The booking form can be *read* in any of the languages in bookingTranslator
 * (static phrase book, no network needed). This service handles the other half:
 * the free text a rider types in their own language is translated to English
 * before it is written into the booking notes, so the mechanic always reads the
 * job sheet in English.
 *
 * Every failure path returns the original text unchanged — a booking must never
 * be blocked or delayed because Gemini is unavailable, rate-limited or not
 * configured on this build.
 */
import { GoogleGenAI } from '@google/genai';
import { LanguageCode } from '../utils/bookingTranslator';
import { resolveGeminiModel, noThinking } from './geminiModel';

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const isTranslationConfigured = (): boolean => Boolean(getApiKey());

/**
 * Translate one free-text field to English. `sourceCode === 'en'`, empty input,
 * or a missing API key short-circuits to the input. The owner's booking keeps
 * the original text alongside the translation (see BookingPortal) so a nuance
 * is never lost.
 */
export async function translateToEnglish(text: string, sourceCode: LanguageCode): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed || sourceCode === 'en') return trimmed;

  const apiKey = getApiKey();
  if (!apiKey) return trimmed;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = resolveGeminiModel();
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `Translate the following ${sourceCode} text into natural, plain English for a ` +
                'bike mechanic reading a repair job sheet. Keep it faithful and concise. ' +
                'Return ONLY the translation, with no quotes or commentary.\n\n' +
                trimmed,
            },
          ],
        },
      ],
      config: { temperature: 0, maxOutputTokens: 400, ...noThinking(model) },
    });
    const out = response.text?.trim();
    return out || trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Detect the actual language of a free-text string.
 * Uses a fast heuristic first (script of the first letters / common-language
 * keywords) and falls back to Gemini only when the heuristic is inconclusive.
 * Returns the 2-letter ISO code or undefined when it cannot tell — the caller
 * then assumes the form's UI language.
 */
export function detectTextLanguage(text: string): string | undefined {
  const trimmed = (text || '').trim();
  if (!trimmed) return undefined;

  const script = detectScript(trimmed);
  if (script === 'cyrillic') return 'uk'; // shop's biggest Cyrillic communities are UA/RU
  if (script === 'arabic') return 'ar';
  if (script === 'urdu') return 'ur';
  if (script === 'hebrew') return 'he';
  if (script === 'panjabi') return 'pa';

  // Latin script — use keyword markers concentrated at the start of the string.
  const lower = trimmed.toLowerCase();
  const markers: Array<[RegExp, string]> = [
    [/[\u00e3\u00f5\u00e7\u00e1-\u00fa]/i, 'pt'],
  ];
  for (const [re, code] of markers) {
    if (re.test(lower)) return code;
  }
  return undefined;
}

/** Classify a string by its dominant Unicode script. */
function detectScript(text: string): 'latin' | 'cyrillic' | 'arabic' | 'urdu' | 'hebrew' | 'panjabi' | undefined {
  let cyrillic = 0;
  let arabic = 0;
  let urdu = 0;
  let hebrew = 0;
  let panjabi = 0;
  let latin = 0;
  let total = 0;

  const urduLetters = /[\u0679-\u068E\u0691\u0698\u06A0\u06A9-\u06BE\u06C1-\u06D3\u06D5\u06E4\u06F1-\u06F9]/;

  for (const ch of text) {
    if (/\s/.test(ch) || /[\d\p{P}]/u.test(ch)) continue;
    const code = ch.codePointAt(0)!;
    total++;
    if (code >= 0x0400 && code <= 0x04ff) cyrillic++;
    else if (code >= 0x0600 && code <= 0x06ff) {
      if (urduLetters.test(ch)) urdu++;
      else arabic++;
    } else if (code >= 0x0590 && code <= 0x05ff) hebrew++;
    else if (code >= 0x0a00 && code <= 0x0a7f) panjabi++;
    else if ((code >= 0x0041 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x00ff)) latin++;
  }
  if (total === 0) return undefined;
  if (urdu / total > 0.35) return 'urdu';
  if (arabic / total > 0.5) return 'arabic';
  if (hebrew / total > 0.5) return 'hebrew';
  if (panjabi / total > 0.5) return 'panjabi';
  if (cyrillic / total > 0.5) return 'cyrillic';
  if (latin / total > 0.5) return 'latin';
  return undefined;
}

/** The scripts/verifier-guard for the language fallback. */
const ISO_LANGUAGE_RE = /^[a-z]{2}$/;

/**
 * Translate to English, auto-detecting the typed language when it differs from
 * the form's UI language (a Polish customer may leave the form in English but
 * type in Polish; a Spanish customer may have switched the UI to Arabic).
 * Returns `{ text, detected }` so the caller can persist what really happened.
 */
export async function detectAndTranslateToEnglish(
  text: string,
  expectedCode: LanguageCode
): Promise<{ text: string; detected?: string }> {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { text: trimmed };
  }

  let detected: string | undefined = detectTextLanguage(trimmed);
  if (detected && detected !== expectedCode) {
    // The UI label says one language but the typed text is another — translate
    // from the *actual* language so the workshop gets accurate English.
    // (A UI of English is the most common mismatch: the rider reads the code
    // but types in their mother tongue.)
    let translated = trimmed;
    if (getApiKey()) {
      try {
        const engine = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await engine.models.generateContent({
          model: resolveGeminiModel(),
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Identify the language of this text, then translate it into natural, plain English ` +
                    'for a bike mechanic reading a repair job sheet. Keep brand names, model numbers and ' +
                    'part codes exactly as-is. Return ONLY the translation, no commentary and no quotes.\n\n' +
                    trimmed,
                },
              ],
            },
          ],
          config: { temperature: 0, maxOutputTokens: 400 },
        });
        translated = response.text?.trim() || trimmed;
      } catch {
        translated = trimmed;
      }
    } else {
      translated = trimmed;
    }
    return { text: translated, detected };
  }

  // No mismatch — use the existing single-field translation path.
  return { text: await translateToEnglish(trimmed, expectedCode), detected };
}

/**
 * Bilingual booking translation. Translates the four free-text fields to
 * English (auto-detecting each one's real language when it differs from the
 * form language) and returns BOTH the English values and the untouched
 * original strings, so the staff card can show the primary English reading
 * with a collapsible "view original native text" toggle.
 */
export async function translateBookingNotesWithOriginal(
  fields: { notes?: string; problemNotes?: string; accessNotes?: string; additionalDetails?: string },
  sourceCode: LanguageCode
): Promise<{
  translated: { notes: string; problemNotes: string; accessNotes: string; additionalDetails: string };
  original: { notes: string; problemNotes: string; accessNotes: string; additionalDetails: string };
  languageDetected?: string;
}> {
  if (sourceCode === 'en') {
    // UI is English: normally a pass-through, BUT if the rider typed in another
    // language anyway (no way to tell otherwise — English is the universal
    // fallback and the common denominator), detect and translate to keep the
    // mechanic's job sheet consistent.
    const [notes, problemNotes, accessNotes, additionalDetails] = await Promise.all([
      detectAndTranslateToEnglish(fields.notes || '', sourceCode),
      detectAndTranslateToEnglish(fields.problemNotes || '', sourceCode),
      detectAndTranslateToEnglish(fields.accessNotes || '', sourceCode),
      detectAndTranslateToEnglish(fields.additionalDetails || '', sourceCode),
    ]);
    const detectedSet = new Set([notes.detected, problemNotes.detected, accessNotes.detected, additionalDetails.detected].filter(Boolean));
    return {
      translated: {
        notes: notes.text,
        problemNotes: problemNotes.text,
        accessNotes: accessNotes.text,
        additionalDetails: additionalDetails.text,
      },
      original: {
        notes: fields.notes || '',
        problemNotes: fields.problemNotes || '',
        accessNotes: fields.accessNotes || '',
        additionalDetails: fields.additionalDetails || '',
      },
      languageDetected: detectedSet.size === 1 ? detectedSet.values().next().value : undefined,
    };
  }

  const [notes, problemNotes, accessNotes, additionalDetails] = await Promise.all([
    detectAndTranslateToEnglish(fields.notes || '', sourceCode),
    detectAndTranslateToEnglish(fields.problemNotes || '', sourceCode),
    detectAndTranslateToEnglish(fields.accessNotes || '', sourceCode),
    detectAndTranslateToEnglish(fields.additionalDetails || '', sourceCode),
  ]);

  // If the field scripts all agree on a single detected language, surface it;
  // otherwise omit (the customer_language from the form remains authoritative).
  const detectedSet = new Set(
    [notes.detected, problemNotes.detected, accessNotes.detected, additionalDetails.detected].filter(v => v && ISO_LANGUAGE_RE.test(v))
  );
  const languageDetected = detectedSet.size === 1 ? detectedSet.values().next().value : undefined;

  return {
    translated: {
      notes: notes.text,
      problemNotes: problemNotes.text,
      accessNotes: accessNotes.text,
      additionalDetails: additionalDetails.text,
    },
    original: {
      notes: fields.notes || '',
      problemNotes: fields.problemNotes || '',
      accessNotes: fields.accessNotes || '',
      additionalDetails: fields.additionalDetails || '',
    },
    languageDetected,
  };
}

/**
 * Translate the rider's free-text fields in parallel. Bounded to the fields we
 * actually write into the booking notes. Any individual failure falls back to
 * that field's original text.
 */
export async function translateBookingNotes(
  fields: { notes?: string; problemNotes?: string; accessNotes?: string; additionalDetails?: string },
  sourceCode: LanguageCode
): Promise<{ notes: string; problemNotes: string; accessNotes: string; additionalDetails: string }> {
  if (sourceCode === 'en') {
    return {
      notes: fields.notes || '',
      problemNotes: fields.problemNotes || '',
      accessNotes: fields.accessNotes || '',
      additionalDetails: fields.additionalDetails || '',
    };
  }
  const [notes, problemNotes, accessNotes, additionalDetails] = await Promise.all([
    translateToEnglish(fields.notes || '', sourceCode),
    translateToEnglish(fields.problemNotes || '', sourceCode),
    translateToEnglish(fields.accessNotes || '', sourceCode),
    translateToEnglish(fields.additionalDetails || '', sourceCode),
  ]);
  return { notes, problemNotes, accessNotes, additionalDetails };
}
