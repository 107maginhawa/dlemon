/**
 * AttachmentRepository tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { AttachmentRepository } from './attachment.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const VISIT_1   = 'e3000000-0000-4000-8000-000000000001';
const PATIENT_1 = 'e3000000-0000-4000-8000-000000000010';

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

  beforeEach(() => { repo = new AttachmentRepository(db); });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE dental_attachment CASCADE`);
  });

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
  });

  describe('deleteById', () => {
    test('deletes an existing attachment and returns true', async () => {
      const att = await repo.createOne(baseAttachment);
      const deleted = await repo.deleteById(att.id);
      expect(deleted).toBe(true);

      const found = await repo.findOneById(att.id);
      expect(found).toBeNull();
    });

    test('returns false for unknown id', async () => {
      const deleted = await repo.deleteById('00000000-0000-4000-8000-000000000000');
      expect(deleted).toBe(false);
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseAttachment);
      await repo.createOne({ ...baseAttachment, visitId: 'e3000000-0000-4000-8000-000000000002' });

      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });
  });
});
