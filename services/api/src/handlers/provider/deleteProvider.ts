import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { 
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ProviderRepository } from './repos/provider.repo';
import { removeUserRole } from '@/utils/auth';

/**
 * deleteProvider
 * 
 * Path: DELETE /providers/{providerId}
 * OperationId: deleteProvider
 * Security: bearerAuth with role ["owner"]
 */
export async function deleteProvider(ctx: Context) {
  // Get authenticated user (guaranteed by middleware)
  const user = ctx.get('user') as User;
  
  // Get path parameter
  const providerId = ctx.req.param('provider');
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new ProviderRepository(db, logger);
  
  // Find and validate provider exists
  const provider = await repo.findOneById(providerId);
  if (!provider) {
    throw new NotFoundError('Provider not found', {
      resourceType: 'provider',
      resource: providerId,
      suggestions: ['Check provider ID format', 'Verify provider exists in system', 'Complete profile setup']
    });
  }
  
  // Check authorization - owner can only delete their own record
  const personId = typeof provider.person === 'string' ? provider.person : provider.person.id;
  const isOwner = personId === user.id;
  if (!isOwner) {
    throw new ForbiddenError('You can only delete your own provider profile');
  }
  
  // Perform hard delete (provider profile only - person record preserved)
  await repo.deleteOneById(providerId, user.id);

  // Remove provider role from user
  await removeUserRole(db, user, 'provider');
  
  // Log audit trail
  logger?.info({
    providerId,
    personId,
    action: 'delete',
    deletedBy: user.id,
    isOwner,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Provider profile deleted');
  
  // Return 204 No Content response as per TypeSpec
  return ctx.body(null, 204);
}
