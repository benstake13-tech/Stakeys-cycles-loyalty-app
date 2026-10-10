/**
 * Shared Google Drive helpers for the Vercel serverless functions.
 *
 * Staff keep product / gallery / advert images in public Drive folders. Listing
 * a folder needs an API key; serving the bytes does not. These helpers keep the
 * key server-side and normalise Drive's response so the client only ever sees
 * { id, name, thumbnailUrl, directUrl, mimeType }.
 *
 * Mirrors the `/api/drive/*` routes in server.ts (dev) so the deployed (static
 * Vercel) site behaves identically. Requires a public folder and a key with the
 * Drive API enabled:
 *   GOOGLE_DRIVE_API_KEY (falls back to GOOGLE_BUSINESS_API_KEY)
 */

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
const DRIVE_IMAGE_MIMES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif',
];

/** The Drive API key, preferring the dedicated name and falling back to the business key. */
export function resolveDriveKey(env = process.env) {
  return env.GOOGLE_DRIVE_API_KEY || env.GOOGLE_BUSINESS_API_KEY || null;
}

/** A renderable thumbnail URL for a Drive file id. */
export function driveThumbnail(id, size = 400) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/**
 * Extracts the Drive file/folder id from any pasted share link and returns the
 * direct-renderable URLs. Throws when no id is found.
 */
export function resolveDriveLink(url) {
  const link = String(url || '');
  const match =
    link.match(/\/file\/d\/([-\w]{10,})/) ||
    link.match(/[?&]id=([-\w]{10,})/) ||
    link.match(/\/folders\/([-\w]{10,})/);
  if (!match) {
    throw new Error('No Drive file id found in that link');
  }
  const id = match[1];
  return { id, directUrl: driveThumbnail(id, 1600), thumbnailUrl: driveThumbnail(id, 400) };
}

/**
 * Lists every image and sub-folder in a Drive folder, paging through Drive's
 * `nextPageToken` so a big stock folder is returned in full. Returns
 * `{ images, folders }`; throws an Error carrying `.status` on an upstream error.
 */
export async function listDriveFolder(folderId, key) {
  const files = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      key,
      fields: 'nextPageToken, files(id, name, mimeType, imageMediaMetadata(width, height))',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data?.error?.message || 'Drive list failed');
      err.status = response.status;
      throw err;
    }
    files.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const images = files
    .filter((f) => f.mimeType !== DRIVE_FOLDER_MIME && DRIVE_IMAGE_MIMES.includes(f.mimeType))
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      width: f.imageMediaMetadata?.width,
      height: f.imageMediaMetadata?.height,
      thumbnailUrl: driveThumbnail(f.id, 400),
      directUrl: driveThumbnail(f.id, 1600),
    }));

  const folders = files
    .filter((f) => f.mimeType === DRIVE_FOLDER_MIME)
    .map((f) => ({ id: f.id, name: f.name }));

  return { images, folders };
}
