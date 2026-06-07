/**
 * ConsentRefusalRepository — data access for informed refusal records
 *
 * Refusal records are immutable after creation. No update or delete.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { consentRefusals, type ConsentRefusal, type NewConsentRefusal } from './consent-refusal.schema';
import type { Logger } from '@/types/logger';

export interface ConsentRefusalFilters {
  visitId?: string;
  patientId?: string;
}

export class ConsentRefusalRepository extends DatabaseRepository<ConsentRefusal, NewConsentRefusal, ConsentRefusalFilters> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, consentRefusals, logger);
  }

  protected buildWhereConditions(filters?: ConsentRefusalFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(consentRefusals.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(consentRefusals.patientId, filters.patientId));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: ConsentRefusalFilters): Promise<ConsentRefusal[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(consentRefusals).where(where)
      : await this.db.select().from(consentRefusals);
  }

  override async findOneById(id: string): Promise<ConsentRefusal | null> {
    const [row] = await this.db.select().from(consentRefusals).where(eq(consentRefusals.id, id));
    return row ?? null;
  }
}
