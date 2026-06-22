#!/usr/bin/env bun
/**
 * fsm-matrix.ts — FSM transition coverage matrix (legal + illegal edges).
 *
 * WHY: each clinical/billing entity (Visit, Treatment, Appointment, LabOrder,
 * Prescription, imaging Finding, Ceph landmark, payment Plan) is governed by a
 * declared finite-state machine — a `Record<Status, Status[]>` constant named
 * `*_TRANSITIONS` or `*_FSM` (both naming conventions exist in the codebase).
 * The latent bug class is an *unguarded illegal transition*: a
 * handler that silently accepts (from → to) the FSM never declared, e.g.
 * `diagnosed → performed` skipping `planned`, or reviving a terminal `voided`.
 * A property/HTTP test that asserts the rejection of every illegal edge closes
 * that class; the gaps below are exactly the edges nobody asserts.
 *
 * WHAT it does, deterministically:
 *   1. Discovers every `export const <NAME>_TRANSITIONS: Record<...> = { ... }`
 *      across services/api-ts/src/handlers (schema + repo files), mirroring the
 *      pgEnum extraction in scripts/check-fsm-tokens.ts.
 *   2. Parses each map's `from → to[]` literal.
 *   3. Enumerates the full edge space: states × states − self-loops. Declared
 *      pairs are LEGAL; the remainder are ILLEGAL.
 *   4. For each edge, looks for a covering test via a documented PROXIMITY
 *      HEURISTIC over the FSM test corpus (api-unit tests whose file references
 *      the FSM, preferring `*.fsm*.test.ts`): a line where the `from` and `to`
 *      state tokens co-occur within a small window of a matching OUTCOME token
 *      (legal → a 2xx / `.toBe(200|201)` / `.toContain('<to>')` / `.toBe(true)`;
 *      illegal → a 4xx / `.toBe(false)` rejection). This is a heuristic — it
 *      proves *a* test mentions the edge with the right polarity, not that the
 *      assertion is semantically perfect. Documented as such in the output.
 *   5. Emits docs/testing/coverage/fsm-matrix.{json,md} (columns: fsm, from, to,
 *      legal, coveredByTest, evidenceFile?, evidenceLine?). A gap is an uncovered
 *      edge; uncovered ILLEGAL edges are the high-value column.
 *   6. --check: ratchets current gaps against docs/testing/coverage/fsm.allowlist.json.
 *
 * Run from repo root:  bun scripts/coverage/fsm-matrix.ts [--check]
 * (root-level script — does NOT trip the api-ts db-guard preload).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, cmpByCodepoint } from './lib/sources';
import { listFiles } from './lib/scan-tests';
import {
  loadAllowlist,
  ratchet,
  formatRatchetReport,
  type AllowlistEntry,
} from './lib/ratchet';

const OUT_JSON = join(ROOT, 'docs/testing/coverage/fsm-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/fsm-matrix.md');
const ALLOWLIST_PATH = join(ROOT, 'docs/testing/coverage/fsm.allowlist.json');

const HANDLERS_DIR = 'services/api-ts/src/handlers';

/** How many lines either side of a token line still count as "near" (proximity). */
const PROXIMITY_WINDOW = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Source parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip `//` line comments and block comments (replacing with spaces so offsets
 * are preserved). String literals are skipped so a `//` inside a string is safe.
 * Lifted in spirit from role-op-matrix.ts's stripComments.
 */
function stripComments(src: string): string {
  const out = src.split('');
  let i = 0;
  while (i < out.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out[i] = ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out[i] = ' ';
      out[i + 1] = ' ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < src.length) {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 2;
      }
      continue;
    }
    i++;
  }
  return out.join('');
}

/** A parsed `from → to[]` transition map. */
export type LegalMap = Record<string, string[]>;

