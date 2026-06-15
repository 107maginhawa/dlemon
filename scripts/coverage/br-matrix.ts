#!/usr/bin/env bun
/**
 * br-matrix.ts — business-rule coverage matrix + gate.
 *
 * WHY: the role-op-matrix proves the AUTHZ surface matches the spec; this matrix
 * proves the BUSINESS-RULE surface is actually TESTED. The 122 BRs in
 * `specs/api/docs/standards/br-registry.json` are the codified invariants of the
 * product (a patient can't have two active visits; an invoice needs a billable
 * treatment; a signed consent is immutable; a portal read is IDOR-free…). A BR
 * that no test references is an invariant the suite would not notice breaking —
 * exactly the "app broken while CI green" class the STOP-THE-DRIFT program exists
 * to kill. This script computes, per BR:
 *
 *   1. derivedSeverity — from the registry `type` (the registry has no severity
 *      field). P0 = the authz/tenancy/security/privacy/compliance family; P1 =
 *      the guard/state-machine/integrity/concurrency family; else P2.
 *   2. corporaHit      — which of the 4 test corpora reference the BR id
 *      (scanForToken(brId) over api-unit / app-unit / e2e / hurl).
 *   3. hasNegativePath — does a file that mentions the BR also assert a failure
 *      status (403/409/422/405) or an error-code token? Guard-typed BRs need
 *      this to count as fully covered (a positive-only authz test is a trap).
 *   4. coverageState   — FULLY_COVERED / POSITIVE_ONLY / UNTESTED.
 *
 * GATE (intended):
 *   - A P0 BR (non-excluded status) that is UNTESTED, or a P0 GUARD that is
 *     POSITIVE_ONLY (referenced but no negative path), is a HARD FAIL — never
 *     allowlistable. A broken authorization/tenancy/compliance invariant must be
 *     impossible to ship silently.
 *   - P1/P2 uncovered BRs RATCHET via br.allowlist.json: a current baseline is
 *     tolerated; a NEW uncovered P1/P2 fails the gate.
 *   - BRs whose registry status ∈ {deferred, not-implemented, unauditable} are
 *     excluded from gating entirely (recorded in the allowlist as by-status).
 *
 * Run from repo root:  bun scripts/coverage/br-matrix.ts          (write matrices)
 *                      bun scripts/coverage/br-matrix.ts --check   (gate mode)
 * (root-level script — does NOT trip the api-ts db-guard preload.)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, cmpByCodepoint } from './lib/sources';
import { scanForToken, scanForRegex, type CorpusName } from './lib/scan-tests';
import {
  ratchet,
  loadAllowlist,
  formatRatchetReport,
  type Gap,
  type AllowlistEntry,
} from './lib/ratchet';

const REGISTRY = join(ROOT, 'specs/api/docs/standards/br-registry.json');
const OUT_JSON = join(ROOT, 'docs/testing/coverage/br-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/br-matrix.md');
const ALLOWLIST = join(ROOT, 'docs/testing/coverage/br.allowlist.json');

/** The corpora a BR can be referenced in (journeys is folded into e2e). */
const SCAN_CORPORA: readonly CorpusName[] = ['api-unit', 'app-unit', 'e2e', 'hurl'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Severity + guard-typing — derived from the registry `type` (no severity field)
// ─────────────────────────────────────────────────────────────────────────────

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type CoverageState = 'FULLY_COVERED' | 'POSITIVE_ONLY' | 'UNTESTED';

/**
 * P0 — a broken instance is a security / privacy / compliance / cross-tenant
 * incident: leaks PHI, escalates privilege, or violates a legal obligation.
 */
const P0_TYPES = new Set([
  'authorization',
  'access-control',
  'multi-tenancy',
  'security',
  'privacy',
  'compliance',
]);

/**
 * P1 — a broken instance corrupts data or lets an illegal state through (a
 * reversed state machine, a double-booking, a lost write) but is not directly a
 * disclosure/authz incident.
 */
const P1_TYPES = new Set([
  'state-guard',
  'state-machine',
  'conflict-prevention',
  'data-integrity',
  'referential-integrity',
  'concurrency',
]);

/** Derive a severity from the registry `type`. Unknown / lower-stakes → P2. */
export function deriveSeverity(type: string): Severity {
  if (P0_TYPES.has(type)) return 'P0';
  if (P1_TYPES.has(type)) return 'P1';
  return 'P2';
}

/**
 * Guard-typed BRs encode a REFUSAL (an authz denial, a tenancy boundary, an
 * illegal state-transition rejection, a conflict block). A test that only
 * exercises the happy path "proves" nothing about the guard — so a guard-typed
 * BR needs a NEGATIVE-PATH assertion (a 4xx / error code) to count as fully
 * covered. Pure response-contract / ux / schema BRs have no refusal to miss, so
 * a positive reference suffices.
 */
const GUARD_TYPES = new Set([
  ...P0_TYPES, // every authz/tenancy/security/etc. BR is a refusal
  'state-guard',
  'state-machine',
  'conflict-prevention',
  'lifecycle-guard',
  'validation',
]);

/** True when a BR of this `type` requires a negative-path test to be FULLY_COVERED. */
export function isGuardTyped(type: string): boolean {
  return GUARD_TYPES.has(type);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gating exclusion — by registry status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A BR whose registry status says it is not (fully) implemented or cannot be
 * audited from the backend is excluded from the coverage gate — it would be
 * incoherent to demand a passing negative-path test for an unbuilt or
 * frontend-only invariant. These land in br.allowlist.json with reason = status.
 */
const EXCLUDED_STATUSES = new Set(['deferred', 'not-implemented', 'unauditable']);

export function isGatingExcluded(status: string): boolean {
  return EXCLUDED_STATUSES.has(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage-state resolution
// ─────────────────────────────────────────────────────────────────────────────

export function resolveCoverageState(args: {
  corporaHit: CorpusName[];
  guardTyped: boolean;
  hasNegativePath: boolean;
}): CoverageState {
  if (args.corporaHit.length === 0) return 'UNTESTED';
  if (args.guardTyped && !args.hasNegativePath) return 'POSITIVE_ONLY';
  return 'FULLY_COVERED';
}

// ─────────────────────────────────────────────────────────────────────────────
// Row type
// ─────────────────────────────────────────────────────────────────────────────

export interface BrRow {
  /** Module-qualified unique key `<module>::<brId>` (brId alone is not unique). */
  key: string;
  brId: string;
  module: string;
  type: string;
  derivedSeverity: Severity;
  status: string;
  guardTyped: boolean;
  corporaHit: CorpusName[];
  hasNegativePath: boolean;
  coverageState: CoverageState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scan-code extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The registry `id` is `<CODE>[ / <ALIAS>…] [(prose label)]` — e.g.
 *   "BR-001"
 *   "AC-AUD-004 / V-AUD-001 / V-AUD-NEW-A"
 *   "V-PORTAL-001 (IDOR-free self-scope — headline invariant)"
 * A token scan must use the bare CODE(s), never the prose-laden full id (no test
 * cites the parenthetical). This strips the parenthetical and splits on `/` so a
 * BR tagged by ANY of its alias codes is credited.
 */
export function scanCodesForId(id: string): string[] {
  const beforeParen = id.split('(')[0] ?? id;
  return beforeParen
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Negative-path detection
// ─────────────────────────────────────────────────────────────────────────────

/** Failure HTTP status tokens a guard test is expected to assert. */
const NEG_STATUS_RE = /\b(403|409|422|405)\b/;
/**
 * Error-code tokens: SCREAMING_SNAKE constants the handlers throw (e.g.
 * ACTIVE_VISIT_EXISTS, CONSENT_REQUIRED, LANDMARK_LOCKED). An UPPER_SNAKE token
 * of length ≥ 6 with an underscore is a strong signal a negative path is being
 * asserted; we additionally require an error-shaped word so we don't match
 * arbitrary constants.
 */
const ERROR_CODE_RE =
  /\b[A-Z][A-Z0-9]*_[A-Z0-9_]*(REQUIRED|EXISTS|IMMUTABLE|LOCKED|INVALID|MISMATCH|FORBIDDEN|DENIED|CONFLICT|NOT_|_NOT|EXCEEDS|REVOKED|SIGNED|ARCHIVED|UNSUPPORTED|FAILED|BLOCKED|TRANSITION|ERROR)[A-Z0-9_]*\b/;

/**
 * A BR has a negative path iff SOME file that references any of the BR's codes
 * also (on any line in that same file) asserts a failure status token or an
 * error-code token. Scoping to files-that-mention-the-BR keeps the signal local
 * to the BR's own tests rather than crediting an unrelated 422 elsewhere.
 */
function hasNegativePathForBr(codes: string[]): boolean {
  const refFiles = new Set<string>();
  for (const code of codes) for (const m of scanForToken(code, SCAN_CORPORA)) refFiles.add(m.file);
  if (refFiles.size === 0) return false;

  for (const re of [NEG_STATUS_RE, ERROR_CODE_RE]) {
    for (const m of scanForRegex(re, SCAN_CORPORA)) {
      if (refFiles.has(m.file)) return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry loading + build
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryRule {
  id: string;
  description?: string;
  type: string;
  status: string;
}

interface Registry {
  modules: Record<string, { description?: string; rules: RegistryRule[] }>;
}

function loadRegistry(): Registry {
  return JSON.parse(readFileSync(REGISTRY, 'utf8')) as Registry;
}

/** Build the full BR coverage matrix from the registry + test corpora. */
export function buildBrMatrix(): BrRow[] {
  const reg = loadRegistry();
  const rows: BrRow[] = [];

  for (const [module, mod] of Object.entries(reg.modules)) {
    for (const rule of mod.rules) {
      const codes = scanCodesForId(rule.id);
      const corporaHit = corporaReferencing(codes);
      const guardTyped = isGuardTyped(rule.type);
      const hasNegativePath = corporaHit.length > 0 ? hasNegativePathForBr(codes) : false;
      rows.push({
        key: `${module}::${rule.id}`,
        brId: rule.id,
        module,
        type: rule.type,
        derivedSeverity: deriveSeverity(rule.type),
        status: rule.status,
        guardTyped,
        corporaHit,
        hasNegativePath,
        coverageState: resolveCoverageState({ corporaHit, guardTyped, hasNegativePath }),
      });
    }
  }

  rows.sort((a, b) => cmpByCodepoint(a.key, b.key));
  return rows;
}

/** Which corpora reference any of this BR's codes (at least one matching line). */
function corporaReferencing(codes: string[]): CorpusName[] {
  const hits = new Set<CorpusName>();
  for (const code of codes) for (const m of scanForToken(code, SCAN_CORPORA)) hits.add(m.corpus);
  return SCAN_CORPORA.filter((c) => hits.has(c));
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist seeding + gate verdict
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ratchet baseline: every currently-uncovered non-P0, non-excluded BR. P0s
 * are NEVER seeded (they must be fixed, not tolerated); excluded-status BRs are
 * recorded separately (reason = status) so the live allowlist file distinguishes
 * "known coverage debt" from "not gateable by design".
 */
export function seedAllowlist(rows: BrRow[]): AllowlistEntry[] {
  const out: AllowlistEntry[] = [];
  for (const r of rows) {
    if (isGatingExcluded(r.status)) continue; // recorded by-status, not as debt
    if (r.derivedSeverity === 'P0') continue; // never tolerated
    if (r.coverageState === 'FULLY_COVERED') continue;
    out.push({
      id: r.key,
      reason: `ratchet baseline: ${r.derivedSeverity} ${r.type} ${r.coverageState} (${r.status})`,
    });
  }
  return out;
}

/** The by-status allowlist entries (deferred/not-implemented/unauditable). */
export function statusExcludedAllowlist(rows: BrRow[]): AllowlistEntry[] {
  return rows
    .filter((r) => isGatingExcluded(r.status))
    .map((r) => ({ id: r.key, reason: r.status }));
}

export interface GateVerdict {
  /** P0 hard failures (untested or positive-only guard) — never allowlistable. */
  p0Failures: Gap[];
  /** New non-allowlisted P1/P2 gaps. */
  newGaps: Gap[];
  /** Allowlist ids no longer a current gap (tighten the allowlist). */
  resolved: string[];
  ok: boolean;
}

/** Is this row an unmet coverage requirement (uncovered or positive-only guard)? */
function isGap(r: BrRow): boolean {
  return r.coverageState !== 'FULLY_COVERED';
}

/**
 * The gate:
 *   - P0 (non-excluded) gaps → hard fail, regardless of the allowlist.
 *   - everything else ratchets against `allowlist`.
 */
export function computeGateVerdict(rows: BrRow[], allowlist: AllowlistEntry[]): GateVerdict {
  const gating = rows.filter((r) => !isGatingExcluded(r.status));

  const p0Failures: Gap[] = gating
    .filter((r) => r.derivedSeverity === 'P0' && isGap(r))
    .map((r) => gapOf(r));

  // By-status exclusions live in the allowlist (reason = status) but never enter
  // the ratchet's `current` set; passing them to `ratchet` would falsely flag
  // them as "resolved" (tighten me). Drop them from the ratchet comparison.
  const excludedKeys = new Set(rows.filter((r) => isGatingExcluded(r.status)).map((r) => r.key));
  const ratchetAllowlist = allowlist.filter((e) => !excludedKeys.has(e.id));

  const ratchetable = gating.filter((r) => r.derivedSeverity !== 'P0' && isGap(r)).map(gapOf);
  const r = ratchet(ratchetable, ratchetAllowlist);

  return {
    p0Failures,
    newGaps: r.newGaps,
    resolved: r.resolved,
    ok: p0Failures.length === 0 && r.ok,
  };
}

function gapOf(r: BrRow): Gap {
  return {
    id: r.key,
    severity: r.derivedSeverity,
    type: r.type,
    state: r.coverageState,
    status: r.status,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderMd(rows: BrRow[]): string {
  const by = (s: CoverageState) => rows.filter((r) => r.coverageState === s).length;
  const sev = (s: Severity) => rows.filter((r) => r.derivedSeverity === s).length;
  const p0Gaps = rows.filter(
    (r) => r.derivedSeverity === 'P0' && !isGatingExcluded(r.status) && isGap(r),
  );

  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/br-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Business-Rule Coverage Matrix');
  lines.push('');
  lines.push(
    'Computed coverage of the 122 business rules in ' +
      '`specs/api/docs/standards/br-registry.json` against the four test corpora ' +
      '(api-unit, app-unit, e2e, hurl). A BR no test references is an invariant the ' +
      'suite would not notice breaking — the "app broken while CI green" bug class.',
  );
  lines.push('');
  lines.push('## Coverage state');
  lines.push('');
  lines.push('- **FULLY_COVERED** — referenced, and (if guard-typed) a negative-path assertion exists.');
  lines.push('- **POSITIVE_ONLY** — a guard-typed BR is referenced but no negative-path (4xx / error-code) assertion sits in a referencing file.');
  lines.push('- **UNTESTED** — no test corpus references the BR id.');
  lines.push('');
  lines.push('## Intended gate');
  lines.push('');
  lines.push('- A **P0** BR (non-excluded status) that is **UNTESTED**, or a **P0 guard** that is **POSITIVE_ONLY**, is a **HARD FAIL** — never allowlistable.');
  lines.push('- **P1/P2** uncovered BRs **ratchet** via `br.allowlist.json` (current baseline tolerated; new uncovered BR fails).');
  lines.push('- BRs with registry status ∈ {deferred, not-implemented, unauditable} are **excluded** from gating (listed in the allowlist with reason = status).');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Total BRs | ${rows.length} |`);
  lines.push(`| P0 | ${sev('P0')} |`);
  lines.push(`| P1 | ${sev('P1')} |`);
  lines.push(`| P2 | ${sev('P2')} |`);
  lines.push(`| FULLY_COVERED | ${by('FULLY_COVERED')} |`);
  lines.push(`| POSITIVE_ONLY | ${by('POSITIVE_ONLY')} |`);
  lines.push(`| UNTESTED | ${by('UNTESTED')} |`);
  lines.push(`| **P0 gate failures** | **${p0Gaps.length}** |`);
  lines.push('');

  lines.push('## P0 gate failures');
  lines.push('');
  if (p0Gaps.length === 0) {
    lines.push('_None — every P0 business rule is fully covered._');
  } else {
    lines.push('| key | type | state | status |');
    lines.push('|-----|------|-------|--------|');
    for (const r of p0Gaps) {
      lines.push(`| \`${r.key}\` | ${r.type} | ${r.coverageState} | ${r.status} |`);
    }
  }
  lines.push('');

  lines.push('## All business rules');
  lines.push('');
  lines.push('| brId | module | type | sev | status | corpora | neg-path | state |');
  lines.push('|------|--------|------|:---:|--------|---------|:--------:|-------|');
  for (const r of rows) {
    const corpora = r.corporaHit.length ? r.corporaHit.join(', ') : '—';
    lines.push(
      `| \`${r.brId}\` | ${r.module} | ${r.type} | ${r.derivedSeverity} | ${r.status} | ${corpora} | ${r.hasNegativePath ? '✓' : '—'} | ${r.coverageState} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const rows = buildBrMatrix();
  const check = process.argv.includes('--check');

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));

  // Seed the allowlist file once if it does not yet exist (ratchet baseline =
  // current non-P0 debt + by-status exclusions). Never overwrite a curated one.
  let allowlist: AllowlistEntry[];
  try {
    allowlist = loadAllowlist(ALLOWLIST);
    if (allowlist.length === 0) throw new Error('empty');
  } catch {
    allowlist = [...statusExcludedAllowlist(rows), ...seedAllowlist(rows)];
    writeFileSync(ALLOWLIST, JSON.stringify(allowlist, null, 2) + '\n');
  }

  const verdict = computeGateVerdict(rows, allowlist);
  const sev = (s: Severity) => rows.filter((r) => r.derivedSeverity === s).length;
  const by = (s: CoverageState) => rows.filter((r) => r.coverageState === s).length;

  console.log(
    `br-matrix: ${rows.length} BRs (P0 ${sev('P0')} / P1 ${sev('P1')} / P2 ${sev('P2')}), ` +
      `${by('FULLY_COVERED')} fully / ${by('POSITIVE_ONLY')} positive-only / ${by('UNTESTED')} untested. ` +
      `${verdict.p0Failures.length} P0 gate failure(s). Wrote ${OUT_JSON} + ${OUT_MD}`,
  );

  if (check) {
    if (verdict.p0Failures.length > 0) {
      console.error(`\n✗ P0 BR coverage FAILURES (${verdict.p0Failures.length}) — never allowlistable:`);
      for (const g of verdict.p0Failures) {
        console.error(`  ${g.id}: ${g.type} ${g.state} (${g.status})`);
      }
    }
    console.error(formatRatchetReport(verdict, { label: 'br-matrix (P1/P2)' }));
    if (!verdict.ok) process.exit(1);
  }
}

if (import.meta.main) main();
