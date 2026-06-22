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
  VISIT_IMMUTABLE: 'Visit is locked. Reopen the visit to make changes.',
  FORBIDDEN: "You don't have permission to do that.",
  CONSENT_REQUIRED: 'Patient consent is required before continuing.',
  CONSENT_NOT_SIGNED: 'Patient consent must be signed before continuing.',
  // NOTE: codes like ACTIVE_VISIT_EXISTS are intentionally NOT mapped — the backend
  // message ("Active visit already exists for this patient. Complete or discard it
  // first.") is already clear and actionable, and surfacing it verbatim avoids a
  // second FE copy that can drift from the server. Only map terse/cryptic codes.
};

const KNOWN_CODES = Object.keys(CODE_MESSAGES);

/**
 * Codes / messages that carry NO actionable user information — the server's generic
 * 500 surface. We must NOT show "Internal server error" to a user: it is worse than
 * a contextual fallback and indistinguishable across failures. Instead we show the
 * caller's fallback plus a per-occurrence ref (see getErrorMessage).
 */
const GENERIC_CODES = new Set([
  'INTERNAL_SERVER_ERROR',
  'INTERNAL_ERROR',
  'UNKNOWN_ERROR',
  'UNHANDLED',
]);
const GENERIC_MESSAGES = new Set(['internal server error', 'an unexpected error occurred']);

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

/** Read a per-occurrence reference (`requestId`, else `trackingId`) off an envelope. */
function readRef(o: Record<string, unknown>): string | undefined {
  const id = o.requestId ?? o.trackingId;
  return typeof id === 'string' && id.trim() ? id : undefined;
}

/**
 * Pull the server's per-occurrence reference from the error envelope. Every backend
 * error response carries a `requestId` (500s also a `trackingId`) and the server
 * logs the SAME value (see services/api-ts/src/middleware/request.ts), so surfacing
 * it makes two otherwise-identical opaque failures distinguishable AND lets a user
 * quote the exact id to correlate with the log line. Returns undefined for a network
 * error (the request never reached the server, so there is no ref).
 */
export function extractErrorRef(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  if (e.body && typeof e.body === 'object') {
    const fromBody = readRef(e.body as Record<string, unknown>);
    if (fromBody) return fromBody;
  }
  const top = readRef(e);
  if (top) return top;
  if (e.error && typeof e.error === 'object') return readRef(e.error as Record<string, unknown>);
  return undefined;
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

/**
 * Resolve the best user-facing message for an error, falling back to `fallback`.
 *
 * Order: a mapped friendly code → an actionable backend message → a known-code scan
 * → the contextual fallback. A GENERIC server message ("Internal server error") /
 * code (INTERNAL_SERVER_ERROR) is treated as non-actionable and routed to the
 * fallback so the user never sees the opaque server string. Whenever we land on the
 * fallback AND the server gave us a per-occurrence ref, we append it — turning an
 * indistinguishable "Please try again" into a quotable, log-correlatable one.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  const { code, message } = extractApiError(err);
  const mapped = code ? CODE_MESSAGES[code] : undefined;
  if (mapped) return mapped;

  const isGeneric =
    (!!code && GENERIC_CODES.has(code)) ||
    (!!message && GENERIC_MESSAGES.has(message.trim().toLowerCase()));
  if (message && message.trim() && !isGeneric) return message;

  const scanned = scanForKnownCodeMessage(err);
  if (scanned) return scanned;

  // Opaque path: append the server ref (first 8 chars — enough to disambiguate and
  // to grep the logs) when present. Network errors have no ref → clean fallback.
  const ref = extractErrorRef(err);
  return ref ? `${fallback} (ref: ${ref.slice(0, 8)})` : fallback;
}

/** Show an error toast with the taxonomy message when available, else `fallback`. */
export function toastError(err: unknown, fallback: string): void {
  toast.error(getErrorMessage(err, fallback));
}
