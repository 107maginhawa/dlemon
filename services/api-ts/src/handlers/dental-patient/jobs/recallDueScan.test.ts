/**
 * recallDueScan tests (P1-24) — the nightly cron that surfaces due recalls.
 *
 * Real DB. recallDueScan is a read-mostly observability pass: it counts recurring
 * pending recalls whose dueDate has arrived and logs when any are due. It mutates
 * nothing and must never throw (failures are swallowed so the scheduler stays up).
 *
 * Behaviours locked:
 *   - a due recurring pending recall is counted and logged
 *   - a not-yet-due recurring recall is a candidate but contributes 0 to the count
 *   - a NON-recurring (intervalMonths null) recall is excluded entirely
 *   - a repo failure is logged at error and swallowed (no throw)
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql, eq } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import type { Logger } from '@/types/logger';
import { recallDueScanJob } from './recallDueScan';
import { dentalRecalls } from '../repos/recall.schema';
import { dentalOrganizations } from '@/handlers/dental-org/repos/organization.schema';
import { dentalBranches } from '@/handlers/dental-org/repos/branch.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';

const db = createDatabase({ url: process.env['DATABASE_URL'] ?? 'postgres://postgres:password@localhost:5432/monobase_test' });

const ACTOR = '00000000-0000-1000-8000-0000000000d1';
const PERSON_ID = 'a0000000-0000-1000-8000-0000000000d1';
const PATIENT_ID = 'a0000000-0000-1000-8000-0000000000d2';
const ORG_ID = 'f0000000-0000-1000-8000-0000000000d1';
const BRANCH_ID = 'b0000000-0000-1000-8000-0000000000d1';

function spyLogger() {
  const calls = { info: [] as unknown[][], error: [] as unknown[][] };
  const logger = {
    debug() {}, warn() {},
    info: (...a: unknown[]) => { calls.info.push(a); },
    error: (...a: unknown[]) => { calls.error.push(a); },
  } as unknown as Logger;
  return { logger, calls };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3_600_000).toISOString().slice(0, 10);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 3_600_000).toISOString().slice(0, 10);

async function seedRecall(values: { dueDate: string; status?: string; intervalMonths?: number | null }) {
  const [row] = await db.insert(dentalRecalls).values({
    patientId: PATIENT_ID,
    type: 'cleaning',
    dueDate: values.dueDate,
    status: (values.status ?? 'pending') as 'pending',
    intervalMonths: values.intervalMonths === undefined ? 6 : values.intervalMonths,
    createdBy: ACTOR,
    updatedBy: ACTOR,
  }).returning();
  return row!;
}

beforeAll(async () => {
  await db.insert(dentalOrganizations).values({
    id: ORG_ID, name: 'Recall Scan Clinic', tier: 'solo', ownerPersonId: ACTOR,
    countryCode: 'PH', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(dentalBranches).values({
    id: BRANCH_ID, organizationId: ORG_ID, name: 'Recall Scan Branch', timezone: 'Asia/Manila',
    createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(persons).values({
    id: PERSON_ID, firstName: 'Scan', lastName: 'Patient', createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
  await db.insert(patients).values({
    id: PATIENT_ID, person: PERSON_ID, preferredBranchId: BRANCH_ID, createdBy: ACTOR, updatedBy: ACTOR,
  }).onConflictDoNothing();
});

afterEach(async () => {
  await db.execute(sql`DELETE FROM dental_recall WHERE patient_id = ${PATIENT_ID}`);
});

describe('recallDueScanJob (P1-24)', () => {
  test('counts and logs a due recurring pending recall', async () => {
    await seedRecall({ dueDate: daysAgo(1), status: 'pending', intervalMonths: 6 });
    const { logger, calls } = spyLogger();

    await recallDueScanJob({ db, logger, jobId: 'scan-1' } as never);

    expect(calls.error.length).toBe(0);
    expect(calls.info.length).toBe(1);
    const payload = calls.info[0]![0] as { due: number; recurring: number };
    expect(payload.due).toBe(1);
  });

  test('a not-yet-due recurring recall contributes 0 (no info log)', async () => {
    await seedRecall({ dueDate: daysAhead(30), status: 'pending', intervalMonths: 6 });
    const { logger, calls } = spyLogger();

    await recallDueScanJob({ db, logger, jobId: 'scan-2' } as never);

    expect(calls.info.length).toBe(0); // candidate exists but dueCount is 0
  });

  test('a non-recurring (intervalMonths null) past-due recall is excluded entirely', async () => {
    await seedRecall({ dueDate: daysAgo(5), status: 'pending', intervalMonths: null });
    const { logger, calls } = spyLogger();

    await recallDueScanJob({ db, logger, jobId: 'scan-3' } as never);

    expect(calls.info.length).toBe(0); // filtered out by `intervalMonths IS NOT NULL`
  });

  test('a repo failure is logged at error and swallowed (never throws)', async () => {
    const { logger, calls } = spyLogger();

    // A bogus db makes RecallRepository.findRecurringPending throw inside the job.
    await expect(
      recallDueScanJob({ db: {}, logger, jobId: 'scan-err' } as never),
    ).resolves.toBeUndefined();

    expect(calls.error.length).toBe(1);
  });
});
