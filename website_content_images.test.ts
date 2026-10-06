import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_WEBSITE_CONTENT } from './src/data/websiteContent';

const KEY = 'stakeys.website_content.v3';

/**
 * The store keeps a module-level cache, so each test reseeds localStorage and
 * reloads the module to exercise the legacy-image scrub on a saved draft.
 */
async function loadStore(saved: unknown) {
  vi.resetModules();
  window.localStorage.clear();
  if (saved !== undefined) window.localStorage.setItem(KEY, JSON.stringify(saved));
  return import('./src/context/WebsiteContentStore');
}

describe('carried-over gallery and location images are removed', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it('ships no location hero or gallery photos by default', () => {
    expect(DEFAULT_WEBSITE_CONTENT.locationImage).toBe('');
    expect(DEFAULT_WEBSITE_CONTENT.galleryImages).toEqual([]);
  });

  it('scrubs old-site photos out of an already-saved draft', async () => {
    const { getWebsiteContent } = await loadStore({
      ...DEFAULT_WEBSITE_CONTENT,
      locationImage: 'https://cdn6.editmysite.com/uploads/old-location.jpg',
      galleryImages: [
        { id: 'gallery-1', url: 'https://cdn6.editmysite.com/uploads/old-1.jpg' },
        { id: 'gallery-9', url: 'https://example.com/fresh-photo.jpg' },
      ],
    });

    const content = getWebsiteContent();
    expect(content.locationImage).toBe('');
    expect(content.galleryImages.map((g) => g.id)).toEqual(['gallery-9']);
  });

  it('keeps replacement photos staff have uploaded', async () => {
    const { getWebsiteContent } = await loadStore({
      ...DEFAULT_WEBSITE_CONTENT,
      locationImage: 'https://example.com/new-hero.jpg',
      galleryImages: [{ id: 'gallery-2', url: 'https://example.com/new.jpg' }],
    });

    const content = getWebsiteContent();
    expect(content.locationImage).toBe('https://example.com/new-hero.jpg');
    expect(content.galleryImages).toHaveLength(1);
  });
});
