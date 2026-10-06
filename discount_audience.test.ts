import { describe, it, expect } from 'vitest';
import {
  MEMBER_DISCOUNT_SET,
  PUBLIC_DISCOUNT_SET,
  DISCOUNT_SET_BLUEPRINTS,
  buildCode,
  generateDiscountSet,
} from './src/utils/discountAudience';
import { validateDiscountCode, findDiscountCode } from './src/utils/discountService';
import type { DiscountCode } from './src/types/bikeShop';

describe('two discount code sets', () => {
  it('generates a member set tagged for loyalty members', () => {
    const codes = generateDiscountSet(MEMBER_DISCOUNT_SET);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((c) => c.audience === 'member')).toBe(true);
    expect(codes.every((c) => c.code.startsWith('MEM-'))).toBe(true);
  });

  it('generates a public set tagged for website visitors', () => {
    const codes = generateDiscountSet(PUBLIC_DISCOUNT_SET);
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((c) => c.audience === 'public')).toBe(true);
    expect(codes.every((c) => c.code.startsWith('WEB-'))).toBe(true);
  });

  it('exposes both sets for the generator UI', () => {
    const audiences = DISCOUNT_SET_BLUEPRINTS.map((b) => b.audience).sort();
    expect(audiences).toEqual(['member', 'public']);
  });

  it('gives members a better headline discount than the public set', () => {
    const best = (codes: DiscountCode[]) =>
      Math.max(...codes.filter((c) => c.type === 'percent').map((c) => c.value));
    const memberBest = best(generateDiscountSet(MEMBER_DISCOUNT_SET));
    const publicBest = best(generateDiscountSet(PUBLIC_DISCOUNT_SET));
    expect(memberBest).toBeGreaterThan(publicBest);
  });

  it('generates stable, readable codes', () => {
    const codes = generateDiscountSet(MEMBER_DISCOUNT_SET);
    const again = generateDiscountSet(MEMBER_DISCOUNT_SET);
    expect(codes.map((c) => c.code)).toEqual(again.map((c) => c.code));
    expect(codes.map((c) => c.id)).toEqual(again.map((c) => c.id));
    expect(buildCode('mem', '15 off!')).toBe('MEM-15OFF');
  });
});

describe('audience-aware validation', () => {
  const memberCode = generateDiscountSet(MEMBER_DISCOUNT_SET).find((c) => c.code === 'MEM-15OFF')!;
  const publicCode = generateDiscountSet(PUBLIC_DISCOUNT_SET).find((c) => c.code === 'WEB-5OFF')!;

  it('refuses a member-only code for a signed-out visitor', () => {
    const res = validateDiscountCode(memberCode, { subtotal: 100, isMember: false });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/members only/i);
  });

  it('allows a member-only code once the customer is a member', () => {
    const res = validateDiscountCode(memberCode, { subtotal: 100, isMember: true });
    expect(res.ok).toBe(true);
    expect(res.amountOff).toBe(15);
  });

  it('allows a public code for everyone', () => {
    expect(validateDiscountCode(publicCode, { subtotal: 100, isMember: false }).ok).toBe(true);
    expect(validateDiscountCode(publicCode, { subtotal: 100, isMember: true }).ok).toBe(true);
  });

  it('resolves generated codes case-insensitively through the catalogue', () => {
    const codes = generateDiscountSet(PUBLIC_DISCOUNT_SET);
    expect(findDiscountCode('web-5off', codes)?.code).toBe('WEB-5OFF');
  });

  it('does not double-gate a code that is also assigned to a specific member', () => {
    const assigned: DiscountCode = { ...memberCode, assignedToUid: 'cust-1' };
    const res = validateDiscountCode(assigned, { subtotal: 100, customerUid: 'cust-1' });
    expect(res.ok).toBe(true);
  });
});
