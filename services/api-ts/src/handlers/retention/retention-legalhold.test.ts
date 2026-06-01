/**
 * Integration: retention excludes attachments whose owning Person is under an
 * active legal hold (V-DG-001 + B1). Proves the engine's legal-hold exclusion
 * is now backed by the real legal-hold store.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { placeLegalHold } from '@/handlers/dental-legalhold/legal-hold-service';
import { RETENTION_TARGETS } from './retention-targets';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const noopLogger = { info() {}, warn() {}, error() {}, debug() {} } as any;
const target = RETENTION_TARGETS['attachment']!;
const OLD = new Date('2010-01-01T00:00:00.000Z');
const CUTOFF = new Date('2020-01-01T00:00:00.000Z');
const ATT = 'a7000000-0000-4000-8000-000000000001';

describe('retention respects the legal-hold store', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;
    await seedClinicalChain(db, { visits: 1 });
    await db.insert(dentalAttachments).values({
      id: ATT,
      visitId: CHAIN_IDS.VISIT_1,
      patientId: CHAIN_IDS.PATIENT_1,
      imageType: 'xray',
      fileName: 'x.jpg',
      filePath: '/u/x.jpg',
      fileSizeBytes: 1024,
      mimeType: 'image/jpeg',
      createdAt: OLD,
    });
  });

  afterEach(() => teardown());

  test('an old attachment becomes legal-held once its patient Person is held', async () => {
    const opts = { tenantId: CHAIN_IDS.ORG, branchId: CHAIN_IDS.BRANCH_1, cutoff: CUTOFF };

    // Before any hold: eligible, not held.
    const before = await target.findEligible(db, opts);
    expect(before.find((c) => c.id === ATT)?.legalHold).toBe(false);

    // Place a hold on the attachment's owning Person.
    const [pt] = await db.select({ person: patients.person }).from(patients).where(eq(patients.id, CHAIN_IDS.PATIENT_1));
    await placeLegalHold(db, noopLogger, {
      tenantId: CHAIN_IDS.ORG,
      subjectPersonId: pt!.person,
      name: 'hold',
      reason: 'litigation',
      initiatedBy: CHAIN_IDS.OWNER_PERSON,
    });

    // After: the candidate is flagged held (engine will exclude it).
    const after = await target.findEligible(db, opts);
    expect(after.find((c) => c.id === ATT)?.legalHold).toBe(true);
  });
});
