import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingFindingsMgmt_updateFindingBody, ImagingFindingsMgmt_updateFindingParams } from '@/generated/openapi/validators';
import { updateFinding } from './updateFinding';

/**
 * ImagingFindingsMgmt_updateFinding
 *
 * Path: PATCH /dental/imaging/findings/{findingId}
 * OperationId: ImagingFindingsMgmt_updateFinding
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingFindingsMgmt_updateFinding(
  ctx: ValidatedContext<ImagingFindingsMgmt_updateFindingBody, never, ImagingFindingsMgmt_updateFindingParams>
): Promise<Response> {
  return updateFinding(ctx as BaseContext);
}
