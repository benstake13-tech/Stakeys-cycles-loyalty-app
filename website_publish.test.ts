import { describe, it, expect, vi, beforeEach } from 'vitest';
const db = vi.hoisted(() => ({ error: null as any, saved: null as any }));
vi.mock('./src/lib/supabase', () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  update: (values: any) => ({ eq: () => ({ select: () => ({ single: async () => ({ data: db.error ? null : { website_content_json: values.website_content_json }, error: db.error }) }) }) }),
}) } }));
import { getWebsiteContent, updateWebsiteContent } from './src/context/WebsiteContentStore';
describe('website publishing', () => {
  beforeEach(() => { db.error = null; });
  it('does not pretend a failed database write was published locally', async () => {
    const before = getWebsiteContent().heroTitle;
    db.error = { message: 'website_content_json does not exist' };
    await expect(updateWebsiteContent({ heroTitle: 'Unsaved draft' })).rejects.toThrow('not published');
    expect(getWebsiteContent().heroTitle).toBe(before);
  });
  it('updates the shared website snapshot after the database returns saved content', async () => {
    await updateWebsiteContent({ heroTitle: 'Confirmed publication' });
    expect(getWebsiteContent().heroTitle).toBe('Confirmed publication');
  });
});
