import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingFindingsMgmt_deleteFindingParams } from '@/generated/openapi/validators';
import { deleteFinding } from './deleteFinding';

/**
 * ImagingFindingsMgmt_deleteFinding
 *
 * Path: DELETE /dental/imaging/findings/{findingId}
 * OperationId: ImagingFindingsMgmt_deleteFinding
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() directly).
 */
export async function ImagingFindingsMgmt_deleteFinding(
  ctx: ValidatedContext<never, never, ImagingFindingsMgmt_deleteFindingParams>
): Promise<Response> {
  return deleteFinding(ctx as BaseContext);
}
