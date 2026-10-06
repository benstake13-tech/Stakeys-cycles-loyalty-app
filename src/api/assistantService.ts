/**
 * Shop assistant chat service.
 *
 * Answers customer questions on the public website and the customer loyalty
 * app. The persona, greeting, quick prompts and knowledge base all come from
 * the staff-managed assistant config, so staff control what it says without a
 * code change.
 */
import { GoogleGenAI } from '@google/genai';
import { AssistantConfig, DEFAULT_ASSISTANT_CONFIG } from '../config/assistantConfig';

const MODEL = 'gemini-2.5-flash';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantContext {
  /** Live facts the assistant may quote, e.g. opening hours, stock, prices. */
  facts?: string;
  /** Which surface is asking — lets the assistant tailor its answer. */
  surface?: 'website' | 'customer';
}

const getApiKey = (): string =>
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const isAssistantConfigured = (): boolean => Boolean(getApiKey());

function buildSystemInstruction(config: AssistantConfig, context: AssistantContext): string {
  const surfaceLine =
    context.surface === 'customer'
      ? 'You are inside the customer loyalty app, so you can also help with stamps, rewards and the customer\'s own bookings.'
      : 'You are on the public website, so help visitors with repairs, prices, the shop and how to get in touch.';

  return [
    config.tone,
    surfaceLine,
    'Knowledge base:',
    config.knowledge,
    context.facts ? `Live shop data (may change):\n${context.facts}` : '',
    `If you cannot answer from the above, reply with exactly this fallback message: "${config.fallback}"`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Sends the conversation to Gemini with the staff-managed persona and returns
 * the assistant's reply text.
 */
export async function askAssistant(
  messages: AssistantMessage[],
  config: AssistantConfig = DEFAULT_ASSISTANT_CONFIG,
  context: AssistantContext = {}
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return config.fallback;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    config: {
      systemInstruction: buildSystemInstruction(config, context),
      temperature: 0.4,
      maxOutputTokens: 400,
    },
  });

  const text = response.text?.trim();
  return text || config.fallback;
}
