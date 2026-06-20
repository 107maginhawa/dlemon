#!/usr/bin/env bun
/**
 * ledger-coverage.ts — Phase 1 of the coverage-completeness initiative (plan 013).
 *
 * WHY: docs/testing/coverage/coverage-ledger.json (Phase 0) enumerates the 915
 * authoritative user-reachable workflows / use-cases / business-rules / inter-module
 * flows. Phase 0 said WHAT exists. This says, for each item, IS IT PROVEN — across
 * the four test layers (be-unit, contract, fe-unit, e2e) — by joining the ledger
 * against the existing computed matrices:
 *
 *   - endpoint-matrix.json  → per endpoint: hasIntegrationTest (be-unit api corpus),
 *                             hasContractTest (Hurl), hasJourney (e2e recorder).
 *   - workflow-matrix.json  → per WF id: status + specExists (journey/e2e).
 *   - fe-route-matrix.json  → per route: exercisedByE2E.
 *
 * It applies a deterministic per-type REQUIRED-LAYER policy (plan decision 3,
 * formalized in Phase 2) and grades each required layer COVERED / MISSING / UNKNOWN.
 * An item with ≥1 MISSING required layer is a backlog gap. Output:
 *
 *   - docs/testing/coverage/ledger-coverage.json  (full per-item grades)
 *   - docs/testing/coverage/LEDGER_COVERAGE.md     (summary + prioritized backlog)
 *
 * Confidence: be-unit / contract / e2e are graded mechanically from the matrices.
 * fe-unit is UNKNOWN here (no reliable FE-unit corpus index) — resolved by the
 * Phase 1 FE fan-out. UNKNOWN never counts as a hard gap; only confident MISSING does.
 *
 * Run from repo root:  bun scripts/coverage/ledger-coverage.ts
 * (root-level script — no api-ts db-guard preload.)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const E2E_DIR = join(ROOT, 'apps/dentalemon/tests/e2e');
const LEDGER = join(ROOT, 'docs/testing/coverage/coverage-ledger.json');
const ENDPOINT_MATRIX = join(ROOT, 'docs/testing/coverage/endpoint-matrix.json');
const WORKFLOW_MATRIX = join(ROOT, 'docs/testing/coverage/workflow-matrix.json');
const FE_ROUTE_MATRIX = join(ROOT, 'docs/testing/coverage/fe-route-matrix.json');
const OUT_JSON = join(ROOT, 'docs/testing/coverage/ledger-coverage.json');
const OUT_MD = join(ROOT, 'docs/testing/coverage/LEDGER_COVERAGE.md');

type Layer = 'be-unit' | 'contract' | 'fe-unit' | 'e2e';
type Grade = 'COVERED' | 'MISSING' | 'UNKNOWN' | 'N/A';

interface LedgerItem {
  id: string;
  title: string;
  type: 'workflow' | 'business-rule' | 'use-case' | 'inter-module';
  modules: string[];
  userEntryPoint: { route: string | null; control: string | null };
  endpoints: string[];
  relatedWF: string[];
  relatedBR: string[];
  requiredLayers: Layer[];
  notes: string;
}

// ── module risk classes (Phase 1 working policy; Phase 2 formalizes) ──
const MONEY = new Set(['billing', 'dental-billing']);
const CLINICAL = new Set([
  'dental-clinical', 'dental-visit', 'dental-perio', 'dental-imaging', 'dental-pmd',
  'dental-patient', 'dental-erasure', 'dental-legalhold', 'retention', 'emr',
  'dental-audit', 'audit', 'person', 'patient', // PII / compliance = safety class
]);

// Items the Reconcile agent classified as absent-by-design — never a coverage gap.
const ABSENT_BY_DESIGN = new Set(['WF-P05', 'V-XRI-003', 'BR-031']);

/** Collapse `:param` and `{param}` to a single placeholder for path matching. */
function normPath(p: string): string {
  return p.replace(/\/:[^/]+/g, '/{}').replace(/\/\{[^}]+\}/g, '/{}').replace(/\/+$/, '');
}
function epKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normPath(path)}`;
}

interface EpRow {
  operationId: string;
  method: string; path: string; module: string;
  hasIntegrationTest: boolean; hasContractTest: boolean; hasJourney: boolean;
  hasFEConsumer: boolean; disposition: string; // tested | gap | orphan
}

/**
 * be-unit coverage signal that the recorder/endpoint-matrix MISS: the dominant
 * dental test pattern is a direct-handler unit test (`discardVisit.test.ts` imports
 * and calls discardVisit) which never flows through buildTestApp. Such a test
 * references the handler by its operationId. So: an op is be-unit-covered if its
 * operationId token appears anywhere in the BE test corpus. (Validated: discardVisit,
 * listPatientInsuranceProfiles both resolve correctly where disposition='gap' lied.)
 */
function loadBeUnitOps(opIds: string[]): Set<string> {
  const corpus = walkBE().map((f) => readFileSync(f, 'utf8')).join('\n');
  const covered = new Set<string>();
  for (const full of opIds) {
    const short = full.split('_').pop()!; // strip "CephMgmt_" namespace
    if (corpus.includes(full) || corpus.includes(short)) covered.add(full);
  }
  return covered;
}
/**
 * Recorder sink (gitignored, populated by `COVERAGE_RECORD=1 bun test`): the set of
 * operationIds a buildTestApp-routed test actually hit. This catches be-unit tests
 * that route by PATH without naming the operationId — which the opId-grep misses.
 * be-unit signal = opId-grep ∪ recorder. Absent sink (e.g. CI) → grep-only, which is
 * slightly more conservative (a few extra candidate gaps the LLM verify pass filters).
 */
function loadRecordedOps(epIndex: Map<string, EpRow>): Set<string> {
  const covered = new Set<string>();
  let text = '';
  try { text = readFileSync(join(ROOT, 'docs/testing/coverage/.recorded-ops.jsonl'), 'utf8'); } catch { return covered; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line) as { method: string; matchedRoutePath: string };
      const row = epIndex.get(epKey(o.method, o.matchedRoutePath));
      if (row) covered.add(row.operationId);
    } catch { /* skip malformed line */ }
  }
  return covered;
}

function walkBE(): string[] {
  const roots = [join(ROOT, 'services/api-ts/src/handlers'), join(ROOT, 'services/api-ts/src/tests'), join(ROOT, 'services/api-ts/tests')];
  const acc: string[] = [];
  for (const r of roots) { try { statSync(r); walk(r, acc); } catch { /* missing root */ } }
  return acc.filter((f) => /\.test\.ts$/.test(f));
}

function loadEndpointIndex(): Map<string, EpRow> {
  const arr = Object.values(JSON.parse(readFileSync(ENDPOINT_MATRIX, 'utf8'))) as EpRow[];
  const idx = new Map<string, EpRow>();
  for (const r of arr) idx.set(epKey(r.method, r.path), r);
  return idx;
}

function loadWorkflowIndex(): Map<string, { status: string; specExists: boolean }> {
  const m = JSON.parse(readFileSync(WORKFLOW_MATRIX, 'utf8'));
  const idx = new Map<string, { status: string; specExists: boolean }>();
  for (const r of m.rows) idx.set(r.wfId, { status: r.status, specExists: r.specExists });
  return idx;
}

function loadFeRouteIndex(): Map<string, boolean> {
  const arr = Object.values(JSON.parse(readFileSync(FE_ROUTE_MATRIX, 'utf8'))) as Array<{ routePath: string; exercisedByE2E: boolean }>;
  const idx = new Map<string, boolean>();
  for (const r of arr) idx.set(normPath(r.routePath), r.exercisedByE2E);
  return idx;
}

/**
 * Static e2e-spec signal: the data-testids and routes the journey/e2e corpus
 * actually exercises. A ledger item whose userEntryPoint.control is one of those
 * testids, or whose route is visited, has a confident e2e proof. (The journey
 * recorder would be authoritative but needs the web app up; this static read is
 * the reliable, run-free approximation — and the Phase 1 LLM fan-out refines the
 * uncertain remainder.)
 */
function loadE2eSpecSignals(): { testids: Set<string>; routes: Set<string> } {
  const testids = new Set<string>();
  const routes = new Set<string>();
  let files: string[] = [];
  try { files = walk(E2E_DIR); } catch { return { testids, routes }; }
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/getByTestId\(['"`]([^'"`]+)/g)) testids.add(m[1]!);
    for (const m of src.matchAll(/\[data-testid=["']([^"']+)/g)) testids.add(m[1]!);
    for (const m of src.matchAll(/goto\(\s*`\$\{APP\}([^`]+)`/g)) routes.add(normPath(m[1]!.split('?')[0]!));
    for (const m of src.matchAll(/goto\(\s*['"]([^'"]+)/g)) routes.add(normPath(m[1]!.split('?')[0]!));
  }
  return { testids, routes };
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); }
    else if (/\.(spec|test)\.ts$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Extract the data-testid out of a freeform ledger control string, if any. */
function controlTestids(control: string | null): string[] {
  if (!control) return [];
  const ids: string[] = [];
  for (const m of control.matchAll(/[a-z][a-z0-9]+(?:-[a-z0-9]+)+/gi)) ids.push(m[0]); // kebab tokens
  return ids;
}

function parseEndpoint(e: string): { method: string; path: string } | null {
  const m = e.match(/^([A-Z]+)\s+(.+)$/);
  return m ? { method: m[1]!, path: m[2]! } : null;
}

function isWrite(it: LedgerItem): boolean {
  return it.endpoints.some((e) => /^(POST|PUT|PATCH|DELETE)\b/.test(e));
}
function isHot(it: LedgerItem): boolean {
  return it.type === 'inter-module' || it.modules.some((m) => MONEY.has(m) || CLINICAL.has(m));
}
function riskClass(it: LedgerItem): 'money' | 'clinical' | 'auth' | 'core' | 'rest' {
  if (it.modules.some((m) => MONEY.has(m))) return 'money';
  if (it.modules.some((m) => CLINICAL.has(m))) return 'clinical';
  if (it.modules.some((m) => m === 'audit' || m === 'dental-org' || m === 'provider') ||
      /auth|login|pin|role|permission|consent/i.test(it.title)) return 'auth';
  if (it.type === 'workflow' || it.type === 'inter-module') return 'core';
  return 'rest';
}

/** Deterministic required-layer policy (plan decision 3). */
function policyLayers(it: LedgerItem): Layer[] {
  const L = new Set<Layer>();
  const route = !!it.userEntryPoint.route;
  const hasEndpoint = it.endpoints.length > 0;
  const hot = isHot(it);
  const userWorkflow = it.type === 'workflow' || it.type === 'inter-module';

  if (hasEndpoint) L.add('be-unit');
  if (hot && hasEndpoint) L.add('contract');
  if (route && (isWrite(it) || hot)) L.add('fe-unit');
  // e2e: user-reachable WORKFLOWS, plus money/clinical user-facing MUTATIONS (full stack).
  // NOT required for reads or pure business-rules (plan decision 3: "reads get BE unit").
  if (userWorkflow && route) L.add('e2e');
  if (hot && route && isWrite(it) && it.type === 'use-case') L.add('e2e');
  if (!hasEndpoint && !route) L.add('be-unit'); // pure backend rule → unit-testable
  return [...L].sort();
}

function gradeLayer(layer: Layer, it: LedgerItem, idx: {
  ep: Map<string, EpRow>; wf: Map<string, { status: string; specExists: boolean }>; fe: Map<string, boolean>;
  e2e: { testids: Set<string>; routes: Set<string> }; beUnitOps: Set<string>;
}): Grade {
  const eps = it.endpoints.map(parseEndpoint).filter(Boolean).map((p) => idx.ep.get(epKey(p!.method, p!.path))).filter(Boolean) as EpRow[];
  switch (layer) {
    case 'be-unit':
      // Primary signal = operationId appears in the BE test corpus (catches the
      // direct-handler unit tests the recorder/endpoint-matrix miss), OR the
      // recorder saw it. MISSING only when FE-reachable, the op is named in NO BE
      // test, and the recorder never hit it.
      if (it.endpoints.length === 0) return 'UNKNOWN'; // no-endpoint rule → corpus grep can't bind it
      if (eps.length === 0) return 'UNKNOWN';
      if (eps.some((e) => e.hasIntegrationTest || idx.beUnitOps.has(e.operationId))) return 'COVERED';
      if (eps.some((e) => e.hasFEConsumer)) return 'MISSING';
      return 'UNKNOWN';
    case 'contract':
      // Hurl files are statically parsed → hasContractTest is a COMPLETE signal.
      if (eps.length === 0) return it.endpoints.length ? 'UNKNOWN' : 'N/A';
      return eps.some((e) => e.hasContractTest) ? 'COVERED' : 'MISSING';
    case 'e2e': {
      const wfCovered = it.relatedWF.some((w) => { const r = idx.wf.get(w); return r && r.status === 'covered' && r.specExists; });
      const epJourney = eps.some((e) => e.hasJourney);
      const route = it.userEntryPoint.route ? normPath(it.userEntryPoint.route) : null;
      const feRouteE2E = route ? idx.fe.get(route) === true : false;
      const specRoute = route ? idx.e2e.routes.has(route) : false;
      const specTestid = controlTestids(it.userEntryPoint.control).some((t) => idx.e2e.testids.has(t));
      if (wfCovered || epJourney || feRouteE2E || specRoute || specTestid) return 'COVERED';
      return 'MISSING';
    }
    case 'fe-unit':
      return 'UNKNOWN'; // resolved by the Phase 1 FE fan-out
  }
}

function main(): void {
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const items = ledger.items as LedgerItem[];
  const ep = loadEndpointIndex();
  const grepOps = loadBeUnitOps([...new Set([...ep.values()].map((r) => r.operationId))]);
  const recordedOps = loadRecordedOps(ep);
  const beUnitOps = new Set<string>([...grepOps, ...recordedOps]);
  const idx = { ep, wf: loadWorkflowIndex(), fe: loadFeRouteIndex(), e2e: loadE2eSpecSignals(), beUnitOps };

  const graded = items.map((it) => {
    const required = policyLayers(it);
    const grades: Record<string, Grade> = {};
    for (const layer of ['be-unit', 'contract', 'fe-unit', 'e2e'] as Layer[]) {
      grades[layer] = required.includes(layer) ? gradeLayer(layer, it, idx) : 'N/A';
    }
    const missing = required.filter((l) => grades[l] === 'MISSING');
    const unknown = required.filter((l) => grades[l] === 'UNKNOWN');
    const absentByDesign = it.relatedWF.some((w) => ABSENT_BY_DESIGN.has(w)) ||
      it.relatedBR.some((b) => ABSENT_BY_DESIGN.has(b)) || ABSENT_BY_DESIGN.has(it.id);
    // user-reachable = a dentalemon FE actually calls one of its endpoints, OR it has
    // an FE route. Items whose endpoints are ALL orphans (no FE consumer) and have no
    // route are backend/template-only — out of scope for the north-star backlog (the
    // endpoint-matrix's own orphan ratchet governs them).
    const eps = it.endpoints.map(parseEndpoint).filter(Boolean)
      .map((p) => idx.ep.get(epKey(p!.method, p!.path))).filter(Boolean) as EpRow[];
    // For endpoint-bearing items, FE-reachability = a dentalemon FE actually calls one
    // of the endpoints (hasFEConsumer from the contract-spine). The ledger's route field
    // is unreliable here — Phase 0 agents put API paths (`:invoice`) in it, not just real
    // TanStack routes (`$patientId`). Only fall back to the route for no-endpoint items.
    const feReachable = eps.length > 0 ? eps.some((e) => e.hasFEConsumer) : !!it.userEntryPoint.route;
    const allOrphan = eps.length > 0 && eps.every((e) => e.disposition === 'orphan');
    // severity keys off whether the behavior is proven by ANY layer:
    //   unproven    — zero required layers covered (the behavior has NO test at all) — critical
    //   e2e-gap     — unit/contract proves it, but the user workflow has no end-to-end proof
    //   be-unit-gap — covered elsewhere (e.g. contract) but no bun unit test
    //   fe-unit-gap — only the FE unit layer is missing
    //   contract-only — only the contract (Hurl) layer is missing (often deliberate)
    const coveredCount = required.filter((l) => grades[l] === 'COVERED').length;
    // `unproven` = positive evidence of zero coverage (every required layer confidently
    // MISSING; no COVERED, no UNKNOWN). An UNKNOWN layer might be covered, so it's not
    // confidently unproven.
    const severity = (coveredCount === 0 && unknown.length === 0) ? 'unproven'
      : missing.includes('e2e') ? 'e2e-gap'
      : missing.includes('be-unit') ? 'be-unit-gap'
      : missing.includes('fe-unit') ? 'fe-unit-gap'
      : missing.includes('contract') ? 'contract-only' : 'none';
    return {
      id: it.id, title: it.title, type: it.type, modules: it.modules,
      route: it.userEntryPoint.route, risk: riskClass(it), feReachable, allOrphan, severity,
      requiredLayers: required, grades, missing, unknown, absentByDesign,
      itemGrade: absentByDesign ? 'DEFERRED' : missing.length ? 'GAP' : unknown.length ? 'PARTIAL' : 'COVERED',
    };
  });

  // ── backlog: confident GAPs, split user-reachable (north-star) vs backend/orphan ──
  const RISK_ORDER = { money: 0, clinical: 1, auth: 2, core: 3, rest: 4 } as const;
  const SEV_ORDER = { unproven: 0, 'e2e-gap': 1, 'be-unit-gap': 2, 'fe-unit-gap': 3, 'contract-only': 4, none: 5 } as Record<string, number>;
  const sortGaps = (a: typeof graded[number], b: typeof graded[number]) =>
    SEV_ORDER[a.severity]! - SEV_ORDER[b.severity]! || RISK_ORDER[a.risk] - RISK_ORDER[b.risk] ||
    a.missing.length - b.missing.length || a.id.localeCompare(b.id);
  const allGaps = graded.filter((g) => g.itemGrade === 'GAP');
  const backlog = allGaps.filter((g) => g.feReachable).sort(sortGaps);          // primary — a user reaches it
  const backendGaps = allGaps.filter((g) => !g.feReachable).sort(sortGaps);     // orphan/template/backend-only

  // ── stats ──
  const byGrade: Record<string, number> = {};
  for (const g of graded) byGrade[g.itemGrade] = (byGrade[g.itemGrade] || 0) + 1;
  const gapByLayer: Record<string, number> = {};
  for (const g of backlog) for (const l of g.missing) gapByLayer[l] = (gapByLayer[l] || 0) + 1;
  const gapByRisk: Record<string, number> = {};
  for (const g of backlog) gapByRisk[g.risk] = (gapByRisk[g.risk] || 0) + 1;
  const gapBySeverity: Record<string, number> = {};
  for (const g of backlog) gapBySeverity[g.severity] = (gapBySeverity[g.severity] || 0) + 1;
  const partialUnknownByLayer: Record<string, number> = {};
  for (const g of graded) if (g.itemGrade === 'PARTIAL') for (const l of g.unknown) partialUnknownByLayer[l] = (partialUnknownByLayer[l] || 0) + 1;

  writeFileSync(OUT_JSON, JSON.stringify({
    generatedBy: 'scripts/coverage/ledger-coverage.ts',
    source: 'coverage-ledger.json',
    totals: {
      items: items.length, ...byGrade, gapByLayer, gapByRisk, gapBySeverity, partialUnknownByLayer,
      userReachableGaps: backlog.length, backendOnlyGaps: backendGaps.length,
    },
    backlog, backendGaps, items: graded,
  }, null, 2) + '\n');

  const L: string[] = [];
  const P = (s = '') => L.push(s);
  P('<!-- GENERATED by scripts/coverage/ledger-coverage.ts — do not edit by hand. -->');
  P('# Ledger Coverage Matrix (Phase 1)');
  P('');
  P('Per-item layer grades joining `coverage-ledger.json` against the endpoint / workflow / fe-route matrices.');
  P('`be-unit`/`contract`/`e2e` graded mechanically; `fe-unit` = UNKNOWN here (Phase 1 FE fan-out resolves it).');
  P('Only confident `MISSING` required layers count as GAPs.');
  P('');
  P('## Item grades');
  P('');
  P('| Grade | Count | Meaning |');
  P('|-------|------:|---------|');
  P(`| COVERED | ${byGrade.COVERED || 0} | all required layers proven (be/contract/e2e) |`);
  P(`| PARTIAL | ${byGrade.PARTIAL || 0} | no confident MISSING, but ≥1 UNKNOWN (mostly fe-unit / no-endpoint be-unit) |`);
  P(`| **GAP** | **${byGrade.GAP || 0}** | ≥1 required layer confidently MISSING — the backlog |`);
  P(`| DEFERRED | ${byGrade.DEFERRED || 0} | absent-by-design (WF-P05 / V-XRI-003 / BR-031) |`);
  P('');
  P('## GAP backlog by risk × layer');
  P('');
  P('| Risk | GAPs |');
  P('|------|-----:|');
  for (const r of ['money', 'clinical', 'auth', 'core', 'rest']) P(`| ${r} | ${gapByRisk[r] || 0} |`);
  P('');
  P('| Missing layer | GAP count |');
  P('|---------------|----------:|');
  for (const [l, n] of Object.entries(gapByLayer).sort((a, b) => b[1] - a[1])) P(`| ${l} | ${n} |`);
  P('');
  P('## UNKNOWN (needs scan, mostly fe-unit + no-endpoint be-unit)');
  P('');
  P('| Layer | UNKNOWN count |');
  P('|-------|--------------:|');
  for (const [l, n] of Object.entries(partialUnknownByLayer).sort((a, b) => b[1] - a[1])) P(`| ${l} | ${n} |`);
  P('');
  P('## GAP backlog by severity');
  P('');
  P('Severity precedence: `unproven` (NO layer covers the behavior — critical) > `e2e-gap` (unit/contract proves it but the user workflow has no end-to-end proof) > `be-unit-gap` (covered elsewhere, no bun unit test) > `fe-unit-gap` > `contract-only` (often a deliberate "integration-tested instead" choice — see dental-billing.hurl:595).');
  P('');
  P('| severity | GAPs |');
  P('|----------|-----:|');
  for (const s of ['unproven', 'e2e-gap', 'be-unit-gap', 'fe-unit-gap', 'contract-only']) P(`| ${s} | ${gapBySeverity[s] || 0} |`);
  P('');
  P(`## Prioritized user-reachable GAP backlog (${backlog.length}) — the north-star work`);
  P('');
  P('| # | sev | risk | id | type | missing | route | title |');
  P('|--:|-----|------|----|------|---------|-------|-------|');
  backlog.forEach((g, i) => P(`| ${i + 1} | ${g.severity} | ${g.risk} | \`${g.id}\` | ${g.type} | ${g.missing.join('+')} | ${g.route || '—'} | ${g.title.replace(/\|/g, '\\|').slice(0, 56)} |`));
  P('');
  P(`## Backend / orphan-endpoint GAPs (${backendGaps.length}) — NOT user-reachable`);
  P('');
  P('No dentalemon FE consumes these (all endpoints are `disposition: orphan`, mostly the upstream Stripe `billing` template vs the live `dental-billing`). They are the endpoint-matrix orphan ratchet\'s domain, not the user-workflow north star. Listed for completeness, deprioritized.');
  P('');
  P('| risk | id | missing | endpoints (title) |');
  P('|------|----|---------|-------------------|');
  backendGaps.slice(0, 60).forEach((g) => P(`| ${g.risk} | \`${g.id}\` | ${g.missing.join('+')} | ${g.title.replace(/\|/g, '\\|').slice(0, 60)} |`));
  if (backendGaps.length > 60) P(`\n_(+${backendGaps.length - 60} more.)_`);
  P('');
  writeFileSync(OUT_MD, L.join('\n') + '\n');

  console.log(`ledger-coverage: ${items.length} items → COVERED ${byGrade.COVERED || 0}, PARTIAL ${byGrade.PARTIAL || 0}, GAP ${byGrade.GAP || 0}, DEFERRED ${byGrade.DEFERRED || 0}`);
  console.log(`  user-reachable backlog ${backlog.length} — by severity: ${JSON.stringify(gapBySeverity)} — by risk: ${JSON.stringify(gapByRisk)} — by layer: ${JSON.stringify(gapByLayer)}`);
  console.log(`  backend/orphan-only gaps ${backendGaps.length} (deprioritized)`);
  console.log(`  UNKNOWN by layer: ${JSON.stringify(partialUnknownByLayer)}`);
  console.log(`  wrote ${OUT_JSON} + ${OUT_MD}`);
}

if (import.meta.main) main();
