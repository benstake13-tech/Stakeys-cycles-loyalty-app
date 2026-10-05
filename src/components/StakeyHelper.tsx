/**
 * Virtual Stakey — the customer-facing helper.
 *
 * A floating launcher opens a chat panel where the animated avatar greets the
 * customer, answers questions (Gemini when configured, a local knowledge
 * fallback otherwise), speaks the answer aloud when the staff enable voice, and
 * can walk the customer to the right screen via `onNavigate`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Send, Volume2, VolumeX, X, Sparkles } from 'lucide-react';
import type { StakeyAvatarConfig } from '../shared/types/bikeShop';
import { StakeyAvatar } from './StakeyAvatar';
import { askStakey } from '../shared/utils/stakeyAssistant';
import { isSpeechSupported, primeVoices, speak, stopSpeaking } from '../shared/utils/stakeyVoice';

interface ChatMessage {
  id: number;
  role: 'user' | 'helper';
  text: string;
}

export interface StakeyHelperProps {
  config: StakeyAvatarConfig;
  /** Take the customer to a destination id from STAKEY_DESTINATIONS. */
  onNavigate: (target: string) => void;
  /** Optional one-line context about the current screen. */
  context?: string;
}

const SUGGESTIONS = ['How do I book a repair?', 'Show me my loyalty stamps', 'What offers do you have?'];

export function StakeyHelper({ config, onNavigate, context }: StakeyHelperProps) {
  const [open, setOpen] = useState(false);
  const [talking, setTalking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voiceOn = config.voiceEnabled && isSpeechSupported();

  const greeting = `Hi, I'm ${config.name}! I can help you book a repair, use your loyalty stamps or find your way around. What would you like to do?`;

  useEffect(() => {
    if (open) primeVoices();
    return () => stopSpeaking();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const push = (role: ChatMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }]);
  };

  const say = async (text: string) => {
    if (!voiceOn) return;
    setTalking(true);
    await speak(text, config.voiceStyle);
    setTalking(false);
  };

  const handleAsk = async (raw: string) => {
    const question = raw.trim();
    if (!question || thinking) return;
    push('user', question);
    setInput('');
    setThinking(true);
    const result = await askStakey({ question, config, context });
    setThinking(false);
    push('helper', result.reply);
    void say(result.reply);
    if (result.action.type === 'navigate' && result.action.target) {
      // Let the spoken sentence land before moving the customer.
      window.setTimeout(() => onNavigate(result.action.target), voiceOn ? 600 : 300);
    }
  };

  const openPanel = () => {
    setOpen(true);
    if (messages.length === 0) {
      push('helper', greeting);
      void say(greeting);
    }
  };

  if (!config.enabled) return null;

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={openPanel}
          aria-label={`Open ${config.name}, your helper`}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-[#0b0f14]/90 border border-emerald-500/40 pl-1.5 pr-4 py-1.5 shadow-2xl shadow-emerald-500/20 backdrop-blur hover:border-emerald-400 transition-colors cursor-pointer"
        >
          <span className="stakey-launcher-bob">
            <StakeyAvatar config={config} size={40} />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">Ask {config.name}</span>
            <span className="text-[10px] text-neutral-400">Your bike helper</span>
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(94vw,380px)] max-h-[80vh] flex flex-col rounded-3xl border border-emerald-500/30 bg-[#0b0f14]/97 backdrop-blur-xl shadow-2xl shadow-emerald-900/40 overflow-hidden animate-rise">
          <header className="flex items-center gap-3 p-3.5 border-b border-white/5 bg-gradient-to-r from-emerald-500/10 to-transparent">
            <StakeyAvatar config={config} size={44} talking={talking} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                {config.name}
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </p>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${thinking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                {thinking ? 'Thinking…' : talking ? 'Speaking…' : 'Ready to help'}
              </p>
            </div>
            {voiceOn && (
              <button
                type="button"
                onClick={() => {
                  if (talking) {
                    stopSpeaking();
                    setTalking(false);
                  }
                }}
                aria-label="Stop speaking"
                className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                {talking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setTalking(false);
                setOpen(false);
              }}
              aria-label="Close helper"
              className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-emerald-500 text-neutral-950 font-medium rounded-br-sm'
                      : 'bg-white/5 text-neutral-100 border border-white/10 rounded-bl-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white/5 border border-white/10 px-4 py-2.5 flex gap-1.5">
                  <span className="tracker-dot tracker-dot--bright" />
                  <span className="tracker-dot tracker-dot--bright" />
                  <span className="tracker-dot tracker-dot--bright" />
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAsk(s)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk(input);
            }}
            className="flex items-center gap-2 p-3 border-t border-white/5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${config.name} anything…`}
              aria-label={`Ask ${config.name}`}
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-3.5 py-2 text-[13px] text-white placeholder-neutral-500 focus:border-emerald-500/60 outline-none"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              aria-label="Send"
              className="p-2.5 rounded-full bg-emerald-500 text-neutral-950 disabled:opacity-40 hover:bg-emerald-400 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
