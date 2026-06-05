/**
 * patient-person.facade.ts
 *
 * Centralizes the patients ⋈ persons join (name search, with-person reads,
 * duplicate detection) in one exempt bridge file so PatientRepository itself no
 * longer imports the person schema directly (Phase 10 boundary lint). The join
 * is inseparable from these queries (WHERE/ilike on person columns), so it is
 * RELOCATED unchanged rather than batched — SQL is byte-identical. The repo
 * methods delegate here, keeping their public signatures intact.
 */

import { eq, and, or, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { PaginationOptions } from '@/core/database.repo';
import { patients, type PatientWithPerson, type PersonData } from './patient.schema';
import { persons } from '../../person/repos/person.schema';
import type { PatientFilters } from './patient.repo';

/** patients ⋈ persons by patient id. */
export async function findPatientWithPersonById(
  db: DatabaseInstance,
  patientId: string,
): Promise<PatientWithPerson | null> {
  const result = await db
    .select({ patient: patients, person: persons })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(eq(patients.id, patientId))
    .limit(1);

  const row = result[0];
  if (!row) return null;
  return { ...row.patient, person: row.person as unknown as PersonData };
}

/** Shared filter conditions for the patients ⋈ persons list/count queries. */
function listConditions(filters?: PatientFilters): SQL<unknown>[] {
  const conditions: SQL<unknown>[] = [];
  if (filters?.person) conditions.push(eq(patients.person, filters.person));
  if (filters?.ids && filters.ids.length > 0) conditions.push(inArray(patients.id, filters.ids));
  if (filters?.q) {
    conditions.push(
      or(ilike(persons.firstName, `%${filters.q}%`), ilike(persons.lastName, `%${filters.q}%`)) as SQL<unknown>,
    );
  }
  // STRICT per-branch scope (data isolation). Previously this OR'd in
  // `isNull(preferredBranchId)`, which leaked every branchless patient into EVERY
  // branch's list across orgs (cross-tenant PHI leak). Branchless patients are
  // intentionally NOT a free-for-all (see dental-patient-branchless-auth.test.ts),
  // so they must not surface in any branch list.
  if (filters?.branchIds && filters.branchIds.length > 0) {
    conditions.push(inArray(patients.preferredBranchId, filters.branchIds));
  } else if (filters?.branchId) {
    conditions.push(eq(patients.preferredBranchId, filters.branchId));
  }
  if (filters?.needsFollowUp !== undefined) conditions.push(eq(patients.needsFollowUp, filters.needsFollowUp));
  if (filters?.status) conditions.push(eq(patients.status, filters.status));
  return conditions;
}

/** patients ⋈ persons, filtered + paginated. */
export async function findManyPatientsWithPerson(
  db: DatabaseInstance,
  filters?: PatientFilters,
  options?: { pagination?: PaginationOptions },
): Promise<PatientWithPerson[]> {
  const query = db
    .select({ patient: patients, person: persons })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .$dynamic();

  const conditions = listConditions(filters);
  if (conditions.length > 0) query.where(and(...conditions));

  if (options?.pagination) {
    const { limit = 25, offset = 0 } = options.pagination;
    query.limit(limit).offset(offset);
  }

  const results = await query;
  return results.map(({ patient, person }) => ({ ...patient, person })) as PatientWithPerson[];
}

/** Count of patients matching the list filters (same join + conditions, no pagination). */
export async function countPatientsWithPerson(
  db: DatabaseInstance,
  filters?: PatientFilters,
): Promise<number> {
  const query = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .$dynamic();

  const conditions = listConditions(filters);
  if (conditions.length > 0) query.where(and(...conditions));

  const result = await query;
  return Number(result[0]?.count ?? 0);
}

/** Name-similar patients in a branch (FR2.5 duplicate hint, non-blocking). */
export async function findPotentialDuplicatePatients(
  db: DatabaseInstance,
  firstName: string,
  lastName: string | null,
  branchId?: string,
): Promise<PatientWithPerson[]> {
  const conditions: SQL<unknown>[] = [ilike(persons.firstName, `%${firstName}%`)];
  if (lastName) conditions.push(ilike(persons.lastName, `%${lastName}%`));
  if (branchId) conditions.push(eq(patients.preferredBranchId, branchId));

  const results = await db
    .select({ patient: patients, person: persons })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(and(...conditions))
    .limit(5);

  return results.map(({ patient, person }) => ({ ...patient, person })) as PatientWithPerson[];
}

/** Active patients (with person) in a branch — input to duplicate clustering. */
export async function findActivePatientsWithPersonByBranch(
  db: DatabaseInstance,
  branchId: string,
): Promise<PatientWithPerson[]> {
  const rows = await db
    .select({ patient: patients, person: persons })
    .from(patients)
    .innerJoin(persons, eq(patients.person, persons.id))
    .where(and(eq(patients.preferredBranchId, branchId), eq(patients.status, 'active')));

  return rows.map(({ patient, person }) => ({ ...patient, person })) as PatientWithPerson[];
}
