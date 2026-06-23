#!/usr/bin/env bun
/**
 * endpoint-matrix.ts — per-operation ENDPOINT coverage matrix.
 *
 * WHY: "the app is broken while CI is green" is, structurally, an UNTESTED
 * endpoint that the frontend nonetheless calls. The role×operation matrix
 * (role-op-matrix.ts) answers "who may call each op"; this matrix answers the
 * orthogonal question "is each op actually EXERCISED by a test, and if the FE
 * consumes it, is it exercised by ANY layer at all?". A FE-consumed op with no
 * contract / integration / journey test is the latent broken-while-green class
 * the ratchet must hold the line on.
 *
 * WHAT it does, deterministically, over all ~369 operations:
 *   1. Joins the contract-spine columns
 *        { operationId, method, path, module, hasHandler, hasSDK, hasFEConsumer }
 *      from `.understand-anything/contract-spine.json`.
 *   2. Contract column — statically parses every `specs/api/tests/contract/*.hurl`
 *      request line, normalises `{{var}}` segments to OpenAPI templates, resolves
 *      each (method, path) to an operationId via the OpenAPI `paths` map →
 *      `hasContractTest`.
 *   3. Integration / journey columns — reads a JSONL "recorded ops" sink, if
 *      present, produced by the env-gated recorders wired into the shared
 *      `buildTestApp` (integration) and the journey HTTP client (journey). Each
 *      recorded `{method, matchedRoutePath}` is resolved positionally to an
 *      operationId. ABSENT sink → both columns false (the suite was not run with
 *      `COVERAGE_RECORD=1`).
 *   4. disposition:
 *        - `hasFEConsumer && !(contract||integration||journey)` → "gap"
 *          (consumed but untested — the ratchet cares about these).
 *        - `hasHandler && hasSDK && !hasFEConsumer`             → "orphan"
 *          (shipped wiring nothing calls — written to orphan-disposition.md, NOT
 *          put in the test ratchet).
 *        - else                                                 → "tested".
 *   5. Emits docs/testing/coverage/endpoint-matrix.{json,md}, seeds the gap
 *      allowlist baseline (endpoint.allowlist.json), and writes the orphan
 *      disposition doc.
 *   6. --check: ratchets the current gaps against endpoint.allowlist.json — a
 *      FE-consumed-but-untested op not on the allowlist FAILS the gate (exit 1).
 *      Run-all.ts passes --check through (gate:true); this is the live gate that
 *      catches a newly-wired FE call that ships without any test layer.
 *
 * Run from repo root:  bun scripts/coverage/endpoint-matrix.ts [--check]
 * (root-level script — does NOT trip the api-ts db-guard preload).
 *
 * RECORDING the integration/journey columns:
 *   COVERAGE_RECORD=1 cd services/api-ts && bun test          # appends to the sink
 *   COVERAGE_RECORD=1 <run the journey suite>                 # appends to the sink
 *   bun scripts/coverage/endpoint-matrix.ts                   # reads the sink
 * With no sink the two columns are simply false (documented, not an error).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, loadContractSpine, cmpByCodepoint } from './lib/sources';
import { listFiles } from './lib/scan-tests';
import {
  loadAllowlist,
  ratchet,
  formatRatchetReport,
  type AllowlistEntry,
  type Gap,
} from './lib/ratchet';

const SPINE_PATH = join(ROOT, '.understand-anything/contract-spine.json');
const OPENAPI_PATH = join(ROOT, 'specs/api/dist/openapi/openapi.json');
const RECORDED_SINK = join(ROOT, 'docs/testing/coverage/.recorded-ops.jsonl');

const OUT_JSON = join(ROOT, 'docs/testing/coverage/endpoint-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/endpoint-matrix.md');
const OUT_ALLOWLIST = join(ROOT, 'docs/testing/coverage/endpoint.allowlist.json');
const OUT_SENSITIVE_ALLOWLIST = join(
  ROOT,
  'docs/testing/coverage/endpoint-sensitive-orphan.allowlist.json',
);
const OUT_ORPHANS = join(ROOT, 'docs/testing/coverage/orphan-disposition.md');
// Committed, hand-curated list of upstream base-template operationIds (booking,
// comms, email, storage, reviews, emr, notifs, generic providers/patients/persons)
// the dental product does not consume. They are permanent orphans that can never
// be zeroed, so they are reported SEPARATELY (disposition 'template-base') and
// EXCLUDED from the product-orphan denominator — otherwise the orphan metric
// trains the team to ignore it. Sensitive mutating orphans are NEVER on this list
// (the classifier refuses to template-base them); see plan 015 S2.
const TEMPLATE_BASE_ALLOWLIST = join(
  ROOT,
  'docs/testing/coverage/template-base.allowlist.json',
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Disposition = 'gap' | 'orphan' | 'template-base' | 'tested';

export interface EndpointRow {
  operationId: string;
  method: string;
  path: string;
  module: string | null;
  /** A codegen handler is wired to this op (always true today; kept for clarity). */
  hasHandler: boolean;
  /** The generated SDK exposes a client fn / query hook for this op. */
  hasSDK: boolean;
  /** A file under apps/dentalemon/src/** imports/calls this op's SDK surface. */
  hasFEConsumer: boolean;
  /** A `*.hurl` contract test issues a request that resolves to this op. */
  hasContractTest: boolean;
  /** The buildTestApp recorder saw this op (api-unit integration corpus). */
  hasIntegrationTest: boolean;
  /** The journey HTTP-client recorder saw this op (journey corpus). */
  hasJourney: boolean;
  disposition: Disposition;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path normalisation + resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a request path to a positional shape the OpenAPI `paths` map can be
 * matched against:
 *   - drop any query string
 *   - collapse every templated segment — OpenAPI `{param}`, hurl `{{var}}`, or
 *     Hono `:param` — to a single placeholder `{}`
 *   - strip a trailing slash (except for the root `/`)
 *
 * Positional matching is safe: across the live OpenAPI document there are ZERO
 * (method, positional-shape) collisions, so two distinct ops never share a
 * shape. This lets the hurl/recorder var names (`{{person_id}}`, `:id`) match the
 * OpenAPI param names (`{person}`) without a per-op name table.
 */
