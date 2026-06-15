#!/usr/bin/env bun
/**
 * fe-route-matrix.ts — frontend route REACHABILITY matrix.
 *
 * WHY: a route that no test ever navigates to is dark — it can 500 on mount, lose
 * its data wiring, or rot behind a renamed nav link and CI stays green. The
 * journey lock + e2e suite are our reachability evidence; this script computes,
 * per route, whether ANY e2e/journey spec navigates to it, so an unexercised
 * route surfaces as a gap instead of being discovered in production.
 *
 * SOURCE OF TRUTH: `apps/dentalemon/src/routeTree.gen.ts` — TanStack Router's
 * generated route table. Its `FileRoutesByPath` module-augmentation block carries
 * both the `id` (which we resolve to the on-disk source file) and the `fullPath`
 * (the canonical navigable path) for every route. We parse that rather than
 * re-walking `src/routes/` so the canonical path list never diverges from what
 * the router actually mounts.
 *
 * REACHABILITY is a PROXY, not a render-smoke. `exercisedByE2E` is true when some
 * spec references a navigation literal for the route (its static path, or — for
 * param routes — the static prefix before the first `$param`, or the param
 * placeholder for param-first routes). It proves a spec *navigates toward* the
 * route; it does NOT prove the route mounted cleanly. The follow-up is a
 * per-route render-smoke (mount each route, assert no console error / error
 * boundary) — tracked separately. A `true` here means "some spec exercises this
 * path"; the gap set (`false`) is the actionable output.
 *
 * Run from repo root:  bun scripts/coverage/fe-route-matrix.ts
 * (root-level script — does NOT trip the api-ts db-guard preload).
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from './lib/sources';
import { scanForToken, type CorpusName } from './lib/scan-tests';
import {
  loadAllowlist,
  ratchet,
  formatRatchetReport,
  type AllowlistEntry,
} from './lib/ratchet';

const ROUTE_TREE_PATH = join(
  ROOT,
  'apps/dentalemon/src/routeTree.gen.ts',
);
const ROUTES_DIR_REL = 'apps/dentalemon/src/routes';

const OUT_JSON = join(ROOT, 'docs/testing/coverage/fe-route-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/fe-route-matrix.md');
const ALLOWLIST_PATH = join(
  ROOT,
  'docs/testing/coverage/fe-route.allowlist.json',
);

/** The corpora a spec navigation lives in. `journeys` ⊂ `e2e` (see scan-tests). */
const NAV_CORPORA: readonly CorpusName[] = ['e2e', 'journeys'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// (a) Parse routeTree.gen.ts → canonical route list
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRoute {
  /** Route id from the generated table, e.g. `/_dashboard/calendar`. */
  id: string;
  /** Canonical navigable path (router `fullPath`), e.g. `/calendar`. */
  routePath: string;
  /** Repo-relative source file (POSIX separators). */
  file: string;
}

/**
 * Parse the `FileRoutesByPath` augmentation block of routeTree.gen.ts.
 *
 * Each entry is shaped:
 *   '<key>': {
 *     id: '<id>'
 *     path: '<path>'
 *     fullPath: '<fullPath>'
 *     ...
 *   }
 *
 * We key on `id` (→ source file) and `fullPath` (→ navigable routePath). Pathless
 * layout routes carry `path: ''` and a `fullPath` that collides with a sibling
 * (always `/`); they are not navigable destinations and are dropped. The portal
 * index's `fullPath` is `'/portal/'` and is normalised to `/portal`.
 */
export function parseRouteTree(src: string): ParsedRoute[] {
  // Each route record: an object literal whose first three fields are id/path/fullPath.
  const recordRe =
    /id:\s*'([^']+)'\s*\n\s*path:\s*'([^']*)'\s*\n\s*fullPath:\s*'([^']*)'/g;

  const byPath = new Map<string, ParsedRoute>();
  let m: RegExpExecArray | null;
  while ((m = recordRe.exec(src))) {
    const id = m[1]!;
    const path = m[2]!;
    const fullPathRaw = m[3]!;

    if (id === '__root__') continue;
    // Pathless layout routes: path === '' (their fullPath aliases a sibling's).
    if (path === '') continue;

    const routePath = normaliseFullPath(fullPathRaw);
    const file = resolveRouteFile(id);

    // First record for a routePath wins (no real collisions once layouts dropped).
    if (!byPath.has(routePath)) {
      byPath.set(routePath, { id, routePath, file });
    }
  }

  return [...byPath.values()].sort((a, b) =>
    a.routePath.localeCompare(b.routePath),
  );
}

