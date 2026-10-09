/**
 * Classifies failures from the in-browser Gemini vision call.
 *
 * The AI Bike Identifier talks to Gemini directly from the browser, so a failed
 * request surfaces as an Error whose `message` is the raw upstream JSON body —
 * e.g. `{ "error": { "code": 503, "message": "This model is currently
 * experiencing high demand…", "status": "UNAVAILABLE" } }`. That raw blob used
 * to be shown to staff verbatim. This module turns any thrown value into a
 * stable, machine-readable kind plus a human sentence the UI can render in a
 * styled banner, and — crucially — never lets raw JSON reach the user.
 */

export type VisionErrorKind =
  | 'MODEL_OVERLOADED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'CANCELLED'
  | 'NOT_CONFIGURED'
  | 'EMPTY_RESPONSE'
  | 'INVALID_RESPONSE'
  | 'BAD_IMAGE'
  | 'UNKNOWN';

export interface VisionErrorInfo {
  kind: VisionErrorKind;
  /** True when a simple retry ("Re-analyse") is likely to succeed. */
  retryable: boolean;
  /** True when waiting a little while before retrying is worthwhile. */
  transient: boolean;
  message: string;
}

/**
 * A structured vision failure the UI can render as a friendly banner. Carries
 * the machine-readable `kind` plus a ready-to-show message, so raw upstream JSON
 * never reaches the user. Lives here (TS) rather than in the `.js` service so the
 * type-only fields stay valid.
 */
export class VisionError extends Error {
  kind: VisionErrorKind;
  retryable: boolean;
  transient: boolean;
  constructor(info: VisionErrorInfo) {
    super(info.message);
    this.name = 'VisionError';
    this.kind = info.kind;
    this.retryable = info.retryable;
    this.transient = info.transient;
  }
}

export interface VisionErrorOptions {
  configured?: boolean;
  /** The UI timed out the request before the SDK returned (AbortError). */
  timedOut?: boolean;
}

const STATUS_TO_KIND: Record<number, VisionErrorKind> = {
  429: 'RATE_LIMITED',
  500: 'MODEL_OVERLOADED',
  502: 'MODEL_OVERLOADED',
  503: 'MODEL_OVERLOADED',
  504: 'MODEL_OVERLOADED',
};

/** A JSON body the SDK sometimes throws as the raw error text. */
const parseErrorBody = (message: string): { code?: number; status?: string } => {
  const start = message.indexOf('{');
  if (start === -1) return {};
  try {
    const body = JSON.parse(message.slice(start));
    return { code: body?.error?.code, status: body?.error?.status };
  } catch {
    return {};
  }
};

export function classifyVisionError(err: unknown, opts: VisionErrorOptions = {}): VisionErrorInfo {
  const message = String((err as { message?: unknown })?.message ?? err ?? '');
  const name = String((err as { name?: unknown })?.name ?? '');
  const lower = message.toLowerCase();

  if (opts.timedOut || name === 'AbortError' || name === 'TimeoutError' || /timed?\s*out|timeout/.test(lower)) {
    return {
      kind: 'TIMEOUT',
      retryable: true,
      transient: true,
      message: 'The AI scanner took too long to respond. Please tap Re-analyse to try again.',
    };
  }
  if (name === 'AbortError' || /aborted|abort/.test(lower)) {
    return {
      kind: 'CANCELLED',
      retryable: true,
      transient: true,
      message: 'The scan was cancelled. Tap Re-analyse to start again.',
    };
  }
  if (/not configured|no api key|api key is missing|vite_gemini_api_key/.test(lower) || opts.configured === false) {
    return {
      kind: 'NOT_CONFIGURED',
      retryable: false,
      transient: false,
      message: "AI vision isn't configured on this build. Please contact support to enable photo identification.",
    };
  }
  if (/failed to fetch|networkerror|network request failed|load failed|err_internet|enotfound/.test(lower)) {
    return {
      kind: 'OFFLINE',
      retryable: true,
      transient: true,
      message: 'The scanner could not reach the network. Check your connection and tap Re-analyse.',
    };
  }

  const parsed = parseErrorBody(message);
  const code = parsed.code;
  const status = (parsed.status || '').toUpperCase();

  if (code && STATUS_TO_KIND[code]) {
    return infoForKind(STATUS_TO_KIND[code]);
  }
  if (status === 'UNAVAILABLE' || status === 'INTERNAL' || /overloaded|high demand|unavailable|currently experiencing/.test(lower)) {
    return infoForKind('MODEL_OVERLOADED');
  }
  if (/rate limit|quota|resource_exhausted|too many requests/.test(lower)) {
    return infoForKind('RATE_LIMITED');
  }
  if (/empty response/.test(lower)) {
    return infoForKind('EMPTY_RESPONSE');
  }
  if (/unexpected token|json|parse/.test(lower)) {
    return infoForKind('INVALID_RESPONSE');
  }
  if (/image|mime|inline_data|too large|unsupported/.test(lower)) {
    return infoForKind('BAD_IMAGE');
  }
  return infoForKind('UNKNOWN');
}

function infoForKind(kind: VisionErrorKind): VisionErrorInfo {
  switch (kind) {
    case 'MODEL_OVERLOADED':
      return {
        kind,
        retryable: true,
        transient: true,
        message: "Our AI scanner is temporarily busy due to high demand. Please tap 'Re-analyse' in a moment.",
      };
    case 'RATE_LIMITED':
      return {
        kind,
        retryable: true,
        transient: true,
        message: "The AI scanner is handling a lot of requests right now. Please tap 'Re-analyse' in a few seconds.",
      };
    case 'EMPTY_RESPONSE':
      return {
        kind,
        retryable: true,
        transient: true,
        message: 'The AI could not read that photo. Try another image, or tap Re-analyse.',
      };
    case 'INVALID_RESPONSE':
      return {
        kind,
        retryable: true,
        transient: true,
        message: 'The AI sent an unexpected response. Please tap Re-analyse to try again.',
      };
    case 'BAD_IMAGE':
      return {
        kind,
        retryable: false,
        transient: false,
        message: 'That image could not be read. Please choose a clear photo (JPG or PNG).',
      };
    default:
      return {
        kind: 'UNKNOWN',
        retryable: true,
        transient: true,
        message: 'Something went wrong while analysing the photo. Please tap Re-analyse to try again.',
      };
  }
}
