import { describe, it, expect } from 'vitest';
import { SHOP_SOCIAL_LINKS } from './src/data/socialLinks';

describe('SHOP_SOCIAL_LINKS', () => {
  it('exposes the shop Instagram and Facebook profiles', () => {
    const ids = SHOP_SOCIAL_LINKS.map((l) => l.id);
    expect(ids).toContain('instagram');
    expect(ids).toContain('facebook');
  });

  it('every link is a valid https URL with an icon and label', () => {
    for (const link of SHOP_SOCIAL_LINKS) {
      expect(link.url.startsWith('https://')).toBe(true);
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.icon).toBeTruthy();
    }
  });

  it('points at the confirmed Stakey\'s handles', () => {
    const instagram = SHOP_SOCIAL_LINKS.find((l) => l.id === 'instagram')!;
    const facebook = SHOP_SOCIAL_LINKS.find((l) => l.id === 'facebook')!;
    expect(instagram.url).toBe('https://www.instagram.com/stakeyscycles22');
    expect(facebook.url).toContain('Stakeys-cycles-100088457832581');
  });
});
