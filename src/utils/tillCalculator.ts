import type { SaleLineItem } from '../types/bikeShop';

/**
 * Till calculator engine.
 *
 * A small, pure four-function calculator that staff use at the counter to add
 * up a job (labour + parts) and drop the total straight onto the till basket as
 * a single billable line. Kept free of React and money-formatting side effects
 * so the arithmetic is fully unit-testable — mirrors how `tillStock.ts` keeps
 * the button-per-product rules pure.
 *
 * Chaining works like a phone/PAX till: pressing an operator collapses the
 * pending sum into the display (2 + 3 + → shows 5), and `=` finalises.
 */

export type CalcOp = '+' | '-' | '×' | '÷';

export interface CalcState {
  /** The operand currently shown / being typed, as text. */
  entry: string;
  /** The collapsed left-hand total, or null before the first operator. */
  accumulator: number | null;
  /** The operator awaiting its right-hand operand. */
  op: CalcOp | null;
  /** True when the next digit should start a fresh entry (after = or an op). */
  replaceEntry: boolean;
  /** True after an illegal operation (e.g. divide by zero) until cleared. */
  errored: boolean;
}

const MAX_ENTRY_LENGTH = 12;

export const initialCalc = (): CalcState => ({
  entry: '0',
  accumulator: null,
  op: null,
  replaceEntry: false,
  errored: false,
});

const toNumber = (entry: string): number => {
  const n = Number(entry);
  return Number.isFinite(n) ? n : 0;
};

/** Round to the penny and drop float noise (0.1+0.2 → 0.3). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const formatNumber = (n: number): string => {
  if (!Number.isFinite(n)) return '0';
  return String(round2(n));
};

const errorState = (): CalcState => ({ ...initialCalc(), entry: 'Error', errored: true });

export function applyOp(a: number, op: CalcOp, b: number): number | null {
  switch (op) {
    case '+':
      return round2(a + b);
    case '-':
      return round2(a - b);
    case '×':
      return round2(a * b);
    case '÷':
      return b === 0 ? null : round2(a / b);
    default:
      return b;
  }
}

export function pressDigit(state: CalcState, digit: string): CalcState {
  if (!/^[0-9]$/.test(digit)) return state;
  if (state.errored) return { ...initialCalc(), entry: digit, replaceEntry: false };
  // A fresh entry keeps the pending operator/accumulator, so `2 + 3` works.
  if (state.replaceEntry) return { ...state, entry: digit, replaceEntry: false };
  if (state.entry.replace('-', '').length >= MAX_ENTRY_LENGTH) return state;
  const entry = state.entry === '0' ? digit : state.entry + digit;
  return { ...state, entry };
}

export function pressDecimal(state: CalcState): CalcState {
  if (state.errored) return { ...initialCalc(), entry: '0.', replaceEntry: false };
  if (state.replaceEntry) return { ...state, entry: '0.', replaceEntry: false };
  if (state.entry.includes('.')) return state;
  return { ...state, entry: state.entry + '.' };
}

export function pressOp(state: CalcState, op: CalcOp): CalcState {
  if (state.errored) return state;
  const current = toNumber(state.entry);

  // First operator, or the operator is being changed before an operand is typed.
  if (state.accumulator === null || state.replaceEntry) {
    return { ...state, accumulator: state.accumulator === null ? current : state.accumulator, op, replaceEntry: true };
  }

  const result = applyOp(state.accumulator, state.op ?? op, current);
  if (result === null) return errorState();
  return { entry: formatNumber(result), accumulator: result, op, replaceEntry: true, errored: false };
}

export function pressEquals(state: CalcState): CalcState {
  if (state.errored) return state;
  const current = toNumber(state.entry);
  if (state.accumulator === null || state.op === null) {
    return { ...state, entry: formatNumber(current), replaceEntry: true };
  }
  const result = applyOp(state.accumulator, state.op, current);
  if (result === null) return errorState();
  return { entry: formatNumber(result), accumulator: null, op: null, replaceEntry: true, errored: false };
}

export function pressClear(): CalcState {
  return initialCalc();
}

export function pressBackspace(state: CalcState): CalcState {
  if (state.errored) return initialCalc();
  if (state.replaceEntry) return { ...state, entry: '0', replaceEntry: false };
  const trimmed = state.entry.slice(0, -1);
  return { ...state, entry: trimmed === '' || trimmed === '-' ? '0' : trimmed };
}

export function pressSign(state: CalcState): CalcState {
  if (state.errored) return state;
  if (toNumber(state.entry) === 0) return state;
  const entry = state.entry.startsWith('-') ? state.entry.slice(1) : `-${state.entry}`;
  return { ...state, entry };
}

/** Percent key: treat the current entry as a percentage (÷100). */
export function pressPercent(state: CalcState): CalcState {
  if (state.errored) return state;
  return { ...state, entry: formatNumber(toNumber(state.entry) / 100), replaceEntry: true };
}

/** The pound amount currently shown, ready to bill. */
export function displayAmount(state: CalcState): number {
  return state.errored ? 0 : toNumber(state.entry);
}

export function displayText(state: CalcState): string {
  return state.errored ? 'Error' : state.entry;
}

const OP_LABEL: Record<CalcOp, string> = { '+': '+', '-': '−', '×': '×', '÷': '÷' };

/** The running expression shown above the total, e.g. "30 + 12". */
export function historyText(state: CalcState): string {
  if (state.accumulator === null || state.op === null) return '';
  const op = OP_LABEL[state.op];
  // While an operand is being typed, show `acc op entry`; right after an op or
  // equals, show just `acc op`.
  return state.replaceEntry ? `${formatNumber(state.accumulator)} ${op}` : `${formatNumber(state.accumulator)} ${op} ${state.entry}`;
}

export const formatMoney = (n: number): string => `£${round2(n).toFixed(2)}`;

export type JobCategory = SaleLineItem['category'];

/**
 * Turn the calculator total into a billable till line. Defaults to a Labour
 * line, since manually-added jobs are almost always the mechanic's time, but
 * the caller can raise it as a Part / Diagnostic / Consumable instead.
 */
export function calcJobLine(
  state: CalcState,
  description: string,
  category: JobCategory = 'Labour'
): Omit<SaleLineItem, 'id'> {
  return {
    description: description.trim() || 'Manual job',
    category,
    quantity: 1,
    unitPrice: displayAmount(state),
  };
}