export function normalizeRequestPath(rawPath: string): string {
  let p = rawPath.split('?')[0] ?? rawPath; // drop query
  // Collapse templated segments of every flavour to `{}`.
  p = p.replace(/\{\{[^}]+\}\}/g, '{}'); // hurl {{var}}
  p = p.replace(/\{[^}]+\}/g, '{}'); // OpenAPI {param}
  p = p.replace(/:[^/]+/g, '{}'); // Hono :param
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1); // trailing slash
  return p;
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Parse a single Hurl line into a `{method, path}` request, or null when the
 * line is not a request against the API under test.
 *
 * A request line looks like `POST {{api}}/persons` or
 * `GET {{api}}/audit/logs?x=1`. We accept ONLY the `{{api}}` prefix var — other
 * prefixes (`{{mailpit_api}}`, absolute URLs) target side services and have no
 * operationId in our spec. Indented or commented lines are ignored so prose
 * mentions never count as coverage.
 */
export function parseHurlRequestLine(line: string): { method: string; path: string } | null {
  // No leading whitespace and no comment marker — a real request line starts at col 0.
  const m = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\{\{api\}\}(\/\S*)\s*$/.exec(line);
  if (!m) return null;
  return { method: m[1]!, path: m[2]! };
}

/** A resolver: `"METHOD <positional-shape>"` → operationId. */
export type PathResolver = Map<string, string>;

interface OpenApiDoc {
  paths?: Record<string, Record<string, { operationId?: string }>>;
}

/** Build the (method + positional path shape) → operationId index from OpenAPI. */
export function buildPathResolver(openapi: OpenApiDoc): PathResolver {
  const out: PathResolver = new Map();
  for (const [tmpl, methods] of Object.entries(openapi.paths ?? {})) {
    const shape = normalizeRequestPath(tmpl);
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op.operationId !== 'string') continue;
      out.set(`${method.toUpperCase()} ${shape}`, op.operationId);
    }
  }
  return out;
}

