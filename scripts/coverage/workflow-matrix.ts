#!/usr/bin/env bun
/**
 * workflow-matrix.ts — WORKFLOW coverage matrix.
 *
 * WHY: docs/product/WORKFLOW_MAP.md is the authoritative catalogue of the product's
 * end-to-end workflows (98+ WF-### / WF-P0# / WF-EMRC-### rows, 16 of them
 * cross-module per §12, plus 14 discovered gaps WFG-### in §14). Nothing tied
 * those workflows back to the tests that actually exercise them, so a workflow
 * could silently rot with green CI. This generator computes that join:
 *
 *   1. Parses every `| WF-### | name | … |` row from WORKFLOW_MAP.md (all tables —
 *      §2 explicit, §3 op-tables, §2b perio/EMR, §12 cross-module).
 *   2. Parses the §12 cross-module set and the §14 WFG gap set.
 *   3. Loads docs/testing/coverage/workflow-test-map.json — the hand-curated,
 *      semi-automatically-seeded WF → journey/e2e spec crosswalk (seeded from the
 *      journey roster's rubricIds + §12 composition notes; see that file's header).
 *   4. VALIDATES the crosswalk: every journeySpec/e2eSpec it names must EXIST on
 *      disk (via lib/scan-tests listFiles); dangling references are reported and
 *      fail the gate.
 *   5. Builds one row per WF (wfId, name, crossModule, mappedSpec?, specExists,
 *      status) and emits docs/testing/coverage/workflow-matrix.{json,md}.
 *   6. Ratchets the gap set (every WF that is not `covered` with an existing spec)
 *      against docs/testing/coverage/workflow.allowlist.json — a new unmapped WF
 *      that is not allowlisted FAILS `--check`.
 *
 * Run from repo root:  bun scripts/coverage/workflow-matrix.ts [--check]
 * (root-level script — does NOT trip the api-ts db-guard preload.)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listFiles } from './lib/scan-tests';
import { ratchet, loadAllowlist, formatRatchetReport, type Gap } from './lib/ratchet';
import { cmpByCodepoint } from './lib/sources';

// ROOT is three levels up from this file (scripts/coverage/ → repo root), matching
// lib/sources.ts. Kept local so this generator owns its own WORKFLOW_MAP parsing
// (per the parallel-safe rule: no shared-lib edits).
const ROOT = join(import.meta.dir, '..', '..');
const WORKFLOW_MAP_PATH = join(ROOT, 'docs/product/WORKFLOW_MAP.md');
const TEST_MAP_PATH = join(ROOT, 'docs/testing/coverage/workflow-test-map.json');
const ALLOWLIST_PATH = join(ROOT, 'docs/testing/coverage/workflow.allowlist.json');
const OUT_JSON = join(ROOT, 'docs/testing/coverage/workflow-matrix.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/workflow-matrix.md');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowDef {
  name: string;
}

export type TestMapStatus = 'covered' | 'gap' | 'deferred';

export interface TestMapEntry {
  journeySpec?: string;
  e2eSpec?: string;
  status: TestMapStatus;
  anchor?: string;
}

export type WorkflowTestMap = Record<string, TestMapEntry>;

export interface WorkflowRow {
  wfId: string;
  name: string;
  crossModule: boolean;
  mappedSpec?: string;
  specExists: boolean;
  status: 'covered' | 'gap' | 'deferred';
}

export interface DanglingRef {
  wfId: string;
  spec: string;
  kind: 'journeySpec' | 'e2eSpec';
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW_MAP.md parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A WF id is `WF-###` (explicit/inferred), `WF-P0#` (perio), or `WF-EMRC-###`
 * (EMR-consultation). We anchor on this set so prose mentions of other tokens
 * are not mistaken for workflow ids.
 */
const WF_ID_RE = /\bWF-(?:P\d{2}|EMRC-\d{3}|\d{3})\b/;
const WFG_ID_RE = /\bWFG-\d{3}\b/;

