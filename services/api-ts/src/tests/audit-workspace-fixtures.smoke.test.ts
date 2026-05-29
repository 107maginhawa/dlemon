/**
 * Smoke test: verifies seedAuditWorkspace() runs idempotently and produces
 * expected rows/statuses in the local Postgres. Audit-only; not a production test.
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { seedAuditWorkspace, AUDIT_IDS } from './fixtures/audit-workspace-fixtures';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { dentalTreatments } from '@/handlers/dental-visit/repos/treatment.schema';
import { dentalCharts } from '@/handlers/dental-visit/repos/dental-chart.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

beforeAll(async () => {
  // Run twice to confirm idempotency.
  await seedAuditWorkspace(db);
  await seedAuditWorkspace(db);
});

describe('seedAuditWorkspace smoke', () => {
  test('active + completed visits exist', async () => {
    const visits = await db
      .select({ id: dentalVisits.id, status: dentalVisits.status })
      .from(dentalVisits)
      .where(eq(dentalVisits.patientId, AUDIT_IDS.patient));
    const ids = visits.map(v => v.id);
    expect(ids).toContain(AUDIT_IDS.visitActive);
    expect(ids).toContain(AUDIT_IDS.visitCompleted);
    const active = visits.find(v => v.id === AUDIT_IDS.visitActive);
    const completed = visits.find(v => v.id === AUDIT_IDS.visitCompleted);
    expect(active?.status).toBe('active');
    expect(completed?.status).toBe('completed');
  });

  test('treatments exist at each expected status', async () => {
    const txs = await db
      .select({ id: dentalTreatments.id, status: dentalTreatments.status })
      .from(dentalTreatments)
      .where(eq(dentalTreatments.visitId, AUDIT_IDS.visitActive));
    const byId = Object.fromEntries(txs.map(t => [t.id, t.status]));
    expect(byId[AUDIT_IDS.txDiagnosed]).toBe('diagnosed');
    expect(byId[AUDIT_IDS.txPlanned]).toBe('planned');
    expect(byId[AUDIT_IDS.txPerformed]).toBe('performed');
    expect(byId[AUDIT_IDS.txVerified]).toBe('verified');
  });

  test('dental chart exists with tooth states', async () => {
    const charts = await db
      .select({ teeth: dentalCharts.teeth })
      .from(dentalCharts)
      .where(eq(dentalCharts.visitId, AUDIT_IDS.visitActive));
    expect(charts.length).toBeGreaterThan(0);
    const teeth = charts[0]!.teeth as Array<{ toothNumber: number; state: string }>;
    const t32 = teeth.find(t => t.toothNumber === 32);
    expect(t32?.state).toBe('extracted');
  });
});
