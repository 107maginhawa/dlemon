/**
 * Centralized API-error → toast helper.
 *
 * The backend error envelope (ERROR_TAXONOMY.md §1) returns
 * `{ error: { code, message } }` where `message` is "human-readable, safe to
 * display". This helper surfaces that message (and a small code→friendly-copy
 * map for a few terse codes) instead of hardcoded generic strings, so users see
 * what actually went wrong (e.g. "Visit is locked") rather than "Please try again".
 *
 * Handles both error shapes the hey-api SDK can produce:
 *  - thrown envelope (when `throwOnError: true`)        → reads `err.error.{code,message}`
 *  - returned `{ error: {...} }` (default throwOnError)  → same shape
 *  - a wrapped/stringified Error                         → last-resort code scan
 * Plain JS Errors (network/technical messages) fall through to the caller's
 * contextual `fallback` — we never surface a raw technical message.
 */
import { toast } from 'sonner';

/** A few terse codes that deserve friendlier copy than the raw backend message. */
const CODE_MESSAGES: Record<string, string> = {
  VISIT_LOCKED: 'Visit is locked. Reopen the visit to make changes.',
  FORBIDDEN: "You don't have permission to do that.",
  CONSENT_REQUIRED: 'Patient consent is required before continuing.',
  CONSENT_NOT_SIGNED: 'Patient consent must be signed before continuing.',
};

const KNOWN_CODES = Object.keys(CODE_MESSAGES);

/** Pull `{ code, message }` from the standard envelope, if present. */
export function extractApiError(err: unknown): { code?: string; message?: string } {
  if (!err || typeof err !== 'object') return {};
  const e = err as Record<string, unknown>;
  const env = e.error;
  if (env && typeof env === 'object') {
    const inner = env as Record<string, unknown>;
    return {
      code: typeof inner.code === 'string' ? inner.code : undefined,
      message: typeof inner.message === 'string' ? inner.message : undefined,
    };
  }
  return {};
}

/** Last-resort: scan a serialized error for a known code, returning its mapped copy. */
function scanForKnownCodeMessage(err: unknown): string | undefined {
  try {
    const serialized = JSON.stringify(err) + String(err);
    const code = KNOWN_CODES.find((c) => serialized.includes(c));
    return code ? CODE_MESSAGES[code] : undefined;
  } catch {
    return undefined;
  }
}

/** Resolve the best user-facing message for an error, falling back to `fallback`. */
export function getErrorMessage(err: unknown, fallback: string): string {
  const { code, message } = extractApiError(err);
  const mapped = code ? CODE_MESSAGES[code] : undefined;
  if (mapped) return mapped;
  if (message && message.trim()) return message;
  const scanned = scanForKnownCodeMessage(err);
  if (scanned) return scanned;
  return fallback;
}

/** Show an error toast with the taxonomy message when available, else `fallback`. */
export function toastError(err: unknown, fallback: string): void {
  toast.error(getErrorMessage(err, fallback));
}
