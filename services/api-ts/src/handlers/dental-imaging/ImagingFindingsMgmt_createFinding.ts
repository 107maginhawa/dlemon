import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingFindingsMgmt_createFindingBody, ImagingFindingsMgmt_createFindingParams } from '@/generated/openapi/validators';
import { createFinding } from './createFinding';

/**
 * ImagingFindingsMgmt_createFinding
 *
 * Path: POST /dental/imaging/images/{imageId}/findings
 * OperationId: ImagingFindingsMgmt_createFinding
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingFindingsMgmt_createFinding(
  ctx: ValidatedContext<ImagingFindingsMgmt_createFindingBody, never, ImagingFindingsMgmt_createFindingParams>
): Promise<Response> {
  return createFinding(ctx as BaseContext);
}
