/**
 * PractitionerRoleRepository - Data access layer for practitioner_roles table
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  practitionerRoles,
  type PractitionerRole,
  type NewPractitionerRole,
} from './practitioner.schema';

export interface PractitionerRoleFilters {
  practitionerId?: string;
  active?: boolean;
  specialty?: string;
  organization?: string; // organization ref id (not a DB column, filtered in-app)
  location?: string;
}

export class PractitionerRoleRepository extends DatabaseRepository<
  PractitionerRole,
  NewPractitionerRole,
  PractitionerRoleFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, practitionerRoles, logger);
  }

  protected buildWhereConditions(filters?: PractitionerRoleFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;

    const conditions: SQL[] = [];

    if (filters.practitionerId) {
      conditions.push(eq(practitionerRoles.practitionerId, filters.practitionerId));
    }

    if (filters.active !== undefined) {
      conditions.push(eq(practitionerRoles.active, filters.active));
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  /**
   * Soft-delete a practitioner role (FHIR: set active=false)
   */
  async deactivateById(id: string): Promise<PractitionerRole> {
    return this.updateOneById(id, {
      active: false,
      deactivatedAt: new Date(),
    } as Partial<PractitionerRole>);
  }
}

export const practitionerRoleRepo = PractitionerRoleRepository;
