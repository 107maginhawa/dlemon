import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User } from '@/types/auth';
import { 
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ProviderRepository } from './repos/provider.repo';
// Auto-expand via middleware - no manual expand logic needed

/**
 * getProvider
 * 
 * Path: GET /providers/{providerId}
 * OperationId: getProvider
 * Security: Public endpoint, but supports special /providers/me for authenticated users
 */
export async function getProvider(ctx: Context) {
  // Get path parameter and query
  let providerId = ctx.req.param('provider');
  const query = ctx.req.valid('query') as { expand?: string[] };
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repository
  const repo = new ProviderRepository(db, logger);
  
  // Handle special 'me' endpoint - get current user's provider profile
  if (providerId === 'me') {
    // Authentication required for 'me' endpoint
    const user = ctx.get('user') as User;
    if (!user) {
      throw new UnauthorizedError('Authentication required for /providers/me endpoint');
    }
    
    if (!user.id) {
      throw new NotFoundError('No provider profile found for current user', {
        resourceType: 'provider',
        resource: 'me',
        suggestions: ['Create provider profile first', 'Verify authentication']
      });
    }
    
    // Find provider by person ID
    const provider = await repo.findByPersonId(user.id);
    if (!provider) {
      throw new NotFoundError('No provider profile found for current user', {
        resourceType: 'provider',
        resource: 'me',
        suggestions: ['Create provider profile first', 'Complete user profile']
      });
    }
    
    providerId = provider.id;
  }
  
  const user = ctx.get('user') as User | undefined;
  
  // Get provider (expansion handled automatically by auto-expand middleware)
  const provider = await repo.findOneById(providerId);
  
  if (!provider) {
    throw new NotFoundError('Provider not found', {
      resourceType: 'provider',
      resource: providerId,
      suggestions: ['Check provider ID format', 'Verify provider exists in system']
    });
  }
  
  // For public access, only return active providers
  // For authenticated users accessing their own profile, return regardless of status
  const personId = typeof provider.person === 'string' ? provider.person : provider.person.id;
  const isOwner = user && user.id === personId;
  
  // Note: Provider schema doesn't have a status field based on current TypeSpec
  // This check may need to be removed or status field added to TypeSpec
  // if (!isOwner && provider.status !== 'active') {
  //   throw new NotFoundError('Provider not found');
  // }
  
  // Log audit trail
  logger?.info({
    providerId: provider.id,
    personId,
    action: 'view',
    viewedBy: user?.id || 'anonymous',
    isOwner: isOwner || false,
    isPublic: !isOwner,
    wasMeEndpoint: ctx.req.param('provider') === 'me'
  }, 'Provider retrieved');
  
  // Return the provider data
  return ctx.json(provider, 200);
}