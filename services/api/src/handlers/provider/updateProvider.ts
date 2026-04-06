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
import { type ProviderUpdateRequest } from './repos/provider.schema';

/**
 * updateProvider
 * 
 * Path: PATCH /providers/{providerId}
 * OperationId: updateProvider
 * Security: bearerAuth with role ["owner"]
 */
export async function updateProvider(ctx: Context) {
  // Get authenticated user (guaranteed by middleware)
  const user = ctx.get('user') as User;
  
  // Get path parameter
  const providerId = ctx.req.param('provider');
  
  // Get validated request body
  const body = await ctx.req.json() as ProviderUpdateRequest;
  
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
  
  // Check authorization - owner can only update their own record
  const personId = provider.person; // provider.person is always a string (UUID)
  const isOwner = personId === user.id;
  if (!isOwner) {
    throw new ForbiddenError('You can only update your own provider profile');
  }
  
  // Build update payload
  const updateData: any = {};
  
  if (body.yearsOfExperience !== undefined) updateData.yearsOfExperience = body.yearsOfExperience;
  if (body.biography !== undefined) updateData.biography = body.biography;
  if (body.minorAilmentsSpecialties !== undefined) updateData.minorAilmentsSpecialties = body.minorAilmentsSpecialties;
  if (body.minorAilmentsPracticeLocations !== undefined) updateData.minorAilmentsPracticeLocations = body.minorAilmentsPracticeLocations;
  
  // Add audit fields
  updateData.updatedBy = user.id;
  
  // Update provider record
  const updatedProvider = await repo.updateOneById(providerId, updateData);
  
  // Log audit trail
  logger?.info({
    providerId: updatedProvider.id,
    personId: updatedProvider.person,
    action: 'update',
    updatedFields: Object.keys(updateData).filter(key => key !== 'updatedBy'),
    updatedBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Provider profile updated');
  
  // Get updated provider with person data
  const providerWithPerson = await repo.findOneByIdWithPerson(updatedProvider.id);
  
  return ctx.json(providerWithPerson, 200);
}