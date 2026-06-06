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
}
