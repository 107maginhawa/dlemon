/**
 * check-secret-logging.test.ts — TDD for the secrets-in-logs Tier-0 gate.
 *
 * Run from repo root:  bun test ./scripts/check-secret-logging.test.ts
 *
 * The class this closes: a logger call that carries a secret the redactor won't
 * catch. Pino's redactor (core/logger.ts `redactPhi`) keys off FIELD NAMES, so
 * `logger.info({ key: this.config.secretKey }, 'stripe.initialize')` logs a live
 * `sk_live_…` in cleartext — the field name `key` is not in the redact set
 * (verified P0 in billing.ts). gitleaks can't catch this: the secret is a config
 * VARIABLE, not a literal in source.
 */

import { describe, expect, test } from 'bun:test';
import { scanSource, parseRedactFields } from './check-secret-logging';

const REDACT = new Set(['password', 'token', 'secretAccessKey', 'accessKeyId', 'email']);

describe('scanSource — secret value flowing into a logger call', () => {
  test('flags a multi-line logger object whose value is a secret accessor under a non-redacted key', () => {
    const src = [
      "this.logger.info({ ",
      "  key: this.config.secretKey,",
      "  stripeOptions",
      "}, 'stripe.initialize')",
    ].join('\n');
    const found = scanSource(src, REDACT);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('secret-value-in-log');
    expect(found[0]!.line).toBe(2); // the `key: this.config.secretKey` line
  });

  test('does NOT flag when the property KEY is in the redact set (pino redacts it)', () => {
    const src = "logger.info({ password: pw, token: t }, 'login')";
    expect(scanSource(src, REDACT)).toHaveLength(0);
  });

  test('does NOT flag logger calls with no secret-bearing value', () => {
    const src = "logger.info({ url: this.config.url, count: 3 }, 'using custom url')";
    expect(scanSource(src, REDACT)).toHaveLength(0);
  });

  test('flags a secret-named property whose own key is NOT redacted', () => {
    const src = "log.debug({ clientSecret: cfg.clientSecret }, 'oauth')";
    const found = scanSource(src, REDACT);
    expect(found).toHaveLength(1);
    expect(found[0]!.kind).toBe('secret-value-in-log');
  });

  test('ignores secret-looking text OUTSIDE a logger call', () => {
    const src = "const x = computeSecretKey(this.config.secretKey); // not logged";
    expect(scanSource(src, REDACT)).toHaveLength(0);
  });
});

describe('scanSource — committed literal secrets (gitleaks-lite)', () => {
  // Assemble the secret-SHAPED fixtures at runtime so this test file itself
  // contains no contiguous literal secret (which would trip GitHub push
  // protection — and the very gate under test). scanSource gets the joined
  // string and must still detect it.
  const skLive = 'sk_' + 'live_' + 'AbCdEfGhIjKlMnOpQrStUvWx';
  const whSec = 'wh' + 'sec_' + 'AbCdEfGhIjKlMnOpQrStUvWx';
  const skTest = 'sk_' + 'test_123';

  test('flags a live Stripe secret literal anywhere in source', () => {
    const found = scanSource(`const k = "${skLive}";`, REDACT);
    expect(found.some((f) => f.kind === 'literal-secret')).toBe(true);
  });

  test('flags a webhook signing secret literal', () => {
    expect(
      scanSource(`const w = "${whSec}";`, REDACT).some((f) => f.kind === 'literal-secret'),
    ).toBe(true);
  });

  test('does NOT flag a short test placeholder (sk_test_…)', () => {
    expect(scanSource(`const k = "${skTest}";`, REDACT)).toHaveLength(0);
  });
});

describe('parseRedactFields — read the live redact set from logger.ts', () => {
  test('extracts the field names from a PHI_FIELDS Set literal', () => {
    const loggerSrc = [
      'const PHI_FIELDS = new Set([',
      "  'password', 'token', 'email',",
      "  'secretAccessKey', 'accessKeyId',",
      ']);',
    ].join('\n');
    const set = parseRedactFields(loggerSrc);
    expect(set.has('password')).toBe(true);
    expect(set.has('secretAccessKey')).toBe(true);
    expect(set.has('accessKeyId')).toBe(true);
  });
});