/** True for a markdown table-separator row like `|---|:---:|`. */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/**
 * True when a cell IS essentially just the id (the row's id column) — tolerating a
 * trailing/leading status annotation in brackets, e.g. `WF-055 [INFERRED]` or
 * `WF-056 [VERIFY]` (the §3 op-tables annotate inferred ids). Without the bracket
 * strip, ~16 [INFERRED] workflows were silently dropped → invisible to the ratchet.
 * A prose cell that merely mentions an id ("see WF-055 for…") still has leftover
 * text and is correctly rejected.
 */
function isIdOnlyCell(cell: string, idRe: RegExp): boolean {
  return cell.replace(idRe, '').replace(/\[[^\]]*\]/g, '').replace(/[\s|]/g, '').length === 0;
}

/** Split a markdown `| a | b | c |` line into trimmed cell strings. */
function splitPipeRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  // Drop the leading/trailing pipe, then split. Trailing empty cell is dropped.
  const inner = t.replace(/^\|/, '').replace(/\|\s*$/, '');
  return inner.split('|').map((c) => c.trim());
}

/**
 * Parse every workflow row across ALL tables in WORKFLOW_MAP.md.
 *
 * A WF id can appear in column 1 (§2 explicit, §2b, §12) or a later column
 * (§3 entity op-tables put the WF-ID in column 3). We therefore scan every cell
 * for a WF id and take the FIRST other cell that looks like a human name as the
 * workflow name. The first table that names a given WF wins (§2/§2b/§12 are the
 * name-bearing tables and appear before the op-tables), so the canonical name is
 * the explicit one, not the op-table's verb.
 */
export function parseWorkflowTables(md: string): Map<string, WorkflowDef> {
  const out = new Map<string, WorkflowDef>();
  for (const rawLine of md.split('\n')) {
    const cells = splitPipeRow(rawLine);
    if (!cells || isSeparatorRow(cells)) continue;

    // Find the cell that is a WF id (exactly, allowing surrounding whitespace).
    let idCellIdx = -1;
    let wfId: string | null = null;
    for (let i = 0; i < cells.length; i++) {
      const m = cells[i]!.match(WF_ID_RE);
      // Treat as the id column only when the cell IS essentially just the id
      // (header column), so a "Linked BRs"/prose cell that mentions a WF id in
      // passing does not hijack the row. A `[INFERRED]`/`[VERIFY]` annotation is OK.
      if (m && isIdOnlyCell(cells[i]!, WF_ID_RE)) {
        idCellIdx = i;
        wfId = m[0];
        break;
      }
    }
    if (!wfId || idCellIdx === -1) continue;
    if (out.has(wfId)) continue; // first name-bearing table wins

    // The name is the next non-empty cell that is not itself a WF/ref token.
    let name = '';
    for (let i = 0; i < cells.length; i++) {
      if (i === idCellIdx) continue;
      const c = cells[i]!;
      if (!c) continue;
      if (WF_ID_RE.test(c) && isIdOnlyCell(c, WF_ID_RE)) continue;
      name = c;
      break;
    }
    out.set(wfId, { name: name || '(unnamed)' });
  }
  return out;
}

/**
 * Parse the §12 Cross-Module Flows table → the set of WF ids that are
 * cross-module. Scoped to the section between `## §12` and the next `## §` so the
 * 16 §12 ids are captured without sweeping in unrelated WF mentions.
 */
export function parseCrossModuleFlows(md: string): Set<string> {
  return collectIdsInSection(md, '§12', WF_ID_RE);
}

/**
 * Parse the §14 Discovered Gaps table → the set of WFG ids. Scoped to the
 * §14 section.
 */
export function parseGaps(md: string): Set<string> {
  return collectIdsInSection(md, '§14', WFG_ID_RE);
}

/**
 * Collect every distinct id matching `idRe` that appears as a row's first id-cell
 * within the markdown section whose `## …` heading contains `sectionMarker`,
 * stopping at the next `## ` heading.
 */