/** Strip a trailing slash from a non-root fullPath ("/portal/" → "/portal"). */
function normaliseFullPath(fullPath: string): string {
  if (fullPath.length > 1 && fullPath.endsWith('/')) {
    return fullPath.replace(/\/+$/, '');
  }
  return fullPath;
}

/**
 * Resolve a route `id` to its on-disk source file under src/routes/.
 *
 * The id is the slash-joined route segment path (layout segments included):
 *   `/_dashboard/calendar`                          → _dashboard/calendar.tsx
 *   `/book/$branchId`                               → book.$branchId.tsx
 *   `/_workspace/$patientId/case-presentation/$presentationId`
 *        → _workspace/$patientId.case-presentation.$presentationId.tsx
 *   `/_portal/portal/`                              → _portal/portal.index.tsx
 *   `/`                                             → index.tsx
 *
 * TanStack flattens trailing segments of a flat-file route with `.`, and uses a
 * real directory only when the segment is itself a layout/parent. We can't tell
 * those apart from the id alone, so we GENERATE candidate encodings (every split
 * of "which separators are `/` vs `.`") and return the first that exists on disk
 * — the source files are the ground truth. A deterministic dotted fallback is
 * returned when nothing matches (so the column is never empty / non-deterministic).
 */
export function resolveRouteFile(id: string): string {
  if (id === '/') return `${ROUTES_DIR_REL}/index.tsx`;

  // Trailing-slash ids are index routes: `/_portal/portal/` → .../portal.index.tsx
  const isIndex = id.endsWith('/');
  const trimmed = id.replace(/^\/+/, '').replace(/\/+$/, '');
  const segs = trimmed.split('/');

  // Build the candidate set: every choice of `/` (dir) vs `.` (flat) between
  // consecutive segments. Layout segments (leading `_`) are real directories, so
  // the separator AFTER them is fixed to `/` to keep the candidate count small.
  const candidates = enumerateSeparatorChoices(segs).map((joined) => {
    const base = isIndex ? `${joined}.index` : joined;
    return `${ROUTES_DIR_REL}/${base}.tsx`;
  });

  for (const cand of candidates) {
    if (existsSync(join(ROOT, cand))) return cand;
  }
  // Deterministic fallback: first segment is a directory, the rest dotted.
  const fallbackBase =
    segs.length === 1
      ? segs[0]!
      : `${segs[0]}/${segs.slice(1).join('.')}`;
  const fb = isIndex ? `${fallbackBase}.index` : fallbackBase;
  return `${ROUTES_DIR_REL}/${fb}.tsx`;
}

/**
 * Enumerate the possible file encodings of a segment list, choosing `/` or `.`
 * for each inter-segment boundary. The boundary immediately after a layout
 * segment (leading `_`) is forced to `/` (layouts are always real directories),
 * which keeps the candidate count tiny for the real route set.
 */
