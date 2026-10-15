import { describe, it, expect } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

describe('main website repair journey', () => {
  it('keeps one concise, three-step mobile repair process', () => {
    const steps = DEFAULT_WEBSITE_CONTENT.brandStory.howWeWorkSteps;
    expect(steps).toHaveLength(3);
    expect(steps.map(step => step.title)).toEqual([
      'Tell us what’s wrong', 'Approve the price', 'We come to you',
    ]);
    expect(steps[2].body).toMatch(/at home or work/i);
  });
});
