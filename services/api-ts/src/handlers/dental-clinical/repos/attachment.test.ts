/**
 * AttachmentRepository tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AttachmentRepository } from './attachment.repo';
import { VALID_IMAGE_TYPES } from './attachment.schema';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase;

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;

const baseAttachment = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  imageType: 'xray' as const,
  fileName: 'tooth-21-xray.jpg',
  filePath: '/uploads/tooth-21-xray.jpg',
  fileSizeBytes: 204800,
  mimeType: 'image/jpeg',
};

describe('AttachmentRepository', () => {
  let repo: AttachmentRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new AttachmentRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  describe('create', () => {
    test('creates an attachment with required fields', async () => {
      const att = await repo.createOne(baseAttachment);
      expect(att.id).toBeTruthy();
      expect(att.imageType).toBe('xray');
      expect(att.fileName).toBe('tooth-21-xray.jpg');
      expect(att.fileSizeBytes).toBe(204800);
      expect(att.mimeType).toBe('image/jpeg');
    });

    test('stores optional toothNumbers array', async () => {
      const att = await repo.createOne({ ...baseAttachment, toothNumbers: [21, 22] });
      expect(att.toothNumbers).toEqual([21, 22]);
    });

    test('stores optional note', async () => {
      const att = await repo.createOne({ ...baseAttachment, note: 'Periapical view' });
      expect(att.note).toBe('Periapical view');
    });

    test('accepts all image types', async () => {
      for (const imageType of ['xray', 'photo', 'scan', 'document', 'other'] as const) {
        const att = await repo.createOne({ ...baseAttachment, imageType });
        expect(att.imageType).toBe(imageType);
      }
    });

    // V-CLI-015 canonical ruling: dental_attachment.image_type is a coarse
    // FILE-CATEGORY taxonomy, NOT the clinical radiograph modality taxonomy
    // (periapical/bitewing/panoramic/…) — that lives in dental-imaging.ModalityEnum.
    // Lock the exact set so spec↔code can't silently drift toward modalities.
    test('image_type is the canonical file-category enum (V-CLI-015)', () => {
      expect([...VALID_IMAGE_TYPES]).toEqual(['xray', 'photo', 'scan', 'document', 'other']);
      // radiograph modalities must NOT leak into the attachment enum
      for (const modality of ['periapical', 'bitewing', 'panoramic', 'cephalometric', 'cbct']) {
        expect(VALID_IMAGE_TYPES as readonly string[]).not.toContain(modality);
      }
    });
  });

  describe('softDelete', () => {
    test('soft-deletes an existing attachment and returns true', async () => {
      const att = await repo.createOne(baseAttachment);
      const deleted = await repo.softDelete(att.id);
      expect(deleted).toBe(true);

      const found = await repo.findOneById(att.id);
      expect(found).toBeNull();
    });

    test('returns false for unknown id', async () => {
      const deleted = await repo.softDelete('00000000-0000-4000-8000-000000000000');
      expect(deleted).toBe(false);
    });

    test('soft-deleted attachment excluded from findMany', async () => {
      const att = await repo.createOne(baseAttachment);
      await repo.softDelete(att.id);

      const results = await repo.findMany({ visitId: att.visitId });
      expect(results).toHaveLength(0);
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseAttachment);
      await repo.createOne({ ...baseAttachment, visitId: VISIT_2 });

      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });
  });
});
