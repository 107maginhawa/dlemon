/**
 * workflow-matrix.test.ts — TDD for the WORKFLOW coverage matrix generator.
 *
 * Run from repo root:  bun test ./scripts/coverage/workflow-matrix.test.ts
 * (the leading ./ is required for Bun path filters). These are root-level tests:
 * they do NOT trip the api-ts db-guard preload, so no DATABASE_URL is needed.
 *
 * What this matrix is: docs/product/WORKFLOW_MAP.md enumerates 98+ workflows
 * (WF-### explicit/inferred, WF-P0# perio, WF-EMRC-### consultation), 16 of them
 * cross-module (§12), plus 14 discovered gaps (WFG-### in §14). This generator
 * parses those tables, joins each WF to its mapped journey/e2e spec via
 * docs/testing/coverage/workflow-test-map.json (seeded from the journey roster's
 * rubricIds), validates that every referenced spec actually exists on disk, and
 * ratchets the unmapped WF + WFG gaps against workflow.allowlist.json.
 */

import { describe, expect, test } from 'bun:test';
import {
  parseWorkflowTables,
  parseCrossModuleFlows,
  parseGaps,
  isCrossModule,
  loadWorkflowTestMap,
  validateTestMap,
  buildRows,
  deriveGaps,
  type WorkflowRow,
} from './workflow-matrix';
import { listFiles } from './lib/scan-tests';
import { loadAllowlist, ratchet } from './lib/ratchet';

// ─────────────────────────────────────────────────────────────────────────────
// (a) WORKFLOW_MAP table parsing
// ─────────────────────────────────────────────────────────────────────────────

