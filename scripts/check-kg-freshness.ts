#!/usr/bin/env bun
/**
 * check-kg-freshness.ts — understand-anything KG freshness radar (ADVISORY).
 *
 * UA_KG_UPGRADE.md U2 / issue #133. The old knowledge graph silently rotted:
 * 420 commits and 11 days stale, in no gate, so nothing flagged it when it
 * mattered (the New-Visit incident). This radar reads every committed graph's
 * `project.gitCommitHash`, measures drift from HEAD, and emits a VISIBLE warning
 * when a graph is stale past a threshold, has no recorded commit, or records a
 * commit not in history.
 *
 * It is deliberately ADVISORY — never a blocking gate (the plan's scope
 * guardrail: UA is a change-impact radar, the real firewall is the goal-state
 * journey harness). So the CLI prints warnings and exits 0 on drift. `--strict`
 * exits 1 ONLY for a config error (a committed graph with a missing/corrupt
 * commit hash), never for mere drift.
 *
 * Worktree-rot note: the refresh entry points (`/understand`, `/understand-domain`)
 * already redirect worktree runs to the main repo root, but the plugin's
 * incremental auto-update-prompt.md does NOT — so a per-commit auto-update fired
 * from an ephemeral worktree writes there and is lost. Mitigation: run refreshes
 * from the main checkout. This radar is the backstop that makes the resulting
 * staleness loud regardless of where (or whether) auto-update ran.
 *
 * Run from repo root:
 *   bun scripts/check-kg-freshness.ts              # advisory, exit 0
 *   bun scripts/check-kg-freshness.ts --max-drift=75
 *   bun scripts/check-kg-freshness.ts --json
 *   bun scripts/check-kg-freshness.ts --strict     # exit 1 on missing/corrupt hash only
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const KG_DIR = join(ROOT, '.understand-anything');
const DEFAULT_MAX_DRIFT = 50;

/** A graph's recorded commit and how far it has drifted from HEAD. */
export interface GraphFreshness {
  name: string;
  /** `project.gitCommitHash` from the graph file, or null if absent/empty. */
  gitCommitHash: string | null;
  /**
   * Commits between the recorded hash and HEAD (`git rev-list --count <hash>..HEAD`),
   * or null when the hash is missing OR could not be resolved in history.
   */
  commitsBehind: number | null;
}

export type Severity = 'stale' | 'missing' | 'unknown-commit';

export interface Finding {
  name: string;
  severity: Severity;
  gitCommitHash: string | null;
  commitsBehind: number | null;
  message: string;
}

/**
 * Pure classifier — no I/O. `maxDrift` is the inclusive fresh boundary: a graph
 * `maxDrift` commits behind is still fresh; `maxDrift + 1` is stale.
 */
export function assessFreshness(graphs: GraphFreshness[], maxDrift: number): Finding[] {
  const findings: Finding[] = [];
  for (const gr of graphs) {
    if (!gr.gitCommitHash) {
      findings.push({
        name: gr.name,
        severity: 'missing',
        gitCommitHash: gr.gitCommitHash,
        commitsBehind: null,
        message: `${gr.name}: no project.gitCommitHash recorded — cannot verify freshness`,
      });
      continue;
    }
    if (gr.commitsBehind === null) {
      findings.push({
        name: gr.name,
        severity: 'unknown-commit',
        gitCommitHash: gr.gitCommitHash,
        commitsBehind: null,
        message: `${gr.name}: recorded commit ${gr.gitCommitHash.slice(0, 8)} is not in history (rebased away or shallow clone) — re-baseline with /understand`,
      });
      continue;
    }
    if (gr.commitsBehind > maxDrift) {
      findings.push({
        name: gr.name,
        severity: 'stale',
        gitCommitHash: gr.gitCommitHash,
        commitsBehind: gr.commitsBehind,
        message: `${gr.name}: ${gr.commitsBehind} commits behind HEAD (> ${maxDrift}) — refresh with /understand or /understand-domain`,
      });
    }
  }
  return findings;
}

// ─── CLI / I/O layer (not exercised by unit tests) ──────────────────────────

/** Graph files under .understand-anything/ that carry a project.gitCommitHash. */
const GRAPH_FILES = [
  'knowledge-graph.json',
  'frontend-knowledge-graph.json',
  'backend-knowledge-graph.json',
  'domain-graph.json',
];

function commitsBehindHead(hash: string): number | null {
  try {
    const out = execFileSync('git', ['rev-list', '--count', `${hash}..HEAD`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const n = Number.parseInt(out, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // hash not in history
  }
}

function loadGraphs(): GraphFreshness[] {
  if (!existsSync(KG_DIR)) return [];
  const present = new Set(readdirSync(KG_DIR));
  const graphs: GraphFreshness[] = [];
  for (const file of GRAPH_FILES) {
    if (!present.has(file)) continue;
    const name = file.replace(/\.json$/, '');
    let hash: string | null = null;
    try {
      const parsed = JSON.parse(readFileSync(join(KG_DIR, file), 'utf8'));
      const raw = parsed?.project?.gitCommitHash;
      hash = typeof raw === 'string' && raw.length > 0 ? raw : null;
    } catch {
      hash = null; // corrupt file → treated as missing hash
    }
    graphs.push({ name, gitCommitHash: hash, commitsBehind: hash ? commitsBehindHead(hash) : null });
  }
  return graphs;
}

function main(): void {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const asJson = argv.includes('--json');
  const driftArg = argv.find((a) => a.startsWith('--max-drift='));
  const maxDrift = driftArg ? Number.parseInt(driftArg.split('=')[1] ?? '', 10) : DEFAULT_MAX_DRIFT;
  const limit = Number.isFinite(maxDrift) ? maxDrift : DEFAULT_MAX_DRIFT;

  const graphs = loadGraphs();
  const findings = assessFreshness(graphs, limit);

  if (asJson) {
    console.log(JSON.stringify({ maxDrift: limit, graphs, findings }, null, 2));
  } else if (graphs.length === 0) {
    console.log('[kg-freshness] No committed knowledge graphs found under .understand-anything/.');
  } else if (findings.length === 0) {
    const summary = graphs
      .map((g) => `${g.name}@${(g.gitCommitHash ?? '?').slice(0, 8)} (${g.commitsBehind ?? '?'} behind)`)
      .join(', ');
    console.log(`[kg-freshness] OK — all ${graphs.length} graph(s) within ${limit} commits of HEAD: ${summary}`);
  } else {
    console.warn(`[kg-freshness] ⚠ ${findings.length} graph(s) need attention (advisory, max-drift=${limit}):`);
    for (const f of findings) console.warn(`  • ${f.message}`);
  }

  // Advisory: drift NEVER blocks. --strict surfaces only config errors
  // (a committed graph whose recorded commit is missing/corrupt).
  if (strict) {
    const configErrors = findings.filter((f) => f.severity === 'missing' || f.severity === 'unknown-commit');
    if (configErrors.length > 0) process.exit(1);
  }
  process.exit(0);
}

if (import.meta.main) main();
