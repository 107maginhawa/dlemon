import type { ValidatedContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { MergePatientsBody } from '@/generated/openapi/validators';

/**
 * mergePatients
 * 
 * Path: POST /patients/merge
 * OperationId: mergePatients
 */
export async function mergePatients(
  ctx: ValidatedContext<MergePatientsBody, never, never>
): Promise<Response> {
  const user = ctx.get('user');
  if (!user?.id) throw new UnauthorizedError();
  
  
  
  // Extract validated request body (reserved for future implementation)
  ctx.req.valid('json');

  // EM-PAT-007: patient merge is not yet implemented. Return a clean
  // 501 Not Implemented rather than letting an unhandled Error surface as
  // a misleading 500 Internal Server Error.
  return ctx.json(
    {
      code: 'NOT_IMPLEMENTED',
      message: 'Patient merge is not implemented yet',
    },
    501,
  );
}