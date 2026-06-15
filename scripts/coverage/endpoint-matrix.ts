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
 *
 * Run from repo root:  bun scripts/coverage/endpoint-matrix.ts
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
import { ROOT, loadContractSpine } from './lib/sources';
import { listFiles } from './lib/scan-tests';

const SPINE_PATH = join(ROOT, '.understand-anything/contract-spine.json');
const OPENAPI_PATH = join(ROOT, 'specs/api/dist/openapi/openapi.json');
const RECORDED_SINK = join(ROOT, 'docs/testing/coverage/.recorded-ops.jsonl');

const OUT_JSON = join(ROOT, 'docs/testing/coverage/endpoint-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/endpoint-matrix.md');
const OUT_ALLOWLIST = join(ROOT, 'docs/testing/coverage/endpoint.allowlist.json');
const OUT_ORPHANS = join(ROOT, 'docs/testing/coverage/orphan-disposition.md');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Disposition = 'gap' | 'orphan' | 'tested';

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
 *   - handler + SDK but no FE consumer      → "orphan" (doc-tracked, not ratcheted).
 *   - everything else                       → "tested" (no obligation / covered).
 */
export function classifyDisposition(row: EndpointRow): Disposition {
  const anyTest = row.hasContractTest || row.hasIntegrationTest || row.hasJourney;
  if (row.hasFEConsumer && !anyTest) return 'gap';
  if (row.hasHandler && row.hasSDK && !row.hasFEConsumer) return 'orphan';
  return 'tested';
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
    base.disposition = classifyDisposition(base);
    rows.push(base);
  }

  rows.sort((a, b) => a.operationId.localeCompare(b.operationId));
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
  lines.push(`| orphan (handler+SDK, no FE consumer) | ${orphans.length} |`);
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

function renderOrphans(rows: EndpointRow[]): string {
  const orphans = rows.filter((r) => r.disposition === 'orphan');
  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/endpoint-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Orphan Endpoint Disposition');
  lines.push('');
  lines.push(
    'An **orphan** is an operation with a shipped handler AND a generated SDK ' +
      'surface that NO file under `apps/dentalemon/src/**` consumes. Orphans are ' +
      'NOT a test obligation (nothing in the product calls them, so a missing test ' +
      'cannot break the app) — they are tracked here for a deliberate wire / remove ' +
      '/ keep decision instead of being silently swept into the test ratchet.',
  );
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
      lines.push(
        `| \`${r.operationId}\` | ${r.module ?? '—'} | ${r.method} | \`${r.path}\` | keep | _triage pending_ |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

/** Seed the ratchet baseline: today's gap ops, keyed by operationId. */
function renderAllowlist(rows: EndpointRow[]): string {
  const gaps = rows.filter((r) => r.disposition === 'gap');
  const entries = gaps.map((r) => ({
    id: r.operationId,
    reason:
      `Baseline gap seeded ${new Date().toISOString().slice(0, 10)}: ${r.method} ${r.path} ` +
      `is FE-consumed (apps/dentalemon) but has no contract/integration/journey test yet.`,
  }));
  return JSON.stringify(entries, null, 2) + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const rows = build();

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));
  writeFileSync(OUT_ORPHANS, renderOrphans(rows));

  // Seed the allowlist baseline ONLY if it does not already exist, so a later
  // tightened allowlist is never clobbered by a re-run of the generator.
  if (!existsSync(OUT_ALLOWLIST)) {
    writeFileSync(OUT_ALLOWLIST, renderAllowlist(rows));
  }

  const gaps = rows.filter((r) => r.disposition === 'gap');
  const orphans = rows.filter((r) => r.disposition === 'orphan');
  const tested = rows.filter((r) => r.disposition === 'tested');
  console.log(
    `endpoint-matrix: ${rows.length} ops — ${tested.length} tested, ${gaps.length} gap, ` +
      `${orphans.length} orphan. Wrote ${OUT_JSON} + ${OUT_MD} + ${OUT_ORPHANS}` +
      (existsSync(OUT_ALLOWLIST) ? '' : ` + ${OUT_ALLOWLIST}`),
  );
}

if (import.meta.main) main();
