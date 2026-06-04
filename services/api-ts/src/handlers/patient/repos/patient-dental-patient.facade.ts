/**
 * patient-dental-patient.facade.ts
 *
 * Facade exposing patient repo data to dental-patient handlers.
 * Isolates cross-module access behind typed functions.
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { PaginationOptions } from '@/core/database.repo';
import { patients, type Patient, type PatientWithPerson } from './patient.schema';
import { persons } from '../../person/repos/person.schema';
import { PatientRepository, type PatientFilters, type ArchiveResult } from './patient.repo';

/** Re-exported so dental-patient handlers can type patient payloads without
 *  importing the patient schema directly (Phase 10 boundary lint). */
export type { FollowUpNote, PatientWithPerson } from './patient.schema';

/** Lookup patient for branch authorization. Returns { id, preferredBranchId, status } or null. */
export async function getPatientForDentalPatient(
  db: DatabaseInstance,
  patientId: string,
): Promise<{ id: string; preferredBranchId: string | null; status: string } | null> {
  const [row] = await db
    .select({ id: patients.id, preferredBranchId: patients.preferredBranchId, status: patients.status })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return row ?? null;
}

/**
 * P1-24: the patient's preferred communication channel (drives the reminder
 * consent gate's primary-channel preference). Returns null when unset.
 */
export async function getPatientPreferredChannel(
  db: DatabaseInstance,
  patientId: string,
): Promise<'sms' | 'email' | 'phone' | 'none' | null> {
  const [row] = await db
    .select({ communicationPreferences: patients.communicationPreferences })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  return (row?.communicationPreferences?.preferredChannel as 'sms' | 'email' | 'phone' | 'none' | undefined) ?? null;
}

/** Find potential duplicate patients by name. Returns id-only array. */
export async function findDuplicateDentalPatients(
  db: DatabaseInstance,
  firstName: string,
  lastName: string | null,
  branchId?: string,
): Promise<{ id: string }[]> {
  const repo = new PatientRepository(db);
  const results = await repo.findPotentialDuplicates(firstName, lastName, branchId);
  return results.map(p => ({ id: p.id }));
}

/**
 * P2-16: surface likely duplicate-patient groups in a branch for staff review.
 * Maps the repo clusters to a lean, PII-minimal shape (id, displayName, dob,
 * email/phone) suitable for the dedup review UI.
 */
export async function findDuplicatePatientGroups(
  db: DatabaseInstance,
  branchId: string,
): Promise<Array<{
  matchType: 'strong' | 'name';
  matchKey: string;
  patients: Array<{
    id: string;
    displayName: string;
    dateOfBirth: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  }>;
}>> {
  const repo = new PatientRepository(db);
  const groups = await repo.findDuplicateCandidates(branchId);
  return groups.map((g) => ({
    matchType: g.matchType,
    matchKey: g.matchKey,
    patients: g.patients.map((p) => {
      const contact = p.person.contactInfo as { email?: string; phone?: string } | null | undefined;
      const displayName = [p.person.firstName, p.person.lastName].filter(Boolean).join(' ');
      return {
        id: p.id,
        displayName,
        dateOfBirth: p.person.dateOfBirth ?? null,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt as any)).toISOString(),
      };
    }),
  }));
}

/** Create a patient record during registration. Returns the full Patient. */
export async function createPatientForRegistration(
  db: DatabaseInstance,
  personId: string,
  branchId?: string,
) {
  const repo = new PatientRepository(db);
  return repo.createOne({
    person: personId,
    ...(branchId ? { preferredBranchId: branchId } : {}),
  });
}

/**
 * P1-25: match-or-create a patient from prospect contact details for online
 * self-service booking. Matches an EXISTING patient when a person with the same
 * (non-empty) email or phone already exists in the branch; otherwise creates a
 * new person + patient flagged in `dentalHistorySummary` as self-booked so staff
 * can review. Returns the patient id and whether it was newly created.
 *
 * Identity match is intentionally conservative (exact email/phone) — a fuzzy
 * name-only match would risk attaching a prospect to the wrong record.
 */
