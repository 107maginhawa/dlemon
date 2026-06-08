/**
 * clinical-visit.facade tests — hasSignedConsentForVisit
 *
 * This facade is the consent gate for BOTH the treatment status=performed guard
 * (dental-visit) and the visit-completion guard. A consent the patient has
 * REVOKED must never satisfy it (WF-035: "patient revokes → treatment blocked").
 * Prior to V-CLN-010 the gate matched on signed=true only, so a corrupt
 * signed+revoked row would have re-enabled a treatment the patient refused.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import { hasSignedConsentForVisit } from './clinical-visit.facade';
import { consentForms } from './consent-form.schema';
import { openTestTx } from '@/core/test-tx';
import { seedClinicalChain, CHAIN_IDS } from '@/tests/fixtures/seed-clinical-chain';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

let db: NodePgDatabase;

const VISIT_1   = CHAIN_IDS.VISIT_1;
const PATIENT_1 = CHAIN_IDS.PATIENT_1;

const baseForm = {
  visitId: VISIT_1,
  patientId: PATIENT_1,
  templateId: 'tpl-001',
  templateName: 'General Consent',
};

describe('hasSignedConsentForVisit', () => {
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const { db: txDb, rollback } = await openTestTx();
    db = txDb;
    await seedClinicalChain(db, { visits: 2 });
    teardown = rollback;
  });

  afterEach(() => teardown());

  test('false when the visit has no consent forms', async () => {
    expect(await hasSignedConsentForVisit(db, VISIT_1)).toBe(false);
  });

  test('false when the only consent form is unsigned', async () => {
    await db.insert(consentForms).values({ ...baseForm });
    expect(await hasSignedConsentForVisit(db, VISIT_1)).toBe(false);
  });

  test('true when a signed, non-revoked consent form exists', async () => {
    await db.insert(consentForms).values({ ...baseForm, signed: true, signedAt: new Date() });
    expect(await hasSignedConsentForVisit(db, VISIT_1)).toBe(true);
  });

  // V-CLN-010: a signed BUT revoked form must NOT satisfy the gate.
  test('false when the signed consent form was revoked', async () => {
    await db.insert(consentForms).values({
      ...baseForm,
      signed: true,
      signedAt: new Date(),
      revoked: true,
      revokedAt: new Date(),
      revokedBy: '00000000-0000-4000-8000-00000000aaaa',
    });
    expect(await hasSignedConsentForVisit(db, VISIT_1)).toBe(false);
    // the revoked row must not be cleaned up — only excluded from the gate
    const [row] = await db.select().from(consentForms).where(eq(consentForms.visitId, VISIT_1));
    expect(row!.revoked).toBe(true);
  });
});
