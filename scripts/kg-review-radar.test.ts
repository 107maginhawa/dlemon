/**
 * kg-review-radar.test.ts — TDD for the UA_KG_UPGRADE U3 advisory review radar.
 *
 * Run from repo root:  bun test ./scripts/kg-review-radar.test.ts
 *
 * The class this closes: a diff that changes a MAPPED business flow which has no
 * covering goal-state journey ships unnoticed. The radar maps each changed file to
 * its domain-graph step → flow, then cross-checks the flow against the journey
 * roster via an explicit coverage map. It is ADVISORY (a comment), never blocking.
 *
 * Both functions are pure (inputs injected) so these tests are deterministic.
 */

import { describe, expect, test } from 'bun:test';
import {
  affectedFlows,
  coverageReport,
  type DomainGraph,
} from './kg-review-radar';

const GRAPH: DomainGraph = {
  nodes: [
    { id: 'flow:start-visit', type: 'flow', name: 'Start Clinical Visit' },
    { id: 'flow:capture-imaging', type: 'flow', name: 'Capture & upload imaging' },
    {
      id: 'step:start-visit:post-draft',
      type: 'step',
      name: 'POST create draft visit',
      filePath: 'apps/dentalemon/src/routes/_workspace/$patientId.tsx',
    },
    {
      id: 'step:start-visit:create-handler',
      type: 'step',
      name: 'createDentalVisit handler',
      filePath: 'services/api-ts/src/handlers/dental-visit/createDentalVisit.ts',
    },
    {
      id: 'step:capture-imaging:upload',
      type: 'step',
      name: 'Direct binary upload',
      filePath: 'apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx',
    },
  ],
  edges: [
    { source: 'flow:start-visit', target: 'step:start-visit:post-draft', type: 'flow_step' },
    { source: 'flow:start-visit', target: 'step:start-visit:create-handler', type: 'flow_step' },
    { source: 'flow:capture-imaging', target: 'step:capture-imaging:upload', type: 'flow_step' },
  ],
};

describe('affectedFlows — map a diff to the flows it touches', () => {
  test('a changed FE file maps to its flow via the step filePath', () => {
    const found = affectedFlows(['apps/dentalemon/src/routes/_workspace/$patientId.tsx'], GRAPH);
    expect(found.map((f) => f.flowId)).toEqual(['flow:start-visit']);
    expect(found[0]!.flowName).toBe('Start Clinical Visit');
    expect(found[0]!.file).toBe('apps/dentalemon/src/routes/_workspace/$patientId.tsx');
  });

  test('a changed BE handler maps to the same flow (FE↔BE)', () => {
    const found = affectedFlows(['services/api-ts/src/handlers/dental-visit/createDentalVisit.ts'], GRAPH);
    expect(found.map((f) => f.flowId)).toEqual(['flow:start-visit']);
  });

  test('a changed file with no mapped step yields no flows', () => {
    expect(affectedFlows(['services/api-ts/src/core/logger.ts'], GRAPH)).toEqual([]);
  });

  test('multiple changed files dedupe to distinct affected flows', () => {
    const found = affectedFlows(
      [
        'apps/dentalemon/src/routes/_workspace/$patientId.tsx',
        'services/api-ts/src/handlers/dental-visit/createDentalVisit.ts',
        'apps/dentalemon/src/features/imaging/components/imaging-workspace.tsx',
      ],
      GRAPH,
    );
    expect(found.map((f) => f.flowId).sort()).toEqual(['flow:capture-imaging', 'flow:start-visit']);
  });
});

describe('coverageReport — cross-check affected flows against the journey roster', () => {
  const JOURNEYS = new Set(['J21', 'J03', 'J04']);

  test('a flow mapped to an EXISTING journey is reported covered', () => {
    const rep = coverageReport(['flow:start-visit'], { 'flow:start-visit': ['J21'] }, JOURNEYS);
    expect(rep[0]!.covered).toEqual(['J21']);
    expect(rep[0]!.uncovered).toBe(false);
  });

  test('a flow with NO mapping is flagged uncovered (the headline signal)', () => {
    const rep = coverageReport(['flow:capture-imaging'], {}, JOURNEYS);
    expect(rep[0]!.uncovered).toBe(true);
    expect(rep[0]!.covered).toEqual([]);
  });

  test('a mapping pointing only at a NON-existent journey id is uncovered (stale map)', () => {
    const rep = coverageReport(['flow:start-visit'], { 'flow:start-visit': ['J99'] }, JOURNEYS);
    expect(rep[0]!.uncovered).toBe(true);
    expect(rep[0]!.covered).toEqual([]);
  });

  test('mixed roster: only uncovered flows are distinguishable', () => {
    const rep = coverageReport(
      ['flow:start-visit', 'flow:capture-imaging'],
      { 'flow:start-visit': ['J21'] },
      JOURNEYS,
    );
    const byId = Object.fromEntries(rep.map((r) => [r.flowId, r.uncovered]));
    expect(byId['flow:start-visit']).toBe(false);
    expect(byId['flow:capture-imaging']).toBe(true);
  });
});
