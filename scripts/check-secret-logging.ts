#!/usr/bin/env bun
/**
 * check-secret-logging.ts — Tier-0 security gate: secrets must never flow into logs.
 *
 * THE CLASS THIS CLOSES: a logger call that carries a secret the redactor will
 * not catch. The pino redactor (services/api-ts/src/core/logger.ts `redactPhi`)
 * redacts by FIELD NAME, so `logger.info({ key: this.config.secretKey }, '…')`
 * logs a live `sk_live_…` in cleartext — `key` is not a redacted field name.
 * A literal-secret scan (gitleaks-style) cannot catch this: the secret is a
 * config VARIABLE, not a literal in source. So this gate has two rules:
 *
 *   Rule A — secret-value-in-log: inside a `(this.)?(logger|log).<level>({ … })`
 *     call, a property whose KEY or VALUE expression names a secret
 *     (secretKey / privateKey / clientSecret / apiKey / accessToken / …) and
 *     whose KEY is NOT in the live redact set → a leak.
 *   Rule B — literal-secret: a high-confidence committed secret literal anywhere
 *     in source (sk_live_ / rk_live_ / whsec_ / AKIA… / PEM private key / ghp_).
 *
 * The redact set is read from logger.ts at runtime so this gate stays in sync.
 * Findings are ratcheted against scripts/secret-logging.allowlist.json (every
 * entry needs a reason). New, un-allowlisted findings FAIL the gate (exit 1).
 *
 * Run from repo root:  bun scripts/check-secret-logging.ts
 * (root-level script — does NOT trip the api-ts db-guard preload.)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const SCAN_ROOT = 'services/api-ts/src';
const LOGGER_PATH = join(ROOT, 'services/api-ts/src/core/logger.ts');
const ALLOWLIST_PATH = join(ROOT, 'scripts/secret-logging.allowlist.json');

// ─────────────────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────────────────

export type SecretLogKind = 'secret-value-in-log' | 'literal-secret';

export interface Finding {
  line: number;
  kind: SecretLogKind;
  detail: string;
}

/** A value expression (or key) that names a secret-bearing thing. */
const SECRET_RE =
  /\b(secretKey|privateKey|clientSecret|client_secret|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|sessionSecret|signingSecret|webhookSecret|password|passwd|secret)\b|\.secret\b|\bsk_(live|test)_|\bwhsec_/i;

