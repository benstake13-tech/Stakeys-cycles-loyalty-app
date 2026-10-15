import { describe, expect, it, vi } from 'vitest';
import { runShopGalleryStorageDiagnostics, SHOP_GALLERY_BUCKET, SHOP_GALLERY_REPAIR_SQL } from './src/api/storageDiagnostics';

function makeStorage(overrides: Record<string, unknown> = {}) {
  const bucket = {
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    upload: vi.fn().mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://storage.example.test/${path}` } })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return { storage: { from: vi.fn(() => bucket) }, bucket };
}

describe('shop gallery bucket diagnostics', () => {
  it('checks the correct bucket and self-cleans a successful upload test', async () => {
    const { storage, bucket } = makeStorage();
    const fetcher = vi.fn().mockResolvedValue(new Response('png', { status: 200 }));
    const report = await runShopGalleryStorageDiagnostics(storage as any, fetcher as any, () => 'probe-123');

    expect(storage.from).toHaveBeenCalledWith(SHOP_GALLERY_BUCKET);
    expect(bucket.upload).toHaveBeenCalledWith('test-bench/probe-123.png', expect.any(Blob), expect.objectContaining({ contentType: 'image/png' }));
    expect(fetcher).toHaveBeenCalledWith('https://storage.example.test/test-bench/probe-123.png', expect.objectContaining({ method: 'GET' }));
    expect(bucket.remove).toHaveBeenCalledWith(['test-bench/probe-123.png']);
    expect(report.passed).toBe(true);
    expect(report.steps.map((step) => step.id)).toEqual(['bucket', 'staff-write', 'public-read', 'cleanup']);
  });

  it('stops at a missing bucket and leaves setup to the focused repair SQL', async () => {
    const { storage, bucket } = makeStorage({ list: vi.fn().mockResolvedValue({ data: null, error: { message: 'Bucket not found', statusCode: 404 } }) });
    const report = await runShopGalleryStorageDiagnostics(storage as any, vi.fn() as any, () => 'probe-123');

    expect(report.passed).toBe(false);
    expect(report.steps[0].detail).toContain('Bucket not found');
    expect(bucket.upload).not.toHaveBeenCalled();
    expect(SHOP_GALLERY_REPAIR_SQL).toContain("VALUES ('shop-gallery', 'shop-gallery', true");
    expect(SHOP_GALLERY_REPAIR_SQL).toContain('shop_gallery_staff_insert');
  });

  it('reports a public delivery failure but still removes the temporary upload', async () => {
    const { storage, bucket } = makeStorage();
    const report = await runShopGalleryStorageDiagnostics(
      storage as any,
      vi.fn().mockResolvedValue(new Response('missing', { status: 403 })) as any,
      () => 'probe-456'
    );

    expect(report.passed).toBe(false);
    expect(report.steps.find((step) => step.id === 'public-read')?.detail).toContain('HTTP 403');
    expect(bucket.remove).toHaveBeenCalledWith(['test-bench/probe-456.png']);
    expect(report.steps.find((step) => step.id === 'cleanup')?.status).toBe('pass');
  });
});
