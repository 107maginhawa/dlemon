/**
 * patient-emr.facade.ts — narrow EMR access to the patient module
 *
 * Exposes only the patient-data operations the EMR (dental-emr-integration)
 * module needs, so EMR handlers do not cross-import the concrete
 * PatientRepository class (MODULE_BOUNDARIES.md EX-004).
 */

import type { DatabaseInstance } from '@/core/database';
import type { FindManyOptions } from '@/core/database.repo';
import { PatientRepository, type PatientFilters } from './patient.repo';
import type { Patient, PatientWithPerson } from './patient.schema';

export type { PatientFilters } from './patient.repo';

/**
 * Fetch a single patient by ID for EMR consumption.
 */
export async function getPatientForEMR(
  db: DatabaseInstance,
  patientId: string,
  logger?: any
): Promise<Patient | null> {
  const repo = new PatientRepository(db, logger);
  return repo.findOneById(patientId);
}

/**
 * Resolve a patient by their owning person ID for EMR authorization checks.
 */
export async function getPatientByPersonIdForEMR(
  db: DatabaseInstance,
  personId: string,
  logger?: any
): Promise<Patient | null> {
  const repo = new PatientRepository(db, logger);
  return repo.findByPersonId(personId);
}

/**
 * List patients (no person expansion) for EMR patient listing.
 */
export async function listPatientsForEMR(
  db: DatabaseInstance,
  filters?: PatientFilters,
  options?: FindManyOptions,
  logger?: any
): Promise<Patient[]> {
  const repo = new PatientRepository(db, logger);
  return repo.findMany(filters, options);
}

/**
 * List patients with joined person data for EMR patient listing.
 */
export async function listPatientsWithPersonForEMR(
  db: DatabaseInstance,
  filters?: PatientFilters,
  options?: { pagination?: FindManyOptions['pagination'] },
  logger?: any
): Promise<PatientWithPerson[]> {
  const repo = new PatientRepository(db, logger);
  return repo.findManyWithPerson(filters, options);
}
