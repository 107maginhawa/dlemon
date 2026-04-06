import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import {
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { PatientRepository } from './repos/patient.repo';
import { parsePagination, buildPaginationMeta, parseFilters } from '@/utils/query';
// Auto-expand via middleware - no manual expand logic needed
import type { User } from '@/types/auth';

/**
 * listPatients
 * 
 * Path: GET /patients
 * OperationId: listPatients
 * Security: bearerAuth with role ["admin"]
 */
export async function listPatients(ctx: Context) {
  // Get authenticated user (middleware guarantees user exists)
  const user = ctx.get('user') as User;
  
  
  // Extract validated query parameters
  const query = ctx.req.valid('query') as {
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
    q?: string;
    expand?: string[];
    status?: 'active' | 'inactive' | 'archived';
  };

  // Parse pagination with utilities - use TypeSpec defaults (limit: 20, maxLimit: 100)
  const { limit, offset } = parsePagination(query, { limit: 20, maxLimit: 100 });

  // Parse filters with utilities
  const filters = parseFilters(query, ['q', 'status']);
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new PatientRepository(db, logger);
  
  // Fetch patients (expansion handled automatically by auto-expand middleware)
  const patients = await repo.findMany(filters, { pagination: { limit, offset } });
  
  // Get total count for proper pagination metadata
  const totalCount = await repo.count(filters);
  
  // Build pagination metadata
  const paginationMeta = buildPaginationMeta(patients, totalCount, limit, offset);
  
  // Log audit trail
  logger?.info({
    action: 'list',
    requestedBy: user.id,
    filters,
    pagination: { limit, offset },
    resultCount: patients.length,
    totalCount
  }, 'Patients list retrieved');
  
  // Return standardized paginated response
  return ctx.json({
    data: patients,
    pagination: paginationMeta
  }, 200);
}