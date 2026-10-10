/**
 * AI assist for the staff E-Scooter / E-Bike error-code lookup.
 *
 * Given the category, brand, model, and the rider's symptom text, this asks
 * Gemini to pick the most likely error-code families from the catalogue we already
 * ship (the codes the technician sees), explain what the fault usually is, and
 * suggest workshop steps. It never invents a code number that is not in our
 * catalogue — the system prompt explicitly forbids it — so the tech always sees
 * codes they can find on the display.
 *
 * Falls back to the deterministic list (no AI) when the service is not
 * configured, offline, or the reply cannot be parsed.
 */
import { GoogleGenAI } from '@google/genai';
import { resolveGeminiModel, noThinking } from './geminiModel';
import { classifyVisionError, VisionErrorInfo } from './visionErrors';
import {
  EVehicleCategory,
  EVehicleErrorDefinition,
  errorCodesFor,
  findErrorCode,
  normalizeErrorCode,
} from '../data/eVehicleCodes';

const ASSIST_TIMEOUT_MS = 20000;

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const isECodeAssistConfigured = (): boolean => Boolean(getApiKey());

export interface ECodeAssistRequest {
  category: EVehicleCategory;
  brand: string;
  model: string;
  /** The rider's own words about the fault (may be in any language). */
  symptom: string;
}

export interface ECodeAssistItem {
  code: string;
  title: string;
  reason: string;
  confidence: number;
}

export interface ECodeAssistResult {
  source: 'ai' | 'offline' | 'none';
  item?: ECodeAssistRequest;
  /** The codes the AI believes are most likely, all guaranteed to exist. */
  matches: ECodeAssistItem[];
  /** What the AI thinks the technician should check first. */
  guidance: string;
  /** True when no catalogue codes could be matched (nothing useful to show). */
  empty: boolean;
  /**
   * Set when the AI call itself failed (bad key, quota, network) and the result
   * fell back to deterministic matching. The UI surfaces this so a real API
   * failure is not misreported as "AI not configured".
   */
  error?: VisionErrorInfo;
}

/** A purely deterministic failure/suggestion entry — used when the AI is unavailable. */
const offlineGuidance = (
  req: ECodeAssistRequest,
  error?: VisionErrorInfo
): ECodeAssistResult => {
  const codes = errorCodesFor(req.category, req.brand, req.model);
  // Keyword buckets map a symptom to the code(s) in THIS model's catalogue whose
  // title or description covers it — so a Xiaomi throttle symptom still finds
  // E23 even though the generic catalogue lists E03.
  const buckets: { terms: string[]; labels: string[] }[] = [
    { terms: ['throttle', 'twist', 'accelerat', 'accelera'], labels: ['throttle'] },
    { terms: ['brake', 'stop', 'lever', 'braking'], labels: ['brake'] },
    { terms: ['battery', 'charg', 'low', 'flat', 'won\'t charge', 'charge'], labels: ['battery', 'bms', 'charg'] },
    { terms: ['motor', 'hall', 'hum', 'grind', 'no power', 'cut'], labels: ['motor', 'hall'] },
    { terms: ['display', 'screen', 'dark', 'no dash', 'dashboard'], labels: ['display'] },
    { terms: ['overheat', 'hot', 'burn', 'over-temperature', 'overheating'], labels: ['overheat', 'over temperature'] },
  ];
  const text = (req.symptom || '').toLowerCase();
  const wantedLabels = buckets
    .filter((b) => b.terms.some((t) => text.includes(t)))
    .flatMap((b) => b.labels);
  const matches: ECodeAssistItem[] =
    wantedLabels.length === 0
      ? []
      : codes
          .filter((c) => {
            const hay = `${c.title} ${c.description}`.toLowerCase();
            return wantedLabels.some((w) => hay.includes(w));
          })
          .slice(0, 3)
          .map((c) => ({
            code: c.code,
            title: c.title,
            reason: 'Matches the symptom keywords in this model’s fault catalogue.',
            confidence: 0.5,
          }));

  return {
    source: 'offline',
    item: req,
    matches,
    guidance: 'AI assist is not configured on this build. Review all codes shown on the display and start with the highest-severity entry.',
    empty: matches.length === 0,
    error,
  };
};

