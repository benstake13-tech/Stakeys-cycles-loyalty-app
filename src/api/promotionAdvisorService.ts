import { generateGemini, isGeminiGatewayConfigured } from './geminiGateway';
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
import { Type } from '@google/genai';
import { resolveGeminiModel, noThinking } from './geminiModel';
import {
  AdvisorAction,
  AdvisorResult,
  PromotionBrief,
  briefToPrompt,
  recommendPromotion,
} from '../utils/promotionAdvisor';
import { DiscountAudience, VehicleCategory } from '../types/bikeShop';
import { PROMOTION_STRATEGY_INSTRUCTIONS, assessStrategyAction, validDay } from '../../supabase/functions/_shared/promotionStrategy';

const ADVISOR_TIMEOUT_MS = 20000;

const getApiKey = () => isGeminiGatewayConfigured() ? 'server-side' : '';

export const isPromotionAdvisorConfigured = (): boolean => Boolean(getApiKey());

const SYSTEM_INSTRUCTION = PROMOTION_STRATEGY_INSTRUCTIONS;

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
          segmentId: { type: Type.STRING, description: 'An exact supplied segment id, or quote-first when values are unknown' },
          serviceId: { type: Type.STRING, description: 'An exact supplied catalogue id, or empty for a quote-first idea' },
          evidence: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Observed facts and dated evidence. Label seasonal assumptions.' },
          checks: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Missing data, margin and capacity checks for staff' },
          channel: { type: Type.STRING, description: 'Suggested communication channel; no automatic messages' },
          successMetric: { type: Type.STRING, description: 'What staff should measure, without invented numerical targets' },
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
        required: ['title', 'rationale', 'categories', 'startDate', 'endDate', 'segmentId', 'evidence', 'checks', 'channel', 'successMetric'],
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

const toAction = (raw: any, brief: PromotionBrief): AdvisorAction | null => {
  if (!raw || typeof raw !== 'object' || !String(raw.title || '').trim() || !String(raw.rationale || '').trim()) return null;
  if (!validDay(raw.startDate) || !validDay(raw.endDate) || raw.endDate < raw.startDate || raw.startDate < brief.today) return null;
  if (!brief.clearWindows.some(w => raw.startDate >= w.startDate && raw.endDate <= w.endDate)) return null;
  const assessed = assessStrategyAction(raw, brief.strategy);
  if (!assessed) return null;
  const segment = brief.strategy.segments.find(s => s.id === assessed.segmentId);
  return ({
  title: String(raw?.title || 'Campaign'),
  rationale: String(raw?.rationale || ''),
  categories: segment ? [segment.category] : (Array.isArray(raw?.categories) ? raw.categories : []).filter((c: any): c is VehicleCategory =>
    VALID_CATEGORIES.includes(c)
  ),
  startDate: String(raw?.startDate || ''),
  endDate: String(raw?.endDate || ''),
  audience: raw?.audience === 'member' ? ('member' as DiscountAudience) : ('public' as DiscountAudience),
  confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0.5)),
  ...assessed,
});
};

/**
 * Returns campaign advice for the given brief. Tries the AI first (once, cached);
 * on any problem returns the deterministic recommendation with source 'offline'.
 */
export async function advisePromotion(brief: PromotionBrief): Promise<AdvisorResult> {
  const key = briefToPrompt(brief);
  const cached = cache.get(key);
  if (cached) return cached;

  const offline = recommendPromotion(brief);
  if (!brief.clearWindows.length) return offline;
  const apiKey = getApiKey();
  if (!apiKey) return offline;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ADVISOR_TIMEOUT_MS);
  try {
    const ai = { models: { generateContent: generateGemini } };
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
      .map((raw: unknown) => toAction(raw, brief))
      .filter((a: AdvisorAction | null): a is AdvisorAction => a !== null).slice(0, 3);
    if (!actions.length) return offline;

    const result: AdvisorResult = {
      headline: String(parsed?.headline || offline.headline),
      actions,
      source: 'ai',
      notes: 'Every idea needs a total quote, cost check and staff approval. No campaign has been published.',
    };
    if (cache.size >= 30) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch {
    // Quota exhausted / offline / bad response — the deterministic plan stands.
    return offline;
  } finally {
    clearTimeout(timer);
  }
}
