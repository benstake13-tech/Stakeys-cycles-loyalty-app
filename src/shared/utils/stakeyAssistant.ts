/**
 * Virtual Stakey — the AI helper brain.
 *
 * Wraps Gemini (`@google/genai`, same pattern as `visionService`) with a small
 * in-app knowledge base and a local fallback so the helper can always guide a
 * customer even when no API key is configured. Answers are short and
 * conversational because they are meant to be *spoken* aloud.
 */
import { GoogleGenAI, Type } from '@google/genai';
import type { StakeyAvatarConfig } from '../types/bikeShop';
import { MAINTENANCE_PACKAGES } from '../data/maintenancePackages';

const MODEL = 'gemini-2.5-flash';

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY) || '';

export const isStakeyAiConfigured = (): boolean => Boolean(getApiKey());

/** Destinations Virtual Stakey is allowed to send a customer to. */
export interface StakeyDestination {
  target: string;
  label: string;
  description: string;
}

export const STAKEY_DESTINATIONS: StakeyDestination[] = [
  { target: 'booking', label: 'Book a repair', description: 'The booking form to book a workshop visit or mobile call-out' },
  { target: 'loyalty', label: 'Loyalty pass', description: 'The customer stamp card and rewards pass' },
  { target: 'garage', label: 'My garage', description: 'Saved bikes, service history and repair tracking' },
  { target: 'promotions', label: 'Offers', description: 'Current promotions and discount codes' },
  { target: 'prizes', label: 'Prize wheel', description: 'The weekly prize draw and wheel' },
  { target: 'contact', label: 'Contact us', description: 'Phone, WhatsApp and directions to the workshop' },
];

export interface StakeyAction {
  type: 'navigate' | 'none';
  target: string;
}

export interface StakeyReply {
  reply: string;
  action: StakeyAction;
  source: 'ai' | 'local';
}

export interface StakeyAnswerInput {
  question: string;
  config: StakeyAvatarConfig;
  /** Optional short context so answers can reference what the customer sees. */
  context?: string;
}

function knowledgeBase(): string {
  const packages = MAINTENANCE_PACKAGES.map(
    (p) => `- ${p.name} (from £${p.indicativePrice}): ${p.tagline}`.trim()
  ).join('\n');
  const destinations = STAKEY_DESTINATIONS.map((d) => `- "${d.target}" → ${d.label}: ${d.description}`).join('\n');
  return [
    "Stakey's Cycles & Scooter is a bike and e-scooter workshop: repairs, servicing, mobile call-outs, e-bike and e-scooter diagnostics, and a loyalty stamp card.",
    '',
    'Seasonal maintenance packages:',
    packages || '- (none configured)',
    '',
    'Places in the app you can send the customer to (use the exact target id):',
    destinations,
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'A short, warm, spoken-style answer (max ~60 words). No markdown.',
    },
    actionTarget: {
      type: Type.STRING,
      description:
        'The exact destination id to take the customer to, or an empty string when no navigation is needed.',
    },
  },
  required: ['reply'],
};

function buildSystemPrompt(config: StakeyAvatarConfig): string {
  return [
    config.persona,
    '',
    'How to answer:',
    '- Keep it to 1-3 short sentences. It will be read aloud by a voice, so avoid lists, emoji, markdown and URLs.',
    '- If the customer asks to do something that lives in a screen, set actionTarget to the matching destination id so the app can take them there and say you are opening it.',
    '- If you do not know something (exact price, stock, timing), say so and offer to pass them to a mechanic. Never invent facts.',
    '',
    'Knowledge base:',
    knowledgeBase(),
  ].join('\n');
}

/** Keyword fallback used when no API key is set (or the call fails). */
export function answerStakeyLocally(question: string): StakeyReply {
  const q = question.toLowerCase();
  const nav = (target: string, reply: string): StakeyReply => ({
    reply,
    action: { type: 'navigate', target },
    source: 'local',
  });
  if (/\b(book|booking|appointment|reserve|schedule)s?\b/.test(q))
    return nav('booking', 'Sure — let me open the booking form so you can pick a date and time.');
  if (/\b(loyalty|stamp|points|reward|card)s?\b/.test(q))
    return nav('loyalty', "I'll open your loyalty pass so you can see your stamps and rewards.");
  if (/\b(garage|my bike|my bikes|history|repair|track)s?\b/.test(q))
    return nav('garage', "Let's open your garage to see your bikes and repair progress.");
  if (/\b(offer|promo|discount|deal|voucher)s?\b/.test(q))
    return nav('promotions', "I'll show you the current offers and discount codes.");
  if (/\b(prize|wheel|draw|win)s?\b/.test(q))
    return nav('prizes', "Let's take a look at the weekly prize wheel.");
  if (/\b(contact|phone|call|address|where|open|hours)\b/.test(q))
    return nav('contact', "I'll open our contact details so you can reach the workshop.");
  return {
    reply:
      "I'm your helper for Stakey's Cycles. I can help you book a repair, use your loyalty stamps, check your garage or find our offers — just ask, or tell me what you'd like to do.",
    action: { type: 'none', target: '' },
    source: 'local',
  };
}

export async function askStakey(input: StakeyAnswerInput): Promise<StakeyReply> {
  const question = input.question.trim();
  if (!question) {
    return { reply: 'Ask me anything about your bike or the app.', action: { type: 'none', target: '' }, source: 'local' };
  }
  const apiKey = getApiKey();
  if (!apiKey) return answerStakeyLocally(question);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = input.context ? `Context: ${input.context}\n\nCustomer: ${question}` : question;
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: contents }] }],
      config: {
        systemInstruction: buildSystemPrompt(input.config),
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.6,
      },
    });
    const text = response.text;
    if (!text) return answerStakeyLocally(question);
    const parsed = JSON.parse(text) as { reply?: string; actionTarget?: string };
    const reply = (parsed.reply || '').trim();
    if (!reply) return answerStakeyLocally(question);
    const target = (parsed.actionTarget || '').trim();
    const valid = STAKEY_DESTINATIONS.some((d) => d.target === target);
    return {
      reply,
      action: valid ? { type: 'navigate', target } : { type: 'none', target: '' },
      source: 'ai',
    };
  } catch (err) {
    console.warn('[STAKEY AI] falling back to local answer:', err);
    return answerStakeyLocally(question);
  }
}
