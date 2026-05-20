import type { ValidatedContext } from '@/types/app';
import type { ImagingFindingsMgmt_updateFindingBody, ImagingFindingsMgmt_updateFindingParams } from '@/generated/openapi/validators';
import { updateFinding } from './updateFinding';

/**
 * ImagingFindingsMgmt_updateFinding
 *
 * Path: PATCH /dental/imaging/findings/{findingId}
 * OperationId: ImagingFindingsMgmt_updateFinding
 */
export async function ImagingFindingsMgmt_updateFinding(
  ctx: ValidatedContext<ImagingFindingsMgmt_updateFindingBody, never, ImagingFindingsMgmt_updateFindingParams>
): Promise<Response> {
  return updateFinding(ctx as any);
}