export async function matchOrCreatePatientForOnlineBooking(
  db: DatabaseInstance,
  data: {
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    branchId: string;
    actorId: string;
  },
): Promise<{ patientId: string; personId: string; created: boolean }> {
  const email = data.email?.trim().toLowerCase() || undefined;
  const phone = data.phone?.trim() || undefined;

  if (email || phone) {
    // Search persons whose contactInfo email/phone matches, joined to a patient
    // in the same branch. contactInfo is JSONB { email, phone }.
    const matchConds = [];
    if (email) matchConds.push(sql`lower(${persons.contactInfo}->>'email') = ${email}`);
    if (phone) matchConds.push(sql`${persons.contactInfo}->>'phone' = ${phone}`);
    const [existing] = await db
      .select({ patientId: patients.id, personId: persons.id })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id))
      .where(and(eq(patients.preferredBranchId, data.branchId), sql`(${sql.join(matchConds, sql` OR `)})`))
      .limit(1);
    if (existing) return { patientId: existing.patientId, personId: existing.personId, created: false };
  }

  const personId = crypto.randomUUID();
  await db.insert(persons).values({
    id: personId,
    firstName: data.firstName,
    ...(data.lastName ? { lastName: data.lastName } : {}),
    ...(data.dateOfBirth ? { dateOfBirth: data.dateOfBirth } : {}),
    ...(email || phone ? { contactInfo: { ...(email ? { email } : {}), ...(phone ? { phone } : {}) } } : {}),
    createdBy: data.actorId,
    updatedBy: data.actorId,
  });

  const repo = new PatientRepository(db);
  const patient = await repo.createOne({
    person: personId,
    preferredBranchId: data.branchId,
    // Provenance marker so staff can review self-booked prospect records.
    dentalHistorySummary: 'Self-booked online (unverified)',
    createdBy: data.actorId,
    updatedBy: data.actorId,
  } as Parameters<PatientRepository['createOne']>[0]);

  return { patientId: patient.id, personId, created: true };
}

// ---------------------------------------------------------------------------
// dental-patient/identity CRUD surface
//
// dental-patient/identity/* operates on patient records but lives in a separate
// module, so it goes through these thin wrappers rather than importing
// PatientRepository directly (Phase 10 boundary lint). Behaviour mirrors the
// underlying repo methods exactly.
// ---------------------------------------------------------------------------

/** Fetch a patient record by id, or null. */
export async function getDentalPatientRecord(
  db: DatabaseInstance,
  patientId: string,
): Promise<Patient | null> {
  return new PatientRepository(db).findOneById(patientId);
}

/** Fetch a patient joined to its person by id, or null. */
export async function getDentalPatientWithPerson(
  db: DatabaseInstance,
  patientId: string,
): Promise<PatientWithPerson | null> {
  return new PatientRepository(db).findOneByIdWithPerson(patientId);
}

/** List patients joined to person, filtered + paginated. */
export async function listDentalPatientsWithPerson(
  db: DatabaseInstance,
  filters?: PatientFilters,
  options?: { pagination?: PaginationOptions },
): Promise<PatientWithPerson[]> {
  return new PatientRepository(db).findManyWithPerson(filters, options);
}

/** Count patients matching filters. */
export async function countDentalPatientsWithPerson(
  db: DatabaseInstance,
  filters?: PatientFilters,
): Promise<number> {
  return new PatientRepository(db).countWithPerson(filters);
}

/** Apply a partial update to a patient record. */
export async function updateDentalPatientRecord(
  db: DatabaseInstance,
  patientId: string,
  data: Partial<Patient>,
): Promise<Patient> {
  return new PatientRepository(db).updateOneById(patientId, data);
}

/** Soft-archive a patient record (optional reason note). */
export async function archiveDentalPatientRecord(
  db: DatabaseInstance,
  patientId: string,
  note?: string,
): Promise<ArchiveResult> {
  return new PatientRepository(db).archivePatient(patientId, note);
}

/** Restore a soft-archived patient record. */
export async function restoreDentalPatientRecord(
  db: DatabaseInstance,
  patientId: string,
): Promise<ArchiveResult> {
  return new PatientRepository(db).restorePatient(patientId);
}

/**
 * Persist a patient's follow-up notes (JSONB) and flag needsFollowUp. Combines
 * the former two sequential UPDATEs into one — same resulting row.
 */
export async function setPatientFollowUpNotes(
  db: DatabaseInstance,
  patientId: string,
  notes: Patient['followUpNotes'],
): Promise<void> {
  await db
    .update(patients)
    .set({ followUpNotes: notes, needsFollowUp: true, updatedAt: new Date() })
    .where(eq(patients.id, patientId));
}

/** Insert a patient row inside a Drizzle transaction (importPatients use case). */
export async function insertPatientForImport(
  db: DatabaseInstance,
  personId: string,
  branchId: string,
  actorId: string,
) {
  const [patient] = await db
    .insert(patients)
    .values({
      person: personId,
      preferredBranchId: branchId,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  return patient!;
}
