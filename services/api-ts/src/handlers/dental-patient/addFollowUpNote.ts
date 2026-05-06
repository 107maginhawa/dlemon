import type { ValidatedContext } from '@/types/app';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessLogicError,
} from '@/core/errors';
import type { AddFollowUpNoteBody, AddFollowUpNoteParams } from '@/generated/openapi/validators';

/**
 * addFollowUpNote
 * 
 * Path: POST /{id}/follow-up-notes
 * OperationId: addFollowUpNote
 */
export async function addFollowUpNote(
  ctx: ValidatedContext<AddFollowUpNoteBody, never, AddFollowUpNoteParams>
): Promise<Response> {
  // Get authenticated session from Better-Auth
  const session = ctx.get('session');
  if (!session) {
    throw new UnauthorizedError();
  }
  
  // Extract validated parameters
  const params = ctx.req.valid('param');
  
  // Extract validated request body
  const body = ctx.req.valid('json');
  
  // TODO: Implement business logic
  // Examples of throwing errors:
  // throw new UnauthorizedError();
  // throw new ForbiddenError('You do not have access to this resource');
  // throw new NotFoundError('Resource');
  // throw new ValidationError('Invalid input');
  // throw new BusinessLogicError('Business rule violated', 'BUSINESS_ERROR');
  
  throw new Error('Not implemented: addFollowUpNote');
}