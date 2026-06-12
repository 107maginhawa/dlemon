/**
 * Pino logger configuration
 * Factory function that accepts config as parameter
 */

import pino from 'pino';
import type { Config } from '@/core/config';
import type { Logger } from '@/types/logger';

// PHI/credential field NAMES redacted at every log call-site, at ANY depth.
// Pino's `redact.paths` only descends a fixed number of levels (`*.email` is
// one level), which leaked PHI carried in nested JSONB blobs — e.g. a logged
// person/patient `contactInfo: { email, phone }` sat two-plus levels below the
// log root. `redactPhi` below walks the logged object recursively instead.
const PHI_FIELDS = new Set([
  'password', 'token', 'email', 'phone', 'ssn', 'dateOfBirth', 'dob',
  'firstName', 'lastName', 'address', 'notes', 'soap',
  'refusalReason', 'dismissReason', 'accessKeyId', 'secretAccessKey',
]);

const REDACTED = '[REDACTED]';

// True only for array literals and plain objects ({}). Dates, Buffers, Maps and
// class instances are left untouched so Pino can serialize them normally —
// walking a Date (no own enumerable keys) would clobber it to `{}` and destroy
// the audit value of logged timestamps.
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Build a redacted COPY of the logged object, descending plain objects and
// arrays to any depth. Never mutates the caller's object (handlers keep using it
// after the log call). Any value under a PHI field name is replaced wholesale
// (the whole subtree), since a PHI key's value is PHI. `ancestors` tracks only
// the current path so a true cycle becomes '[Circular]' while a shared (DAG)
// reference is still redacted in every place it appears.
function redactPhi(value: unknown, ancestors: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (!Array.isArray(value) && !isPlainObject(value)) return value;
  if (ancestors.has(value as object)) return '[Circular]';
  ancestors.add(value as object);

  let out: unknown;
  if (Array.isArray(value)) {
    out = value.map((item) => redactPhi(item, ancestors));
  } else {
    const obj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      obj[key] = PHI_FIELDS.has(key) ? REDACTED : redactPhi(val, ancestors);
    }
    out = obj;
  }

  ancestors.delete(value as object);
  return out;
}

const SENSITIVE_HEADERS = new Set([
  'authorization', 'cookie', 'set-cookie', 'x-api-key',
  'x-internal-service-token', 'x-auth-token',
]);

function redactSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return result;
}

// Create logger instance with config.
// The optional `dest` parameter accepts any object with a `write(msg: string): void`
// method — used in tests to capture log output without a real stream.
export function createLogger(config: Config, dest?: { write(msg: string): void }): Logger {
  const options: pino.LoggerOptions = {
    level: config.logging.level,
    // Recursive PHI redaction runs after the req/res serializers below, so it
    // also covers their output. Returns a redacted copy — see `redactPhi`.
    formatters: {
      log: (obj) => redactPhi(obj, new WeakSet()) as Record<string, unknown>,
    },
    transport: config.logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss',
          },
        }
      : undefined,
    serializers: {
      req: (req) => ({
        method: req.method,
        // Strip query string — never log query-param PII (SSN, DOB, etc.)
        url: typeof req.url === 'string' ? req.url.split('?')[0] : req.url,
        headers: redactSensitiveHeaders(req.headers),
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
      error: pino.stdSerializers.err,
    },
    base: {
      service: 'api',
    },
  };

  const logger = dest ? pino(options, dest as pino.DestinationStream) : pino(options);
  return logger;
}
