/**
 * ConsentFormRepository tests
 *
 * Key behaviors:
 * - Forms are immutable after signing (signed=true blocks re-sign)
 * - signedAt timestamp recorded on sign
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { ConsentFormRepository } from './consent-form.repo';
import { createDatabase } from '@/core/database';

const db = createDatabase({ url: 'postgres://postgres:password@localhost:5432/monobase' });

const VISIT_1   = 'e2000000-0000-4000-8000-000000000001';
const PATIENT_1 = 'e2000000-0000-4000-8000-000000000010';

const baseForm = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  templateId: 'tpl-001',
  templateName: 'General Consent',
};

describe('ConsentFormRepository', () => {
  let repo: ConsentFormRepository;

  beforeEach(() => { repo = new ConsentFormRepository(db); });

  afterEach(async () => {
    await db.execute(sql`TRUNCATE TABLE consent_form CASCADE`);
  });

  describe('create', () => {
    test('creates an unsigned form by default', async () => {
      const form = await repo.createOne(baseForm);
      expect(form.id).toBeTruthy();
      expect(form.signed).toBe(false);
      expect(form.signedAt).toBeNull();
      expect(form.signatureData).toBeNull();
    });

    test('stores templateId and templateName', async () => {
      const form = await repo.createOne(baseForm);
      expect(form.templateId).toBe('tpl-001');
      expect(form.templateName).toBe('General Consent');
    });
  });

  describe('sign', () => {
    test('marks form as signed with timestamp and signature data', async () => {
      const form = await repo.createOne(baseForm);
      const signed = await repo.sign(form.id, 'data:image/png;base64,abc123');
      expect(signed!.signed).toBe(true);
      expect(signed!.signedAt).toBeInstanceOf(Date);
      expect(signed!.signatureData).toBe('data:image/png;base64,abc123');
    });

    test('immutable after signing — re-sign returns null', async () => {
      const form = await repo.createOne(baseForm);
      await repo.sign(form.id, 'sig-data-1');
      const reSigned = await repo.sign(form.id, 'sig-data-2');
      expect(reSigned).toBeNull();
    });

    test('original signature data is preserved after attempted re-sign', async () => {
      const form = await repo.createOne(baseForm);
      await repo.sign(form.id, 'original-sig');
      await repo.sign(form.id, 'new-sig'); // should be rejected
      const found = await repo.findOneById(form.id);
      expect(found!.signatureData).toBe('original-sig');
    });

    test('returns null for unknown id', async () => {
      const result = await repo.sign('00000000-0000-4000-8000-000000000000', 'sig');
      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseForm);
      await repo.createOne({ ...baseForm, visitId: 'e2000000-0000-4000-8000-000000000002' });

      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });
  });
});
