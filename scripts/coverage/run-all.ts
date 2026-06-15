#!/usr/bin/env bun
/**
 * run-all.ts — regenerate every coverage matrix and (with --check) enforce the gates.
 *
 * The computed coverage engine has six dimensions; this is the single entry point
 * the `verify:app` button and the CI `coverage-ratchet` job call.
 *
 *   bun scripts/coverage/run-all.ts          # regenerate all matrices, print summaries
 *   bun scripts/coverage/run-all.ts --check  # + fail on any ENFORCED gate regression
 *
 * Gate policy (intentional, documented):
 *   - role-op : HARD — role↔spec drift must be 0 (never allowlisted; PHI-leak class).
 *   - endpoint/fsm/workflow/fe-route : RATCHET — fail only on NEW gaps beyond the
 *     committed *.allowlist.json baseline (allowlists can only shrink).
 *   - br : REPORT-ONLY for now. Its P0 "failures" are traceability gaps (behaviour is
 *     tested but the test does not tag the BR code); turning on the P0 hard gate is a
 *     follow-up that first triages each (tag the test or add a negative-path / new test).
 *     The existing `audit:trace:ci` P0 gate stays in place meanwhile.
 *
 * Prereq: the operationId↔handler join (role-op, endpoint) needs
 * `.understand-anything/contract-spine.json`; it is gitignored, so CI regenerates it
 * (bun scripts/build-contract-spine.ts) before calling this.
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/sources';

const check = process.argv.includes('--check');

interface Generator {
  name: string;
  file: string;
  /** When true, `--check` is passed through and a non-zero exit fails the run. */
  gate: boolean;
}

const GENERATORS: Generator[] = [
  { name: 'role-op', file: 'role-op-matrix.ts', gate: true },
  { name: 'endpoint', file: 'endpoint-matrix.ts', gate: true },
  { name: 'fsm', file: 'fsm-matrix.ts', gate: true },
  { name: 'workflow', file: 'workflow-matrix.ts', gate: true },
  { name: 'fe-route', file: 'fe-route-matrix.ts', gate: true },
  // Report-only (see header): regenerate + print, but its exit code does not gate.
  { name: 'br', file: 'br-matrix.ts', gate: false },
];

let failed = 0;
for (const g of GENERATORS) {
  const enforced = check && g.gate;
  const args = [join(ROOT, 'scripts/coverage', g.file)];
  if (enforced) args.push('--check');
  console.log(`\n${'─'.repeat(70)}\n▶ coverage:${g.name}${enforced ? ' --check' : g.gate ? '' : ' (report-only)'}`);
  const r = spawnSync('bun', args, { cwd: ROOT, stdio: 'inherit' });
  const code = r.status ?? 1;
  if (enforced && code !== 0) {
    failed++;
    console.error(`✗ coverage:${g.name} gate FAILED (exit ${code})`);
  } else if (!g.gate && code !== 0) {
    // br report-only: a non-zero from its own --check semantics is expected/ignored here.
    console.log(`ℹ coverage:${g.name} reported gaps (report-only — not gating this run)`);
  } else if (code !== 0) {
    failed++;
    console.error(`✗ coverage:${g.name} crashed (exit ${code})`);
  }
}

console.log(`\n${'═'.repeat(70)}`);
if (check && failed > 0) {
  console.error(`✗ coverage:all — ${failed} enforced gate(s) failed.`);
  process.exit(1);
}
console.log(`✓ coverage:all complete${check ? ' — all enforced gates green (br report-only).' : '.'}`);
