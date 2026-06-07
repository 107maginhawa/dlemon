/**
 * LegalHoldRepository — data access for dental_legal_hold.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import {
  dentalLegalHolds,
  type DentalLegalHold,
  type NewDentalLegalHold,
  type LegalHoldStatus,
} from './legal-hold.schema';

export interface LegalHoldFilters {
  tenantId?: string;
  subjectPersonId?: string;
  status?: LegalHoldStatus;
}

export class LegalHoldRepository extends DatabaseRepository<
  DentalLegalHold,
  NewDentalLegalHold,
  LegalHoldFilters
> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, dentalLegalHolds, logger);
  }

  protected buildWhereConditions(filters?: LegalHoldFilters) {
    const conditions = [];
    if (filters?.tenantId) conditions.push(eq(dentalLegalHolds.tenantId, filters.tenantId));
    if (filters?.subjectPersonId) conditions.push(eq(dentalLegalHolds.subjectPersonId, filters.subjectPersonId));
    if (filters?.status) conditions.push(eq(dentalLegalHolds.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
