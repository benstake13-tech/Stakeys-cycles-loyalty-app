import { describe, it, expect } from 'vitest';
import {
  LEGAL_DISCLAIMER_SECTIONS,
  LEGAL_DISCLAIMER_UPDATED,
} from './src/data/legalDisclaimers';

const allText = LEGAL_DISCLAIMER_SECTIONS.map(
  (s) => [s.title, ...s.paragraphs, ...s.bullets.map((b) => `${b.label ?? ''} ${b.text}`)].join(' ')
).join('\n');

describe('legal disclaimers', () => {
  it('covers all five required areas', () => {
    expect(LEGAL_DISCLAIMER_SECTIONS.map((s) => s.id)).toEqual([
      'general',
      'mobile-callout',
      'repair',
      'home-workshop',
      'liability',
    ]);
  });

  it('every section has a title and some body content', () => {
    for (const s of LEGAL_DISCLAIMER_SECTIONS) {
      expect(s.title.length, `${s.id} has no title`).toBeGreaterThan(0);
      expect(s.paragraphs.length + s.bullets.length, `${s.id} is empty`).toBeGreaterThan(0);
    }
  });

  it('states the mobile call-out fee and non-refundable terms', () => {
    expect(allText).toMatch(/starts at £10/);
    expect(allText).toMatch(/non-refundable/i);
    expect(allText).toMatch(/safe, dry, and flat/i);
  });

  it('covers e-scooter legal road-use liability and speed-unlocking', () => {
    expect(allText).toMatch(/speed-unlocking/i);
    expect(allText).toMatch(/road traffic regulations/i);
    expect(allText).toMatch(/private e-scooters on public roads/i);
  });

  it('states the unclaimed-property and storage-fee window', () => {
    expect(allText).toMatch(/14 days/);
    expect(allText).toMatch(/30 days/);
  });

  it('includes the limitation-of-liability clause', () => {
    expect(allText).toMatch(/indirect, incidental, or consequential damages/i);
    expect(allText).toMatch(/proven mechanical negligence/i);
  });

  it('exposes a last-updated label', () => {
    expect(LEGAL_DISCLAIMER_UPDATED.length).toBeGreaterThan(0);
  });
});
