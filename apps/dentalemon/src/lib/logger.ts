/**
 * Frontend diagnostic logger — the single seam for developer-facing logging.
 *
 * WHY: 30+ scattered `console.*` calls made production consoles noisy and left no
 * single place to (a) gate verbosity by environment or (b) later forward warnings
 * /errors to a telemetry sink. This is NOT the user-facing error channel — that is
 * `error-toast.ts` (sonner). Diagnostic logs here are never shown to the user.
 *
 * Behaviour:
 *   - DEV (`import.meta.env.DEV`, i.e. `vite dev`): every level prints to the
 *     console, scope-prefixed.
 *   - PROD: `debug`/`info` are dropped (noise); `warn`/`error` still print so
 *     shipped issues stay diagnosable, and are forwarded to an optional `sink`
 *     for future telemetry (Sentry/OneSignal/etc.). No sink is wired by default.
 *
 * PHI: pass an `Error` or a small non-PHI detail object. Do NOT pass raw request
 * payloads / patient records — browser-console logs can be captured by monitoring
 * tools. (The backend logger redacts PHI server-side via `core/logger.ts`; the FE
 * keeps PHI out by convention, mirroring that intent without a recursive walk.)
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogSink = (level: LogLevel, scope: string, message: string, detail?: unknown) => void;

interface LoggerConfig {
  /** False in a production build: drop debug/info, forward warn/error to `sink`. */
  dev: boolean;
  /** Optional telemetry transport for prod warn/error. Never invoked in dev. */
  sink: LogSink | null;
}

// `import.meta.env.DEV` is injected by Vite (true under `vite dev`, false in a
// prod build). Under the bun test runner it is undefined → treated as prod; tests
// set `dev` explicitly via `configureLogger`.
const config: LoggerConfig = {
  dev: Boolean(import.meta.env.DEV),
  sink: null,
};

/** Override logger behaviour. App bootstrap may wire a telemetry `sink`; tests set `dev`. */
export function configureLogger(patch: Partial<LoggerConfig>): void {
  if (patch.dev !== undefined) config.dev = patch.dev;
  if (patch.sink !== undefined) config.sink = patch.sink;
}

function emit(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  // Prod: drop chatter (debug/info); keep warn/error so shipped issues stay diagnosable.
  if (!config.dev && (level === 'debug' || level === 'info')) return;

  const label = scope ? `[${scope}] ${message}` : message;
  // eslint-disable-next-line no-console -- this module IS the sanctioned console seam
  if (detail === undefined) console[level](label);
  // eslint-disable-next-line no-console -- this module IS the sanctioned console seam
  else console[level](label, detail);

  // Telemetry is a production-only concern; never forward dev logs.
  if (!config.dev && (level === 'warn' || level === 'error') && config.sink) {
    try {
      config.sink(level, scope, message, detail);
    } catch {
      // A failing sink must never break the calling code path.
    }
  }
}

export const logger = {
  debug: (scope: string, message: string, detail?: unknown) => emit('debug', scope, message, detail),
  info: (scope: string, message: string, detail?: unknown) => emit('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) => emit('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) => emit('error', scope, message, detail),
};
