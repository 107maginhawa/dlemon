/**
 * ConsentFormRepository tests
 *
 * Key behaviors:
 * - Forms are immutable after signing (signed=true blocks re-sign)
 * - signedAt timestamp recorded on sign
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ConsentFormRepository } from './consent-form.repo';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase;

const VISIT_1   = CHAIN_IDS.VISIT_1;
const VISIT_2   = CHAIN_IDS.VISIT_2;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;

const baseForm = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  templateId: 'tpl-001',
  templateName: 'General Consent',
};

describe('ConsentFormRepository', () => {
  let repo: ConsentFormRepository;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    repo = new ConsentFormRepository(db);
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

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

    // V-CLN-010: a revoked consent must never become signed. The revoke path is
    // symmetric to the signed→revoke guard (CONSENT_ALREADY_SIGNED): once a patient
    // has refused/withdrawn (revoked=true), signing it would resurrect consent the
    // patient declined and let a treatment proceed via the signed-only gate.
    test('does not sign a revoked form — returns null (V-CLN-010)', async () => {
      const form = await repo.createOne(baseForm);
      await repo.revoke(form.id, '00000000-0000-4000-8000-00000000aaaa');
      const signed = await repo.sign(form.id, 'sig-after-revoke');
      expect(signed).toBeNull();
      const found = await repo.findOneById(form.id);
      expect(found!.signed).toBe(false);
      expect(found!.revoked).toBe(true);
    });
  });

  describe('findMany', () => {
    test('filters by visitId', async () => {
      await repo.createOne(baseForm);
      await repo.createOne({ ...baseForm, visitId: VISIT_2 });

      const results = await repo.findMany({ visitId: VISIT_1 });
      expect(results).toHaveLength(1);
    });
  });
});
