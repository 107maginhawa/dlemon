/**
 * Pino logger configuration
 * Factory function that accepts config as parameter
 */

import pino from 'pino';
import type { Config } from '@/core/config';
import type { Logger } from '@/types/logger';

// PHI/credential field names redacted at every log call-site.
// Covers top-level and one-level-deep nesting (e.g., { patient: { email } }).
// The req/res serializers never include body, so req.body/res.body are
// defense-in-depth only.
const PHI_REDACT_PATHS = [
  'password', 'token', 'email', 'phone', 'ssn', 'dateOfBirth', 'dob',
  'firstName', 'lastName', 'address', 'notes', 'soap',
  'refusalReason', 'dismissReason', 'accessKeyId', 'secretAccessKey',
  '*.password', '*.token', '*.email', '*.phone', '*.ssn',
  '*.dateOfBirth', '*.dob', '*.firstName', '*.lastName',
  '*.address', '*.notes', '*.soap', '*.refusalReason', '*.dismissReason',
  '*.accessKeyId', '*.secretAccessKey',
  'req.body', 'res.body',
] as const;

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
    redact: {
      paths: PHI_REDACT_PATHS as unknown as string[],
      censor: '[REDACTED]',
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
