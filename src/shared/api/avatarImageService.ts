/**
 * Generates an HD, Bitmoji-style likeness portrait with Google's Gemini image
 * model ("nano-banana" / gemini-2.5-flash-image).
 *
 * Mirrors the existing bike-vision integration: the same `@google/genai`
 * client and `VITE_GEMINI_API_KEY`. The model returns inline image bytes which
 * we hand back as a base64 data URL, so the result can be shown, downloaded
 * and persisted on the profile without any storage bucket.
 *
 * An optional source photo can be supplied so the portrait captures the
 * customer's real features rather than only the vector config.
 */

import { GoogleGenAI } from '@google/genai';
import { type AvatarConfig, type AvatarImage } from '../types/avatar';
import { buildAvatarPrompt } from '../utils/avatarPrompt';
import { GEMINI_IMAGE_MODEL } from './geminiModels';

/** Gemini's native image model. */
export const AVATAR_IMAGE_MODEL = GEMINI_IMAGE_MODEL;

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_GEMINI_API_KEY) ||
  '';

export const isAvatarImageGenConfigured = (): boolean => Boolean(getApiKey());

export interface GenerateAvatarOptions {
  config: AvatarConfig;
  /** Optional free-text brief, e.g. "female, late 20s". */
  brief?: string;
  /** Optional base64 data URL of a reference photo of the customer. */
  sourceImage?: string;
}

export class AvatarImageError extends Error {}

/**
 * Splits a data URL into { data, mimeType }. Accepts a bare base64 string too.
 */
function splitDataUrl(input: string): { data: string; mimeType: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(input);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: 'image/jpeg', data: input };
}

/**
 * Generates a portrait and returns it as an AvatarImage record.
 * Throws AvatarImageError with a human-readable message on failure.
 */
export async function generateAvatarImage({
  config,
  brief,
  sourceImage,
}: GenerateAvatarOptions): Promise<AvatarImage> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AvatarImageError(
      'Avatar image generation is not configured. Add VITE_GEMINI_API_KEY to enable it.'
    );
  }

  const prompt = buildAvatarPrompt({ config, brief });
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [];
  if (sourceImage) {
    const { data, mimeType } = splitDataUrl(sourceImage);
    parts.push({ inlineData: { data, mimeType } });
    parts.push({
      text: `Using the attached photo as the likeness reference, ${prompt}`,
    });
  } else {
    parts.push({ text: prompt });
  }

  let response;
  try {
    response = await ai.models.generateContent({
      model: AVATAR_IMAGE_MODEL,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.6 },
    });
  } catch (err: any) {
    throw new AvatarImageError(
      `The image model could not be reached: ${String(err?.message || err).slice(0, 160)}`
    );
  }

  const responseParts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((p: any) => p?.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new AvatarImageError(
      'The image model returned no image. Try again, or adjust the brief.'
    );
  }

  const mime = imagePart.inlineData.mimeType || 'image/png';
  const dataUrl = `data:${mime};base64,${imagePart.inlineData.data}`;

  return {
    dataUrl,
    prompt,
    model: AVATAR_IMAGE_MODEL,
    createdAt: new Date().toISOString(),
  };
}

/** Triggers a browser download of a generated portrait. */
export function downloadAvatarImage(dataUrl: string, filename = 'stakeys-avatar.png'): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
