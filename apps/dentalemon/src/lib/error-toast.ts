/**
 * Centralized API-error → toast helper.
 *
 * CANONICAL ERROR SHAPE: every non-2xx the app sees is an `SdkError`
 * (`@monobase/sdk-ts/client`, installed as an interceptor in `react/provider.tsx`).
 * It is an `Error` subclass with `.message` (human string) and `.body` = the FLAT
 * backend envelope `{ code, message, statusCode, … }` (TypeSpec `ErrorDetail` in
 * `specs/api/src/common/errors.tsp`; serialized by `core/errors.ts`). The message
 * is "human-readable, safe to display". This helper surfaces it (and a small
 * code→friendly-copy map for a few terse codes) instead of hardcoded generic
 * strings, so users see what actually went wrong (e.g. "Active visit already
 * exists…") rather than "Please try again".
 *
 * NOTE: `ERROR_TAXONOMY.md` historically documented a *nested* `{ error: {...} }`
 * envelope — that shape is NOT what the wire or the SDK produce. Reading `.error`
 * is kept only as defensive back-compat (the nested branch below). The real
 * sources are `err.body.{code,message}` (SdkError) and the flat top-level body.
 *
 * Shapes handled (in priority order):
 *  - SdkError              → `err.body.{code,message}` (canonical)
 *  - raw flat body         → top-level `err.{code,message}` (interceptor absent)
 *  - legacy nested         → `err.error.{code,message}` (back-compat)
 *  - wrapped/stringified   → last-resort known-code scan
 * Plain JS Errors (network/technical messages) and the SdkError synthetic
 * "SDK request failed: …" message are NEVER surfaced — they fall through to the
 * caller's contextual `fallback`.
 */
import { toast } from 'sonner';

/** A few terse codes that deserve friendlier copy than the raw backend message. */
const CODE_MESSAGES: Record<string, string> = {
  VISIT_LOCKED: 'Visit is locked. Reopen the visit to make changes.',
  FORBIDDEN: "You don't have permission to do that.",
  CONSENT_REQUIRED: 'Patient consent is required before continuing.',
  CONSENT_NOT_SIGNED: 'Patient consent must be signed before continuing.',
  // NOTE: codes like ACTIVE_VISIT_EXISTS are intentionally NOT mapped — the backend
  // message ("Active visit already exists for this patient. Complete or discard it
  // first.") is already clear and actionable, and surfacing it verbatim avoids a
  // second FE copy that can drift from the server. Only map terse/cryptic codes.
};

const KNOWN_CODES = Object.keys(CODE_MESSAGES);

/** Read `{ code, message }` off a candidate envelope object (string fields only). */
function readEnvelope(o: Record<string, unknown>): { code?: string; message?: string } {
  return {
    code: typeof o.code === 'string' ? o.code : undefined,
    message: typeof o.message === 'string' ? o.message : undefined,
  };
}

/**
 * Pull `{ code, message }` from whichever real error shape we received. Returns
 * `{}` for plain Errors / unknown shapes so the caller's `fallback` wins (we never
 * surface a raw technical or synthetic message).
 */
export function extractApiError(err: unknown): { code?: string; message?: string } {
  if (!err || typeof err !== 'object') return {};
  const e = err as Record<string, unknown>;

  // 1. SdkError canonical: the flat envelope lives on `.body` (object, not a string).
  if (e.body && typeof e.body === 'object') {
    const fromBody = readEnvelope(e.body as Record<string, unknown>);
    if (fromBody.code || fromBody.message) return fromBody;
  }
  // 2. Raw flat body (interceptor absent): top-level { code, message, statusCode }.
  //    Require a string `code` so a plain Error (has `.message`, no `.code`) is not
  //    misread as an API envelope — that would leak technical messages.
  if (typeof e.code === 'string') {
    return readEnvelope(e);
  }
  // 3. Legacy nested { error: { code, message } } — defensive back-compat only.
  if (e.error && typeof e.error === 'object') {
    return readEnvelope(e.error as Record<string, unknown>);
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