/**
 * Parse a `export const <constName>: Record<...> = { from: [...], ... };` literal
 * into a `Record<string, string[]>`. Returns null when the constant is absent.
 *
 * The object body is brace-balanced from the `=`'s opening `{`. Each top-level
 * `key: [ ... ]` entry is read; array members are single/double-quoted snake/
 * camel-case tokens. Comments are stripped first so trailing `// terminal` notes
 * never leak in.
 */
export function parseTransitionMap(srcRaw: string, constName: string): LegalMap | null {
  const src = stripComments(srcRaw);
  // Find `const <constName>` ... up to the `=` then the opening `{`.
  const declRe = new RegExp(`\\bconst\\s+${escapeRe(constName)}\\b`);
  const m = declRe.exec(src);
  if (!m) return null;
  const eq = src.indexOf('=', m.index);
  if (eq === -1) return null;
  const braceStart = src.indexOf('{', eq);
  if (braceStart === -1) return null;

  // Brace-balance to find the matching close of the object literal.
  let depth = 0;
  let braceEnd = -1;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  if (braceEnd === -1) return null;

  const body = src.slice(braceStart + 1, braceEnd);
  const map: LegalMap = {};
  // Match `key: [ ... ]` — key is a (quoted or bare) identifier, value an array.
  const entryRe = /(?:'([a-z0-9_]+)'|"([a-z0-9_]+)"|([a-z_][a-z0-9_]*))\s*:\s*\[([^\]]*)\]/gi;
  let e: RegExpExecArray | null;
  while ((e = entryRe.exec(body))) {
    const key = (e[1] ?? e[2] ?? e[3])!;
    const inner = e[4]!;
    const targets = [...inner.matchAll(/'([a-z0-9_]+)'|"([a-z0-9_]+)"/gi)].map(
      (t) => (t[1] ?? t[2])!,
    );
    map[key] = targets;
  }
  return Object.keys(map).length ? map : null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge enumeration
// ─────────────────────────────────────────────────────────────────────────────

export interface Edge {
  from: string;
  to: string;
  legal: boolean;
}

/**
 * Enumerate the full edge space for a transition map: states × states − self-
 * loops. The state universe is the union of the map's keys and every declared
 * target (a state that only ever appears as a target — defensive). Declared
 * (from, to) pairs are LEGAL; everything else is ILLEGAL.
 */
export function computeEdges(legalMap: LegalMap): Edge[] {
  const states = new Set<string>();
  for (const [from, tos] of Object.entries(legalMap)) {
    states.add(from);
    for (const to of tos) states.add(to);
  }
  const ordered = [...states].sort();
  const declared = new Set<string>();
  for (const [from, tos] of Object.entries(legalMap)) {
    for (const to of tos) declared.add(`${from}->${to}`);
  }
  const edges: Edge[] = [];
  for (const from of ordered) {
    for (const to of ordered) {
      if (from === to) continue; // no self-loops in the edge space
      edges.push({ from, to, legal: declared.has(`${from}->${to}`) });
    }
  }
  return edges;
}