describe('parseWorkflowTables', () => {
  test('parses a `| WF-### | name | ... |` row into id + name', () => {
    const md = `
## §2 Explicit PRD Workflows

| WF-ID | Name | PRD Ref | Module | Type |
|-------|------|---------|--------|------|
| WF-001 | User Login (email+password) | FR1 | auth | Core |
| WF-005 | Patient registration | FR2 | dental-patient | Core |
`;
    const wfs = parseWorkflowTables(md);
    expect(wfs.get('WF-001')?.name).toBe('User Login (email+password)');
    expect(wfs.get('WF-005')?.name).toBe('Patient registration');
  });

  test('captures perio (WF-P0#) and EMR-consultation (WF-EMRC-###) ids', () => {
    const md = `
| WF-ID | Name | Actor | Priority |
|-------|------|-------|----------|
| WF-P01 | Create perio chart for a visit | Dentist | P1 |

| WF-ID | Name |
|-------|------|
| WF-EMRC-001 | Provider creates a draft consultation note for a patient. |
`;
    const wfs = parseWorkflowTables(md);
    expect(wfs.has('WF-P01')).toBe(true);
    expect(wfs.has('WF-EMRC-001')).toBe(true);
    expect(wfs.get('WF-EMRC-001')?.name).toContain('draft consultation note');
  });

  test('de-duplicates a WF id that appears in several tables (first name wins)', () => {
    const md = `
| WF-ID | Name | PRD Ref | Module | Type |
|-------|------|---------|--------|------|
| WF-007 | Appointment check-in → visit creation | FR3, BR-004 | dental-scheduling, dental-visit | Core |

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Check-in | Staff Full, Dentist | WF-007 | BR-004, BR-001 |
`;
    const wfs = parseWorkflowTables(md);
    // WF-007's canonical name comes from §2 (the first, name-bearing table).
    expect(wfs.get('WF-007')?.name).toBe('Appointment check-in → visit creation');
    // counted once, not twice
    const all = [...wfs.keys()].filter((k) => k === 'WF-007');
    expect(all.length).toBe(1);
  });

  test('does not treat a struck WF-### prose mention as a row', () => {
    // §3 op-tables have WF in column 3, not column 1 — still captured by id,
    // but a bare prose line "~~WF-EMRC-004~~ STRUCK" is NOT a pipe row.
    const md = `
| WF-EMRC-004 | ~~Provider amends...~~ STRUCK (V-EMR-001) — no amend endpoint. |
`;
    const wfs = parseWorkflowTables(md);
    expect(wfs.get('WF-EMRC-004')?.name).toContain('STRUCK');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) cross-module flows (§12)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseCrossModuleFlows / isCrossModule', () => {
  const md = `
## §12 Cross-Module Flows

| WF-ID | Flow Name | Modules Involved | Handoff Type | Data Passed |
|-------|-----------|-----------------|-------------|-------------|
| WF-089 | Check-in flow | dental-scheduling → dental-visit | Sync API | appointmentId → visitId |
| WF-090 | Visit → Invoice creation | dental-visit → dental-billing | Sync API | visitId, treatmentIds |
| WF-104 | Email notifications | notifs → email | Async pg-boss | recipientPersonId, template |
`;

  test('collects exactly the §12 ids as cross-module', () => {
    const xs = parseCrossModuleFlows(md);
    expect(xs.has('WF-089')).toBe(true);
    expect(xs.has('WF-090')).toBe(true);
    expect(xs.has('WF-104')).toBe(true);
  });

  test('isCrossModule reflects §12 membership', () => {
    const xs = parseCrossModuleFlows(md);
    expect(isCrossModule('WF-089', xs)).toBe(true);
    expect(isCrossModule('WF-001', xs)).toBe(false);
  });

  test('the real WORKFLOW_MAP has exactly the 16 documented cross-module flows', () => {
    const md = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '../../docs/product/WORKFLOW_MAP.md'),
      'utf8',
    );
    const xs = parseCrossModuleFlows(md);
    // §12 lists WF-089 … WF-104 = 16 flows.
    expect(xs.size).toBe(16);
    expect(xs.has('WF-089')).toBe(true);
    expect(xs.has('WF-104')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) gaps (§14 WFG-###)
// ─────────────────────────────────────────────────────────────────────────────

describe('parseGaps', () => {
  test('collects WFG-### ids from the §14 gap table', () => {
    const md = `
## §14 Discovered Gaps

| Gap ID | Type | Description | Impact | Linked BRs |
|--------|------|-------------|--------|-----------|
| WFG-001 | Missing workflow | BR-005 auto-discard ... | MEDIUM | BR-005 |
| WFG-014 | Missing search | Lab orders ... | LOW | — |
`;
    const gaps = parseGaps(md);
    expect(gaps.has('WFG-001')).toBe(true);
    expect(gaps.has('WFG-014')).toBe(true);
  });

  test('the real WORKFLOW_MAP has 15 WFG gaps', () => {
    const md = require('node:fs').readFileSync(
      require('node:path').join(__dirname, '../../docs/product/WORKFLOW_MAP.md'),
      'utf8',
    );
    const gaps = parseGaps(md);
    expect(gaps.size).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) test-map loading + validation (dangling spec detection)
// ─────────────────────────────────────────────────────────────────────────────

describe('loadWorkflowTestMap / validateTestMap', () => {
  test('a mapping that points at a real journey spec is not dangling', () => {
    const realJourney = listFiles('journeys').find((f) => f.endsWith('.journey.spec.ts'));
    expect(realJourney).toBeTruthy();
    const map = {
      'WF-006': { journeySpec: realJourney!, status: 'covered' as const },
    };
    const { dangling } = validateTestMap(map);
    expect(dangling).toEqual([]);
  });

  test('a mapping that points at a non-existent spec is flagged dangling', () => {
    const map = {
      'WF-999': { journeySpec: 'apps/dentalemon/tests/e2e/journeys/zz-nope.journey.spec.ts', status: 'covered' as const },
    };
    const { dangling } = validateTestMap(map);
    expect(dangling.length).toBe(1);
    expect(dangling[0]?.wfId).toBe('WF-999');
  });

  test('an e2eSpec reference is validated against the e2e corpus', () => {
    const realE2e = listFiles('e2e').find((f) => f.endsWith('.spec.ts'));
    const map = {
      'WF-023': { e2eSpec: realE2e!, status: 'covered' as const },
      'WF-024': { e2eSpec: 'apps/dentalemon/tests/e2e/does-not-exist.spec.ts', status: 'covered' as const },
    };
    const { dangling } = validateTestMap(map);
    expect(dangling.map((d) => d.wfId)).toEqual(['WF-024']);
  });

  test('the shipped workflow-test-map.json has no dangling spec references', () => {
    const map = loadWorkflowTestMap();
    const { dangling } = validateTestMap(map);
    expect(dangling).toEqual([]);
  });

  test('every "covered" entry in the shipped map has an existing spec', () => {
    const map = loadWorkflowTestMap();
    for (const [wfId, entry] of Object.entries(map)) {
      if (entry.status !== 'covered') continue;
      const spec = entry.journeySpec ?? entry.e2eSpec;
      expect(spec, `${wfId} is "covered" but names no spec`).toBeTruthy();
    }
    const { dangling } = validateTestMap(map);
    expect(dangling).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) row building (the joined matrix)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildRows', () => {
  test('marks a mapped+existing WF as covered with specExists=true', () => {
    const realJourney = listFiles('journeys').find((f) => f.endsWith('.journey.spec.ts'))!;
    const wfs = new Map([['WF-006', { name: 'Appointment booking' }]]);
    const xs = new Set<string>();
    const map = { 'WF-006': { journeySpec: realJourney, status: 'covered' as const } };
    const rows = buildRows(wfs, xs, map);
    const row = rows.find((r) => r.wfId === 'WF-006')!;
    expect(row.status).toBe('covered');
    expect(row.mappedSpec).toBe(realJourney);
    expect(row.specExists).toBe(true);
  });

  test('an unmapped WF defaults to a gap row with no spec', () => {
    const wfs = new Map([['WF-050', { name: 'Dismiss treatment' }]]);
    const rows = buildRows(wfs, new Set<string>(), {});
    const row = rows.find((r) => r.wfId === 'WF-050')!;
    expect(row.status).toBe('gap');
    expect(row.mappedSpec).toBeUndefined();
    expect(row.specExists).toBe(false);
  });

  test('a mapped-but-dangling WF is covered-in-intent but specExists=false', () => {
    const wfs = new Map([['WF-006', { name: 'Appointment booking' }]]);
    const map = {
      'WF-006': { journeySpec: 'apps/dentalemon/tests/e2e/journeys/nope.journey.spec.ts', status: 'covered' as const },
    };
    const rows = buildRows(wfs, new Set<string>(), map);
    const row = rows.find((r) => r.wfId === 'WF-006')!;
    expect(row.specExists).toBe(false);
  });

  test('cross-module flag is carried onto the row from §12 membership', () => {
    const wfs = new Map([
      ['WF-089', { name: 'Check-in flow' }],
      ['WF-001', { name: 'User Login' }],
    ]);
    const xs = new Set(['WF-089']);
    const rows = buildRows(wfs, xs, {});
    expect(rows.find((r) => r.wfId === 'WF-089')!.crossModule).toBe(true);
    expect(rows.find((r) => r.wfId === 'WF-001')!.crossModule).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (e2) gap derivation feeds the ratchet (incl. §14 WFG gaps)
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveGaps', () => {
  test('a truly-covered row is NOT a gap; an uncovered one IS', () => {
    const rows: WorkflowRow[] = [
      { wfId: 'WF-006', name: 'Booking', crossModule: false, mappedSpec: 'x.spec.ts', specExists: true, status: 'covered' },
      { wfId: 'WF-050', name: 'Dismiss', crossModule: false, specExists: false, status: 'gap' },
    ];
    const gaps = deriveGaps(rows);
    expect(gaps.map((g) => g.id)).toEqual(['WF-050']);
  });

  test('a deferred row is still a tracked gap (must be allowlisted, not silently OK)', () => {
    const rows: WorkflowRow[] = [
      { wfId: 'WF-P05', name: 'Print perio', crossModule: false, specExists: false, status: 'deferred' },
    ];
    const gaps = deriveGaps(rows);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]?.reason).toBe('deferred');
  });

  test('§14 WFG gaps are folded into the gap stream so the allowlist covers them', () => {
    const rows: WorkflowRow[] = [
      { wfId: 'WF-006', name: 'Booking', crossModule: false, mappedSpec: 'x.spec.ts', specExists: true, status: 'covered' },
    ];
    const gaps = deriveGaps(rows, new Set(['WFG-001', 'WFG-007']));
    expect(gaps.map((g) => g.id).sort()).toEqual(['WFG-001', 'WFG-007']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) end-to-end: the real generator output is internally consistent
// ─────────────────────────────────────────────────────────────────────────────

describe('end-to-end against the real WORKFLOW_MAP', () => {
  const md = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../../docs/product/WORKFLOW_MAP.md'),
    'utf8',
  );

  test('parses well over the 44 explicit PRD workflows', () => {
    const wfs = parseWorkflowTables(md);
    // §2 alone has WF-001..WF-044; the op-tables/journeys add the inferred ones.
    expect(wfs.size).toBeGreaterThanOrEqual(44);
  });

  test('every covered row in the real matrix names a spec that exists', () => {
    const wfs = parseWorkflowTables(md);
    const xs = parseCrossModuleFlows(md);
    const map = loadWorkflowTestMap();
    const rows: WorkflowRow[] = buildRows(wfs, xs, map);
    for (const r of rows) {
      if (r.status === 'covered') {
        expect(r.mappedSpec, `${r.wfId} covered but unmapped`).toBeTruthy();
        expect(r.specExists, `${r.wfId} covered but spec missing: ${r.mappedSpec}`).toBe(true);
      }
    }
  });

  test('the shipped allowlist clears the ratchet (no new, un-allowlisted gaps)', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const wfs = parseWorkflowTables(md);
    const xs = parseCrossModuleFlows(md);
    const wfg = parseGaps(md);
    const map = loadWorkflowTestMap();
    const rows = buildRows(wfs, xs, map);
    const gaps = deriveGaps(rows, wfg);
    const allowlist = loadAllowlist(
      path.join(__dirname, '../../docs/testing/coverage/workflow.allowlist.json'),
    );
    const result = ratchet(gaps, allowlist);
    expect(result.newGaps.map((g) => g.id)).toEqual([]);
    expect(result.ok).toBe(true);
    // sanity: the WORKFLOW_MAP gives us 85 WF + 15 WFG; the gate is non-trivial.
    expect(gaps.length).toBeGreaterThan(14);
    // every allowlist id should still correspond to a current gap (no rot).
    expect(result.resolved).toEqual([]);
  });
});
