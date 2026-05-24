/**
 * Performance ratchet — runs autocannon against critical paths and fails
 * when p95 latency regresses by more than 15% from baseline.
 *
 * Usage:
 *   bun run tests/perf/run.ts                  # check vs baseline
 *   UPDATE_BASELINE=true bun run tests/perf/run.ts  # rewrite baseline
 *
 * Env:
 *   API_URL          base URL (default http://localhost:7213)
 *   API_TOKEN        bearer token included as Authorization header
 *   PERF_PATIENT_ID  patient id to substitute into :id paths
 *   PERF_VISIT_ID    visit id to substitute into :id paths
 *   PERF_CHART_ID    perio chart id to substitute into :id paths
 *   PERF_DURATION    seconds per scenario (default 5)
 *   PERF_CONNECTIONS concurrent connections (default 10)
 *   REGRESSION_RATIO failure threshold multiplier (default 1.15 = +15%)
 */

import autocannon from 'autocannon';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarios, type PerfScenario } from './scenarios/perf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, 'baseline.json');

interface BaselineEntry { p95: number }
type Baseline = Record<string, BaselineEntry>;

const baseUrl = process.env['API_URL'] ?? 'http://localhost:7213';
const token = process.env['API_TOKEN'] ?? '';
const duration = Number(process.env['PERF_DURATION'] ?? 5);
const connections = Number(process.env['PERF_CONNECTIONS'] ?? 10);
const regressionRatio = Number(process.env['REGRESSION_RATIO'] ?? 1.15);
const updateBaseline = process.env['UPDATE_BASELINE'] === 'true';

const substitutions: Record<string, string | undefined> = {
  ':patientId': process.env['PERF_PATIENT_ID'],
  ':id': process.env['PERF_PATIENT_ID'] ?? process.env['PERF_VISIT_ID'] ?? process.env['PERF_CHART_ID'],
};

function substitute(value: string, scenarioKey: string): string {
  let out = value;
  // Pick the right :id substitution based on the scenario key.
  if (out.includes(':id')) {
    const id =
      scenarioKey.includes('perio-charts') ? process.env['PERF_CHART_ID'] :
      scenarioKey.includes('visits') ? process.env['PERF_VISIT_ID'] :
      process.env['PERF_PATIENT_ID'];
    if (id) out = out.replace(':id', id);
  }
  for (const [marker, repl] of Object.entries(substitutions)) {
    if (repl && out.includes(marker)) out = out.replaceAll(marker, repl);
  }
  return out;
}

function loadBaseline(): Baseline {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
  } catch {
    return {};
  }
}

async function runScenario(s: PerfScenario): Promise<number> {
  const url = baseUrl + substitute(s.path, s.key);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;

  const body = s.body
    ? substitute(JSON.stringify(s.body), s.key)
    : undefined;

  const result = await autocannon({
    url,
    method: s.method,
    headers,
    body,
    duration,
    connections,
  });

  // p95 in milliseconds
  return result.latency.p97_5 ?? result.latency.p99 ?? result.latency.p90 ?? 0;
}

async function main(): Promise<void> {
  const baseline = loadBaseline();
  const next: Baseline = {};
  const failures: string[] = [];

  for (const s of scenarios) {
    process.stdout.write(`[perf] ${s.method} ${s.path} ... `);
    try {
      const p95 = await runScenario(s);
      next[s.key] = { p95 };
      const baselineP95 = baseline[s.key]?.p95;
      if (baselineP95 == null) {
        console.log(`p95=${p95.toFixed(1)}ms (no baseline)`);
      } else {
        const limit = baselineP95 * regressionRatio;
        const status = p95 > limit ? 'FAIL' : 'OK';
        console.log(
          `p95=${p95.toFixed(1)}ms baseline=${baselineP95}ms limit=${limit.toFixed(1)}ms [${status}]`,
        );
        if (p95 > limit) {
          failures.push(
            `${s.key}: p95 ${p95.toFixed(1)}ms exceeds ${(regressionRatio * 100 - 100).toFixed(0)}% over baseline ${baselineP95}ms`,
          );
        }
      }
    } catch (err) {
      console.log(`ERROR ${(err as Error).message}`);
      failures.push(`${s.key}: scenario errored — ${(err as Error).message}`);
    }
  }

  if (updateBaseline) {
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
    console.log(`[perf] baseline updated -> ${BASELINE_PATH}`);
    return;
  }

  if (failures.length > 0) {
    console.error('\n[perf] regressions detected:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }

  console.log('\n[perf] all scenarios within budget.');
}

void main();
