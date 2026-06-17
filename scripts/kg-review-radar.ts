#!/usr/bin/env bun
/**
 * kg-review-radar.ts — understand-anything review radar (ADVISORY).
 *
 * UA_KG_UPGRADE.md U3. At review time, surface: "this diff changed a MAPPED
 * business flow that has no covering goal-state journey." This is the bridge
 * between the KG's flow layer and the real firewall (the journey harness).
 *
 * How: each changed file is mapped to its domain-graph `step` (by filePath) →
 * its `flow` (via `flow_step` edges). Each affected flow is cross-checked against
 * the journey roster in apps/dentalemon/scripts/run-journey-harness.ts using the
 * explicit coverage map in scripts/kg-flow-journey-map.json. A flow with no
 * covering journey (or a map entry pointing only at a journey that no longer
 * exists) is flagged.
 *
 * ADVISORY by design — the plan's scope guardrail makes UA a radar, never a
 * blocking gate. The CLI always exits 0; it prints a note (or `--json` for a PR
 * comment). Run it in /review or CI as a non-blocking comment.
 *
 * Run from repo root:
 *   bun scripts/kg-review-radar.ts                 # diff vs origin/main (or main)
 *   bun scripts/kg-review-radar.ts --base=main
 *   bun scripts/kg-review-radar.ts --files=a.ts,b.ts
 *   bun scripts/kg-review-radar.ts --json
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');

export interface DomainNode {
  id: string;
  type: string;
  name?: string;
  filePath?: string;
}
export interface DomainEdge {
  source: string;
  target: string;
  type: string;
}
export interface DomainGraph {
  nodes: DomainNode[];
  edges: DomainEdge[];
}

export interface AffectedFlow {
  flowId: string;
  flowName: string;
  file: string;
  stepId: string;
}

export interface CoverageRow {
  flowId: string;
  covered: string[];
  uncovered: boolean;
}

/**
 * Pure: map changed files → the domain-graph flows they touch. A file matches a
 * `step` node whose `filePath` equals it; the step's owning `flow` is found via
 * `flow_step` edges (source=flow, target=step). Deduped by flowId (first file
 * kept as the representative).
 */
export function affectedFlows(changedFiles: string[], g: DomainGraph): AffectedFlow[] {
  const stepById = new Map<string, DomainNode>();
  const flowById = new Map<string, DomainNode>();
  for (const n of g.nodes) {
    if (n.type === 'step') stepById.set(n.id, n);
    else if (n.type === 'flow') flowById.set(n.id, n);
  }
  // step id → flow id
  const stepToFlow = new Map<string, string>();
  for (const e of g.edges) {
    if (e.type === 'flow_step') stepToFlow.set(e.target, e.source);
  }
  // filePath → step ids
  const fileToSteps = new Map<string, string[]>();
  for (const s of stepById.values()) {
    if (!s.filePath) continue;
    const arr = fileToSteps.get(s.filePath) ?? [];
    arr.push(s.id);
    fileToSteps.set(s.filePath, arr);
  }

  const changed = new Set(changedFiles);
  const out: AffectedFlow[] = [];
  const seenFlow = new Set<string>();
  for (const file of changed) {
    const steps = fileToSteps.get(file);
    if (!steps) continue;
    for (const stepId of steps) {
      const flowId = stepToFlow.get(stepId);
      if (!flowId || seenFlow.has(flowId)) continue;
      seenFlow.add(flowId);
      out.push({ flowId, flowName: flowById.get(flowId)?.name ?? flowId, file, stepId });
    }
  }
  return out;
}

/**
 * Pure: for each affected flow, report which mapped journeys actually exist in
 * the roster. `uncovered` = no surviving covering journey (no map entry, or the
 * entry points only at journeys no longer in the roster).
 */
export function coverageReport(
  flowIds: string[],
  coverage: Record<string, string[]>,
  journeyIds: Set<string>,
): CoverageRow[] {
  return flowIds.map((flowId) => {
    const mapped = coverage[flowId] ?? [];
    const covered = mapped.filter((j) => journeyIds.has(j));
    return { flowId, covered, uncovered: covered.length === 0 };
  });
}

// ─── CLI / I/O layer (not exercised by unit tests) ──────────────────────────

function parseJourneyIds(): Set<string> {
  const p = join(ROOT, 'apps/dentalemon/scripts/run-journey-harness.ts');
  const ids = new Set<string>();
  if (!existsSync(p)) return ids;
  const src = readFileSync(p, 'utf8');
  // Match BOTH Set-A (J##) and Set-B (B##) journey ids — same id shape the harness
  // itself uses (\b[JB]\d{2}\b). Missing the B-journeys here would make any flow
  // mapped only to ceph journeys (B01–B04) read as falsely uncovered.
  for (const m of src.matchAll(/\b([JB]\d+)\s*:\s*\{\s*name:/g)) ids.add(m[1]!);
  return ids;
}

function changedFilesVsBase(base: string): string[] {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function resolveBase(explicit: string | undefined): string {
  if (explicit) return explicit;
  for (const ref of ['origin/main', 'main']) {
    try {
      execFileSync('git', ['rev-parse', '--verify', ref], { cwd: ROOT, stdio: 'ignore' });
      return ref;
    } catch {
      /* try next */
    }
  }
  return 'HEAD~1';
}

function main(): void {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const baseArg = argv.find((a) => a.startsWith('--base='))?.split('=')[1];
  const filesArg = argv.find((a) => a.startsWith('--files='))?.split('=')[1];

  const graphPath = join(ROOT, '.understand-anything/domain-graph.json');
  if (!existsSync(graphPath)) {
    console.log('[kg-radar] No domain-graph.json — run /understand-domain first. (advisory; skipping)');
    process.exit(0);
  }
  const graph: DomainGraph = JSON.parse(readFileSync(graphPath, 'utf8'));
  const mapFile = JSON.parse(readFileSync(join(ROOT, 'scripts/kg-flow-journey-map.json'), 'utf8'));
  const coverage: Record<string, string[]> = mapFile.coverage ?? {};
  const journeys = parseJourneyIds();

  const base = resolveBase(baseArg);
  const changed = filesArg ? filesArg.split(',').map((s) => s.trim()).filter(Boolean) : changedFilesVsBase(base);
  const affected = affectedFlows(changed, graph);
  const report = coverageReport(affected.map((a) => a.flowId), coverage, journeys);
  const nameById = new Map(affected.map((a) => [a.flowId, a.flowName]));
  const fileById = new Map(affected.map((a) => [a.flowId, a.file]));

  if (asJson) {
    console.log(JSON.stringify({ base, changedFiles: changed.length, affectedFlows: affected, coverage: report }, null, 2));
    process.exit(0);
  }

  console.log(`[kg-radar] Advisory — diff vs ${base}: ${changed.length} changed file(s), ${affected.length} mapped flow(s) touched.`);
  if (affected.length === 0) {
    console.log('  (no domain-graph flow touched by this diff)');
    process.exit(0);
  }
  const uncovered = report.filter((r) => r.uncovered);
  for (const r of report) {
    const tag = r.uncovered ? '⚠ NO covering journey' : `covered by ${r.covered.join(', ')}`;
    console.log(`  • ${nameById.get(r.flowId)} (${r.flowId}) — ${tag}  [via ${fileById.get(r.flowId)}]`);
  }
  if (uncovered.length > 0) {
    console.log(`\n[kg-radar] ⚠ ${uncovered.length} touched flow(s) have NO goal-state journey. Consider adding one (or a coverage-map entry if a journey already covers it).`);
  }
  process.exit(0); // advisory — never blocks
}

if (import.meta.main) main();
