import type { ValidatedContext } from '@/types/app';
import type { ListAuditLogsQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import {
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError
} from '@/core/errors';
import { parsePagination, buildPaginationMeta, parseFilters } from '@/utils/query';
import { AuditRepository } from './repos/audit.repo';
import type { AuditLogFilters, AuditLogQueryParams } from './repos/audit.schema';

/**
 * listAuditLogs
 * 
 * Path: GET /audit/logs
 * OperationId: listAuditLogs
 * Security: bearerAuth with roles ["admin", "compliance"]
 */
export async function listAuditLogs(
  ctx: ValidatedContext<never, ListAuditLogsQuery, never>
): Promise<Response> {
  // Get authenticated user and check authorization
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const userRole: string = user.role ?? '';
  const roles = userRole.split(',').map((r: string) => r.trim());
  if (!roles.includes('admin') && !roles.includes('compliance')) {
    throw new ForbiddenError('admin or compliance role required to access audit logs');
  }

  // Get query parameters
  const query = ctx.req.valid('query') as AuditLogQueryParams;
  
  // Spread into a plain object so it is assignable to Record<string, unknown>
  const queryRecord: Record<string, unknown> = { ...query };

  // Parse pagination with audit-specific defaults
  const { limit, offset } = parsePagination(queryRecord, { limit: 25, maxLimit: 100 });

  // Parse filters - only allow specific fields for security
  const allowedFields = [
    'eventType', 'category', 'action', 'outcome',
    'user', 'userType', 'resourceType', 'resource',
    'retentionStatus', 'startDate', 'endDate', 'ipAddress'
  ];

  const rawFilters = parseFilters(queryRecord, allowedFields);

  // Convert date strings to Date objects if present
  const startDateRaw = rawFilters['startDate'];
  const endDateRaw = rawFilters['endDate'];
  const filters: AuditLogFilters = {
    ...rawFilters,
    startDate: startDateRaw != null ? new Date(String(startDateRaw)) : undefined,
    endDate: endDateRaw != null ? new Date(String(endDateRaw)) : undefined
  };
  
  // Validate date range
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    throw new ValidationError('startDate cannot be after endDate');
  }
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new AuditRepository(db, logger);
  
  // Get paginated audit logs and total count
  const [auditLogs, totalCount] = await Promise.all([
    repo.findMany(filters, { 
      pagination: { limit, offset }
      // orderBy handled by buildWhereConditions in repository
    }),
    repo.count(filters)
  ]);
  
  // Build pagination metadata
  const paginationMeta = buildPaginationMeta(auditLogs, totalCount, limit, offset);

  // Self-log this access for compliance audit trail
  await repo.logEvent({
    eventType: 'data-access',
    category: 'hipaa',
    action: 'read',
    outcome: 'success',
    resourceType: 'audit_log',
    resource: 'audit_log_list',
    description: 'Audit logs accessed',
    user: user.id,
  }, user.id);

  // Log successful query
  logger?.info({
    userId: user.id,
    filters,
    resultCount: auditLogs.length,
    totalCount,
    pagination: { limit, offset }
  }, 'Audit logs queried successfully');
  
  // Format response with TypeSpec-compliant structure
  const response = {
    data: auditLogs.map(entry => ({
      ...entry,
      // Ensure dates are properly serialized
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),

      archivedAt: entry.archivedAt?.toISOString() || null,
      purgeAfter: entry.purgeAfter?.toISOString() || null
    })),
    pagination: paginationMeta
  };
  
  return ctx.json(response, 200);
}