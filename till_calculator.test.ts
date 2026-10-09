import { describe, it, expect } from 'vitest';
import {
  applyOp,
  calcJobLine,
  displayAmount,
  displayText,
  historyText,
  pressBackspace,
  pressClear,
  pressDecimal,
  pressDigit,
  pressEquals,
  pressOp,
  pressPercent,
  pressSign,
  round2,
  CalcState,
} from './src/utils/tillCalculator';

/** Type a whole number/decimal string one character at a time, like a keypad. */
const type = (state: CalcState, text: string): CalcState =>
  text.split('').reduce((s, ch) => (ch === '.' ? pressDecimal(s) : pressDigit(s, ch)), state);

describe('till calculator engine', () => {
  it('starts at zero', () => {
    expect(displayAmount(pressClear())).toBe(0);
    expect(displayText(pressClear())).toBe('0');
  });

  it('builds an entry digit by digit and ignores a second decimal point', () => {
    const s = type(pressClear(), '12.5.0');
    expect(displayText(s)).toBe('12.50');
  });

  it('adds across an operator like a phone calculator (chaining)', () => {
    // 12.50 + 7.25 = 19.75
    let s = type(pressClear(), '12.50');
    s = pressOp(s, '+');
    s = type(s, '7.25');
    s = pressEquals(s);
    expect(displayAmount(s)).toBe(19.75);
  });

  it('collapses a pending sum when the next operator is pressed', () => {
    // 2 + 3 + → 5
    let s = pressDigit(pressClear(), '2');
    s = pressOp(s, '+');
    s = pressDigit(s, '3');
    s = pressOp(s, '+');
    expect(displayAmount(s)).toBe(5);
  });

  it('chains multiplication and division', () => {
    // 10 × 3 ÷ 2 = 15
    let s = type(pressClear(), '10');
    s = pressOp(s, '×');
    s = pressDigit(s, '3');
    s = pressOp(s, '÷');
    s = pressDigit(s, '2');
    s = pressEquals(s);
    expect(displayAmount(s)).toBe(15);
  });

  it('is float-safe: 0.1 + 0.2 = 0.3 exactly', () => {
    expect(applyOp(0.1, '+', 0.2)).toBe(0.3);
    let s = type(pressClear(), '0.1');
    s = pressOp(s, '+');
    s = type(s, '0.2');
    s = pressEquals(s);
    expect(displayAmount(s)).toBe(0.3);
  });

  it('guards divide by zero with an Error state', () => {
    expect(applyOp(5, '÷', 0)).toBeNull();
    let s = pressDigit(pressClear(), '5');
    s = pressOp(s, '÷');
    s = pressDigit(s, '0');
    s = pressEquals(s);
    expect(displayText(s)).toBe('Error');
    expect(displayAmount(s)).toBe(0);
    // Recovering: any digit press clears the error.
    s = pressDigit(s, '7');
    expect(displayText(s)).toBe('7');
  });

  it('treats % as ÷100', () => {
    const s = pressPercent(type(pressClear(), '50'));
    expect(displayAmount(s)).toBe(0.5);
  });

  it('toggles the sign and backspaces an entry', () => {
    let s = type(pressClear(), '25');
    s = pressSign(s);
    expect(displayText(s)).toBe('-25');
    s = pressSign(s);
    expect(displayText(s)).toBe('25');
    s = pressBackspace(s);
    expect(displayText(s)).toBe('2');
  });

  it('shows a running expression above the total', () => {
    let s = type(pressClear(), '30');
    s = pressOp(s, '+');
    expect(historyText(s)).toBe('30 +');
    s = pressDigit(s, '5');
    expect(historyText(s)).toBe('30 + 5');
  });

  it('rounds money to the penny', () => {
    expect(round2(19.999)).toBe(20);
    expect(round2(1 / 3)).toBe(0.33);
  });
});

describe('calcJobLine', () => {
  it('turns the displayed total into a single billable line', () => {
    const s = pressEquals(type(pressOp(type(pressClear(), '30'), '+'), '12'));
    const line = calcJobLine(s, 'Gear service + cable', 'Labour');
    expect(line).toEqual({
      description: 'Gear service + cable',
      category: 'Labour',
      quantity: 1,
      unitPrice: 42,
    });
  });

  it('defaults the description and category when none are given', () => {
    const line = calcJobLine(type(pressClear(), '15'), '   ');
    expect(line.description).toBe('Manual job');
    expect(line.category).toBe('Labour');
    expect(line.unitPrice).toBe(15);
  });

  it('honours a non-labour category', () => {
    const line = calcJobLine(type(pressClear(), '8.99'), 'Inner tube', 'Part');
    expect(line.category).toBe('Part');
    expect(line.unitPrice).toBe(8.99);
  });
});
