import { describe, it, expect } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

describe('brand story — how we work order', () => {
  it('asks the customer to approve the price before we come out', () => {
    const steps = DEFAULT_WEBSITE_CONTENT.brandStory.howWeWorkSteps.map((s) => s.title);
    const approve = steps.findIndex((t) => /approve the price/i.test(t));
    const comeToYou = steps.findIndex((t) => /we come to you/i.test(t));
    expect(approve).toBeGreaterThanOrEqual(0);
    expect(comeToYou).toBeGreaterThanOrEqual(0);
    expect(approve).toBeLessThan(comeToYou);
  });
});
