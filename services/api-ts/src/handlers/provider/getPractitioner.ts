import type { ValidatedContext } from '@/types/app';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
} from '@/core/errors';
import type { GetPractitionerParams } from '@/generated/openapi/validators';

/**
 * getPractitioner
 * 
 * Path: GET /providers/practitioners/{id}
 * OperationId: getPractitioner
 */
export async function getPractitioner(
  ctx: ValidatedContext<never, never, GetPractitionerParams>
): Promise<Response> {
  // Get authenticated session from Better-Auth
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }
  // Note: This endpoint requires ownership validation for 'practitioner:owner'
  // Check that the authenticated user owns the requested resource
  // Example:
  // if (session.user.role === 'patient' && params.patientId !== session.user.id) {
  //   throw new ForbiddenError('You can only access your own resources');
  // }
  
  // Extract validated parameters
  const params = ctx.req.valid('param');
  
  
  
  // TODO: Implement business logic
  // Examples of throwing errors:
  // throw new UnauthorizedError();
  // throw new ForbiddenError('You do not have access to this resource');
  // throw new NotFoundError('Resource');
  // throw new ValidationError('Invalid input');
  // throw new BusinessLogicError('Business rule violated', 'BUSINESS_ERROR');
  
  throw new Error('Not implemented: getPractitioner');
}