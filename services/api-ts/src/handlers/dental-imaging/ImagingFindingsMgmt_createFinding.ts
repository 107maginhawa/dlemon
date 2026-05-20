import type { ValidatedContext } from '@/types/app';
import type { ImagingFindingsMgmt_createFindingBody, ImagingFindingsMgmt_createFindingParams } from '@/generated/openapi/validators';
import { createFinding } from './createFinding';

/**
 * ImagingFindingsMgmt_createFinding
 *
 * Path: POST /dental/imaging/images/{imageId}/findings
 * OperationId: ImagingFindingsMgmt_createFinding
 */
export async function ImagingFindingsMgmt_createFinding(
  ctx: ValidatedContext<ImagingFindingsMgmt_createFindingBody, never, ImagingFindingsMgmt_createFindingParams>
): Promise<Response> {
  return createFinding(ctx as any);
}
