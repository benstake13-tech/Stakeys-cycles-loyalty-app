import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useShop } from '../shared/context/ShopContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, toggleTheme } = useShop();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none group ${
        isDark
          ? 'bg-neutral-900 hover:bg-neutral-850 border-neutral-700/80 text-neutral-200 shadow-inner'
          : 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800 shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
        )}
      </div>

      {showLabel && (
        <span className="text-xs font-semibold">
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}

      {/* Subtle indicator pill */}
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors ${
          isDark ? 'bg-emerald-400 shadow-[0_0_6px_rgba(5,193,71,0.8)]' : 'bg-amber-500'
        }`}
      />
    </button>
  );
};
