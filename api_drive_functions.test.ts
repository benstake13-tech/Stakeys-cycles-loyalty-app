import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveDriveKey,
  driveThumbnail,
  resolveDriveLink,
  listDriveFolder,
} from './api/drive/_shared.js';
import listHandler from './api/drive/list.js';
import resolveHandler from './api/drive/resolve.js';

/**
 * The Drive API keys must never leave the server, and the list/resolve helpers
 * normalise Drive's response so the client only ever sees renderable URLs.
 */

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
  };
  return res;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_DRIVE_API_KEY;
  delete process.env.GOOGLE_BUSINESS_API_KEY;
});

describe('resolveDriveKey', () => {
  it('prefers the dedicated Drive key and falls back to the business key', () => {
    expect(resolveDriveKey({ GOOGLE_DRIVE_API_KEY: 'drive', GOOGLE_BUSINESS_API_KEY: 'biz' })).toBe('drive');
    expect(resolveDriveKey({ GOOGLE_BUSINESS_API_KEY: 'biz' })).toBe('biz');
    expect(resolveDriveKey({})).toBeNull();
  });
});

describe('driveThumbnail / resolveDriveLink', () => {
  it('builds a renderable thumbnail URL at the requested size', () => {
    expect(driveThumbnail('abc', 400)).toBe('https://drive.google.com/thumbnail?id=abc&sz=w400');
  });

  it('extracts the id from each common share-link shape', () => {
    expect(resolveDriveLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view').id)
      .toBe('1AbCdEfGhIjKlMnOpQr');
    expect(resolveDriveLink('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQr').id)
      .toBe('1AbCdEfGhIjKlMnOpQr');
    expect(resolveDriveLink('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr').id)
      .toBe('1AbCdEfGhIjKlMnOpQr');
  });

  it('throws when no file id is present', () => {
    expect(() => resolveDriveLink('nonsense')).toThrow(/No Drive file id/i);
  });
});

describe('listDriveFolder', () => {
  it('keeps only images and sub-folders and maps the renderable fields', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        files: [
          { id: 'img1', name: 'bike.jpg', mimeType: 'image/jpeg', imageMediaMetadata: { width: 800, height: 600 } },
          { id: 'vid1', name: 'clip.mp4', mimeType: 'video/mp4' },
          { id: 'fold1', name: 'Parts', mimeType: 'application/vnd.google-apps.folder' },
        ],
      }),
    })));

    const { images, folders } = await listDriveFolder('folderX', 'key');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ id: 'img1', name: 'bike.jpg', width: 800, height: 600 });
    expect(images[0].thumbnailUrl).toContain('sz=w400');
    expect(images[0].directUrl).toContain('sz=w1600');
    expect(folders).toEqual([{ id: 'fold1', name: 'Parts' }]);
  });

  it('follows nextPageToken so a big folder is returned in full', async () => {
    const pages = [
      { files: [{ id: 'a', name: 'a.jpg', mimeType: 'image/jpeg' }], nextPageToken: 't2' },
      { files: [{ id: 'b', name: 'b.png', mimeType: 'image/png' }] },
    ];
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => pages[call++] })));

    const { images } = await listDriveFolder('folderX', 'key');
    expect(images.map((i) => i.id)).toEqual(['a', 'b']);
    expect(call).toBe(2);
  });

  it('surfaces the upstream error status and message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'The user does not have sufficient permissions' } }),
    })));
    await expect(listDriveFolder('folderX', 'key')).rejects.toMatchObject({
      status: 403,
      message: 'The user does not have sufficient permissions',
    });
  });
});

describe('drive list handler', () => {
  it('responds 405 for a non-GET request', async () => {
    const res = mockRes();
    await listHandler({ method: 'POST' } as any, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('GET');
  });

  it('responds 500 when the key is missing', async () => {
    const res = mockRes();
    await listHandler({ method: 'GET', query: { folderId: 'x' } } as any, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('responds 400 when folderId is missing', async () => {
    process.env.GOOGLE_DRIVE_API_KEY = 'key';
    const res = mockRes();
    await listHandler({ method: 'GET', query: {} } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/folderId/i);
  });

  it('returns the normalised images and folders', async () => {
    process.env.GOOGLE_DRIVE_API_KEY = 'key';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ files: [{ id: 'i', name: 'x.jpg', mimeType: 'image/jpeg' }] }),
    })));
    const res = mockRes();
    await listHandler({ method: 'GET', query: { folderId: 'folderX' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.folderId).toBe('folderX');
    expect(res.body.images).toHaveLength(1);
  });
});

describe('drive resolve handler', () => {
  it('responds 400 for a link with no file id', async () => {
    const res = mockRes();
    await resolveHandler({ method: 'GET', query: { url: 'nope' } } as any, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns direct + thumbnail URLs for a valid link', async () => {
    const res = mockRes();
    await resolveHandler({ method: 'GET', query: { url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view' } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('1AbCdEfGhIjKlMnOpQr');
    expect(res.body.directUrl).toContain('sz=w1600');
  });
});
