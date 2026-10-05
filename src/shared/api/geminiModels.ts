/**
 * Central Gemini model ids for the app's AI features.
 *
 * Keep these in one place: the bike identifier (structured JSON out) and the
 * avatar portrait generator (image out) both read from here, so a model bump
 * only has to happen once.
 */

/** Text + structured-JSON model used by the bike identifier. */
export const GEMINI_TEXT_MODEL = 'gemini-3.8-flash';

/** Native image-generation model used for HD avatar portraits. */
export const GEMINI_IMAGE_MODEL = 'gemini-3-pro-image';

/** The app's shared client-side Gemini API key env var. */
export const GEMINI_API_KEY_ENV = 'VITE_GEMINI_API_KEY';
