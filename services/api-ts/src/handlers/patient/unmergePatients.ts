import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError, ForbiddenError } from '@/core/errors';
import type { User } from '@/types/auth';
import type { UnmergePatientsBody } from '@/generated/openapi/validators';

/**
 * unmergePatients
 *
 * Path: POST /patients/unmerge
 * OperationId: unmergePatients
 */
export async function unmergePatients(
  ctx: ValidatedContext<UnmergePatientsBody, never, never>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError();

  // x-security-required-roles: ["admin"] — patient unmerge is an admin-only operation
  if (user.role !== 'admin') {
    throw new ForbiddenError('Only administrators can unmerge patients');
  }

  // Extract validated request body (reserved for future implementation)
  ctx.req.valid('json');

  // EM-PAT-007: patient unmerge is not yet implemented (BR-020, deferred to
  // Phase 2 alongside merge). Return a clean 501 Not Implemented — mirroring
  // mergePatients — rather than letting an unhandled Error surface as a
  // misleading 500 Internal Server Error.
  return ctx.json(
    {
      code: 'NOT_IMPLEMENTED',
      message: 'Patient unmerge is not implemented yet',
    },
    501,
  );
}