/** Opener for a logger call whose first argument is an object literal. */
const LOGGER_OPEN_RE =
  /\b(?:this\.)?(?:logger|log)\.(?:trace|debug|info|warn|error|fatal)\s*\(\s*\{/g;

/** `key: valueExpr` pairs at any nesting depth (value stops at , } or newline). */
const PAIR_RE = /(['"]?)(\w+)\1\s*:\s*([^,}\n]+)/g;

/** High-confidence committed-secret literals (gitleaks-lite). Test placeholders
 * (`sk_test_…`) are intentionally excluded; real keys need length to match. */
const LITERAL_SECRET_RES: { re: RegExp; what: string }[] = [
  { re: /sk_live_[A-Za-z0-9]{16,}/, what: 'Stripe live secret key' },
  { re: /rk_live_[A-Za-z0-9]{16,}/, what: 'Stripe live restricted key' },
  { re: /whsec_[A-Za-z0-9]{16,}/, what: 'Stripe webhook signing secret' },
  { re: /AKIA[0-9A-Z]{16}/, what: 'AWS access key id' },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, what: 'PEM private key' },
  { re: /ghp_[A-Za-z0-9]{36}/, what: 'GitHub personal access token' },
];

/** Line number (1-based) of a source offset. */
function lineAt(source: string, offset: number): number {
  let n = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') n++;
  }
  return n;
}

/** Forward brace-match from the index of an opening `{`; returns the index of
 * its matching `}`, or -1 if unbalanced (degenerate — treated as no object). */
function matchBrace(source: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Scan one file's source for secret-logging leaks (Rule A) and committed secret
 * literals (Rule B). `redactKeys` is the live redact field-name set; a property
 * whose KEY is redacted is safe (pino will redact it).
 */
export function scanSource(source: string, redactKeys: Set<string>): Finding[] {
  const findings: Finding[] = [];

  // Rule A — secret value/key inside a logger-call object literal.
  for (const open of source.matchAll(LOGGER_OPEN_RE)) {
    const braceIdx = open.index! + open[0].length - 1; // index of the `{`
    const closeIdx = matchBrace(source, braceIdx);
    if (closeIdx < 0) continue;
    const objText = source.slice(braceIdx, closeIdx + 1);
    for (const pair of objText.matchAll(PAIR_RE)) {
      const key = pair[2]!;
      const value = pair[3]!.trim();
      const isSecret = SECRET_RE.test(value) || SECRET_RE.test(key);
      if (!isSecret) continue;
      if (redactKeys.has(key)) continue; // pino redacts this field
      const offset = braceIdx + pair.index!;
      findings.push({
        line: lineAt(source, offset),
        kind: 'secret-value-in-log',
        detail: `${key}: ${value}`.slice(0, 120),
      });
    }
  }

  // Rule B — committed literal secrets anywhere in source.
  for (const { re, what } of LITERAL_SECRET_RES) {
    const m = re.exec(source);
    if (m) {
      findings.push({
        line: lineAt(source, m.index),
        kind: 'literal-secret',
        detail: `${what}: ${m[0].slice(0, 12)}…`,
      });
    }
  }

  return findings;
}

/** Extract the redacted field names from logger.ts's `PHI_FIELDS = new Set([…])`. */
export function parseRedactFields(loggerSource: string): Set<string> {
  const m = /PHI_FIELDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(loggerSource);
  const out = new Set<string>();
  if (!m) return out;
  for (const lit of m[1]!.matchAll(/['"]([^'"]+)['"]/g)) out.add(lit[1]!);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist (ratchet)
// ─────────────────────────────────────────────────────────────────────────────

interface AllowEntry {
  id: string;
  reason: string;
}

/** Stable id for a finding: file + kind + detail (line-independent). */
export function findingId(file: string, f: Finding): string {
  return `${file}::${f.kind}::${f.detail}`;
}

function loadAllowlist(): AllowEntry[] {
  if (!existsSync(ALLOWLIST_PATH)) return [];
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) throw new Error('secret-logging.allowlist.json must be an array');
  return parsed.map((e, i) => {
    const { id, reason } = (e ?? {}) as Record<string, unknown>;
    if (typeof id !== 'string' || typeof reason !== 'string' || !reason.trim()) {
      throw new Error(`secret-logging.allowlist.json entry ${i} needs string id + non-empty reason`);
    }
    return { id, reason };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const redactKeys = parseRedactFields(readFileSync(LOGGER_PATH, 'utf8'));
  const glob = new Bun.Glob('**/*.ts');
  const all: { file: string; finding: Finding }[] = [];

  for (const rel of [...glob.scanSync({ cwd: join(ROOT, SCAN_ROOT) })].sort()) {
    if (rel.endsWith('.test.ts')) continue; // tests log fake secrets to assert redaction
    const file = `${SCAN_ROOT}/${rel}`;
    const src = readFileSync(join(ROOT, file), 'utf8');
    for (const finding of scanSource(src, redactKeys)) all.push({ file, finding });
  }

  const allow = new Set(loadAllowlist().map((e) => e.id));
  const leaks = all.filter(({ file, finding }) => !allow.has(findingId(file, finding)));

  console.log(
    `check-secret-logging: scanned ${SCAN_ROOT} — ${all.length} match(es), ` +
      `${all.length - leaks.length} allowlisted, ${leaks.length} leak(s).`,
  );
  for (const { file, finding } of leaks) {
    console.error(`  ✗ ${file}:${finding.line} [${finding.kind}] ${finding.detail}`);
  }
  if (leaks.length > 0) {
    console.error(
      `\n✗ secret-logging gate FAILED: ${leaks.length} secret(s) reach a log or a committed literal.\n` +
        `  Remove the secret from the log object (or drop the field), or — only if provably safe —\n` +
        `  add it to scripts/secret-logging.allowlist.json with a reason.`,
    );
    process.exit(1);
  }
  console.log('✓ secret-logging gate: no secrets in logs.');
}

if (import.meta.main) main();
