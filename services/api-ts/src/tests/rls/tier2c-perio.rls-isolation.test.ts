/**
 * RLS — Tier-2c chart-anchored perio isolation (ADR-010 gate).
 *
 * `dental_perio_tooth_reading` carries NO direct tenant column — its tenancy is
 * derived through the parent `dental_perio_chart` row (chart_id NOT NULL FK).
 * `dental_perio_chart` itself carries a direct `branch_id` and is RLS-armed
 * (P1a / 0105). The tooth-reading rows hold the most sensitive perio PHI (per-site
 * probing depths, BOP, CAL), yet were left RLS-UNARMED — a cross-tenant DB-read
 * hole that the posture gate was also blind to (the table was absent from
 * check-rls-posture.ts). Migration 0115 arms it with an EXISTS-subquery policy:
 *
 *   USING / WITH CHECK (
 *     EXISTS (SELECT 1 FROM dental_perio_chart c
 *             WHERE c.id = dental_perio_tooth_reading.chart_id
 *               AND c.branch_id = ANY (app_current_branches())))
 *
 * Because dental_perio_chart is itself RLS-armed, the subquery is also subject to
 * the chart's own policy under app_rls — both filters key off the same branch set,
 * so they compose consistently (no false visibility, no recursion). The superuser
 * baseline bypasses RLS entirely → both rows visible → zero runtime change.
 *
 * Reuses the shared registerRlsMatrix (7 assertions): a reading hung off a branch-A
 * chart and one off a branch-B chart, then assert app_rls scoped to A sees/writes
 * only A, [A,B] sees both, empty/unset scope sees neither, and an insert anchored to
 * the out-of-scope chart is rejected by WITH CHECK. Scope key is the BRANCH set
 * (resolved via the chart), so scopeKind stays the default 'branch'.
 */

import { describe, beforeAll } from 'bun:test';
import { createDatabase, type DatabaseInstance } from '@/core/database';
import {
  seedRlsBaseFixture,
  BRANCH_A, BRANCH_B, MEMBER_A, MEMBER_B,
  PATIENT_A, PATIENT_B, VISIT_A, VISIT_B, OWNER_A, OWNER_B,
} from '@/tests/helpers/rls-fixtures';
import { registerRlsMatrix } from '@/tests/helpers/rls-matrix';
import { dentalPerioCharts } from '@/handlers/dental-perio/repos/perio-chart.schema';
import { dentalPerioToothReadings } from '@/handlers/dental-perio/repos/perio-reading.schema';

const db: DatabaseInstance = createDatabase({
  url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test',
});

// Distinct '9…' prefix — no collision with the e… base fixture or the c… Tier-2a ids.
const PERIO_CHART_A = '90000001-0000-4000-8000-0000000000a0', PERIO_CHART_B = '90000001-0000-4000-8000-0000000000b0';
const READING_A = '90000002-0000-4000-8000-0000000000a0', READING_B = '90000002-0000-4000-8000-0000000000b0';

const rid = () => crypto.randomUUID();

beforeAll(async () => {
  await seedRlsBaseFixture(db);

  await db.insert(dentalPerioCharts).values([
    { id: PERIO_CHART_A, visitId: VISIT_A, patientId: PATIENT_A, branchId: BRANCH_A, examinerMemberId: MEMBER_A, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: PERIO_CHART_B, visitId: VISIT_B, patientId: PATIENT_B, branchId: BRANCH_B, examinerMemberId: MEMBER_B, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();

  await db.insert(dentalPerioToothReadings).values([
    { id: READING_A, chartId: PERIO_CHART_A, toothNumber: 19, depthBM: 4, bopBM: true, createdBy: OWNER_A, updatedBy: OWNER_A },
    { id: READING_B, chartId: PERIO_CHART_B, toothNumber: 30, depthBM: 5, bopBM: true, createdBy: OWNER_B, updatedBy: OWNER_B },
  ]).onConflictDoNothing();
});

describe('dental_perio_tooth_reading', () => registerRlsMatrix({
  db, label: 'dental_perio_tooth_reading', tenantA: BRANCH_A, tenantB: BRANCH_B, idA: READING_A, idB: READING_B,
  selectIds: (x) => x.select({ id: dentalPerioToothReadings.id }).from(dentalPerioToothReadings),
  insertIntoB: (x) => x.insert(dentalPerioToothReadings).values({ id: rid(), chartId: PERIO_CHART_B, toothNumber: 14, depthBM: 3, createdBy: OWNER_B, updatedBy: OWNER_B }),
}));
