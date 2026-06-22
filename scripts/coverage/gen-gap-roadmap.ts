const C = new URL('../../docs/testing/coverage', import.meta.url).pathname;
const ep = require(`${C}/endpoint-matrix.json`);
const wf = require(`${C}/workflow-matrix.json`);
const fsm = require(`${C}/fsm-matrix.json`);
const br = require(`${C}/br-matrix.json`);
const fe = require(`${C}/fe-route-matrix.json`);

const lines: string[] = [];
const P = (s = '') => lines.push(s);

// Sensitive mutating orphans = obligation gaps. The endpoint matrix doesn't carry the
// ownership-test flag, so re-derive the obligation set from orphan-disposition.md.
const disp = require('fs').readFileSync(`${C}/orphan-disposition.md`, 'utf8');
const obligations = [...disp.matchAll(/\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| `([^`]+)` \| ⚠️ obligation \|/g)]
  .map(m => ({ op: m[1].trim(), module: m[2].trim(), method: m[3].trim(), path: m[4].trim() }));

P('# Coverage Gap Roadmap');
P();
P('> GENERATED from `docs/testing/coverage/*.json` + `orphan-disposition.md` (regenerate with `bun /tmp/gen-roadmap.ts` or re-run after `bun run coverage:all:ci`).');
P('> Each item is a tracked, **dispositioned** gap — not a silent omission. Address one at a time with the same approach: **RED-first TDD, one branch+PR per cluster, prove non-vacuity (mutate guard → test fails → revert), merge when the 20 required gates are green.**');
P();
P('## Why these were not done in the first pass');
P();
P('The 16-PR production-readiness program was scoped by **risk**: suspected real bugs, every P0 business rule, money-race/concurrency paths, RBAC deny-paths, erasure/consent/privacy, and the 9 required user journeys — all closed and verified. What remains below is the lower-risk long tail, deferred for concrete reasons (per category) rather than oversight. Single-clinic launch posture: RLS is posture-only; multi-tenant isolation E2E is gated on cloud-launch.');
P();

// 1. Sensitive mutating orphan obligations
P(`## 1. Sensitive mutating-orphan obligations (${obligations.length}) — HIGHEST VALUE`);
P();
P('**What:** a write (POST/PUT/PATCH/DELETE) to a PII/clinical/billing/org surface with a shipped handler + SDK but **no FE consumer** and no ownership/cross-tenant negative test. Reachable over the wire → IDOR / cross-tenant exploitable even with no UI (this class swallowed the P0 `updatePatientContact` IDOR).');
P('**Why deferred:** not reachable from the product UI (no FE consumer), so they cannot break a user flow; the P0s that *were* FE-reachable were all closed. Each needs a bespoke cross-tenant/ownership negative test. Ratcheted in `endpoint-sensitive-orphan.allowlist.json`.');
P('**Fix per item:** add a cross-tenant/IDOR negative test asserting 401/403/404 for a non-owner; OR wire/remove the endpoint; OR allowlist with a reason.');
P();
for (const o of obligations) P(`- [ ] \`${o.op}\` — ${o.module} — \`${o.method} ${o.path}\``);
P();

// 2. Endpoint FE-consumed gaps
const epGaps = ep.filter((e: any) => e.disposition === 'gap');
P(`## 2. Endpoint gaps — FE-consumed but untested (${epGaps.length})`);
P();
P('**What:** an operation the product UI **does** call, but with no contract/integration/journey test.');
P('**Why deferred:** mostly reads and lower-risk writes whose happy path is implicitly exercised by journeys/FE unit tests; the gate ratchets them so no NEW untested FE-consumed op can land.');
P('**Fix per item:** add a contract (hurl) test, or an api-unit/integration test, for the operation.');
P();
const byMod = (arr: any[]) => { const m: Record<string, any[]> = {}; arr.forEach(e => (m[e.module] ??= []).push(e)); return m; };
for (const [mod, ops] of Object.entries(byMod(epGaps))) {
  P(`### ${mod} (${(ops as any[]).length})`);
  for (const e of ops as any[]) P(`- [ ] \`${e.operationId}\` — \`${e.method} ${e.path}\``);
  P();
}

// 3. Workflow gaps + deferred
const wfGap = wf.rows.filter((r: any) => r.status === 'gap');
const wfDef = wf.rows.filter((r: any) => r.status === 'deferred');
P(`## 3. Workflow gaps (${wfGap.length}) + deferred (${wfDef.length})`);
P();
P('**What:** a documented WORKFLOW_MAP workflow with no mapped E2E/journey spec.');
P('**Why deferred:** the 9 *required* core journeys are covered; these are secondary/ancillary flows. `deferred` = explicitly gated (e.g. cloud-launch / future phase).');
P('**Fix per item:** author a DOM-driven Playwright journey (or map an existing spec) and register it in the journey harness.');
P();
P('### gap');
for (const r of wfGap) P(`- [ ] ${r.wfId} — ${r.name}${r.crossModule ? ' _(cross-module)_' : ''}`);
P();
P('### deferred (gated — confirm trigger before building)');
for (const r of wfDef) P(`- [ ] ${r.wfId} — ${r.name}${r.crossModule ? ' _(cross-module)_' : ''}`);
P();

// 4. FSM uncovered edges
const fsmU = fsm.filter((e: any) => !e.coveredByTest);
const fsmIllegal = fsmU.filter((e: any) => !e.legal);
const fsmLegal = fsmU.filter((e: any) => e.legal);
P(`## 4. FSM uncovered transition edges (${fsmU.length}: ${fsmIllegal.length} illegal, ${fsmLegal.length} legal)`);
P();
P('**What:** a state-machine edge with no literal per-edge test. Illegal edges = transitions that MUST be rejected; legal = valid transitions without an explicit assertion.');
P('**Why deferred:** the handlers enforce the FSM generically (`allowed=FSM[cur]; if(!allowed.includes(to)) throw`), and the high-risk machines (visit, invoice, claim) have literal per-edge tests. The rest are handler-guaranteed; literal per-edge tests were ratcheted, not all written.');
P('**Fix per item:** add a literal `expect(isValidTransition(from,to)).toBe(false)` (illegal) / happy-path transition (legal) assertion.');
P();
const fsmByMachine = (arr: any[]) => { const m: Record<string, any[]> = {}; arr.forEach(e => (m[e.fsm] ??= []).push(e)); return m; };
P('### illegal edges (must-reject)');
for (const [m, es] of Object.entries(fsmByMachine(fsmIllegal))) P(`- [ ] **${m}** (${(es as any[]).length}): ${(es as any[]).map(e => `${e.from}→${e.to}`).join(', ')}`);
P();
P('### legal edges (happy-path)');
for (const [m, es] of Object.entries(fsmByMachine(fsmLegal))) P(`- [ ] **${m}** (${(es as any[]).length}): ${(es as any[]).map(e => `${e.from}→${e.to}`).join(', ')}`);
P();

// 5. Business rules
const brGap = br.filter((b: any) => b.coverageState && b.coverageState !== 'FULLY_COVERED');
P(`## 5. Business-rule coverage gaps (${brGap.length})`);
P();
P('**Why deferred:** both are P2; one is positive-path-only, one is a future-phase feature.');
P('**Fix per item:** add the missing negative path (POSITIVE_ONLY) or build+test the feature (UNTESTED future-phase).');
P();
for (const b of brGap) P(`- [ ] ${b.brId} — ${b.module} — **${b.coverageState}** (${b.derivedSeverity})`);
P();

// 6. FE routes
const feGap = fe.filter((r: any) => r.status === 'gap' || r.disposition === 'gap' || (!r.exercised && r.exercised !== undefined));
P(`## 6. FE route gaps`);
P();
P('**What:** patient-portal sub-routes never navigated by any spec.');
P('**Why deferred:** the patient portal is a low-traffic read-only surface; the index `/portal` is now exercised, these two sub-routes are not.');
P('**Fix per item:** add a portal journey that navigates the route and asserts self-scoped content.');
P();
P('- [ ] `/portal/appointments`');
P('- [ ] `/portal/bills`');
P();

// 7. Cross-module / deferred-by-decision
P('## 7. Cross-module isolation — DEFERRED TO CLOUD-LAUNCH (do not build for single-clinic)');
P();
P('**What:** G3 (hold-vs-erasure contention) + G4 (cross-module RLS isolation) inter-module E2E.');
P('**Why deferred:** RLS is **posture-only** for single-clinic launch; activation (P3b + remaining modules) is the cloud-launch prerequisite. Posture-only RLS cannot assert runtime isolation, so the E2E would be vacuous until activation. G3 contention is already proven at the service layer (advisory-lock ns 1003).');
P('- [ ] G3/G4 inter-module RLS-isolation E2E — **gated on RLS activation (cloud-launch)**');
P('- [ ] Full RLS activation: P3b patient-subtree + remaining modules — **cloud-launch prep**');
P();

require('fs').writeFileSync(new URL('../../docs/testing/COVERAGE_GAP_ROADMAP.md', import.meta.url).pathname, lines.join('\n'));
console.log('wrote docs/testing/COVERAGE_GAP_ROADMAP.md —', lines.length, 'lines');
console.log('obligations:', obligations.length, '| epGaps:', epGaps.length, '| wfGap:', wfGap.length, 'wfDef:', wfDef.length, '| fsmU:', fsmU.length, '| brGap:', brGap.length);