/** Stable id for an edge — used as the allowlist/gap key. */
export function edgeId(fsm: string, from: string, to: string): string {
  return `${fsm}:${from}->${to}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FSM discovery
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedFsm {
  /** Human label, derived from the constant name (e.g. VISIT_TRANSITIONS → Visit). */
  name: string;
  /** The exported constant name. */
  constName: string;
  /** Repo-relative file the constant lives in (POSIX separators). */
  file: string;
  /** The parsed from → to[] map. */
  legalMap: LegalMap;
}

/** VISIT_TRANSITIONS → Visit; CEPH_LANDMARK_TRANSITIONS → CephLandmark; INSURANCE_CLAIM_FSM → InsuranceClaim. */
function nameFromConst(constName: string): string {
  return constName
    .replace(/_(?:TRANSITIONS|FSM)$/, '')
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Discover every `export const <NAME>_TRANSITIONS: Record<...> = { ... }` under
 * the handlers tree (schema + repo files) and parse each one. Sorted by const
 * name for deterministic output.
 */
export function discoverFsms(): ParsedFsm[] {
  const dir = join(ROOT, HANDLERS_DIR);
  const g = new Bun.Glob('**/*.{schema,repo}.ts');
  const out: ParsedFsm[] = [];
  const seen = new Set<string>();
  for (const rel of g.scanSync({ cwd: dir, onlyFiles: true })) {
    const abs = join(dir, rel);
    const src = readFileSync(abs, 'utf8');
    const constRe = /export\s+const\s+([A-Z][A-Z0-9_]*_(?:TRANSITIONS|FSM))\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = constRe.exec(src))) {
      const constName = m[1]!;
      if (seen.has(constName)) continue;
      const legalMap = parseTransitionMap(src, constName);
      if (!legalMap) continue;
      seen.add(constName);
      out.push({
        name: nameFromConst(constName),
        constName,
        file: `${HANDLERS_DIR}/${rel.split('\\').join('/')}`,
        legalMap,
      });
    }
  }
  out.sort((a, b) => cmpByCodepoint(a.constName, b.constName));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage heuristic
// ─────────────────────────────────────────────────────────────────────────────

/** A scanned test line: 1-based line number + raw text. */
export interface ScannedLine {
  line: number;
  text: string;
}

export interface EdgeCoverage {
  covered: boolean;
  evidenceLine?: number;
}

/** Outcome tokens that signal a *successful* transition (legal-edge positive). */
const SUCCESS_RE = /\b(2\d\d)\b|\.toBe\(\s*(?:200|201|204)\s*\)|\.toContain\(|\.toBe\(\s*true\s*\)/;
/** Outcome tokens that signal a *rejected* transition (illegal-edge positive). */
const REJECT_RE = /\b(4\d\d)\b|\.toBe\(\s*(?:400|409|422)\s*\)|\.toBe\(\s*false\s*\)|INVALID_(?:STATUS_)?TRANSITION/;

/** Word-boundary token presence for a (possibly snake_case) state name. */
function hasToken(text: string, token: string): boolean {
  const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(token)}(?![A-Za-z0-9_])`);
  return re.test(text);
}

/**
 * Try to read this line as a STRUCTURED FSM assertion that names an exact ordered
 * (from, to) pair with a polarity. Two canonical shapes (from the property tests):
 *
 *   isValidTransition('<from>', '<to>')).toBe(true|false)   → legal=bool
 *   <MAP>['<from>']).toContain('<to>')                      → legal=true (membership)
 *
 * Returns the precise edge+polarity, or null when the line is not one of these.
 * This makes a `.toContain` / `isValidTransition` line count ONLY for the exact
 * edge it asserts — a multi-target `toContain` block (one assertion per line) no
 * longer spuriously anchors an unrelated edge that merely shares both tokens.
 */
