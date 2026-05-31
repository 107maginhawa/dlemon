/**
 * DB-backed tests for the built-in `attachment` retention target.
 *
 * These hit the REAL dental_attachment table (cloned test DB) to prove the
 * tenant/branch-scoped eligibility query and the soft-archive actually wire to
 * the schema — a fake target can't catch a wrong join or column name.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RETENTION_TARGETS } from './retention-targets';

const target = RETENTION_TARGETS['attachment']!;

// Deterministic timestamps (no Date.now coupling in assertions).
const OLD = new Date('2010-01-01T00:00:00.000Z');
const RECENT = new Date('2025-06-01T00:00:00.000Z');
const CUTOFF = new Date('2020-01-01T00:00:00.000Z');

const baseRow = {
  patientId: CHAIN_IDS.PATIENT_1,
  imageType: 'xray' as const,
  fileName: 'x.jpg',
  filePath: '/u/x.jpg',
  fileSizeBytes: 1024,
  mimeType: 'image/jpeg',
};

describe('attachment retention target (DB-backed)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    await seedClinicalChain(db, { visits: 1 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  async function insert(id: string, createdAt: Date): Promise<void> {
    await db.insert(dentalAttachments).values({ ...baseRow, id, visitId: CHAIN_IDS.VISIT_1, createdAt });
  }

  test('findEligible (branch-scoped) returns only records older than the cutoff', async () => {
    await insert('a1000000-0000-4000-8000-000000000001', OLD);
    await insert('a1000000-0000-4000-8000-000000000002', RECENT);

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: CHAIN_IDS.BRANCH_1,
      cutoff: CUTOFF,
    });

    expect(eligible.map((e) => e.id)).toEqual(['a1000000-0000-4000-8000-000000000001']);
    expect(eligible[0]!.legalHold).toBe(false);
  });

  test('findEligible (tenant-wide, branchId null) resolves through the org join', async () => {
    await insert('a1000000-0000-4000-8000-000000000003', OLD);

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: null,
      cutoff: CUTOFF,
    });
    expect(eligible.map((e) => e.id)).toContain('a1000000-0000-4000-8000-000000000003');

    // A different tenant sees nothing.
    const otherTenant = await target.findEligible(db, {
      tenantId: '00000000-0000-4000-8000-0000000000ff',
      branchId: null,
      cutoff: CUTOFF,
    });
    expect(otherTenant).toHaveLength(0);
  });

  test('archive soft-deletes (sets deletedAt) and excludes them from later eligibility', async () => {
    const id = 'a1000000-0000-4000-8000-000000000004';
    await insert(id, OLD);

    const count = await target.archive(db, [id]);
    expect(count).toBe(1);

    const [row] = await db.select().from(dentalAttachments).where(eq(dentalAttachments.id, id));
    expect(row!.deletedAt).not.toBeNull(); // soft-archived, NOT hard-deleted

    const eligible = await target.findEligible(db, {
      tenantId: CHAIN_IDS.ORG,
      branchId: CHAIN_IDS.BRANCH_1,
      cutoff: CUTOFF,
    });
    expect(eligible.map((e) => e.id)).not.toContain(id);
  });

  test('archive of an empty id list is a no-op', async () => {
    expect(await target.archive(db, [])).toBe(0);
  });

  test('the audit target is protected and never returns eligible records', async () => {
    expect(RETENTION_TARGETS['audit']!.protected).toBe(true);
    expect(await RETENTION_TARGETS['audit']!.findEligible(db, { tenantId: CHAIN_IDS.ORG, cutoff: CUTOFF })).toHaveLength(0);
  });
});