/** Resolve a (method, path) to an operationId via the resolver, or null. */
export function resolveToOperationId(
  resolver: PathResolver,
  method: string,
  path: string,
): string | null {
  const key = `${method.toUpperCase()} ${normalizeRequestPath(path)}`;
  return resolver.get(key) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract (hurl) corpus → covered operationIds
// ─────────────────────────────────────────────────────────────────────────────

/** Scan a list of hurl file CONTENTS for request lines → resolved operationIds. */
export function parseHurlContractOps(
  hurlContents: string[],
  resolver: PathResolver,
): Set<string> {
  const ops = new Set<string>();
  for (const content of hurlContents) {
    for (const line of content.split('\n')) {
      const req = parseHurlRequestLine(line);
      if (!req) continue;
      const opId = resolveToOperationId(resolver, req.method, req.path);
      if (opId) ops.add(opId);
    }
  }
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recorded-ops sink (JSONL) → covered operationIds
// ─────────────────────────────────────────────────────────────────────────────

interface RecordedEntry {
  method: string;
  matchedRoutePath: string;
  /** Optional corpus tag the recorders attach so we can split integration vs journey. */
  corpus?: 'api-unit' | 'journeys' | string;
}

/**
 * Read the JSONL recorder sink and resolve each `{method, matchedRoutePath}` to
 * an operationId. Tolerant: a missing file or a malformed line yields no entry
 * (the columns simply stay false). `isText` lets tests pass inline content.
 *
 * When `corpusFilter` is supplied, only entries whose `corpus` matches are
 * counted (used to split the integration vs journey columns); entries with no
 * `corpus` tag are counted under EVERY filter (back-compat: an untagged sink is
 * treated as integration+journey both, so an old recorder never silently drops).
 */
export function loadRecordedOps(
  sinkPathOrText: string,
  resolver: PathResolver,
  isText = false,
  corpusFilter?: string,
): Set<string> {
  let text: string;
  if (isText) {
    text = sinkPathOrText;
  } else {
    if (!existsSync(sinkPathOrText)) return new Set();
    try {
      text = readFileSync(sinkPathOrText, 'utf8');
    } catch {
      return new Set();
    }
  }

  const ops = new Set<string>();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let entry: RecordedEntry;
    try {
      entry = JSON.parse(trimmed) as RecordedEntry;
    } catch {
      continue; // tolerated — a stray non-JSON line never breaks the read
    }
    if (!entry || typeof entry.method !== 'string' || typeof entry.matchedRoutePath !== 'string') {
      continue;
    }
    if (corpusFilter && entry.corpus && entry.corpus !== corpusFilter) continue;
    const opId = resolveToOperationId(resolver, entry.method, entry.matchedRoutePath);
    if (opId) ops.add(opId);
  }
  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classify an operation's coverage disposition (see module header):
 *   - FE-consumed but no test on ANY layer → "gap"   (ratchet-tracked).
 *   - handler + SDK but no FE consumer      → "orphan" (doc-tracked, not ratcheted),
 *     EXCEPT a committed upstream base-template op that is NOT a sensitive mutating
 *     orphan → "template-base" (reported separately, excluded from the product-
 *     orphan denominator). A sensitive mutating orphan can NEVER be template-base —
 *     the guard refuses, so the IDOR obligation set is untouched (plan 015 S2).
 *   - everything else                       → "tested" (no obligation / covered).
 */
export function classifyDisposition(
  row: EndpointRow,
  templateBaseIds: Set<string> = new Set(),
): Disposition {
  const anyTest = row.hasContractTest || row.hasIntegrationTest || row.hasJourney;
  if (row.hasFEConsumer && !anyTest) return 'gap';
  if (row.hasHandler && row.hasSDK && !row.hasFEConsumer) {
    // Reclassify ONLY genuinely-unused upstream base-template surface; never a
    // sensitive mutating orphan (those stay obligations). isSensitiveMutatingOrphan
    // keys off disposition === 'orphan', so probe with that forced.
    if (
      templateBaseIds.has(row.operationId) &&
      !isSensitiveMutatingOrphan({ ...row, disposition: 'orphan' })
    ) {
      return 'template-base';
    }
    return 'orphan';
  }
  return 'tested';
}

/** Load the committed base-template operationId allowlist as a Set (empty if absent). */
export function loadTemplateBaseIds(path: string = TEMPLATE_BASE_ALLOWLIST): Set<string> {
  if (!existsSync(path)) return new Set();
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Array<{ id: string }>;
    return new Set(raw.map((e) => e.id));
  } catch {
    return new Set();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gaps + ratchet
// ─────────────────────────────────────────────────────────────────────────────

export interface EndpointGap extends Gap {
  id: string;
  operationId: string;
  module: string | null;
  method: string;
  path: string;
}

/**
 * The ratchet gap stream: every FE-consumed operation with no test on ANY layer
 * (`disposition === 'gap'`) — the "broken while CI is green" class. The gap `id`
 * is the operationId; a NEW such gap that is not on `endpoint.allowlist.json`
 * FAILS `--check`. Orphans are deliberately NOT gaps (nothing in the app calls
 * them, so a missing test cannot break the app — they are tracked in
 * `orphan-disposition.md` for a wire/remove decision instead).
 */
export function gapsOf(rows: EndpointRow[]): EndpointGap[] {
  return rows
    .filter((r) => r.disposition === 'gap')
    .map((r) => ({
      id: r.operationId,
      operationId: r.operationId,
      module: r.module,
      method: r.method,
      path: r.path,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive mutating orphans — the "an IDOR-able endpoint must not be a
// no-obligation orphan" rule.
// ─────────────────────────────────────────────────────────────────────────────
//
// An orphan (handler+SDK, no FE consumer) is normally NOT a test obligation —
// nothing in the app calls it, so a missing test cannot break the app. But that
// rule SWALLOWED the P0 cross-tenant patient-contact IDOR (updatePatientContact:
// a PATCH that mutated PHI was a "no-obligation orphan"). A WRITE to PII /
// clinical / billing data is reachable over the wire whether or not the app's FE
// calls it, so it CAN be exploited (IDOR / cross-tenant) even as an orphan.
//
// So a mutating orphan in a sensitive module is reclassified into a tracked
// OBLIGATION: it must carry a cross-tenant / object-ownership negative test, or
// be allowlisted with a reason. This does NOT move all ~180 orphans (that drowns
// signal) — only the writes to sensitive data.

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Modules/paths whose rows carry PII / clinical / billing / org data. */
const SENSITIVE_MODULE_RE =
  /patient|clinical|billing|imaging|perio|visit|pmd|erasure|consent|insurance|org|scheduling|provider|household/i;

export interface SensitiveOrphanGap extends Gap {
  id: string;
  operationId: string;
  module: string | null;
  method: string;
  path: string;
}

/** A mutating (write) orphan whose module/path touches sensitive data. */
export function isSensitiveMutatingOrphan(row: EndpointRow): boolean {
  return (
    row.disposition === 'orphan' &&
    MUTATING_METHODS.has(row.method.toUpperCase()) &&
    SENSITIVE_MODULE_RE.test(`${row.module ?? ''} ${row.path}`)
  );
}

/** A test that names a cross-tenant / object-ownership negative scenario. */
const OWNERSHIP_MARKER_RE =
  /cross-?tenant|cross-?org|\bforeign\b|\bIDOR\b|other (?:branch|org|tenant|patient)|not a member|different (?:branch|org|tenant)|isolation|object-ownership|object ownership/i;

/** A rejection assertion (the negative path proves the access is DENIED). */
const REJECTION_RE = /\b(401|403|404)\b/;

/**
 * Heuristic: an operation has an ownership/cross-tenant negative test if some
 * test file (a) references the operationId, (b) contains an ownership marker, and
 * (c) asserts a 401/403/404 rejection. Like the fsm/br matrices, this proves a
 * test *exercises* the ownership scenario with the right polarity — not that the
 * assertion is semantically perfect. Documented as a heuristic.
 */
export function detectOwnershipTested(operationId: string, fileTexts: string[]): boolean {
  const idRe = new RegExp(`\\b${operationId}\\b`);
  for (const text of fileTexts) {
    if (!idRe.test(text)) continue;
    if (OWNERSHIP_MARKER_RE.test(text) && REJECTION_RE.test(text)) return true;
  }
  return false;
}

/**
 * The ratchet gap stream for sensitive mutating orphans: those WITHOUT a detected
 * ownership test. A new such op (a fresh PII/clinical/billing write with no FE
 * consumer and no cross-tenant test) FAILS `--check` until it is tested or
 * allowlisted with a reason — it can never silently be a no-obligation orphan.
 */
export function sensitiveOrphanGapsOf(
  rows: EndpointRow[],
  ownershipTested: Set<string>,
): SensitiveOrphanGap[] {
  return rows
    .filter(isSensitiveMutatingOrphan)
    .filter((r) => !ownershipTested.has(r.operationId))
    .map((r) => ({
      id: r.operationId,
      operationId: r.operationId,
      module: r.module,
      method: r.method,
      path: r.path,
    }));
}

/**
 * Compute the set of sensitive-mutating-orphan operationIds that DO carry an
 * ownership/cross-tenant negative test, by scanning the api-unit test corpus.
 * (Read from disk here — kept out of the pure `build()` so build stays testable
 * off the committed JSON alone.)
 */
export function computeOwnershipTested(rows: EndpointRow[]): Set<string> {
  const sensitiveIds = rows.filter(isSensitiveMutatingOrphan).map((r) => r.operationId);
  if (sensitiveIds.length === 0) return new Set();
  const texts = listFiles('api-unit').map((f) => {
    try {
      return readFileSync(join(ROOT, f), 'utf8');
    } catch {
      return '';
    }
  });
  return new Set(sensitiveIds.filter((id) => detectOwnershipTested(id, texts)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────────────────────

/** Raw spine entry shape (the FE-consumer field is `consumers`). */
interface SpineRawEntry {
  operationId: string;
  method: string;
  path: string;
  handler: string | null;
  sdkHooks?: string[];
  sdkClientFn?: string | null;
  consumers?: string[];
}

function loadRawSpine(): Map<string, SpineRawEntry> {
  const raw = JSON.parse(readFileSync(SPINE_PATH, 'utf8')) as { operations?: SpineRawEntry[] };
  const out = new Map<string, SpineRawEntry>();
  for (const op of raw.operations ?? []) {
    if (op && op.operationId) out.set(op.operationId, op);
  }
  return out;
}

export function build(): EndpointRow[] {
  // The module bucket comes from loadContractSpine (which derives it from the
  // handler path); the SDK/consumer columns come from the raw spine JSON.
  const spine = loadContractSpine();
  const rawSpine = loadRawSpine();

  const openapi = JSON.parse(readFileSync(OPENAPI_PATH, 'utf8')) as OpenApiDoc;
  const resolver = buildPathResolver(openapi);

  // Contract corpus — read every hurl file's content and parse request lines.
  const hurlFiles = listFiles('hurl');
  const hurlContents = hurlFiles.map((f) => {
    try {
      return readFileSync(join(ROOT, f), 'utf8');
    } catch {
      return '';
    }
  });
  const contractOps = parseHurlContractOps(hurlContents, resolver);

  // Integration / journey corpora — read the recorder sink (split by corpus tag).
  const integrationOps = loadRecordedOps(RECORDED_SINK, resolver, false, 'api-unit');
  const journeyOps = loadRecordedOps(RECORDED_SINK, resolver, false, 'journeys');

  const templateBaseIds = loadTemplateBaseIds();

  const rows: EndpointRow[] = [];
  for (const entry of spine.values()) {
    const raw = rawSpine.get(entry.operationId);
    const hasSDK = Boolean(
      (raw?.sdkHooks && raw.sdkHooks.length > 0) || (raw?.sdkClientFn ?? null),
    );
    const hasFEConsumer = Boolean(raw?.consumers && raw.consumers.length > 0);

    const base: EndpointRow = {
      operationId: entry.operationId,
      method: entry.method,
      path: entry.path,
      module: entry.module,
      hasHandler: Boolean(entry.handlerPath),
      hasSDK,
      hasFEConsumer,
      hasContractTest: contractOps.has(entry.operationId),
      hasIntegrationTest: integrationOps.has(entry.operationId),
      hasJourney: journeyOps.has(entry.operationId),
      disposition: 'tested',
    };
    base.disposition = classifyDisposition(base, templateBaseIds);
    rows.push(base);
  }

  rows.sort((a, b) => cmpByCodepoint(a.operationId, b.operationId));
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderers
// ─────────────────────────────────────────────────────────────────────────────

function bool(b: boolean): string {
  return b ? '✅' : '';
}

function renderMd(rows: EndpointRow[]): string {
  const gaps = rows.filter((r) => r.disposition === 'gap');
  const orphans = rows.filter((r) => r.disposition === 'orphan');
  const templateBase = rows.filter((r) => r.disposition === 'template-base');
  const tested = rows.filter((r) => r.disposition === 'tested');
  const feConsumed = rows.filter((r) => r.hasFEConsumer);
  const anyRecorded = rows.some((r) => r.hasIntegrationTest || r.hasJourney);

  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/endpoint-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Endpoint Coverage Matrix');
  lines.push('');
  lines.push(
    'Per-operation coverage across the four test layers (contract / integration / ' +
      'journey) joined to the contract-spine wiring columns (handler / SDK / FE ' +
      'consumer). A **gap** is an operation the frontend consumes that NO test layer ' +
      'exercises — the "broken while CI is green" class. An **orphan** is shipped ' +
      'handler+SDK wiring nothing in the app calls (tracked in ' +
      '`orphan-disposition.md`, NOT in the test ratchet).',
  );
  lines.push('');
  if (!anyRecorded) {
    lines.push(
      '> **Note:** the *integration* and *journey* columns are empty because no ' +
        'recorder sink (`docs/testing/coverage/.recorded-ops.jsonl`) was present when ' +
        'this matrix was generated. They populate when the suites run with ' +
        '`COVERAGE_RECORD=1` (buildTestApp records integration; the journey HTTP ' +
        'client records journeys), then re-run this generator.',
    );
    lines.push('');
  }
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Total operations | ${rows.length} |`);
  lines.push(`| FE-consumed | ${feConsumed.length} |`);
  lines.push(`| With a contract test | ${rows.filter((r) => r.hasContractTest).length} |`);
  lines.push(`| With an integration test | ${rows.filter((r) => r.hasIntegrationTest).length} |`);
  lines.push(`| With a journey | ${rows.filter((r) => r.hasJourney).length} |`);
  lines.push(`| **gap** (consumed, untested) | **${gaps.length}** |`);
  lines.push(`| orphan (product handler+SDK, no FE consumer) | ${orphans.length} |`);
  lines.push(`| template-base (upstream-template orphan, excluded from denominator) | ${templateBase.length} |`);
  lines.push(`| tested / no-obligation | ${tested.length} |`);
  lines.push('');

  lines.push('## GAPS — FE-consumed but untested (ratchet-tracked)');
  lines.push('');
  if (gaps.length === 0) {
    lines.push('_No gaps._');
  } else {
    lines.push('| operationId | module | method | path |');
    lines.push('|-------------|--------|--------|------|');
    for (const r of gaps) {
      lines.push(`| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` |`);
    }
  }
  lines.push('');

  lines.push('## All operations');
  lines.push('');
  lines.push(
    '| operationId | module | method | path | handler | SDK | FE | contract | integ | journey | disposition |',
  );
  lines.push(
    '|-------------|--------|--------|------|:-------:|:---:|:--:|:--------:|:-----:|:-------:|-------------|',
  );
  for (const r of rows) {
    lines.push(
      `| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` | ` +
        `${bool(r.hasHandler)} | ${bool(r.hasSDK)} | ${bool(r.hasFEConsumer)} | ` +
        `${bool(r.hasContractTest)} | ${bool(r.hasIntegrationTest)} | ${bool(r.hasJourney)} | ` +
        `${r.disposition} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderOrphans(rows: EndpointRow[], ownershipTested: Set<string>): string {
  const orphans = rows.filter((r) => r.disposition === 'orphan');
  const templateBase = rows.filter((r) => r.disposition === 'template-base');
  const sensitive = rows.filter(isSensitiveMutatingOrphan);
  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/endpoint-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Orphan Endpoint Disposition');
  lines.push('');
  lines.push(
    'An **orphan** is an operation with a shipped handler AND a generated SDK ' +
      'surface that NO file under `apps/dentalemon/src/**` consumes. A *read-only* ' +
      'orphan is not a test obligation (nothing in the product calls it, so a missing ' +
      'test cannot break the app). **A *mutating* orphan that writes PII / clinical / ' +
      'billing data is the exception** — it is reachable over the wire and therefore ' +
      'IDOR / cross-tenant exploitable even with no FE consumer (this is the class ' +
      'that swallowed the P0 `updatePatientContact` contact IDOR). Those are ' +
      'reclassified below into a tracked OBLIGATION (ratcheted in ' +
      '`endpoint-sensitive-orphan.allowlist.json`).',
  );
  lines.push('');
  lines.push(
    '**Upstream base-template orphans** (booking / comms / email / storage / reviews ' +
      '/ emr / notifs / generic providers-patients-persons) are tracked separately as ' +
      'disposition `template-base` and **excluded from the product-orphan denominator** ' +
      '— they are permanent upstream surface the dental product does not consume and can ' +
      "never be zeroed, so counting them in the orphan metric trains the team to ignore " +
      'it. The list is hand-curated in `template-base.allowlist.json`; a sensitive ' +
      'mutating orphan can NEVER be on it (the classifier refuses).',
  );
  lines.push('');
  lines.push(
    `Counts: **${orphans.length} product orphans** + **${templateBase.length} template-base** ` +
      `(upstream, excluded).`,
  );
  lines.push('');

  // ── Sensitive mutating orphans (the obligation set) ─────────────────────────
  const sTested = sensitive.filter((r) => ownershipTested.has(r.operationId));
  const sGap = sensitive.filter((r) => !ownershipTested.has(r.operationId));
  lines.push('## Sensitive mutating orphans — require a cross-tenant / ownership negative test');
  lines.push('');
  lines.push(
    'A write (POST/PUT/PATCH/DELETE) to a PII/clinical/billing/org surface with no ' +
      'FE consumer. `ownership test` = a heuristic match (the operationId named in an ' +
      'api-unit test alongside a cross-tenant/IDOR marker and a 401/403/404 rejection). ' +
      'An op WITHOUT one is a ratcheted obligation: add a negative test, or wire/remove ' +
      'it, or allowlist it with a reason.',
  );
  lines.push('');
  lines.push(
    `Sensitive mutating orphans: **${sensitive.length}** ` +
      `(${sTested.length} ownership-tested, **${sGap.length} obligation gaps**).`,
  );
  lines.push('');
  if (sensitive.length > 0) {
    lines.push('| operationId | module | method | path | ownership test? |');
    lines.push('|-------------|--------|--------|------|:---------------:|');
    for (const r of sensitive) {
      const ok = ownershipTested.has(r.operationId);
      lines.push(
        `| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` | ${
          ok ? '✅' : '⚠️ obligation'
        } |`,
      );
    }
    lines.push('');
  }

  // ── Full orphan list (the wire/remove/keep backlog) ─────────────────────────
  lines.push('## All orphans (wire / remove / keep backlog)');
  lines.push('');
  lines.push('Decision column legend:');
  lines.push('');
  lines.push('- **wire** — a planned product feature should consume this; build the FE consumer.');
  lines.push('- **remove** — dead surface; delete the handler + regenerate the SDK.');
  lines.push(
    '- **keep** — intentionally headless (platform/SDK-for-3rd-parties/admin-only/dev); leave as-is.',
  );
  lines.push('');
  lines.push(`Total orphans: **${orphans.length}**`);
  lines.push('');
  if (orphans.length === 0) {
    lines.push('_No orphans._');
  } else {
    lines.push('| operationId | module | method | path | decision | notes |');
    lines.push('|-------------|--------|--------|------|----------|-------|');
    for (const r of orphans) {
      const sens = isSensitiveMutatingOrphan(r)
        ? ownershipTested.has(r.operationId)
          ? 'sensitive-write (ownership-tested)'
          : 'sensitive-write (obligation)'
        : '_triage pending_';
      lines.push(
        `| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` | keep | ${sens} |`,
      );
    }
  }
  lines.push('');

  // ── Template-base orphans (upstream surface, excluded from the denominator) ──
  lines.push('## Template-base orphans (upstream surface — excluded from the orphan denominator)');
  lines.push('');
  lines.push(
    'Upstream `mono-js-lf` base-template operations the dental product does not ' +
      'consume. Permanent orphans (can never be zeroed); reported here for honesty but ' +
      'kept OUT of the product-orphan count. Curated in `template-base.allowlist.json`.',
  );
  lines.push('');
  lines.push(`Total template-base: **${templateBase.length}**`);
  lines.push('');
  if (templateBase.length === 0) {
    lines.push('_No template-base orphans._');
  } else {
    lines.push('| operationId | module | method | path |');
    lines.push('|-------------|--------|--------|------|');
    for (const r of templateBase) {
      lines.push(`| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** Seed the ratchet baseline: today's gap ops, keyed by operationId. */
export function seedAllowlist(rows: EndpointRow[]): AllowlistEntry[] {
  return gapsOf(rows).map((g) => ({
    id: g.id,
    reason:
      `Baseline gap seeded ${new Date().toISOString().slice(0, 10)}: ${g.method} ${g.path} ` +
      `is FE-consumed (apps/dentalemon) but has no contract/integration/journey test yet.`,
  }));
}

function renderAllowlist(rows: EndpointRow[]): string {
  return JSON.stringify(seedAllowlist(rows), null, 2) + '\n';
}

/** Seed the sensitive-mutating-orphan obligation baseline (those with no
 * detected ownership test), keyed by operationId. */
export function seedSensitiveAllowlist(
  rows: EndpointRow[],
  ownershipTested: Set<string>,
): AllowlistEntry[] {
  return sensitiveOrphanGapsOf(rows, ownershipTested).map((g) => ({
    id: g.id,
    reason:
      `Baseline obligation seeded ${new Date().toISOString().slice(0, 10)}: ${g.method} ${g.path} ` +
      `is a mutating PII/clinical/billing orphan (no FE consumer) with no detected cross-tenant/` +
      `ownership negative test. Phase 3: add an IDOR/cross-tenant test, or wire/remove the op.`,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const rows = build();
  const ownershipTested = computeOwnershipTested(rows);

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));
  writeFileSync(OUT_ORPHANS, renderOrphans(rows, ownershipTested));

  // Seed the allowlist baselines ONLY if they do not already exist, so a later
  // tightened allowlist is never clobbered by a re-run of the generator.
  if (!existsSync(OUT_ALLOWLIST)) {
    writeFileSync(OUT_ALLOWLIST, renderAllowlist(rows));
  }
  if (!existsSync(OUT_SENSITIVE_ALLOWLIST)) {
    writeFileSync(
      OUT_SENSITIVE_ALLOWLIST,
      JSON.stringify(seedSensitiveAllowlist(rows, ownershipTested), null, 2) + '\n',
    );
  }

  const gaps = rows.filter((r) => r.disposition === 'gap');
  const orphans = rows.filter((r) => r.disposition === 'orphan');
  const templateBase = rows.filter((r) => r.disposition === 'template-base');
  const tested = rows.filter((r) => r.disposition === 'tested');
  const sensGaps = sensitiveOrphanGapsOf(rows, ownershipTested);
  console.log(
    `endpoint-matrix: ${rows.length} ops — ${tested.length} tested, ${gaps.length} gap, ` +
      `${orphans.length} orphan (${sensGaps.length} sensitive-mutating-orphan obligation gaps), ` +
      `${templateBase.length} template-base (upstream, excluded). ` +
      `Wrote ${OUT_JSON} + ${OUT_MD} + ${OUT_ORPHANS}`,
  );

  // --check (gate mode): TWO ratchets, both must pass.
  //  1. a FE-consumed-but-untested op (gap) not on endpoint.allowlist.json, and
  //  2. a mutating PII/clinical/billing orphan with no ownership test, not on
  //     endpoint-sensitive-orphan.allowlist.json (an IDOR-able op can never be a
  //     silent no-obligation orphan).
  // New debt of either class cannot be introduced silently; allowlists only shrink.
  if (process.argv.includes('--check')) {
    const r1 = ratchet(gapsOf(rows), loadAllowlist(OUT_ALLOWLIST));
    console.log(formatRatchetReport(r1, { label: 'endpoint-matrix (FE-consumed gaps)' }));
    const r2 = ratchet(sensGaps, loadAllowlist(OUT_SENSITIVE_ALLOWLIST));
    console.log(
      formatRatchetReport(r2, { label: 'endpoint-matrix (sensitive mutating orphans)' }),
    );
    if (!r1.ok || !r2.ok) process.exit(1);
  }
}

if (import.meta.main) main();
