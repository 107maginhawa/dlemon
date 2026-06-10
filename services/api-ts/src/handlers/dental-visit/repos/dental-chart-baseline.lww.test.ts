/**
 * dental-chart-baseline.lww.test.ts — SL-02 / F-G03 (P1 data-loss)
 *
 * The patient-baseline per-tooth merge was incoming-array-wins with NO clock: a
 * stale offline write (a device that hadn't seen a newer edit) that syncs LATER
 * clobbers the newer tooth state. F-G03: merge must be clock-aware LWW — a tooth
 * carrying a LOWER monotonic clock than the one already in the baseline must NOT
 * overwrite it (mirror cadence lww_merge_field: higher clock wins).
 *
 * Backward-compatible: when a clock is absent on either side the merge keeps the
 * current incoming-wins behavior. CHART-BR-002 (existing-tier protection) stays the
 * top guard, above the clock comparison.
 *
 * Tests the REAL repo method against the DB (the prior baseline test asserted a
 * stale inline copy of the merge, which is a fiction-copy smell — avoided here).
 *
 * RED-proof: a stale (lower-clock) incoming tooth overwrites the newer baseline
 * tooth before the fix.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { DentalChartBaselineRepository } from './dental-chart-baseline.repo';
import type { ToothChartState } from './dental-chart.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

// Suite-unique tag: 105.
const USER = '00000000-0000-4000-8000-000000105001';
const ORG = 'ea000000-0000-4000-8000-000000105001';
const BRANCH = 'ba000000-0000-4000-8000-000000105001';
const PERSON = 'fa000000-0000-4000-8000-000000105001';
const PATIENT = 'aa000000-0000-4000-8000-000000105001';
const VISIT_A = '11111111-0000-4000-8000-000000105001';
const VISIT_B = '22222222-0000-4000-8000-000000105001';

beforeAll(async () => {
  const { dentalOrganizations } = await import('@/handlers/dental-org/repos/organization.schema');
  const { dentalBranches } = await import('@/handlers/dental-org/repos/branch.schema');
  const { persons } = await import('@/handlers/person/repos/person.schema');
  const { patients } = await import('@/handlers/patient/repos/patient.schema');
  await db.insert(dentalOrganizations).values({ id: ORG, name: 'LWW Clinic', tier: 'solo', ownerPersonId: USER, countryCode: 'PH', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(dentalBranches).values({ id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(persons).values({ id: PERSON, firstName: 'LWW', lastName: 'Patient', createdBy: USER, updatedBy: USER }).onConflictDoNothing();
  await db.insert(patients).values({ id: PATIENT, person: PERSON, preferredBranchId: BRANCH, createdBy: USER, updatedBy: USER }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_patient_chart_baseline WHERE patient_id = ${PATIENT}`);
});

async function baselineTooth(toothNumber: number): Promise<ToothChartState | undefined> {
  const repo = new DentalChartBaselineRepository(db);
  const b = await repo.findByPatient(PATIENT);
  return (b?.teeth as ToothChartState[] | undefined)?.find(t => t.toothNumber === toothNumber);
}

describe('SL-02 / F-G03 — patient-baseline merge is clock-aware LWW', () => {
  test('a stale (lower-clock) incoming tooth does NOT clobber the newer baseline tooth', async () => {
    const repo = new DentalChartBaselineRepository(db);
    // Newer edit lands first: tooth #14 = crown at clock 10.
    await repo.mergeVisitChart(PATIENT, VISIT_A, [{ toothNumber: 14, state: 'crown', clock: 10 }], USER);
    // A stale offline device (clock 3, never saw the crown) syncs later: tooth #14 = caries.
    await repo.mergeVisitChart(PATIENT, VISIT_B, [{ toothNumber: 14, state: 'caries', clock: 3 }], USER);

    const t14 = await baselineTooth(14);
    expect(t14?.state).toBe('crown');  // RED before: 'caries' (stale clobber)
    expect(t14?.clock).toBe(10);
  });

  test('a newer (higher-clock) incoming tooth applies', async () => {
    const repo = new DentalChartBaselineRepository(db);
    await repo.mergeVisitChart(PATIENT, VISIT_A, [{ toothNumber: 21, state: 'healthy', clock: 5 }], USER);
    await repo.mergeVisitChart(PATIENT, VISIT_B, [{ toothNumber: 21, state: 'filled', clock: 9 }], USER);

    const t21 = await baselineTooth(21);
    expect(t21?.state).toBe('filled');
    expect(t21?.clock).toBe(9);
  });

  test('no-clock writes preserve incoming-wins (backward compatible)', async () => {
    const repo = new DentalChartBaselineRepository(db);
    await repo.mergeVisitChart(PATIENT, VISIT_A, [{ toothNumber: 36, state: 'healthy' }], USER);
    await repo.mergeVisitChart(PATIENT, VISIT_B, [{ toothNumber: 36, state: 'crown' }], USER);

    const t36 = await baselineTooth(36);
    expect(t36?.state).toBe('crown');
  });

  test('CHART-BR-002 still wins over clock: a higher-clock non-existing entry cannot overwrite an existing-tier baseline tooth', async () => {
    const repo = new DentalChartBaselineRepository(db);
    await repo.mergeVisitChart(PATIENT, VISIT_A, [{ toothNumber: 46, state: 'filled', clock: 1, entryClassification: 'existing' }], USER);
    // Higher clock but a treatment_plan/condition entry must NOT overwrite the protected existing tooth.
    await repo.mergeVisitChart(PATIENT, VISIT_B, [{ toothNumber: 46, state: 'caries', clock: 99, entryClassification: 'condition' }], USER);

    const t46 = await baselineTooth(46);
    expect(t46?.state).toBe('filled');           // protected
    expect(t46?.entryClassification).toBe('existing');
  });
});
