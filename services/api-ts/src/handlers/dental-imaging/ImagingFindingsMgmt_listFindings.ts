import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingFindingsMgmt_listFindingsParams } from '@/generated/openapi/validators';
import { listFindings } from './listFindings';

/**
 * ImagingFindingsMgmt_listFindings
 *
 * Path: GET /dental/imaging/images/{imageId}/findings
 * OperationId: ImagingFindingsMgmt_listFindings
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() directly).
 */
export async function ImagingFindingsMgmt_listFindings(
  ctx: ValidatedContext<never, never, ImagingFindingsMgmt_listFindingsParams>
): Promise<Response> {
  return listFindings(ctx as BaseContext);
}
