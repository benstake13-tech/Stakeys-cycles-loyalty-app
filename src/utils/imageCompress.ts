/**
 * Downscale a captured photo before it is stored or sent to the AI.
 *
 * Seven full-resolution phone photos would blow past the localStorage quota and
 * slow the vision request, so each image is drawn onto a canvas at a capped
 * long edge and re-encoded as JPEG. Falls back to the original data URL when a
 * canvas is unavailable (SSR/tests) or the image cannot be decoded.
 */
const MAX_EDGE = 1280;
const QUALITY = 0.72;

export interface CompressedImage {
  dataUrl: string;
  /** Base64 payload without the data-URL prefix, ready for the vision API. */
  data: string;
  mime: string;
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const original = await readAsDataUrl(file);
  const fallback: CompressedImage = { dataUrl: original, data: original.split(',').pop() || '', mime: file.type || 'image/jpeg' };
  if (typeof document === 'undefined') return fallback;

  try {
    const img = await withTimeout(loadImage(original), 2000);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    return { dataUrl, data: dataUrl.split(',').pop() || '', mime: 'image/jpeg' };
  } catch {
    return fallback;
  }
}

/** Resolve with `p`, or reject if it has not settled within `ms` (never hang). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode-failed'));
    img.src = src;
  });
}
