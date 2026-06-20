/**
 * ErasureRequestRepository — data access for dental_erasure_request (V-DG-002).
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import type { Logger } from '@/types/logger';
import {
  dentalErasureRequests,
  type DentalErasureRequest,
  type NewDentalErasureRequest,
  type ErasureRequestStatus,
} from './erasure-request.schema';

export interface ErasureRequestFilters {
  tenantId?: string;
  subjectPersonId?: string;
  status?: ErasureRequestStatus;
}

export class ErasureRequestRepository extends DatabaseRepository<
  DentalErasureRequest,
  NewDentalErasureRequest,
  ErasureRequestFilters
> {
  constructor(db: DatabaseInstance, logger?: Logger) {
    super(db, dentalErasureRequests, logger);
  }

  protected buildWhereConditions(filters?: ErasureRequestFilters) {
    const conditions = [];
    if (filters?.tenantId) conditions.push(eq(dentalErasureRequests.tenantId, filters.tenantId));
    if (filters?.subjectPersonId) conditions.push(eq(dentalErasureRequests.subjectPersonId, filters.subjectPersonId));
    if (filters?.status) conditions.push(eq(dentalErasureRequests.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Atomically transition a request OUT of 'requested' to a terminal status, only if it is
   * still 'requested'. The `status='requested'` predicate makes the decision idempotent
   * under concurrency: of two simultaneous approve/reject calls (both passed the pre-write
   * status check) the second UPDATE re-evaluates against the first's committed row, matches
   * 0 rows, and returns null — so the caller (which CLAIMS the transition before any
   * side-effect) never double-anonymizes or clobbers a committed decision. No transaction
   * required; the conditional WHERE is the guard.
   */
  async transitionFromRequested(
    id: string,
    patch: Partial<NewDentalErasureRequest>,
  ): Promise<DentalErasureRequest | null> {
    const [row] = await this.db
      .update(dentalErasureRequests)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(dentalErasureRequests.id, id), eq(dentalErasureRequests.status, 'requested')))
      .returning();
    return row ?? null;
  }
}
