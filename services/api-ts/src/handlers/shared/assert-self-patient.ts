/**
 * Self-patient authorization utility (E4 — patient portal trust boundary).
 *
 * This is the IDOR-critical core of the patient self-service portal. The patient
 * portal is an EXTERNAL trust boundary: the caller is a patient (Better-Auth
 * system role `user`, linked Person + dental_patient record, NO dental_membership),
 * not staff. None of the existing dental handlers authorize "the patient viewing
 * their OWN record" — they all assume staff membership — which is why this exists.
 *
 * Key invariant (see assert-branch-access.ts / getPerson.ts):
 *   user.id === person.id in this codebase.
 * A dental_patient row links to its person via `patients.person` (person_id).
 * Therefore the authenticated patient's record is exactly:
 *   patients WHERE person_id = userId   (with userId === personId).
 *
 * IDOR design: callers should DERIVE the patient identity from the session via
 * `resolveSelfPatientId` and never accept a client-supplied patientId. If a
 * patientId must be accepted from the client, `assertSelfPatient` enforces that
 * it belongs to the authenticated user, throwing ForbiddenError on any mismatch.
 * Either way a patient can only ever reach their OWN data.
 */

import { eq } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import { patients } from '@/handlers/patient/repos/patient.schema';

/**
 * Resolve the dental_patient.id for the authenticated user, or null if the user
 * has no linked patient record (e.g. the caller is staff-only, not a patient).
 *
 * Resolution: patients.person === userId  (invariant: userId === personId).
 *
 * NOTE: this is a deliberate building block. It is exported for reuse and for
 * the null-returning (non-throwing) variant of self-patient resolution; the
 * portal handlers themselves call `resolveSelfPatientIdOrThrow`. Keep it even
 * though direct production callers are currently limited — do not delete as
 * "dead code".
 */
export async function resolveSelfPatientId(
  db: DatabaseInstance,
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.person, userId))
    .limit(1);

  return row?.id ?? null;
}

/**
 * Resolve the authenticated user's OWN patient id, throwing if none exists.
 *
 * Preferred entry point for self-scoped portal reads: the patientId is NEVER
 * taken from the client — it is derived here from the session, eliminating IDOR
 * entirely. A user with no linked patient record (staff-only account) gets a
 * 403, never another patient's data.
 *
 * @throws ForbiddenError if the user has no linked patient record.
 */
export async function resolveSelfPatientIdOrThrow(
  db: DatabaseInstance,
  userId: string,
): Promise<string> {
  const patientId = await resolveSelfPatientId(db, userId);
  if (!patientId) {
    // Opaque message: do not reveal whether a patient record exists for someone
    // else / leak account topology. The caller simply is not authorized as a
    // self-service patient.
    throw new ForbiddenError('No patient record is associated with this account', 'NOT_A_SELF_PATIENT');
  }
  return patientId;
}

/**
 * Assert that `patientId` is the authenticated user's OWN patient record.
 *
 * @internal Deliberate building block for FUTURE self-scoped routes that accept
 * a patientId path param (e.g. `/me/visits/:id`, `/me/imaging/:id`). It is NOT
 * yet called by any production handler — the current /me reads derive identity
 * via `resolveSelfPatientIdOrThrow` and take no patientId, so they never reach
 * a NotFound. Kept intentionally (and fully tested) so the IDOR-correct gate is
 * ready the moment a patientId-bearing /me route is added. Do not delete as
 * "dead code".
 *
 * Use this on any path where a patientId is supplied by the client and must be
 * validated against the session. It is airtight: it loads the patient by id,
 * 404s if it does not exist, and 403s unless `patient.person === userId`. It
 * NEVER returns or leaks any field of a non-owned patient.
 *
 * @throws NotFoundError  if no patient with `patientId` exists.
 * @throws ForbiddenError if the patient exists but does NOT belong to the user.
 */
export async function assertSelfPatient(
  db: DatabaseInstance,
  userId: string,
  patientId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: patients.id, person: patients.person })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Patient not found', {
      resourceType: 'patient',
      resource: patientId,
    });
  }

  // The single IDOR gate: ownership is `patient.person === userId`
  // (invariant userId === personId). Any mismatch → 403, no data leak.
  if (row.person !== userId) {
    throw new ForbiddenError('You do not have access to this patient record', 'NOT_A_SELF_PATIENT');
  }
}
