import { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import type { User, Session } from '@/types/auth';
import type { AuthInstance } from '@/utils/auth';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError
} from '@/core/errors';
import { ProviderRepository } from './repos/provider.repo';
import { PersonRepository } from '../person/repos/person.repo';
import { type ProviderCreateRequest, type ProviderWithPerson } from './repos/provider.schema';
import { addUserRole } from '@/utils/auth';

/**
 * createProvider
 * 
 * Path: POST /providers
 * OperationId: createProvider
 * Security: bearerAuth with role ["owner"]
 */
export async function createProvider(ctx: Context) {
  // Get authenticated user (guaranteed by middleware)
  const user = ctx.get('user') as User;
  
  // Owner role - user can only create provider profile for themselves
  if (!user.id) {
    throw new BusinessLogicError('User must have a person profile before creating provider profile', 'MISSING_PERSON_PROFILE');
  }
  
  // Get validated request body
  const body = ctx.req.valid('json') as ProviderCreateRequest;
  
  // Get dependencies from context
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  
  // Instantiate repositories
  const providerRepo = new ProviderRepository(db, logger);
  const personRepo = new PersonRepository(db, logger);
  
  // Ensure person exists for the user (create if needed)
  const person = await personRepo.ensurePersonForUser(user, body.person);

  logger?.info({
    userId: user.id,
    personId: person.id,
    personIdMatchesUserId: person.id === user.id,
    action: 'provider_creation_person_check'
  }, 'Person ensured for provider creation');

  // Check if provider profile already exists for this person
  const existingProvider = await providerRepo.findByPersonId(person.id);
  if (existingProvider) {
    throw new BusinessLogicError('Provider profile already exists for this person', 'PROVIDER_EXISTS');
  }

  // Create provider record
  const provider = await providerRepo.createOne({
    person: person.id,
    providerType: body.providerType, // Required field
    yearsOfExperience: body.yearsOfExperience,
    biography: body.biography,
    minorAilmentsSpecialties: body.minorAilmentsSpecialties,
    minorAilmentsPracticeLocations: body.minorAilmentsPracticeLocations
  });

  logger?.info({
    userId: user.id,
    personId: person.id,
    providerId: provider.id,
    providerPerson: provider.person,
    providerPersonMatchesPersonId: provider.person === person.id,
    providerPersonMatchesUserId: provider.person === user.id,
    action: 'provider_created'
  }, 'Provider record created');

  // Add provider role to user after creating profile
  await addUserRole(db, user, 'provider');

  // Invalidate current session to force re-authentication with updated roles
  // User will need to sign in again to get fresh JWT with provider role
  const session = ctx.get('session') as Session;
  const auth = ctx.get('auth') as AuthInstance;
  if (session?.token && auth) {
    try {
      await auth.api.revokeSession({
        headers: ctx.req.raw.headers
      });
      logger?.info({ userId: user.id }, 'Session invalidated after provider role assignment');
    } catch (error) {
      // Log but don't fail the request if session revocation fails
      logger?.warn({ error, userId: user.id }, 'Failed to revoke session after role assignment');
    }
  }

  // Log audit trail
  logger?.info({
    providerId: provider.id,
    personId: person.id,
    action: 'create',
    createdBy: user.id,
    ipAddress: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip')
  }, 'Provider profile created');
  
  // Return provider with expanded person data (always expand on create)
  const response = {
    ...provider,
    person // Always expanded on create
  };
  
  return ctx.json(response, 201);
}