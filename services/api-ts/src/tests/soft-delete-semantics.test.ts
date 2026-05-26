/**
 * Soft-delete semantics — AttachmentRepository
 *
 * Proves that softDelete() sets deleted_at and that buildWhereConditions()
 * (used by findMany) and findOneById() both apply isNull(deletedAt), excluding
 * soft-deleted rows from all read paths.
 *
 * dental_attachment is the only table in this codebase with a deleted_at column.
 *
 * Pattern: real DB (createDatabase) + beforeAll seed of FK parents + afterEach
 * TRUNCATE TABLE dental_attachment CASCADE. UUID prefix `sd` avoids collision
 * with all other test files.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@/core/database';
import { AttachmentRepository } from '@/handlers/dental-clinical/repos/attachment.repo';
import { dentalAttachments } from '@/handlers/dental-clinical/repos/attachment.schema';
import { seedClinicalChain, CHAIN_IDS } from './fixtures/seed-clinical-chain';

// ---------------------------------------------------------------------------
// Real DB + repo
// ---------------------------------------------------------------------------

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });
const repo = new AttachmentRepository(db);

// ---------------------------------------------------------------------------
// Stable test IDs — sd prefix, no collision with any other test file
// ---------------------------------------------------------------------------

const ATTACH_A = '5d000000-0000-4000-8000-000000000001';
const ATTACH_B = '5d000000-0000-4000-8000-000000000002';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // Seed FK parents once. onConflictDoNothing makes this idempotent across runs.
  // dental_attachment → dental_visit → dental_branch → dental_org (via seedClinicalChain)
  // dental_attachment → patient → person
  await seedClinicalChain(db, { visits: 1 });
});

afterEach(async () => {
  // Wipe only attachment rows; parent rows remain for subsequent tests.
  await db.execute(sql`TRUNCATE TABLE dental_attachment CASCADE`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedAttachment(
  id: string,
  overrides: Partial<typeof dentalAttachments.$inferInsert> = {},
) {
  await db.insert(dentalAttachments).values({
    id,
    visitId: CHAIN_IDS.VISIT_1,
    patientId: CHAIN_IDS.PATIENT_1,
    imageType: 'xray',
    fileName: 'test.jpg',
    filePath: '/uploads/test.jpg',
    fileSizeBytes: 1024,
    mimeType: 'image/jpeg',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AttachmentRepository — soft-delete semantics', () => {
  describe('findMany — pre-delete baseline', () => {
    test('active attachment appears in findMany by visitId', async () => {
      await seedAttachment(ATTACH_A);
      const rows = await repo.findMany({ visitId: CHAIN_IDS.VISIT_1 });
      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(ATTACH_A);
    });

    test('active attachment appears in findMany by patientId', async () => {
      await seedAttachment(ATTACH_A);
      const rows = await repo.findMany({ patientId: CHAIN_IDS.PATIENT_1 });
      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(ATTACH_A);
    });
  });

  describe('findMany — post softDelete()', () => {
    test('soft-deleted attachment excluded from findMany by visitId', async () => {
      await seedAttachment(ATTACH_A);
      await repo.softDelete(ATTACH_A);
      const rows = await repo.findMany({ visitId: CHAIN_IDS.VISIT_1 });
      expect(rows.length).toBe(0);
    });

    test('soft-deleted attachment excluded from findMany by patientId', async () => {
      await seedAttachment(ATTACH_A);
      await repo.softDelete(ATTACH_A);
      const rows = await repo.findMany({ patientId: CHAIN_IDS.PATIENT_1 });
      expect(rows.length).toBe(0);
    });

    test('only soft-deleted row excluded; live sibling still visible', async () => {
      await seedAttachment(ATTACH_A);
      await seedAttachment(ATTACH_B, {
        imageType: 'photo',
        fileName: 'second.jpg',
        filePath: '/uploads/second.jpg',
      });
      await repo.softDelete(ATTACH_A);
      const rows = await repo.findMany({ visitId: CHAIN_IDS.VISIT_1 });
      expect(rows.length).toBe(1);
      expect(rows[0]!.id).toBe(ATTACH_B);
    });
  });

  describe('findOneById — post softDelete()', () => {
    test('returns row before soft-delete', async () => {
      await seedAttachment(ATTACH_A);
      const row = await repo.findOneById(ATTACH_A);
      expect(row).not.toBeNull();
      expect(row!.id).toBe(ATTACH_A);
    });

    test('returns null after softDelete()', async () => {
      await seedAttachment(ATTACH_A);
      await repo.softDelete(ATTACH_A);
      const row = await repo.findOneById(ATTACH_A);
      expect(row).toBeNull();
    });
  });

  describe('softDelete — return value', () => {
    test('returns true when row exists and is not yet deleted', async () => {
      await seedAttachment(ATTACH_A);
      const result = await repo.softDelete(ATTACH_A);
      expect(result).toBe(true);
    });

    test('returns false on second call (row already soft-deleted)', async () => {
      await seedAttachment(ATTACH_A);
      await repo.softDelete(ATTACH_A);
      const second = await repo.softDelete(ATTACH_A);
      expect(second).toBe(false);
    });

    test('returns false for valid UUID that does not exist', async () => {
      // Must use a well-formed UUID — PostgreSQL rejects invalid uuid strings with a
      // cast error before evaluating the WHERE clause.
      const result = await repo.softDelete('f0000000-0000-4000-8000-000000000099');
      expect(result).toBe(false);
    });
  });
});
