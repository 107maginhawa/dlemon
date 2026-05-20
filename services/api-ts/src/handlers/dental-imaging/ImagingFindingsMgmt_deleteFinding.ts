import type { ValidatedContext } from '@/types/app';
import type { ImagingFindingsMgmt_deleteFindingParams } from '@/generated/openapi/validators';
import { deleteFinding } from './deleteFinding';

/**
 * ImagingFindingsMgmt_deleteFinding
 *
 * Path: DELETE /dental/imaging/findings/{findingId}
 * OperationId: ImagingFindingsMgmt_deleteFinding
 */
export async function ImagingFindingsMgmt_deleteFinding(
  ctx: ValidatedContext<never, never, ImagingFindingsMgmt_deleteFindingParams>
): Promise<Response> {
  return deleteFinding(ctx as any);
}
