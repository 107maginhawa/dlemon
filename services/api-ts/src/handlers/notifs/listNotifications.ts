import type { ValidatedContext } from '@/types/app';
import type { ListNotificationsQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { UnauthorizedError } from '@/core/errors';
import { parsePagination, buildPaginationMeta, parseFilters } from '@/utils/query';
import { NotificationRepository } from './repos/notification.repo';
import type { NotificationFilters } from './repos/notification.schema';

/**
 * listNotifications
 * 
 * Path: GET /notifications
 * OperationId: listNotifications
 * Security: bearerAuth
 */
export async function listNotifications(
  ctx: ValidatedContext<never, ListNotificationsQuery, never>
): Promise<Response> {
  // Get authenticated user and check authorization
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) {
    throw new UnauthorizedError();
  }

  // Extract validated query parameters
  const query = ctx.req.valid('query');

  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Get the user's person ID
  const userId = user.id;

  // Parse pagination with defaults
  const { limit, offset } = parsePagination(query, { limit: 25, maxLimit: 100 });

  // Parse filters (only allowed fields - removed 'unreadOnly')
  const filters = parseFilters(query, ['type', 'channel', 'status', 'startDate', 'endDate']);

  // Convert string dates to Date objects if present
  if (filters['startDate']) {
    filters['startDate'] = new Date(filters['startDate'] as string);
  }
  if (filters['endDate']) {
    filters['endDate'] = new Date(filters['endDate'] as string);
  }

  // Instantiate repositories
  const repo = new NotificationRepository(db, logger);

  // Get notifications for the current user only
  const result = await repo.findManyByRecipient(
    userId,
    filters as NotificationFilters,
    { pagination: { limit, offset } }
  );
  
  // Build pagination metadata
  const paginationMeta = buildPaginationMeta(
    result.data,
    result.totalCount,
    limit,
    offset
  );
  
  // Log audit trail
  logger?.info({
    action: 'list_notifications',
    userId,
    filters,
    pagination: { limit, offset },
    resultCount: result.data.length,
    totalCount: result.totalCount
  }, 'Notifications listed');
  
  // Return paginated response
  return ctx.json({
    data: result.data,
    pagination: paginationMeta
  }, 200);
}