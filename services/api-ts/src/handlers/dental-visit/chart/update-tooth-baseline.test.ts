/**
 * update-tooth-baseline.test.ts — SL-03 / B-G1 (P1 data-loss, live today)
 *
 * The odontogram is a living document: every chart write must merge into the
 * patient-level baseline so the next visit inherits the cumulative dentition
 * (CHART-BR-002 / WF-032 carry-over). `upsertDentalChart` does this; the
 * per-surface PATCH path (`updateTooth`) did NOT — so a single-tooth edit was
 * silently dropped from the baseline and never carried forward.
 *
 * RED-proof: before the fix, `updateTooth` never calls `mergeVisitChart`, so
 * `DentalChartBaselineRepository.findByPatient` is null after a PATCH and the
 * edited tooth never reaches the next visit.
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { AppError } from '@/core/errors';
import { createDatabase } from '@/core/database';
import { openTestTx } from '@/core/test-tx';
import { seedAuditWorkspace, AUDIT_IDS } from '@/tests/fixtures/audit-workspace-fixtures';
import { updateTooth } from './updateTooth';
import { chartFromBaseline } from './chart-carryover';
import { DentalChartBaselineRepository } from '../repos/dental-chart-baseline.repo';
import type { ToothChartState } from '../repos/dental-chart.schema';
import { UpdateToothParams, UpdateToothBody } from '@/generated/openapi/validators';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Committed DB — used only to seed the FK targets (visit/chart/patient) once.
const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const VISIT_ACTIVE = AUDIT_IDS.visitActive; // active visit with a seeded chart
const PATIENT = AUDIT_IDS.patient;
const USER = AUDIT_IDS.user;

beforeAll(async () => {
  await seedAuditWorkspace(db);
});

const ve = (result: any, c: any) => {
  if (!result.success) return c.json({ error: 'Validation failed', issues: result.error.issues }, 400);
};

function buildApp(txDb: NodePgDatabase) {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message, code: err.code }, err.statusCode as any);
    return c.json({ error: String(err.message) }, 500);
  });
  app.use('*', async (c, next) => {
    const ctx = c as any;
    ctx.set('database', txDb);
    ctx.set('logger', { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });
    ctx.set('user', { id: USER, email: 'audit@clinic.com' });
    ctx.set('session', { id: 'utb-session', userId: USER });
    await next();
  });
  app.patch(
    '/dental/visits/:visitId/chart/teeth/:toothNumber',
    zValidator('param', UpdateToothParams, ve),
    zValidator('json', UpdateToothBody, ve),
    updateTooth as any,
  );
  return app;
}

async function patchTooth(app: Hono, toothNumber: number, body: Record<string, unknown>) {
  return app.request(`/dental/visits/${VISIT_ACTIVE}/chart/teeth/${toothNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('SL-03 / B-G1 — per-tooth PATCH merges into the patient baseline', () => {
  let txDb: NodePgDatabase;
  let baselineRepo: DentalChartBaselineRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: tx, rollback } = await openTestTx();
    txDb = tx;
    baselineRepo = new DentalChartBaselineRepository(tx);
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('a per-tooth PATCH writes the edited tooth into the patient baseline', async () => {
    const app = buildApp(txDb);

    const res = await patchTooth(app, 8, { state: 'crown' });
    expect(res.status).toBe(200);

    // RED before the fix: updateTooth never merged the baseline → null.
    const baseline = await baselineRepo.findByPatient(PATIENT);
    expect(baseline).not.toBeNull();
    const tooth8 = baseline!.teeth.find((t) => t.toothNumber === 8);
    expect(tooth8).toBeTruthy();
    expect(tooth8!.state).toBe('crown');
  });

  test('a PATCH-edited tooth carries forward to the next visit via chartFromBaseline', async () => {
    const app = buildApp(txDb);

    await patchTooth(app, 8, { state: 'crown', conditionCode: 'K02.0' });

    const baseline = await baselineRepo.findByPatient(PATIENT);
    expect(baseline).not.toBeNull();

    const nextVisitChart = chartFromBaseline(baseline!, { id: 'next-visit', patientId: PATIENT });
    const carried = nextVisitChart.teeth.find((t) => t.toothNumber === 8);
    expect(carried).toBeTruthy();
    expect(carried!.state).toBe('crown');
    expect(carried!.conditionCode).toBe('K02.0');
  });

  test('CHART-BR-002: a treatment_plan PATCH does not overwrite an existing-classified baseline tooth', async () => {
    const app = buildApp(txDb);

    // Establish an `existing` baseline entry for tooth 8 (prior-visit restoration).
    await baselineRepo.mergeVisitChart(
      PATIENT,
      VISIT_ACTIVE,
      [{ toothNumber: 8, state: 'healthy', entryClassification: 'existing' }] as ToothChartState[],
      USER,
    );

    // A treatment-plan edit on the same tooth must NOT clobber the baseline entry.
    const res = await patchTooth(app, 8, { state: 'filled', entryClassification: 'treatment_plan' });
    expect(res.status).toBe(200);

    const baseline = await baselineRepo.findByPatient(PATIENT);
    const tooth8 = baseline!.teeth.find((t) => t.toothNumber === 8);
    expect(tooth8!.entryClassification).toBe('existing');
    expect(tooth8!.state).toBe('healthy');
  });
});
