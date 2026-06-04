/**
 * PatientRepository - Data access layer for patients
 * Encapsulates all database operations for the patients table
 */

import { eq, and, inArray, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import {
  patients,
  type Patient,
  type NewPatient,
  type PatientWithPerson,
} from './patient.schema';
import {
  findPatientWithPersonById,
  findManyPatientsWithPerson,
  countPatientsWithPerson,
  findPotentialDuplicatePatients,
  findActivePatientsWithPersonByBranch,
} from './patient-person.facade';

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
    return findPatientWithPersonById(this.db, patientId);
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
    return findManyPatientsWithPerson(this.db, filters, options);
  }

  /**
   * Count patients matching filters (for accurate pagination totals).
   * Mirrors findManyWithPerson filter logic without pagination.
   */
  async countWithPerson(
    filters?: PatientFilters
  ): Promise<number> {
    return countPatientsWithPerson(this.db, filters);
  }

  /**
   * Archive a patient (soft-archive: sets status='archived').
   * EC1: blocks if the patient has an active payment plan.
   */
  async archivePatient(id: string, note?: string): Promise<ArchiveResult> {
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
      .set({ status: 'archived', archivedAt: new Date(), needsFollowUp: false, updatedAt: new Date(), archiveNote: note ?? null })
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
    return findPotentialDuplicatePatients(this.db, firstName, lastName, branchId);
  }

  /**
   * P2-16: duplicate-patient detection. Scans the active patients in a branch and
   * clusters likely duplicates by a normalized match key:
   *   - "strong"  — same lower(firstName)+lower(lastName)+dateOfBirth, OR same
   *                 name + a shared phone/email (a DOB-less but contact-confirmed dup)
   *   - "name"    — same lower(firstName)+lower(lastName) but DOB differs/missing
   * Returns one group per cluster of 2+ patients for staff to review/merge. Merge
   * itself already exists (patient/mergePatients.ts) — this only surfaces candidates.
   */
  async findDuplicateCandidates(branchId: string): Promise<
    Array<{
      matchType: 'strong' | 'name';
      matchKey: string;
      patients: PatientWithPerson[];
    }>
  > {
    const records = await findActivePatientsWithPersonByBranch(this.db, branchId);

    const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
    const nameKey = (p: PatientWithPerson) => `${norm(p.person.firstName)}|${norm(p.person.lastName)}`;
    const contactValues = (p: PatientWithPerson): string[] => {
      const c = p.person.contactInfo as { email?: string; phone?: string } | null | undefined;
      return [norm(c?.email), norm(c?.phone)].filter((v) => v.length > 0);
    };

    // Cluster by strong key (name + DOB) and by name-only key.
    const strong = new Map<string, PatientWithPerson[]>();
    const byName = new Map<string, PatientWithPerson[]>();
    for (const r of records) {
      byName.set(nameKey(r), [...(byName.get(nameKey(r)) ?? []), r]);
      if (r.person.dateOfBirth) {
        const k = `${nameKey(r)}|${r.person.dateOfBirth}`;
        strong.set(k, [...(strong.get(k) ?? []), r]);
      }
    }

    const groups: Array<{ matchType: 'strong' | 'name'; matchKey: string; patients: PatientWithPerson[] }> = [];
    const claimed = new Set<string>();

    // Strong groups first (name + DOB).
    for (const [key, members] of strong) {
      if (members.length < 2) continue;
      members.forEach((m) => claimed.add(m.id));
      groups.push({ matchType: 'strong', matchKey: key, patients: members });
    }

    // Name-only groups: same name, plus either a shared contact (→ strong) or
    // simply not already claimed by a strong DOB group.
    for (const [key, members] of byName) {
      const unclaimed = members.filter((m) => !claimed.has(m.id));
      if (unclaimed.length < 2) continue;
      // Promote to "strong" if any two share a contact value.
      const contactCounts = new Map<string, number>();
      for (const m of unclaimed) for (const v of contactValues(m)) contactCounts.set(v, (contactCounts.get(v) ?? 0) + 1);
      const sharesContact = [...contactCounts.values()].some((n) => n >= 2);
      unclaimed.forEach((m) => claimed.add(m.id));
      groups.push({ matchType: sharesContact ? 'strong' : 'name', matchKey: key, patients: unclaimed });
    }

    return groups;
  }

}