function collectIdsInSection(md: string, sectionMarker: string, idRe: RegExp): Set<string> {
  const ids = new Set<string>();
  const lines = md.split('\n');
  let inSection = false;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      inSection = line.includes(sectionMarker);
      continue;
    }
    if (!inSection) continue;
    const cells = splitPipeRow(line);
    if (!cells || isSeparatorRow(cells)) continue;
    for (const c of cells) {
      const m = c.match(idRe);
      if (m && isIdOnlyCell(c, idRe)) {
        ids.add(m[0]);
        break; // one id per row (the row's id column)
      }
    }
  }
  return ids;
}

export function isCrossModule(wfId: string, crossModule: ReadonlySet<string>): boolean {
  return crossModule.has(wfId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test-map loading + validation
// ─────────────────────────────────────────────────────────────────────────────

/** Load the WF → spec crosswalk JSON (stripping the `$comment`/`anchor` notes). */
export function loadWorkflowTestMap(path: string = TEST_MAP_PATH): WorkflowTestMap {
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const out: WorkflowTestMap = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (k.startsWith('$')) continue; // $comment et al.
    if (typeof v !== 'object' || v === null) continue;
    const e = v as Record<string, unknown>;
    if (typeof e.status !== 'string') continue;
    out[k] = {
      journeySpec: typeof e.journeySpec === 'string' ? e.journeySpec : undefined,
      e2eSpec: typeof e.e2eSpec === 'string' ? e.e2eSpec : undefined,
      status: e.status as TestMapStatus,
      anchor: typeof e.anchor === 'string' ? e.anchor : undefined,
    };
  }
  return out;
}

let _journeySet: Set<string> | null = null;
let _e2eSet: Set<string> | null = null;
function journeyFiles(): Set<string> {
  if (!_journeySet) _journeySet = new Set(listFiles('journeys'));
  return _journeySet;
}
function e2eFiles(): Set<string> {
  if (!_e2eSet) _e2eSet = new Set(listFiles('e2e'));
  return _e2eSet;
}

/** Does the spec a test-map entry references exist on disk? */
function specExistsFor(entry: TestMapEntry): boolean {
  if (entry.journeySpec) return journeyFiles().has(entry.journeySpec);
  if (entry.e2eSpec) return e2eFiles().has(entry.e2eSpec);
  return false;
}

/**
 * Validate the crosswalk: every named journeySpec/e2eSpec must exist in its
 * corpus. Returns the list of dangling references (each fails the gate).
 */
export function validateTestMap(map: WorkflowTestMap): { dangling: DanglingRef[] } {
  const dangling: DanglingRef[] = [];
  for (const [wfId, entry] of Object.entries(map)) {
    if (entry.journeySpec && !journeyFiles().has(entry.journeySpec)) {
      dangling.push({ wfId, spec: entry.journeySpec, kind: 'journeySpec' });
    }
    if (entry.e2eSpec && !e2eFiles().has(entry.e2eSpec)) {
      dangling.push({ wfId, spec: entry.e2eSpec, kind: 'e2eSpec' });
    }
  }
  return { dangling };
}

// ─────────────────────────────────────────────────────────────────────────────
// Row building
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build one matrix row per WF. The row's `status`/`specExists` reflect both the
 * crosswalk's intent and disk reality:
 *   - mapped + spec exists      → status = the map's status (covered/deferred), specExists=true
 *   - mapped + spec missing     → status kept, specExists=false (a dangling cover — surfaces in the gate)
 *   - unmapped                  → status = gap, specExists=false
 */
export function buildRows(
  workflows: ReadonlyMap<string, WorkflowDef>,
  crossModule: ReadonlySet<string>,
  map: WorkflowTestMap,
): WorkflowRow[] {
  const rows: WorkflowRow[] = [];
  for (const [wfId, def] of workflows) {
    const entry = map[wfId];
    const mappedSpec = entry?.journeySpec ?? entry?.e2eSpec;
    const exists = entry ? specExistsFor(entry) : false;
    const status: WorkflowRow['status'] = entry ? entry.status : 'gap';
    rows.push({
      wfId,
      name: def.name,
      crossModule: crossModule.has(wfId),
      mappedSpec,
      specExists: exists,
      status,
    });
  }
  // Zero-padded ids (WF-001 … WF-084) → code-unit order already matches numeric
  // order; cmpByCodepoint keeps the committed artifact byte-stable across runtimes.
  rows.sort((a, b) => cmpByCodepoint(a.wfId, b.wfId));
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gap derivation (for the ratchet)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ratchet gap stream. Two sources of tolerated-but-tracked debt:
 *
 *   1. Every WF row that is not genuinely covered — unmapped, mapped-but-dangling,
 *      explicitly status=gap, or status=deferred. (Deferred rows ARE emitted so
 *      the ratchet sees them: they must carry an allowlist reason, they are not
 *      silently OK.)
 *   2. Every §14 WFG-### discovered gap. These are not workflow rows — they are
 *      the WORKFLOW_MAP's own catalogue of known missing flows/error-paths — but
 *      they belong on the same allowlist so the §14 backlog is reviewed and can
 *      only shrink by an explicit edit (and `resolved` fires when WORKFLOW_MAP
 *      drops one).
 *
 * `wfgGaps` is optional so the unit tests can exercise the row-only derivation.
 */
export function deriveGaps(rows: WorkflowRow[], wfgGaps: ReadonlySet<string> = new Set()): Gap[] {
  const gaps: Gap[] = [];
  for (const r of rows) {
    const trulyCovered = r.status === 'covered' && r.specExists;
    if (trulyCovered) continue;
    gaps.push({
      id: r.wfId,
      name: r.name,
      reason:
        r.status === 'deferred'
          ? 'deferred'
          : r.mappedSpec && !r.specExists
            ? `dangling spec: ${r.mappedSpec}`
            : 'no mapped spec',
      crossModule: r.crossModule,
    });
  }
  for (const id of wfgGaps) {
    gaps.push({ id, name: '(WORKFLOW_MAP §14 discovered gap)', reason: 'wfg-gap' });
  }
  return gaps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

function renderMd(
  rows: WorkflowRow[],
  gaps: Gap[],
  allowlistIds: ReadonlySet<string>,
  dangling: DanglingRef[],
): string {
  const covered = rows.filter((r) => r.status === 'covered' && r.specExists);
  const cross = rows.filter((r) => r.crossModule);
  const gapRows = rows.filter((r) => !(r.status === 'covered' && r.specExists) && r.status !== 'deferred');
  const deferred = rows.filter((r) => r.status === 'deferred');

  const lines: string[] = [];
  lines.push('<!-- GENERATED by scripts/coverage/workflow-matrix.ts — do not edit by hand. -->');
  lines.push('');
  lines.push('# Workflow × Test Coverage Matrix');
  lines.push('');
  lines.push(
    'Computed join of every workflow in `docs/product/WORKFLOW_MAP.md` against the ' +
      'journey/e2e spec that exercises it (crosswalk: ' +
      '`docs/testing/coverage/workflow-test-map.json`). A WF with no existing mapped ' +
      'spec is a coverage gap; gaps must be on `workflow.allowlist.json` (with a reason) ' +
      'or the gate fails.',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|------:|');
  lines.push(`| Total workflows | ${rows.length} |`);
  lines.push(`| Cross-module (§12) | ${cross.length} |`);
  lines.push(`| **Covered** (mapped + spec exists) | **${covered.length}** |`);
  lines.push(`| Gap | ${gapRows.length} |`);
  lines.push(`| Deferred | ${deferred.length} |`);
  lines.push(`| Allowlisted gaps | ${allowlistIds.size} |`);
  lines.push(`| Dangling spec refs | ${dangling.length} |`);
  lines.push('');

  if (dangling.length) {
    lines.push('## ⚠️ Dangling spec references');
    lines.push('');
    lines.push('| WF | kind | spec (does not exist) |');
    lines.push('|----|------|-----------------------|');
    for (const d of dangling) lines.push(`| \`${d.wfId}\` | ${d.kind} | \`${d.spec}\` |`);
    lines.push('');
  }

  lines.push('## Cross-module flows (§12)');
  lines.push('');
  lines.push('The 16 inter-module handoffs — the highest-risk integration seams.');
  lines.push('');
  lines.push('| WF | name | mapped spec | spec exists | status |');
  lines.push('|----|------|-------------|:-----------:|--------|');
  for (const r of cross) {
    lines.push(
      `| \`${r.wfId}\` | ${r.name} | ${r.mappedSpec ? `\`${r.mappedSpec}\`` : '—'} | ${r.specExists ? '✅' : '—'} | ${r.status} |`,
    );
  }
  lines.push('');

  lines.push('## All workflows');
  lines.push('');
  lines.push('| WF | name | cross-module | mapped spec | spec exists | status |');
  lines.push('|----|------|:------------:|-------------|:-----------:|--------|');
  for (const r of rows) {
    lines.push(
      `| \`${r.wfId}\` | ${r.name} | ${r.crossModule ? '🔗' : ''} | ${r.mappedSpec ? `\`${r.mappedSpec}\`` : '—'} | ${r.specExists ? '✅' : '—'} | ${r.status} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main(): void {
  const md = readFileSync(WORKFLOW_MAP_PATH, 'utf8');
  const workflows = parseWorkflowTables(md);
  const crossModule = parseCrossModuleFlows(md);
  const gapSet = parseGaps(md);
  const map = loadWorkflowTestMap();

  const { dangling } = validateTestMap(map);
  const rows = buildRows(workflows, crossModule, map);
  const gaps = deriveGaps(rows, gapSet);

  const allowlist = loadAllowlist(ALLOWLIST_PATH);
  const allowlistIds = new Set(allowlist.map((e) => e.id));
  const result = ratchet(gaps, allowlist);

  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(
    OUT_JSON,
    JSON.stringify(
      {
        generatedBy: 'scripts/coverage/workflow-matrix.ts',
        totals: {
          workflows: rows.length,
          crossModule: rows.filter((r) => r.crossModule).length,
          covered: rows.filter((r) => r.status === 'covered' && r.specExists).length,
          gap: rows.filter((r) => !(r.status === 'covered' && r.specExists) && r.status !== 'deferred').length,
          deferred: rows.filter((r) => r.status === 'deferred').length,
          wfgGaps: gapSet.size,
          danglingSpecRefs: dangling.length,
        },
        dangling,
        rows,
      },
      null,
      2,
    ) + '\n',
  );
  writeFileSync(OUT_MD, renderMd(rows, gaps, allowlistIds, dangling));

  const covered = rows.filter((r) => r.status === 'covered' && r.specExists).length;
  console.log(
    `workflow-matrix: ${rows.length} workflows, ${rows.filter((r) => r.crossModule).length} cross-module, ` +
      `${covered} covered, ${gaps.length} gap-candidates, ${dangling.length} dangling. ` +
      `Wrote ${OUT_JSON} + ${OUT_MD}`,
  );

  if (process.argv.includes('--check')) {
    let failed = false;
    if (dangling.length > 0) {
      console.error(`\n✗ workflow-matrix: ${dangling.length} dangling spec reference(s) — the crosswalk names a spec that does not exist:`);
      for (const d of dangling) console.error(`  ${d.wfId} → ${d.kind} ${d.spec}`);
      failed = true;
    }
    console.log('\n' + formatRatchetReport(result, { label: 'workflow-matrix' }));
    if (!result.ok) failed = true;
    if (failed) process.exit(1);
  }
}

if (import.meta.main) main();
