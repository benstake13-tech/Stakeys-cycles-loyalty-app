import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles, Loader2 } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useWebsiteContent } from '../context/WebsiteContentStore';
import {
  AssistantConfig,
  getAssistantConfig,
  subscribeAssistantConfig,
} from '../config/assistantConfig';
import { AssistantMessage, askAssistant, isAssistantConfigured } from '../api/assistantService';

interface ShopAssistantProps {
  surface: 'website' | 'customer';
}

/**
 * Floating shop assistant shown on the public website and the customer app.
 * Everything it says is driven by the staff-managed assistant config.
 */
export const ShopAssistant: React.FC<ShopAssistantProps> = ({ surface }) => {
  const { theme, promotions, currentUser, bookings } = useShop();
  const content = useWebsiteContent();
  const isDark = theme === 'dark';

  const [config, setConfig] = useState<AssistantConfig>(() => getAssistantConfig());
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeAssistantConfig(setConfig), []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, open]);

  if (!config.enabled) return null;

  const liveFacts = [
    `Phone: ${content.phone}. Email: ${content.email}.`,
    promotions.length
      ? `Live promotions: ${promotions.map((p) => `${p.title} (code ${p.code}, ends ${p.endDate})`).join('; ')}.`
      : 'No promotions running right now.',
    content.products.length
      ? `Shop items: ${content.products
          .slice(0, 12)
          .map((p) => `${p.name} £${p.price}${p.stock <= 0 ? ' (out of stock)' : ` (${p.stock} in stock)`}`)
          .join('; ')}.`
      : '',
    surface === 'customer' && currentUser
      ? `This customer is ${currentUser.displayName}, membership ${currentUser.membershipNumber}, with ${currentUser.stamps} stamps and ${currentUser.points} points, and ${bookings.length} booking(s).`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    const next: AssistantMessage[] = [...messages, { role: 'user', text: question }];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const reply = await askAssistant(next, config, { facts: liveFacts, surface });
      setMessages([...next, { role: 'assistant', text: reply }]);
    } catch (err) {
      console.warn('[ASSISTANT] reply failed:', err);
      setMessages([...next, { role: 'assistant', text: config.fallback }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className={`fixed bottom-24 right-4 z-[60] w-[min(94vw,24rem)] rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="text-sm font-black uppercase tracking-wider">{config.name}</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 max-h-[52vh] overflow-y-auto p-3 space-y-3">
            <div className={`rounded-xl p-3 text-xs leading-relaxed ${isDark ? 'bg-neutral-900 text-neutral-200' : 'bg-neutral-100 text-neutral-700'}`}>
              {config.greeting}
            </div>

            {messages.length === 0 && config.quickPrompts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {config.quickPrompts.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void send(q)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      isDark ? 'border-neutral-700 text-neutral-300 hover:border-emerald-500/60' : 'border-neutral-200 text-neutral-600 hover:border-emerald-500/60'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl p-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-emerald-500 text-neutral-950 font-medium'
                    : isDark
                      ? 'bg-neutral-900 text-neutral-200'
                      : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                {m.text}
              </div>
            ))}

            {thinking && (
              <div className={`inline-flex items-center gap-2 rounded-xl p-2.5 text-xs ${isDark ? 'bg-neutral-900 text-neutral-400' : 'bg-neutral-100 text-neutral-500'}`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className={`flex items-center gap-2 border-t p-2.5 ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about repairs, prices, stock…"
              className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none ${
                isDark ? 'border-neutral-800 bg-neutral-900 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-800'
              }`}
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="pressable inline-flex items-center justify-center rounded-xl bg-emerald-500 p-2 text-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {!isAssistantConfigured() && (
            <p className={`px-3 pb-2 text-[10px] ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
              AI replies are off until a Gemini key is configured — the workshop contact details still work.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : `Open ${config.name}`}
        className="fixed bottom-6 right-4 z-[60] inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-neutral-950 shadow-2xl shadow-emerald-500/30 cursor-pointer hover:scale-105 transition-transform"
      >
        {open ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        {!open && <span className="text-xs font-black uppercase tracking-wider">{config.name}</span>}
      </button>
    </>
  );
};