const SYSTEM_INSTRUCTION = `You are the EV diagnostics assistant for Stakey's Cycles, a UK bicycle and e-scooter workshop.
You are given a category (electric_scooter or ebike), a brand, a model, and the rider's symptom.
You must answer using ONLY the error codes from the provided catalogue (the codes the rider's display can actually show).
Rules:
1. Never invent a code number that is not in the provided catalogue.
2. Pick 1-4 catalogue codes that best match the symptom; order by likelihood.
3. For each chosen code give a one-sentence reason and a confidence 0-1.
4. End with a single 'guidance' field: 1-2 sentences on what the technician should check in the workshop.
5. If the symptom does not match any catalogue code well, return an empty matches array and guidance that says so.
Reply as JSON with fields: matches (array of {code,title,reason,confidence}), guidance.`;

function buildPrompt(req: ECodeAssistRequest, codes: EVehicleErrorDefinition[]): string {
  const catalogue = codes.map((c) => `${c.code} ${c.title}`).join('\n');
  return [
    `Category: ${req.category}`,
    `Brand: ${req.brand}`,
    `Model: ${req.model}`,
    `Rider symptom: ${req.symptom || '(none given)'}`,
    '',
    'Catalogue:',
    catalogue,
  ].join('\n');
}

/** Strip prose the model may wrap around the JSON. */
function extractJson(text: string): string {
  const cleaned = text.trim();
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    return start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  }
}

/**
 * Ask the AI to narrow down which catalogue codes fit the symptom.
 * Always returns a result; never throws.
 */
export async function assistECodeLookup(req: ECodeAssistRequest): Promise<ECodeAssistResult> {
  const codes = errorCodesFor(req.category, req.brand, req.model);
  const offline = offlineGuidance(req);
  const apiKey = getApiKey();
  if (!apiKey) return offline;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSIST_TIMEOUT_MS);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = resolveGeminiModel();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: buildPrompt(req, codes) }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 500,
        abortSignal: controller.signal,
        httpOptions: { timeout: ASSIST_TIMEOUT_MS, retryOptions: { attempts: 1 } },
        ...noThinking(model),
      },
    });

    const text = response.text;
    if (!text) {
      return offlineGuidance(req, classifyVisionError(new Error('The AI returned an empty response.'), { configured: true }));
    }

    const parsed = JSON.parse(extractJson(text));
    const rawMatches = Array.isArray(parsed?.matches) ? parsed.matches : [];
    // Only accept codes that exist in our catalogue — the model must not invent.
    const matches: ECodeAssistItem[] = rawMatches
      .filter((m: any) => findErrorCode(codes, String(m?.code || '')))
      .map((m: any) => ({
        code: String(m.code || '').toUpperCase(),
        title: String(m.title || findErrorCode(codes, String(m.code))?.title || ''),
        reason: String(m.reason || ''),
        confidence: Math.max(0, Math.min(1, Number(m.confidence) || 0)),
      }))
      .slice(0, 4);

    const guidance = String(parsed?.guidance || '').trim();
    if (!matches.length && !guidance) return offline;

    return {
      source: 'ai',
      item: req,
      matches,
      guidance: guidance || offline.guidance,
      empty: matches.length === 0,
    };
  } catch (err) {
    // Surface the real cause (quota, bad key, network) rather than silently
    // pretending the AI is unconfigured.
    const info = classifyVisionError(err, { configured: true });
    return { ...offlineGuidance(req), guidance: info.message, error: info };
  } finally {
    clearTimeout(timer);
  }
}

/** Re-export so the UI can normalise the code the rider typed. */
export { normalizeErrorCode };