import React, { useState } from 'react';
import { Calculator, Delete, Plus } from 'lucide-react';
import {
  CalcOp,
  CalcState,
  JobCategory,
  pressBackspace,
  pressClear,
  pressDecimal,
  pressDigit,
  pressEquals,
  pressOp,
  pressPercent,
  pressSign,
  displayText,
  displayAmount,
  formatMoney,
  historyText,
  calcJobLine,
} from '../utils/tillCalculator';
import type { SaleLineItem } from '../types/bikeShop';

interface TillCalculatorProps {
  onAddLine: (line: Omit<SaleLineItem, 'id'>) => void;
  isDark?: boolean;
}

const CATEGORIES: JobCategory[] = ['Labour', 'Part', 'Consumable', 'Diagnostic'];

const OP_KEYS: { op: CalcOp; label: string }[] = [
  { op: '÷', label: '÷' },
  { op: '×', label: '×' },
  { op: '-', label: '−' },
  { op: '+', label: '+' },
];

/**
 * High-end till calculator. Staff tap out a job's total (e.g. labour + a part),
 * name it, and drop it onto the basket as one billable line. Numeric keypad
 * layout mirrors a PAX / Zonas-style counter terminal; every key is a real
 * button so it works by touch and by keyboard.
 */
export const TillCalculator: React.FC<TillCalculatorProps> = ({ onAddLine, isDark = true }) => {
  const [calc, setCalc] = useState<CalcState>(() => pressClear());
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<JobCategory>('Labour');

  const amount = displayAmount(calc);
  const canAdd = amount !== 0;

  const submit = () => {
    if (!canAdd) return;
    onAddLine(calcJobLine(calc, description, category));
    setCalc(pressClear());
    setDescription('');
  };

  const key = (label: React.ReactNode, onClick: () => void, className = '') => (
    <button
      type="button"
      onClick={onClick}
      className={`pressable flex h-12 items-center justify-center rounded-xl border font-mono text-lg font-bold transition-colors ${className}`}
    >
      {label}
    </button>
  );

  const numKey = (label: string) =>
    key(
      label,
      () => setCalc((s) => pressDigit(s, label)),
      'border-neutral-800 bg-black text-white hover:border-emerald-500/50 hover:text-emerald-300'
    );

  const opKey = ({ op, label }: { op: CalcOp; label: string }) =>
    key(
      label,
      () => setCalc((s) => pressOp(s, op)),
      calc.op === op && calc.replaceEntry
        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
        : 'border-neutral-800 bg-neutral-900 text-sky-300 hover:border-sky-500/50'
    );

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          <Calculator className="w-3.5 h-3.5 text-emerald-400" /> Till calculator
        </span>
        <span className="text-[10px] text-neutral-600">Add up a job, then bill it</span>
      </div>

      {/* Display */}
      <div className="mb-3 rounded-xl border border-neutral-800 bg-black px-4 py-3 text-right">
        <div className="h-4 truncate font-mono text-xs text-neutral-500">{historyText(calc)}</div>
        <div
          className={`truncate font-mono text-3xl font-black ${
            calc.errored ? 'text-rose-400' : 'text-emerald-400'
          }`}
          aria-live="polite"
        >
          £{displayText(calc)}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-2">
        {key('C', () => setCalc(pressClear()), 'border-rose-900/60 bg-rose-950/30 text-rose-300 hover:bg-rose-950/60')}
        {key(
          <Delete className="w-4 h-4" />,
          () => setCalc(pressBackspace),
          'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
        )}
        {key('%', () => setCalc(pressPercent), 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600')}
        {opKey(OP_KEYS[0])}

        {numKey('7')}
        {numKey('8')}
        {numKey('9')}
        {opKey(OP_KEYS[1])}

        {numKey('4')}
        {numKey('5')}
        {numKey('6')}
        {opKey(OP_KEYS[2])}

        {numKey('1')}
        {numKey('2')}
        {numKey('3')}
        {opKey(OP_KEYS[3])}

        {key(
          '±',
          () => setCalc(pressSign),
          'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
        )}
        {numKey('0')}
        {key(
          '.',
          () => setCalc(pressDecimal),
          'border-neutral-800 bg-black text-white hover:border-emerald-500/50 hover:text-emerald-300'
        )}
        {key(
          '=',
          () => setCalc(pressEquals),
          'border-emerald-600 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
        )}
      </div>

      {/* Job details */}
      <div className="mt-3 space-y-2">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Job description (e.g. Gear service + cable)"
          className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                category === c
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-neutral-800 bg-black text-neutral-400 hover:border-neutral-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!canAdd}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition-colors ${
            isDark ? 'text-neutral-950' : 'text-white'
          } ${
            canAdd
              ? 'pressable bg-emerald-500 hover:bg-emerald-400'
              : 'cursor-not-allowed bg-neutral-800 text-neutral-500'
          }`}
        >
          <Plus className="w-4 h-4" />
          {canAdd ? `Add job to till · ${formatMoney(amount)}` : 'Enter an amount'}
        </button>
      </div>
    </div>
  );
};
