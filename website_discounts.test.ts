import { describe, it, expect } from 'vitest';
import {
  WEBSITE_DISCOUNT_FALLBACK,
  websiteDiscountCatalogue,
  inferAudience,
  discountCodeFromSearch,
  discountShareUrl,
} from './src/utils/websiteDiscounts';
import { validateDiscountCode, findDiscountCode } from './src/utils/discountService';
import type { DiscountCode } from './src/types/bikeShop';

describe('website discount fallback catalogue', () => {
  it('ships the curated public codes so the shop works before the migration', () => {
    const codes = WEBSITE_DISCOUNT_FALLBACK.map((c) => c.code);
    expect(codes).toContain('WEB-5OFF');
    expect(codes).toContain('WEB-5CREDIT');
    expect(WEBSITE_DISCOUNT_FALLBACK.every((c) => c.audience === 'public')).toBe(true);
  });

  it('uses the fallback when the live catalogue is empty', () => {
    const merged = websiteDiscountCatalogue([]);
    expect(merged.length).toBe(WEBSITE_DISCOUNT_FALLBACK.length);
    expect(merged.some((c) => c.code === 'WEB-5OFF')).toBe(true);
  });

  it('never duplicates a code the database already provides', () => {
    const live: DiscountCode[] = [
      {
        ...WEBSITE_DISCOUNT_FALLBACK[0],
        id: 'live-web-5off',
        title: 'Edited by staff',
      },
    ];
    const merged = websiteDiscountCatalogue(live);
    const fiveOff = merged.filter((c) => c.code === 'WEB-5OFF');
    expect(fiveOff.length).toBe(1);
    // The live row wins, so a staff edit is never overwritten.
    expect(fiveOff[0].id).toBe('live-web-5off');
    expect(fiveOff[0].title).toBe('Edited by staff');
  });

  it('does not resurrect a code a staff member disabled', () => {
    const live: DiscountCode[] = [{ ...WEBSITE_DISCOUNT_FALLBACK[0], status: 'disabled' }];
    const merged = websiteDiscountCatalogue(live);
    expect(merged.filter((c) => c.code === 'WEB-5OFF').length).toBe(1);
    expect(merged.find((c) => c.code === 'WEB-5OFF')?.status).toBe('disabled');
  });

  it('a fallback public code is valid for a signed-out visitor', () => {
    const catalogue = websiteDiscountCatalogue([]);
    const found = findDiscountCode('web-5off', catalogue);
    const res = validateDiscountCode(found, { subtotal: 50, isMember: false });
    expect(res.ok).toBe(true);
    expect(res.amountOff).toBe(2.5);
  });

  it('infers audience from the code prefix when the live column is absent', () => {
    expect(inferAudience({ code: 'WEB-5OFF' } as DiscountCode)).toBe('public');
    expect(inferAudience({ code: 'mem-20off' } as DiscountCode)).toBe('member');
    expect(inferAudience({ code: 'STK-5341' } as DiscountCode)).toBeUndefined();
    // An explicit audience is never overridden by the prefix guess.
    expect(inferAudience({ code: 'WEB-5OFF', audience: 'member' } as DiscountCode)).toBe('member');
  });

  it('tags un-tagged live rows so a pre-migration DB still shows them', () => {
    // Reproduces the live database before 20261007: the seeded rows exist but
    // have no audience column, so they read back with audience undefined.
    const live = [
      { id: 'disc-329537', code: 'WEB-5OFF', title: 'Welcome 5% off', status: 'active' },
      { id: 'disc-425356', code: 'MEM-15OFF', title: 'Members 15% off labour', status: 'active' },
      { id: 'disc-550252', code: 'STK-5341', title: 'Winter promo', status: 'active' },
    ] as DiscountCode[];
    const merged = websiteDiscountCatalogue(live);
    const publicCodes = merged.filter((c) => c.audience === 'public').map((c) => c.code);
    expect(publicCodes).toContain('WEB-5OFF');
    // MEM- is recovered too, so the member set is hidden from signed-out visitors.
    expect(merged.find((c) => c.code === 'MEM-15OFF')?.audience).toBe('member');
    // An unrecognised prefix stays open to everyone.
    expect(merged.find((c) => c.code === 'STK-5341')?.audience).toBeUndefined();
    // The fallback does not duplicate the live WEB-5OFF.
    expect(merged.filter((c) => c.code === 'WEB-5OFF').length).toBe(1);
  });
});

describe('website offer links', () => {
  it('reads a code from a shared offer link (?code= / ?promo=)', () => {
    expect(discountCodeFromSearch('?code=web-5off')).toBe('WEB-5OFF');
    expect(discountCodeFromSearch('?promo=WEB-10OFF60')).toBe('WEB-10OFF60');
    // Unrelated query params are ignored.
    expect(discountCodeFromSearch('?ref=STK-REF-123456')).toBe('');
    expect(discountCodeFromSearch('')).toBe('');
  });

  it('builds a shareable link that carries the code', () => {
    expect(discountShareUrl('web-5off', 'https://stakeys-cycles.co.uk')).toBe(
      'https://stakeys-cycles.co.uk/?code=WEB-5OFF'
    );
    // Round-trips through the reader.
    const url = discountShareUrl('WEB-10OFF60', 'https://example.com');
    expect(discountCodeFromSearch(new URL(url).search)).toBe('WEB-10OFF60');
  });

  it('a code shared by link validates for a signed-out visitor', () => {
    const catalogue = websiteDiscountCatalogue([]);
    const code = discountCodeFromSearch('?code=WEB-5OFF');
    const res = validateDiscountCode(findDiscountCode(code, catalogue), { subtotal: 40, isMember: false });
    expect(res.ok).toBe(true);
    expect(res.amountOff).toBe(2);
  });
});
