import React, { useEffect, useState } from 'react';
import { Bot, Plus, Trash2, RotateCcw, Save, Sparkles } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import {
  AssistantConfig,
  getAssistantConfig,
  updateAssistantConfig,
  resetAssistantConfig,
} from '../config/assistantConfig';
import { isAssistantConfigured } from '../api/assistantService';

/**
 * Staff Station → Assistant.
 *
 * Lets staff control the shop assistant shown on the public website and the
 * customer loyalty app: its name, greeting, tone, quick prompts and knowledge.
 */
export const AssistantManagerTab: React.FC = () => {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const [draft, setDraft] = useState<AssistantConfig>(() => getAssistantConfig());
  const [savedSink, setSavedSink] = useState(0);

  useEffect(() => setDraft(getAssistantConfig()), []);

  const patch = (p: Partial<AssistantConfig>) => setDraft((prev) => ({ ...prev, ...p }));

  const save = () => {
    updateAssistantConfig(draft);
    setSavedSink((n) => n + 1);
  };

  const inputClass = `w-full rounded-xl border px-3 py-2 text-xs outline-none ${
    isDark ? 'border-neutral-800 bg-neutral-950 text-neutral-100' : 'border-neutral-200 bg-white text-neutral-800'
  }`;
  const cardClass = `rounded-2xl border p-4 space-y-3 ${isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white/70 border-neutral-200'}`;
  const labelClass = `block text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`;

  return (
    <div className="space-y-5">
      <div className={cardClass}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>Shop Assistant</h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                One assistant, shown on the public website and the customer loyalty app. Edit it once here and both surfaces update.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => patch({ enabled: !draft.enabled })}
              className={`pressable inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer ${
                draft.enabled
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                  : isDark ? 'border-neutral-700 text-neutral-300' : 'border-neutral-200 text-neutral-600'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${draft.enabled ? 'bg-[#05C147] animate-pulse' : 'bg-neutral-500'}`} />
              {draft.enabled ? 'Live' : 'Hidden'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetAssistantConfig();
                setDraft(getAssistantConfig());
              }}
              className="pressable inline-flex items-center gap-2 rounded-xl border border-amber-900 px-3.5 py-2 text-xs font-bold text-amber-400 hover:bg-amber-950/40 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Defaults
            </button>
            <button
              type="button"
              onClick={save}
              className="pressable inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-2 text-neutral-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <Save className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDark ? 'bg-neutral-950/60 border border-neutral-800 text-neutral-400' : 'bg-neutral-100 border border-neutral-200 text-neutral-500'}`}>
            {draft.quickPrompts.length} quick prompts · {draft.knowledge.length} chars of knowledge
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isAssistantConfigured()
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
          }`}>
            {isAssistantConfigured() ? 'AI replies active' : 'AI key missing — contact fallback only'}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isDark ? 'bg-neutral-950/60 border border-neutral-800 text-neutral-400' : 'bg-neutral-100 border border-neutral-200 text-neutral-500'}`}>
            Saved {savedSink > 0 ? `${savedSink}×` : 'locally'}
          </span>
        </div>
      </div>

      <div className={cardClass}>
        <span className={labelClass}>Identity</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-neutral-500 uppercase font-mono">Assistant name</label>
            <input className={inputClass} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] text-neutral-500 uppercase font-mono">Greeting (first message)</label>
            <input className={inputClass} value={draft.greeting} onChange={(e) => patch({ greeting: e.target.value })} />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <span className={labelClass}>Personality &amp; guardrails</span>
        <div>
          <label className="text-[10px] text-neutral-500 uppercase font-mono">Tone brief — how it should speak</label>
          <textarea rows={4} className={inputClass} value={draft.tone} onChange={(e) => patch({ tone: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 uppercase font-mono">Fallback — used when it can't answer</label>
          <textarea rows={2} className={inputClass} value={draft.fallback} onChange={(e) => patch({ fallback: e.target.value })} />
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className={labelClass}>Knowledge base</span>
            <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}>Facts the assistant is allowed to use. It is told not to invent anything beyond this.</p>
          </div>
        </div>
        <textarea rows={6} className={inputClass} value={draft.knowledge} onChange={(e) => patch({ knowledge: e.target.value })} />
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-2">
          <span className={labelClass}>Quick prompts</span>
          <button
            type="button"
            onClick={() => patch({ quickPrompts: [...draft.quickPrompts, ''] })}
            className="pressable inline-flex items-center gap-1 rounded-lg border border-emerald-700 px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/40 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        {draft.quickPrompts.map((q, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-neutral-500 uppercase font-mono">Prompt {i + 1}</label>
              <input
                className={inputClass}
                value={q}
                onChange={(e) => patch({ quickPrompts: draft.quickPrompts.map((x, idx) => (idx === i ? e.target.value : x)) })}
              />
            </div>
            <button
              type="button"
              onClick={() => patch({ quickPrompts: draft.quickPrompts.filter((_, idx) => idx !== i) })}
              className="pressable mb-1 inline-flex items-center rounded-lg border border-rose-900 px-2 py-1.5 text-rose-400 hover:bg-rose-950/40 cursor-pointer"
              aria-label={`Remove prompt ${i + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className={`${cardClass} ${isDark ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className={`text-xs font-bold ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
            Customers see this assistant bottom-right on the website and in their loyalty app.
          </span>
        </div>
      </div>
    </div>
  );
};
