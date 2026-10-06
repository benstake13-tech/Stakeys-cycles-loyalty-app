import { describe, it, expect } from 'vitest';
import {
  parseDriveFileId,
  driveDirectUrl,
  normaliseDriveUrl,
  DRIVE_FOLDERS,
} from './src/utils/googleDrive';

describe('googleDrive helpers', () => {
  it('extracts the file id from the common Drive link shapes', () => {
    expect(parseDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view?usp=sharing'))
      .toBe('1AbCdEfGhIjKlMnOpQr');
    expect(parseDriveFileId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQr'))
      .toBe('1AbCdEfGhIjKlMnOpQr');
    expect(parseDriveFileId('https://drive.google.com/uc?export=view&id=1AbCdEfGhIjKlMnOpQr'))
      .toBe('1AbCdEfGhIjKlMnOpQr');
  });

  it('passes through a bare file id and rejects junk', () => {
    expect(parseDriveFileId('1AbCdEfGhIjKlMnOpQrStUvWx')).toBe('1AbCdEfGhIjKlMnOpQrStUvWx');
    expect(parseDriveFileId('')).toBeNull();
    expect(parseDriveFileId('not a link')).toBeNull();
  });

  it('normalises a share link to a renderable thumbnail URL', () => {
    const url = normaliseDriveUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view');
    expect(url).toBe(driveDirectUrl('1AbCdEfGhIjKlMnOpQr'));
    expect(url).toContain('drive.google.com/thumbnail');
  });

  it('leaves a non-Drive URL untouched so pasted CDN links still work', () => {
    const cdn = 'https://cdn.example.com/bike.jpg';
    expect(normaliseDriveUrl(cdn)).toBe(cdn);
  });

  it('exposes the three shop folders', () => {
    expect(DRIVE_FOLDERS.stock).toBe('1jdK0lDyJF32fpPja_9vloiRPaliVPvIZ');
    expect(DRIVE_FOLDERS.gallery).toBe('1CnKTtD1anwHTEEjd5yuqeUZp6V4fjxXt');
    expect(DRIVE_FOLDERS.promo).toBe('1G0TOaRHi1hhowV50QzWjPapTyQprhrFD');
  });
});
