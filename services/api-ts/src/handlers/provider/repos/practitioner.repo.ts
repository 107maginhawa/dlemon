/**
 * PractitionerRepository - Data access layer for practitioners table
 */

import { eq, and, ilike, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  practitioners,
  type Practitioner,
  type NewPractitioner,
} from './practitioner.schema';

export interface PractitionerFilters {
  providerId?: string;
  active?: boolean;
  name?: string;
  specialty?: string;
  npi?: string; // not stored directly but kept for interface compat
  q?: string;
}

export class PractitionerRepository extends DatabaseRepository<
  Practitioner,
  NewPractitioner,
  PractitionerFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, practitioners, logger);
  }

  protected buildWhereConditions(filters?: PractitionerFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL[] = [];

    if (filters.providerId) {
      conditions.push(eq(practitioners.providerId, filters.providerId));
    }

    if (filters.active !== undefined) {
      conditions.push(eq(practitioners.active, filters.active));
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  /**
   * Soft-delete a practitioner (FHIR: set active=false)
   */
  async deactivateById(id: string): Promise<Practitioner> {
    return this.updateOneById(id, {
      active: false,
      deactivatedAt: new Date(),
    } as Partial<Practitioner>);
  }
}

export const practitionerRepo = PractitionerRepository;
