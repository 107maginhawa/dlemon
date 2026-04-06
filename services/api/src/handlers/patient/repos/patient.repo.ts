/**
 * PatientRepository - Data access layer for patients
 * Encapsulates all database operations for the patients table
 */

import { eq, and, or, ilike, isNull, inArray, sql, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository, type PaginationOptions } from '@/core/database.repo';
import { 
  patients, 
  type Patient, 
  type NewPatient,
  type PatientWithPerson
} from './patient.schema';
import { persons } from '../../person/repos/person.schema';

export interface PatientFilters {
  person?: string;
  q?: string; // General search query
  ids?: string[]; // Filter by patient IDs using IN query
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
    
    if (result.length === 0) {
      return null;
    }
    
    const { patient, person } = result[0];
    
    this.logger?.debug({ patientId, found: true }, 'Patient with person data retrieved');
    
    return {
      ...patient,
      person
    };
  }

  /**
   * Delete a patient by ID (hard delete)
   */
  async deleteOneById(id: string): Promise<void> {
    this.logger?.debug({ id }, 'Deleting patient by ID');
    await super.deleteOneById(id);
    this.logger?.info({ id }, 'Patient deleted successfully');
  }

  /**
   * Find patients with person data joined
   */
  async findManyWithPerson(
    filters?: PatientFilters & { q?: string },
    options?: { pagination?: PaginationOptions }
  ): Promise<PatientWithPerson[]> {
    this.logger?.debug({ filters, options }, 'Finding patients with person data');
    
    let query = this.db
      .select({
        patient: patients,
        person: persons
      })
      .from(patients)
      .innerJoin(persons, eq(patients.person, persons.id));
    
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
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Apply pagination
    if (options?.pagination) {
      const { limit = 25, offset = 0 } = options.pagination;
      query = query.limit(limit).offset(offset);
    }
    
    const results = await query;
    
    this.logger?.debug({ 
      filters, 
      resultCount: results.length 
    }, 'Patients with person data retrieved');
    
    return results.map(({ patient, person }) => ({
      ...patient,
      person
    }));
  }

}