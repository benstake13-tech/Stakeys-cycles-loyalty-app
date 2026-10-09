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
import { resolveGeminiModel, NO_THINKING } from './geminiModel';

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
    const response = await ai.models.generateContent({
      model: resolveGeminiModel(),
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
      config: { temperature: 0, maxOutputTokens: 400, ...NO_THINKING },
    });
    const out = response.text?.trim();
    return out || trimmed;
  } catch {
    return trimmed;
  }
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
