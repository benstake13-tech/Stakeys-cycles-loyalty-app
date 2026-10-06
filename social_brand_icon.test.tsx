import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SocialBrandIcon, socialBrandSlug } from './src/components/SocialBrandIcon';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

vi.mock('./src/context/ShopContext', () => ({
  useShop: () => ({
    currentUser: null,
    theme: 'dark',
    promotions: [],
    discountCodes: [],
    recordDiscountUsage: vi.fn(),
  }),
}));

vi.mock('./src/context/WebsiteContentStore', () => ({
  useWebsiteContent: () => DEFAULT_WEBSITE_CONTENT,
}));

import { WebsiteReplica } from './src/components/WebsiteReplica';

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Pinterest', 'Snapchat', 'TikTok', 'Yelp', 'YouTube'];

describe('SocialBrandIcon', () => {
  it.each(PLATFORMS)('renders an official brand mark for %s', (platform) => {
    const { container } = render(<SocialBrandIcon platform={platform} />);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe(`${platform} logo`);
    // A real logo path, not an empty placeholder.
    expect((svg!.querySelector('path')!.getAttribute('d') ?? '').length).toBeGreaterThan(40);
  });

  it('gives every platform a distinct mark', () => {
    const paths = PLATFORMS.map((p) => {
      const { container } = render(<SocialBrandIcon platform={p} />);
      return container.querySelector('path')!.getAttribute('d');
    });
    expect(new Set(paths).size).toBe(PLATFORMS.length);
  });

  it('falls back to a neutral link glyph for an unknown platform', () => {
    const { container } = render(<SocialBrandIcon platform="MySpace" />);
    expect(container.querySelector('svg[role="img"]')).toBeNull();
    expect(container.querySelector('svg.lucide-link-2')).not.toBeNull();
  });

  it('matches platform labels case-insensitively and via common aliases', () => {
    expect(socialBrandSlug('instagram')).toBe('instagram');
    expect(socialBrandSlug('  FB ')).toBe('facebook');
    expect(socialBrandSlug('Insta')).toBe('instagram');
    expect(socialBrandSlug('Tik Tok')).toBe('tiktok');
    expect(socialBrandSlug('my space')).toBeUndefined();
  });
});

describe('website footer social links', () => {
  it('renders an official icon for every configured social link', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    for (const s of DEFAULT_WEBSITE_CONTENT.socials) {
      expect(screen.getByLabelText(`${s.platform} logo`)).toBeTruthy();
    }
  });

  it('links each icon to its real destination', () => {
    render(<WebsiteReplica onBookService={vi.fn()} />);
    const instagram = screen.getByLabelText('Instagram logo').closest('a');
    expect(instagram?.getAttribute('href')).toBe('https://www.instagram.com/stakeyscycles22');
  });
});
