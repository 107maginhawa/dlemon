/**
 * clinical-erasure.facade tests (V-DG-002).
 *
 * Per DATA_GOVERNANCE.md §3, only ConsentForm carries denormalized signer
 * PII among the dental-clinical entities (Treatment / Prescription rows hold
 * only FKs + clinical content → NO-OP, no facade function). These tests pin
 * `anonymizeConsentFormsByPerson`: it redacts signature + template label +
 * revoker identity while KEEPING consent state and the patient/visit FKs, and
 * is scoped strictly to the subject person.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { openTestTx } from '@/core/test-tx';
import { persons } from '../../person/repos/person.schema';
import { patients } from '../../patient/repos/patient.schema';
import { dentalOrganizations } from '../../dental-org/repos/organization.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';
import { dentalMemberships } from '../../dental-org/repos/membership.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { consentForms } from './consent-form.schema';
import {
  anonymizeConsentFormsByPerson,
  ERASED_MARKER,
} from './clinical-erasure.facade';

const SUBJECT_PERSON = 'f1000000-0000-4000-8000-000000000001';
const SUBJECT_PATIENT = 'f1000000-0000-4000-8000-0000000000a1';
const OTHER_PERSON = 'f1000000-0000-4000-8000-000000000002';
const OTHER_PATIENT = 'f1000000-0000-4000-8000-0000000000a2';
const ORG = 'f1000000-0000-4000-8000-0000000000b1';
const BRANCH = 'f1000000-0000-4000-8000-0000000000c1';
const MEMBER = 'f1000000-0000-4000-8000-0000000000d1';
const SUBJECT_VISIT = 'f1000000-0000-4000-8000-0000000000e1';
const OTHER_VISIT = 'f1000000-0000-4000-8000-0000000000e2';
const SIGNED_FORM = 'f1000000-0000-4000-8000-0000000000f1';
const REVOKED_FORM = 'f1000000-0000-4000-8000-0000000000f2';
const OTHER_FORM = 'f1000000-0000-4000-8000-0000000000f3';

describe('clinical-erasure facade — anonymizeConsentFormsByPerson (V-DG-002)', () => {
  let db: NodePgDatabase;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const t = await openTestTx();
    db = t.db;
    teardown = t.rollback;

    await db.insert(persons).values([
      { id: SUBJECT_PERSON, firstName: 'Jane' },
      { id: OTHER_PERSON, firstName: 'John' },
    ]);
    await db.insert(patients).values([
      { id: SUBJECT_PATIENT, person: SUBJECT_PERSON },
      { id: OTHER_PATIENT, person: OTHER_PERSON },
    ]);
    await db.insert(dentalOrganizations).values({
      id: ORG, name: 'Clinic', tier: 'clinic',
      ownerPersonId: SUBJECT_PERSON, countryCode: 'PH', active: true,
    });
    await db.insert(dentalBranches).values({
      id: BRANCH, organizationId: ORG, name: 'Main', timezone: 'Asia/Manila', active: true,
    });
    await db.insert(dentalMemberships).values({
      id: MEMBER, branchId: BRANCH, displayName: 'Dr Who', role: 'dentist_owner', status: 'active',
    });
    await db.insert(dentalVisits).values([
      { id: SUBJECT_VISIT, patientId: SUBJECT_PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'completed' },
      { id: OTHER_VISIT, patientId: OTHER_PATIENT, branchId: BRANCH, dentistMemberId: MEMBER, status: 'completed' },
    ]);
    await db.insert(consentForms).values([
      {
        id: SIGNED_FORM, visitId: SUBJECT_VISIT, patientId: SUBJECT_PATIENT,
        templateId: 'tpl-treatment', templateName: 'Treatment Consent — Jane Doe',
        signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,SIGNATURE',
      },
      {
        id: REVOKED_FORM, visitId: SUBJECT_VISIT, patientId: SUBJECT_PATIENT,
        templateId: 'tpl-xray', templateName: 'X-Ray Consent — Jane Doe',
        signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,SIG2',
        revoked: true, revokedAt: new Date(), revokedBy: SUBJECT_PERSON,
      },
      {
        id: OTHER_FORM, visitId: OTHER_VISIT, patientId: OTHER_PATIENT,
        templateId: 'tpl-treatment', templateName: 'Treatment Consent — John Roe',
        signed: true, signedAt: new Date(), signatureData: 'data:image/png;base64,OTHER',
      },
    ]);
  });

  afterEach(() => teardown());

  test('redacts signer PII but keeps consent state + FKs', async () => {
    const n = await anonymizeConsentFormsByPerson(db, SUBJECT_PERSON);
    expect(n).toBe(2);

    const [signed] = await db.select().from(consentForms).where(eq(consentForms.id, SIGNED_FORM));
    expect(signed!.signatureData).toBeNull();          // signature redacted
    expect(signed!.templateName).toBe(ERASED_MARKER);  // label redacted
    expect(signed!.signed).toBe(true);                 // state KEPT
    expect(signed!.signedAt).not.toBeNull();           // state KEPT
    expect(signed!.patientId).toBe(SUBJECT_PATIENT);   // FK KEPT
    expect(signed!.visitId).toBe(SUBJECT_VISIT);       // FK KEPT
    expect(signed!.templateId).toBe('tpl-treatment');  // machine code KEPT

    const [revoked] = await db.select().from(consentForms).where(eq(consentForms.id, REVOKED_FORM));
    expect(revoked!.revoked).toBe(true);               // revocation state KEPT
    expect(revoked!.revokedBy).toBeNull();             // revoker identity redacted
    expect(revoked!.signatureData).toBeNull();
    expect(revoked!.templateName).toBe(ERASED_MARKER);
  });

  test('does not touch another person consent forms', async () => {
    await anonymizeConsentFormsByPerson(db, SUBJECT_PERSON);
    const [other] = await db.select().from(consentForms).where(eq(consentForms.id, OTHER_FORM));
    expect(other!.signatureData).toBe('data:image/png;base64,OTHER');
    expect(other!.templateName).toBe('Treatment Consent — John Roe');
  });

  test('is idempotent and returns 0 for a person with no patient', async () => {
    await anonymizeConsentFormsByPerson(db, SUBJECT_PERSON);
    const again = await anonymizeConsentFormsByPerson(db, SUBJECT_PERSON); // re-matches the rows
    expect(again).toBe(2);

    const none = await anonymizeConsentFormsByPerson(db, 'f1000000-0000-4000-8000-0000000000ff');
    expect(none).toBe(0);
  });
});