function enumerateSeparatorChoices(segs: string[]): string[] {
  if (segs.length === 1) return [segs[0]!];

  const boundaries = segs.length - 1;
  const out: string[] = [];
  const total = 1 << boundaries;
  for (let mask = 0; mask < total; mask++) {
    let s = segs[0]!;
    let ok = true;
    for (let i = 0; i < boundaries; i++) {
      const prevIsLayout = segs[i]!.startsWith('_');
      // bit set → '.', clear → '/'. Layout boundary forced to '/'.
      const useDot = !prevIsLayout && (mask & (1 << i)) !== 0;
      if (prevIsLayout && (mask & (1 << i)) !== 0) {
        ok = false; // skip masks that try to dot-join after a layout
        break;
      }
      s += (useDot ? '.' : '/') + segs[i + 1]!;
    }
    if (ok) out.push(s);
  }
  // Prefer more-dotted encodings first (flat files are the common TanStack form
  // for param/leaf routes), but existence on disk is the real decider.
  return [...new Set(out)].sort(
    (a, b) => countChar(b, '.') - countChar(a, '.'),
  );
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// (b) Navigation tokens — the search literals for the reachability heuristic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The literal token(s) a spec would use to navigate to `routePath`.
 *
 *   - Static route          → the exact path  (`/calendar`).
 *   - Param route           → static prefix up to the first `$param`
 *                             (`/book/$branchId` → `/book/`).
 *   - Param-FIRST route     → the static prefix collapses to `/` (matches
 *                             everything) so we instead emit the FIRST param's
 *                             placeholder + its JS-interpolation form
 *                             (`/$patientId` → `$patientId`, `${patientId}`),
 *                             plus any later static segment as a tie-breaker.
 *
 * The bare `/` is never emitted as a discriminating token (it matches every
 * spec line); the index route `/` is the sole exception and returns exactly `/`.
 */
export function navigationTokens(routePath: string): string[] {
  if (routePath === '/') return ['/'];

  const tokens = new Set<string>();
  const segs = routePath.replace(/^\/+/, '').split('/');

  const firstParamIdx = segs.findIndex((s) => s.startsWith('$'));

  if (firstParamIdx === -1) {
    // No params — the whole path is a safe literal.
    tokens.add('/' + segs.join('/'));
    return [...tokens];
  }

  // Static prefix up to (and including the slash before) the first param.
  const staticSegs = segs.slice(0, firstParamIdx);
  if (staticSegs.length > 0) {
    tokens.add('/' + staticSegs.join('/') + '/');
  }

  // For the first param, emit the discriminating placeholder + JS-interp form.
  // (Critical for param-FIRST routes whose static prefix would be a bare "/".)
  const firstParam = segs[firstParamIdx]!; // e.g. "$patientId"
  const paramName = firstParam.slice(1); // "patientId"
  tokens.add(firstParam); // "$patientId"
  tokens.add('${' + paramName + '}'); // "${patientId}"

  // Any STATIC segment after the first param is a strong discriminator too
  // (e.g. "/$patientId/case-presentation/$presentationId" → "case-presentation").
  for (let i = firstParamIdx + 1; i < segs.length; i++) {
    const s = segs[i]!;
    if (!s.startsWith('$')) tokens.add(s);
  }

  return [...tokens];
}

// ─────────────────────────────────────────────────────────────────────────────
// (c) Build the matrix
// ─────────────────────────────────────────────────────────────────────────────

export interface RouteMatrixRow {
  routePath: string;
  file: string;
  exercisedByE2E: boolean;
}

/** True iff some e2e/journey spec references any navigation token for the route. */
export function isExercised(routePath: string): boolean {
  for (const token of navigationTokens(routePath)) {
    if (token.length === 0) continue;
    if (scanForToken(token, NAV_CORPORA).length > 0) return true;
  }
  return false;
}

/** Build the full matrix from the real routeTree.gen.ts + e2e/journey corpora. */
export function buildRouteMatrix(): RouteMatrixRow[] {
  const src = readFileSync(ROUTE_TREE_PATH, 'utf8');
  const routes = parseRouteTree(src);
  return routes.map((r) => ({
    routePath: r.routePath,
    file: r.file,
    exercisedByE2E: isExercised(r.routePath),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering + gate
// ─────────────────────────────────────────────────────────────────────────────

/** A gap = a route no spec exercises. Gap id is the routePath. */
function gapsOf(rows: RouteMatrixRow[]): { id: string; file: string }[] {
  return rows
    .filter((r) => !r.exercisedByE2E)
    .map((r) => ({ id: r.routePath, file: r.file }));
}

function renderMd(rows: RouteMatrixRow[]): string {
  const exercised = rows.filter((r) => r.exercisedByE2E);
  const gaps = rows.filter((r) => !r.exercisedByE2E);

  const lines: string[] = [];
  lines.push(
    '<!-- GENERATED by scripts/coverage/fe-route-matrix.ts — do not edit by hand. -->',
  );
  lines.push('');
  lines.push('# Frontend Route Reachability Matrix');
  lines.push('');
  lines.push(
    'Per frontend route (enumerated from `apps/dentalemon/src/routeTree.gen.ts`), ' +
      'whether any e2e/journey spec navigates toward it. `exercisedByE2E` is a ' +
      '**reachability proxy** — a spec references the route\'s navigation literal — ' +
      '**not** a render-smoke. A route can be exercised yet still 500 on mount; the ' +
      'follow-up is a per-route render-smoke (mount each route, assert no error ' +
      'boundary / console error). A **gap** is a route no spec exercises.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Total routes | ${rows.length} |`);
  lines.push(`| Exercised by e2e/journeys | ${exercised.length} |`);
  lines.push(`| **Gap (no spec navigates to it)** | **${gaps.length}** |`);
  lines.push('');

  lines.push('## Gaps (unexercised routes)');
  lines.push('');
  if (gaps.length === 0) {
    lines.push('_Every route is exercised by at least one spec._');
  } else {
    lines.push('| routePath | file |');
    lines.push('|-----------|------|');
    for (const r of gaps) {
      lines.push(`| \`${r.routePath}\` | \`${r.file}\` |`);
    }
  }
  lines.push('');

  lines.push('## All routes');
  lines.push('');
  lines.push('| routePath | file | exercisedByE2E |');
  lines.push('|-----------|------|:--------------:|');
  for (const r of rows) {
    lines.push(
      `| \`${r.routePath}\` | \`${r.file}\` | ${r.exercisedByE2E ? '✅' : '❌'} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Seed the allowlist file with the CURRENT gap set as `baseline` entries, but
 * only when the file does not already exist (never clobber a curated allowlist).
 */
function seedAllowlistIfMissing(rows: RouteMatrixRow[]): void {
  if (existsSync(ALLOWLIST_PATH)) return;
  const seed: AllowlistEntry[] = gapsOf(rows).map((g) => ({
    id: g.id,
    reason: 'baseline',
  }));
  mkdirSync(dirname(ALLOWLIST_PATH), { recursive: true });
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(seed, null, 2) + '\n');
}

function main(): void {
  const rows = buildRouteMatrix();

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));
  seedAllowlistIfMissing(rows);

  const gaps = gapsOf(rows);
  const exercised = rows.length - gaps.length;
  console.log(
    `fe-route-matrix: ${rows.length} routes, ${exercised} exercised, ${gaps.length} gap. ` +
      `Wrote ${OUT_JSON} + ${OUT_MD}`,
  );

  // --check (gate mode): a route gap that is NOT on the allowlist fails the gate
  // (the ratchet). New dark routes cannot be added silently.
  if (process.argv.includes('--check')) {
    const allowlist = loadAllowlist(ALLOWLIST_PATH);
    const result = ratchet(gaps, allowlist);
    console.log(formatRatchetReport(result, { label: 'fe-route-matrix' }));
    if (!result.ok) process.exit(1);
  }
}

// Only run generation when invoked directly (not when imported by the test).
if (import.meta.main) main();
