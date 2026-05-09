/**
 * PatientRepository - Data access layer for patients
 * Encapsulates all database operations for the patients table
 */

import { eq, and, or, ilike, isNull, inArray, sql, type SQL, isNotNull } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  patients,
  type Patient,
  type NewPatient,
  type PatientWithPerson,
  type PersonData
} from './patient.schema';
import { persons } from '../../person/repos/person.schema';

export interface PatientFilters {
  person?: string;
  q?: string; // General search query
  ids?: string[]; // Filter by patient IDs using IN query
  branchId?: string; // Filter by preferred dental branch
  branchIds?: string[]; // Filter by multiple branch IDs
  needsFollowUp?: boolean; // Filter by follow-up flag
  status?: string; // Filter by patient status ('active' | 'archived')
}

export interface ArchiveResult {
  success: boolean;
  reason?: string;
}

export class PatientRepository extends DatabaseRepository<Patient, NewPatient, PatientFilters> {
  constructor(
    db: DatabaseInstance,
    logger?: any
  ) {
    super(db, patients, logger);
  }

  /**
   * Build where conditions for patient-specific filtering
   */
  protected buildWhereConditions(filters?: PatientFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions = [];

    if (filters.person) {
      conditions.push(eq(patients.person, filters.person));
    }

    if (filters.ids && filters.ids.length > 0) {
      conditions.push(inArray(patients.id, filters.ids));
    }

    if (filters.branchId) {
      conditions.push(eq(patients.preferredBranchId, filters.branchId));
    }

    if (filters.needsFollowUp !== undefined) {
      conditions.push(eq(patients.needsFollowUp, filters.needsFollowUp));
    }

    if (filters.status) {
      conditions.push(eq(patients.status, filters.status));
    }

    // General search would require joining with persons table
    // For now, we'll handle it separately in findManyWithPerson

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Find patient by person ID
   */
  async findByPersonId(personId: string): Promise<Patient | null> {
    this.logger?.debug({ personId }, 'Finding patient by person ID');
    
    const patient = await this.findOne({ person: personId });
    
    this.logger?.debug({ personId, found: !!patient }, 'Patient person ID lookup completed');
    
    return patient;
  }

  /**
   * Find patient with person data joined
   */
  async findOneByIdWithPerson(patientId: string): Promise<PatientWithPerson | null> {
    this.logger?.debug({ patientId }, 'Finding patient with person data');
    
    const result = await this.db
      .select({
        patient: patients,
        person: persons
      })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id))
      .where(eq(patients.id, patientId))
      .limit(1);
    
    const row = result[0];
    if (!row) {
      return null;
    }

    const { patient, person } = row;

    this.logger?.debug({ patientId, found: true }, 'Patient with person data retrieved');

