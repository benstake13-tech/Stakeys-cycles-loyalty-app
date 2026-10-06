/**
 * Google Drive image catalogue helpers.
 *
 * Staff keep stock, gallery and advert images in public Drive folders. Listing a
 * folder goes through the server proxy (`/api/drive/list`) so the API key stays
 * server-side; the images themselves render straight from Drive's thumbnail
 * endpoint, which needs no key once the folder is shared.
 */

export interface DriveImage {
  id: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  /** Small image for the picker grid. */
  thumbnailUrl: string;
  /** Larger image used once chosen. */
  directUrl: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveListResult {
  folderId: string;
  images: DriveImage[];
  folders: DriveFolder[];
}

/**
 * The three folders the shop uses. Overridable per-branch via Vite env so a
 * surface can point at a different set without a code change.
 */
export const DRIVE_FOLDERS = {
  stock: import.meta.env.VITE_DRIVE_STOCK_FOLDER || '1jdK0lDyJF32fpPja_9vloiRPaliVPvIZ',
  gallery: import.meta.env.VITE_DRIVE_GALLERY_FOLDER || '1CnKTtD1anwHTEEjd5yuqeUZp6V4fjxXt',
  promo: import.meta.env.VITE_DRIVE_PROMO_FOLDER || '1G0TOaRHi1hhowV50QzWjPapTyQprhrFD',
} as const;

export type DriveFolderKey = keyof typeof DRIVE_FOLDERS;

/** Extract a Drive file id from a share link, or return the input if it already is one. */
export function parseDriveFileId(input: string): string | null {
  const value = (input || '').trim();
  if (!value) return null;
  if (/^[-\w]{20,}$/.test(value)) return value;
  const match =
    value.match(/\/file\/d\/([-\w]{10,})/) ||
    value.match(/[?&]id=([-\w]{10,})/) ||
    value.match(/\/d\/([-\w]{10,})/);
  return match ? match[1] : null;
}

/** Direct-renderable URL for a Drive file id (no API key required for public files). */
export function driveDirectUrl(id: string, size = 1600): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** Turn whatever staff pasted (id or link) into a usable image URL. */
export function normaliseDriveUrl(input: string): string {
  const id = parseDriveFileId(input);
  return id ? driveDirectUrl(id) : input;
}

export async function listDriveFolder(folderId: string): Promise<DriveListResult> {
  const response = await fetch(`/api/drive/list?folderId=${encodeURIComponent(folderId)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Could not load the Drive folder');
  }
  return data as DriveListResult;
}
