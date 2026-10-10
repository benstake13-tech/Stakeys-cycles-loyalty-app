/**
 * AI promotion advisor.
 *
 * Asks Gemini (the low-quota Flash-Lite model, same as the other in-browser AI
 * features) for a short, concrete set of campaign suggestions grounded in the
 * shop's own live promotions, coupon usage and clear scheduling windows.
 *
 * Quota discipline: results are cached per brief (so re-opening the planner, or
 * re-rendering, does not re-ask), the model is the cheapest tier, and the
 * response is capped to a small JSON object. Any failure (no key, 429, offline)
 * falls back to the deterministic `recommendPromotion` — the planner is never
 * left without advice.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { resolveGeminiModel, noThinking } from './geminiModel';
import {
  AdvisorAction,
  AdvisorResult,
  PromotionBrief,
  briefToPrompt,
  recommendPromotion,
} from '../utils/promotionAdvisor';
import { DiscountAudience, VehicleCategory } from '../types/bikeShop';

const ADVISOR_TIMEOUT_MS = 20000;

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const isPromotionAdvisorConfigured = (): boolean => Boolean(getApiKey());

const SYSTEM_INSTRUCTION = `You are Stakey's Cycles' promotions strategist for a UK bicycle and e-scooter workshop.
You are given the shop's live campaigns, coupon redemption history and clear scheduling windows.
Propose 2-3 concrete, low-risk campaigns that fit the clear windows, learn from what has already redeemed,
and avoid clashing with live campaigns. Prefer member-only offers and modest discounts (5-20%).
Every action must include start and end dates that fall inside a clear window. Keep rationale to one short sentence.`;

const ADVISOR_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: 'One-line summary of the recommended direction' },
    actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          rationale: { type: Type.STRING, description: 'One short sentence' },
          discountPercentage: { type: Type.NUMBER, description: 'Percent off, or 0' },
          discountAmount: { type: Type.NUMBER, description: 'Fixed £ credit, or 0' },
          categories: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: 'One of: cycle, ebike, electric_scooter, cargo' },
          },
          startDate: { type: Type.STRING, description: 'YYYY-MM-DD, inside a clear window' },
          endDate: { type: Type.STRING, description: 'YYYY-MM-DD, inside a clear window' },
          audience: { type: Type.STRING, description: 'One of: public, member' },
          confidence: { type: Type.NUMBER, description: '0 to 1' },
        },
        required: ['title', 'rationale', 'categories', 'startDate', 'endDate'],
      },
    },
  },
  required: ['headline', 'actions'],
};

const VALID_CATEGORIES: VehicleCategory[] = ['cycle', 'ebike', 'electric_scooter', 'cargo'];

/** In-memory cache keyed by the exact brief text, so a re-render never re-asks. */
const cache = new Map<string, AdvisorResult>();

/** Clears the cache (tests + when the underlying data meaningfully changes). */
export const clearAdvisorCache = (): void => cache.clear();

const toAction = (raw: any): AdvisorAction => ({
  title: String(raw?.title || 'Campaign'),
  rationale: String(raw?.rationale || ''),
  discountPercentage: Number(raw?.discountPercentage) || undefined,
  discountAmount: Number(raw?.discountAmount) || undefined,
  categories: (Array.isArray(raw?.categories) ? raw.categories : []).filter((c: any): c is VehicleCategory =>
    VALID_CATEGORIES.includes(c)
  ),
  startDate: String(raw?.startDate || ''),
  endDate: String(raw?.endDate || ''),
  audience: raw?.audience === 'member' ? ('member' as DiscountAudience) : ('public' as DiscountAudience),
  confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0.5)),
});

/**
 * Returns campaign advice for the given brief. Tries the AI first (once, cached);
 * on any problem returns the deterministic recommendation with source 'offline'.
 */
export async function advisePromotion(brief: PromotionBrief): Promise<AdvisorResult> {
  const key = briefToPrompt(brief);
  const cached = cache.get(key);
  if (cached) return cached;

  const offline = recommendPromotion(brief);
  const apiKey = getApiKey();
  if (!apiKey) return offline;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADVISOR_TIMEOUT_MS);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = resolveGeminiModel();
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `${briefToPrompt(brief)}` }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: ADVISOR_SCHEMA,
        temperature: 0.4,
        abortSignal: controller.signal,
        httpOptions: { timeout: ADVISOR_TIMEOUT_MS, retryOptions: { attempts: 1 } },
        ...noThinking(model),
      },
    });

    const text = response.text;
    if (!text) return offline;
    const parsed = JSON.parse(text);
    const actions: AdvisorAction[] = (Array.isArray(parsed?.actions) ? parsed.actions : [])
      .map(toAction)
      .filter((a: AdvisorAction) => a.title && a.startDate && a.endDate);
    if (!actions.length) return offline;

    const result: AdvisorResult = {
      headline: String(parsed?.headline || offline.headline),
      actions,
      source: 'ai',
    };
    cache.set(key, result);
    return result;
  } catch {
    // Quota exhausted / offline / bad response — the deterministic plan stands.
    return offline;
  } finally {
    clearTimeout(timer);
  }
}
