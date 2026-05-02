/**
 * AmendmentRepository — data access for amendments (additive-only)
 *
 * Amendments link to original records and are never updated after creation.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { amendments, type Amendment, type NewAmendment } from './amendment.schema';

export interface AmendmentFilters {
  visitId?: string;
  patientId?: string;
  originalRecordId?: string;
}

export class AmendmentRepository extends DatabaseRepository<Amendment, NewAmendment, AmendmentFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, amendments, logger);
  }

  protected buildWhereConditions(filters?: AmendmentFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(amendments.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(amendments.patientId, filters.patientId));
    if (filters.originalRecordId) conditions.push(eq(amendments.originalRecordId, filters.originalRecordId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: AmendmentFilters): Promise<Amendment[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(amendments).where(where)
      : await this.db.select().from(amendments);
  }

  override async findOneById(id: string): Promise<Amendment | null> {
    const [row] = await this.db.select().from(amendments).where(eq(amendments.id, id));
    return row ?? null;
  }
}
