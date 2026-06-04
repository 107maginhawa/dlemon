/**
 * DB-backed tests for the built-in `appointment` retention target (V-DG-003).
 *
 * DATA_GOVERNANCE §2 declares Appointment retention as "1 year from date" — the
 * appointment DATE — so eligibility MUST filter on `scheduledAt`, not createdAt.
 * These hit the REAL dental_appointment table (cloned test DB) to prove the
 * tenant/branch-scoped eligibility query, the legal-hold exclusion, and the
 * soft-archive (set deletedAt) actually wire to the schema — a fake target
 * can't catch a wrong join, a wrong cutoff column, or a missing deletedAt.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { dentalAppointments } from '@/handlers/dental-scheduling/repos/dental-appointment.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { placeLegalHold } from '@/handlers/dental-legalhold/legal-hold-service';
import { RETENTION_TARGETS } from './retention-targets';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const target = RETENTION_TARGETS['appointment']!;
const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;

// Deterministic timestamps (no Date.now coupling in assertions).
const OLD = new Date('2010-01-01T00:00:00.000Z'); // appointment date well before cutoff
const RECENT = new Date('2025-06-01T00:00:00.000Z'); // appointment date after cutoff
const CUTOFF = new Date('2020-01-01T00:00:00.000Z');

const APPT_OLD = 'b1000000-0000-4000-8000-000000000001';
const APPT_RECENT = 'b1000000-0000-4000-8000-000000000002';

const baseRow = {
  patientId: CHAIN_IDS.PATIENT_1,
  dentistMemberId: CHAIN_IDS.MEMBERSHIP_1,
  branchId: CHAIN_IDS.BRANCH_1,
  durationMinutes: 30,
  serviceType: 'cleaning',
};

describe('appointment retention target (DB-backed, V-DG-003)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    await seedClinicalChain(db, { visits: 0 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  async function insert(id: string, scheduledAt: Date): Promise<void> {
    await db.insert(dentalAppointments).values({ ...baseRow, id, scheduledAt });
  }

  test('findEligible filters on scheduledAt (the appointment DATE), not createdAt', async () => {
    // Both rows are created NOW, but their appointment dates straddle the cutoff.
    // A createdAt-based filter would (wrongly) match neither; a scheduledAt
    // filter matches only the old appointment.
    await insert(APPT_OLD, OLD);
    await insert(APPT_RECENT, RECENT);

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: CHAIN_IDS.BRANCH_1,
      cutoff: CUTOFF,
    });

    expect(eligible.map((e) => e.id)).toEqual([APPT_OLD]);
    expect(eligible[0]!.legalHold).toBe(false);
  });

  test('findEligible (tenant-wide, branchId null) resolves through the branch→org join', async () => {
    await insert(APPT_OLD, OLD);

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: null,
      cutoff: CUTOFF,
    });
    expect(eligible.map((e) => e.id)).toContain(APPT_OLD);

    // A different tenant sees nothing.
    const otherTenant = await target.findEligible(db, {
      tenantId: '00000000-0000-4000-8000-0000000000ff',
      branchId: null,
      cutoff: CUTOFF,
    });
    expect(otherTenant).toHaveLength(0);
  });

  test('an old appointment becomes legal-held once its patient Person is held', async () => {
    await insert(APPT_OLD, OLD);
    const opts = { tenantId: CHAIN_IDS.ORG, branchId: CHAIN_IDS.BRANCH_1, cutoff: CUTOFF };

    const before = await target.findEligible(db, opts);
    expect(before.find((c) => c.id === APPT_OLD)?.legalHold).toBe(false);

    const [pt] = await db.select({ person: patients.person }).from(patients).where(eq(patients.id, CHAIN_IDS.PATIENT_1));
    await placeLegalHold(db, noopLogger, {
      tenantId: CHAIN_IDS.ORG,
      subjectPersonId: pt!.person,
      name: 'hold',
      reason: 'litigation',
      initiatedBy: CHAIN_IDS.OWNER_PERSON,
    });

    const after = await target.findEligible(db, opts);
    expect(after.find((c) => c.id === APPT_OLD)?.legalHold).toBe(true);
  });

  test('archive soft-deletes (sets deletedAt) and excludes them from later eligibility', async () => {
    await insert(APPT_OLD, OLD);

    const count = await target.archive(db, [APPT_OLD]);
    expect(count).toBe(1);

    const [row] = await db.select().from(dentalAppointments).where(eq(dentalAppointments.id, APPT_OLD));
    expect(row!.deletedAt).not.toBeNull(); // soft-archived, NOT hard-deleted

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: CHAIN_IDS.BRANCH_1,
      cutoff: CUTOFF,
    });
    expect(eligible.map((e) => e.id)).not.toContain(APPT_OLD);
  });

  test('archive of an empty id list is a no-op', async () => {
    expect(await target.archive(db, [])).toBe(0);
  });

  test('the appointment target is NOT protected (it is enforceable)', async () => {
    expect(target.protected).toBeUndefined();
  });
});
