import React, { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useShop } from '../context/ShopContext';

export type TabTone = 'emerald' | 'amber' | 'neutral' | 'rose' | 'sky';

export interface SegmentedTab<T extends string = string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
  tone?: TabTone;
  hint?: string;
}

interface SegmentedTabsProps<T extends string = string> {
  tabs: SegmentedTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

const TONE_ICON: Record<TabTone, string> = {
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  neutral: 'text-neutral-400',
  rose: 'text-rose-400',
  sky: 'text-sky-400',
};

const TONE_BADGE_DARK: Record<TabTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  neutral: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const TONE_BADGE_LIGHT: Record<TabTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  amber: 'bg-amber-100 text-amber-700 border-amber-300',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-300',
  rose: 'bg-rose-100 text-rose-700 border-rose-300',
  sky: 'bg-sky-100 text-sky-700 border-sky-300',
};

export function SegmentedTabs<T extends string = string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
}: SegmentedTabsProps<T>) {
  const { theme } = useShop();
  const isDark = theme === 'dark';
  const listRef = useRef<HTMLDivElement>(null);

  const pad = size === 'sm' ? 'px-3 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs';
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  const move = (from: number, delta: number) => {
    const next = (from + delta + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      move(index, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(index, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(0, 0);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(tabs.length - 1, 0);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`no-scrollbar flex items-center gap-1.5 overflow-x-auto rounded-2xl border p-1.5 shadow-sm ${
        isDark ? 'border-neutral-800/90 bg-[#0b0e13]' : 'border-neutral-200 bg-white'
      } ${className}`}
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        const tone = tab.tone ?? 'emerald';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            title={tab.hint}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`pressable flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl font-semibold ${
              pad
            } ${
              isActive
                ? isDark
                  ? 'border border-emerald-500/40 bg-emerald-500/15 text-white shadow-[0_0_0_1px_rgba(5,193,71,0.15)]'
                  : 'border border-emerald-500/50 bg-emerald-50 text-emerald-900 shadow-sm'
                : isDark
                ? 'border border-transparent text-neutral-400 hover:bg-neutral-900/80 hover:text-white'
                : 'border border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            {Icon && <Icon className={`${iconSize} ${isActive ? TONE_ICON[tone] : isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== 0 && (
              <span
                className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  isDark ? TONE_BADGE_DARK[tone] : TONE_BADGE_LIGHT[tone]
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;