function structuredEdgeAssertion(
  text: string,
): { from: string; to: string; legal: boolean } | null {
  const fn = /isValidTransition\(\s*['"]([a-z0-9_]+)['"]\s*,\s*['"]([a-z0-9_]+)['"]\s*\)\s*\)\s*\.toBe\(\s*(true|false)\s*\)/i.exec(
    text,
  );
  if (fn) return { from: fn[1]!, to: fn[2]!, legal: fn[3] === 'true' };
  const contains = /\[\s*['"]([a-z0-9_]+)['"]\s*\]\s*\)\s*\.toContain\(\s*['"]([a-z0-9_]+)['"]\s*\)/.exec(
    text,
  );
  if (contains) return { from: contains[1]!, to: contains[2]!, legal: true };
  return null;
}

/**
 * Decide whether an edge is covered by a test, given the scanned lines of ONE
 * FSM test file. Heuristic:
 *
 *   - Find every line where BOTH the `from` and `to` state tokens appear
 *     (a line that names the transition). This is the "anchor".
 *   - Look in a ±PROXIMITY_WINDOW band around each anchor for an OUTCOME token
 *     of the right polarity (legal → SUCCESS_RE; illegal → REJECT_RE). The
 *     anchor line itself counts (test-name lines often carry `-> 422`).
 *   - First anchor with a matching outcome ⇒ covered, evidenceLine = anchor.
 *
 * This intentionally tolerates the from/to and the status code being on
 * different lines (the common `test('a->b')` … `expect(res.status).toBe(422)`
 * shape) while still requiring the from+to to co-occur so an unrelated 422
 * elsewhere in the file is not mistaken for coverage.
 */
export function isEdgeCovered(
  edge: Edge,
  lines: ScannedLine[],
  window: number = PROXIMITY_WINDOW,
): EdgeCoverage {
  // (1) PRECISE: a structured assertion naming this exact ordered pair + polarity.
  for (const l of lines) {
    const s = structuredEdgeAssertion(l.text);
    if (s && s.from === edge.from && s.to === edge.to && s.legal === edge.legal) {
      return { covered: true, evidenceLine: l.line };
    }
  }

  // (2) PROXIMITY fallback (HTTP / arrow / prose): a line naming BOTH states that
  // is NOT a structured assertion for a *different* edge, within ±window of a
  // matching outcome token (legal → SUCCESS_RE; illegal → REJECT_RE). Excluding
  // structured lines for other edges stops a `toContain`/`isValidTransition`
  // block (one ordered pair per line) from anchoring an unrelated co-occurring
  // edge.
  const outcomeRe = edge.legal ? SUCCESS_RE : REJECT_RE;
  const anchors = lines.filter((l) => {
    if (!hasToken(l.text, edge.from) || !hasToken(l.text, edge.to)) return false;
    const s = structuredEdgeAssertion(l.text);
    // A structured line only anchors its OWN edge (handled in pass 1); never let
    // it anchor a different edge in the loose pass.
    return s === null;
  });
  for (const anchor of anchors) {
    const lo = anchor.line - window;
    const hi = anchor.line + window;
    for (const l of lines) {
      if (l.line < lo || l.line > hi) continue;
      outcomeRe.lastIndex = 0;
      if (outcomeRe.test(l.text)) {
        return { covered: true, evidenceLine: anchor.line };
      }
    }
  }
  return { covered: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test-corpus selection per FSM
// ─────────────────────────────────────────────────────────────────────────────

/** repo-relative file → scanned lines (cached for the process). */
const fileLinesCache = new Map<string, ScannedLine[]>();

function scannedLinesOf(repoRelFile: string): ScannedLine[] {
  const cached = fileLinesCache.get(repoRelFile);
  if (cached) return cached;
  let out: ScannedLine[] = [];
  try {
    out = readFileSync(join(ROOT, repoRelFile), 'utf8')
      .split('\n')
      .map((text, i) => ({ line: i + 1, text }));
  } catch {
    out = [];
  }
  fileLinesCache.set(repoRelFile, out);
  return out;
}

/**
 * Select the api-unit test files relevant to an FSM:
 *   1. Files that import/reference the FSM's `*_TRANSITIONS` constant (strongest
 *      signal — these are tests of exactly this state machine), anywhere.
 *   2. Every `*.test.ts` under the same module directory as the FSM's schema —
 *      captures HTTP-enforcement / business-rule tests that drive transitions
 *      without importing the constant (e.g. `*.treatment-status-transitions.test.ts`,
 *      `*.fsm-http.test.ts`).
 *
 * Both sets are unioned. Cross-FSM bleed within a shared module directory (Visit
 * + Treatment both live under `dental-visit/`) is contained by `isEdgeCovered`'s
 * requirement that BOTH state tokens co-occur on the anchor line — a treatment
 * edge cannot match a visit edge unless those exact state names appear together.
 * Returns repo-relative paths.
 */
function fsmTestFiles(fsm: ParsedFsm): string[] {
  const apiUnit = listFiles('api-unit');
  const moduleDir = fsm.file.split('/').slice(0, 5).join('/'); // .../handlers/<module>
  const out = new Set<string>();
  for (const f of apiUnit) {
    if (f.startsWith(moduleDir + '/')) {
      out.add(f);
      continue;
    }
    if (scannedLinesOf(f).some((l) => l.text.includes(fsm.constName))) out.add(f);
  }
  return [...out].sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix rows
// ─────────────────────────────────────────────────────────────────────────────

export interface MatrixRow {
  fsm: string;
  constName: string;
  schemaFile: string;
  from: string;
  to: string;
  legal: boolean;
  coveredByTest: boolean;
  evidenceFile?: string;
  evidenceLine?: number;
}

export function buildMatrix(): MatrixRow[] {
  const fsms = discoverFsms();
  const rows: MatrixRow[] = [];
  for (const fsm of fsms) {
    const testFiles = fsmTestFiles(fsm);
    const edges = computeEdges(fsm.legalMap);
    for (const edge of edges) {
      let covered = false;
      let evidenceFile: string | undefined;
      let evidenceLine: number | undefined;
      for (const file of testFiles) {
        const res = isEdgeCovered(edge, scannedLinesOf(file));
        if (res.covered) {
          covered = true;
          evidenceFile = file;
          evidenceLine = res.evidenceLine;
          break;
        }
      }
      rows.push({
        fsm: fsm.name,
        constName: fsm.constName,
        schemaFile: fsm.file,
        from: edge.from,
        to: edge.to,
        legal: edge.legal,
        coveredByTest: covered,
        evidenceFile,
        evidenceLine,
      });
    }
  }
  // Stable order: fsm, legal-first… actually keep from/to alpha within fsm.
  rows.sort(
    (a, b) =>
      cmpByCodepoint(a.fsm, b.fsm) ||
      cmpByCodepoint(a.from, b.from) ||
      cmpByCodepoint(a.to, b.to),
  );
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gaps + ratchet
// ─────────────────────────────────────────────────────────────────────────────

export interface FsmGap {
  id: string;
  fsm: string;
  from: string;
  to: string;
  legal: boolean;
  [k: string]: unknown;
}

/** A gap is any uncovered edge. Uncovered ILLEGAL edges are the high-value ones. */
export function gapsOf(rows: MatrixRow[]): FsmGap[] {
  return rows
    .filter((r) => !r.coveredByTest)
    .map((r) => ({
      id: edgeId(r.fsm, r.from, r.to),
      fsm: r.fsm,
      from: r.from,
      to: r.to,
      legal: r.legal,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderMd(rows: MatrixRow[]): string {
  const legal = rows.filter((r) => r.legal);
  const illegal = rows.filter((r) => !r.legal);
  const legalUncovered = legal.filter((r) => !r.coveredByTest);
  const illegalUncovered = illegal.filter((r) => !r.coveredByTest);
  const fsms = [...new Set(rows.map((r) => r.fsm))].sort();

  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/fsm-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# FSM Transition Coverage Matrix');
  lines.push('');
  lines.push(
    'Every declared `*_TRANSITIONS` state machine, expanded to its full edge space ' +
      '(states × states − self-loops). Declared pairs are **legal**; the rest are ' +
      '**illegal**. `coveredByTest` is a *heuristic* proximity match: a test line ' +
      `naming both states within ±${PROXIMITY_WINDOW} lines of a matching outcome ` +
      '(legal → a 2xx / `.toContain` / `.toBe(true)`; illegal → a 4xx / `.toBe(false)` ' +
      '/ `INVALID_TRANSITION`). It proves a test *mentions* the edge with the right ' +
      'polarity — not that the assertion is semantically perfect. The high-value gap ' +
      'column is **uncovered ILLEGAL edges**: a state machine whose rejection of a bad ' +
      'transition nobody asserts.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| FSMs | ${fsms.length} |`);
  lines.push(`| Total edges (legal + illegal) | ${rows.length} |`);
  lines.push(`| Legal edges | ${legal.length} |`);
  lines.push(`| Illegal edges | ${illegal.length} |`);
  lines.push(`| Legal covered | ${legal.length - legalUncovered.length} |`);
  lines.push(`| **Legal uncovered** | **${legalUncovered.length}** |`);
  lines.push(`| Illegal covered | ${illegal.length - illegalUncovered.length} |`);
  lines.push(`| **Illegal uncovered (high-value)** | **${illegalUncovered.length}** |`);
  lines.push('');

  lines.push('## Per-FSM coverage');
  lines.push('');
  lines.push('| FSM | edges | legal cov/total | illegal cov/total |');
  lines.push('|-----|------:|:---------------:|:-----------------:|');
  for (const name of fsms) {
    const fr = rows.filter((r) => r.fsm === name);
    const fl = fr.filter((r) => r.legal);
    const fi = fr.filter((r) => !r.legal);
    const flc = fl.filter((r) => r.coveredByTest).length;
    const fic = fi.filter((r) => r.coveredByTest).length;
    lines.push(`| ${name} | ${fr.length} | ${flc}/${fl.length} | ${fic}/${fi.length} |`);
  }
  lines.push('');

  lines.push('## Uncovered ILLEGAL edges (high-value)');
  lines.push('');
  if (illegalUncovered.length === 0) {
    lines.push('_None — every illegal transition has a rejection test._');
  } else {
    lines.push('| FSM | from | to |');
    lines.push('|-----|------|----|');
    for (const r of illegalUncovered) {
      lines.push(`| ${r.fsm} | \`${r.from}\` | \`${r.to}\` |`);
    }
  }
  lines.push('');

  lines.push('## Full edge matrix');
  lines.push('');
  lines.push('| FSM | from | to | legal | covered | evidence |');
  lines.push('|-----|------|----|:-----:|:-------:|----------|');
  for (const r of rows) {
    const ev = r.evidenceFile ? `\`${r.evidenceFile}\`:${r.evidenceLine ?? '?'}` : '';
    lines.push(
      `| ${r.fsm} | \`${r.from}\` | \`${r.to}\` | ${r.legal ? '✅' : '⛔'} | ${
        r.coveredByTest ? '✓' : ' '
      } | ${ev} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist seeding
// ─────────────────────────────────────────────────────────────────────────────

/** Build a baseline allowlist from the current gaps (every uncovered edge). */
function seedAllowlist(gaps: FsmGap[]): AllowlistEntry[] {
  return gaps
    .map((g) => ({
      id: g.id,
      reason: `baseline — ${g.legal ? 'legal' : 'illegal'} edge uncovered at matrix introduction`,
    }))
    .sort((a, b) => cmpByCodepoint(a.id, b.id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const rows = buildMatrix();
  const gaps = gapsOf(rows);

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(OUT_MD, renderMd(rows));

  // Seed the allowlist on first run (only when absent) so the ratchet has a
  // baseline; an existing allowlist is never overwritten by generation.
  if (!existsSync(ALLOWLIST_PATH)) {
    writeFileSync(ALLOWLIST_PATH, JSON.stringify(seedAllowlist(gaps), null, 2) + '\n');
  }

  const legal = rows.filter((r) => r.legal);
  const illegal = rows.filter((r) => !r.legal);
  const illegalUncovered = illegal.filter((r) => !r.coveredByTest).length;
  console.log(
    `fsm-matrix: ${new Set(rows.map((r) => r.fsm)).size} FSMs, ${rows.length} edges ` +
      `(${legal.length} legal / ${illegal.length} illegal), ` +
      `${gaps.length} uncovered (${illegalUncovered} illegal). ` +
      `Wrote ${OUT_JSON} + ${OUT_MD}`,
  );

  if (process.argv.includes('--check')) {
    const allowlist = loadAllowlist(ALLOWLIST_PATH);
    const result = ratchet(gaps, allowlist);
    console.log(formatRatchetReport(result, { label: 'fsm-matrix' }));
    if (!result.ok) process.exit(1);
  }
}

if (import.meta.main) main();