    return {
      ...patient,
      person: person as unknown as PersonData
    };
  }

  /**
   * Delete a patient by ID (hard delete)
   */
  override async deleteOneById(id: string, actorId?: string): Promise<void> {
    this.logger?.debug({ id, actorId }, 'Deleting patient by ID');
    await super.deleteOneById(id, actorId);
    this.logger?.info({ id, actorId }, 'Patient deleted successfully');
  }

  /**
   * Find patients with person data joined
   */
  async findManyWithPerson(
    filters?: PatientFilters,
    options?: { pagination?: PaginationOptions }
  ): Promise<PatientWithPerson[]> {
    this.logger?.debug({ filters, options }, 'Finding patients with person data');
    
    const query = this.db
      .select({
        patient: patients,
        person: persons
      })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id))
      .$dynamic();

    // Apply filters
    const conditions = [];

    if (filters?.person) {
      conditions.push(eq(patients.person, filters.person));
    }

    if (filters?.ids && filters.ids.length > 0) {
      conditions.push(inArray(patients.id, filters.ids));
    }

    // General search across person fields
    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    if (filters?.branchIds && filters.branchIds.length > 0) {
      conditions.push(
        or(
          inArray(patients.preferredBranchId, filters.branchIds),
          isNull(patients.preferredBranchId)
        )
      );
    } else if (filters?.branchId) {
      conditions.push(
        or(
          eq(patients.preferredBranchId, filters.branchId),
          isNull(patients.preferredBranchId)
        )
      );
    }

    if (filters?.needsFollowUp !== undefined) {
      conditions.push(eq(patients.needsFollowUp, filters.needsFollowUp));
    }

    if (filters?.status) {
      conditions.push(eq(patients.status, filters.status));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    // Apply pagination
    if (options?.pagination) {
      const { limit = 25, offset = 0 } = options.pagination;
      query.limit(limit).offset(offset);
    }

    const results = await query;

    this.logger?.debug({
      filters,
      resultCount: results.length
    }, 'Patients with person data retrieved');

    return results.map(({ patient, person }) => ({
      ...patient,
      person
    })) as PatientWithPerson[];
  }

  /**
   * Count patients matching filters (for accurate pagination totals).
   * Mirrors findManyWithPerson filter logic without pagination.
   */
  async countWithPerson(
    filters?: PatientFilters
  ): Promise<number> {
    const conditions = [];

    if (filters?.person) {
      conditions.push(eq(patients.person, filters.person));
    }

    if (filters?.ids && filters.ids.length > 0) {
      conditions.push(inArray(patients.id, filters.ids));
    }

    if (filters?.q) {
      conditions.push(
        or(
          ilike(persons.firstName, `%${filters.q}%`),
          ilike(persons.lastName, `%${filters.q}%`)
        )
      );
    }

    if (filters?.branchIds && filters.branchIds.length > 0) {
      conditions.push(
        or(
          inArray(patients.preferredBranchId, filters.branchIds),
          isNull(patients.preferredBranchId)
        )
      );
    } else if (filters?.branchId) {
      conditions.push(
        or(
          eq(patients.preferredBranchId, filters.branchId),
          isNull(patients.preferredBranchId)
        )
      );
    }

    if (filters?.needsFollowUp !== undefined) {
      conditions.push(eq(patients.needsFollowUp, filters.needsFollowUp));
    }

    if (filters?.status) {
      conditions.push(eq(patients.status, filters.status));
    }

    const query = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id))
      .$dynamic();

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const result = await query;
    return Number(result[0]?.count ?? 0);
  }

  /**
   * Archive a patient (soft-archive: sets status='archived').
   * EC1: blocks if the patient has an active payment plan.
   */
  async archivePatient(id: string): Promise<ArchiveResult> {
    const patient = await this.findOneById(id);
    if (!patient) {
      return { success: false, reason: 'Patient not found' };
    }

    if (patient.hasActivePaymentPlan) {
      return {
        success: false,
        reason: 'Cannot archive patient with an active payment plan',
      };
    }

    if (patient.status === 'archived') {
      return { success: false, reason: 'Patient is already archived' };
    }

    // Atomic WHERE guard prevents TOCTOU: concurrent calls both reading status='active'
    const [updated] = await this.db
      .update(patients)
      .set({ status: 'archived', archivedAt: new Date(), needsFollowUp: false, updatedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.status, 'active')))
      .returning();

    if (!updated) {
      return { success: false, reason: 'Patient status changed concurrently' };
    }

    return { success: true };
  }

  /**
   * Restore an archived patient back to active status.
   */
  async restorePatient(id: string): Promise<ArchiveResult> {
    const patient = await this.findOneById(id);
    if (!patient) {
      return { success: false, reason: 'Patient not found' };
    }

    if (patient.status !== 'archived') {
      return { success: false, reason: 'Patient is not archived' };
    }

    // Atomic WHERE guard prevents TOCTOU on concurrent restore calls
    const [updated] = await this.db
      .update(patients)
      .set({ status: 'active', archivedAt: null, updatedAt: new Date() })
      .where(and(eq(patients.id, id), eq(patients.status, 'archived')))
      .returning();

    if (!updated) {
      return { success: false, reason: 'Patient status changed concurrently' };
    }

    return { success: true };
  }

  /**
   * Check if a patient with a similar name already exists (FR2.5: duplicate detection).
   * Returns matching patients for the same branch — non-blocking (caller decides).
   */
  async findPotentialDuplicates(firstName: string, lastName: string | null, branchId?: string): Promise<PatientWithPerson[]> {
    const conditions: SQL<unknown>[] = [
      ilike(persons.firstName, `%${firstName}%`),
    ];

    if (lastName) {
      conditions.push(ilike(persons.lastName, `%${lastName}%`));
    }

    if (branchId) {
      conditions.push(eq(patients.preferredBranchId, branchId));
    }

    const results = await this.db
      .select({ patient: patients, person: persons })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id))
      .where(and(...conditions))
      .limit(5);

    return results.map(({ patient, person }) => ({
      ...patient,
      person,
    })) as PatientWithPerson[];
  }

}