import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_deleteImageLinkParams } from '@/generated/openapi/validators';
import { deleteImageLink } from './deleteImageLink';

/**
 * ImagingMgmt_deleteImageLink
 *
 * Path: DELETE /dental/imaging/links/{linkId}
 * OperationId: ImagingMgmt_deleteImageLink
 *
 * ValidatedContext narrows to BaseContext — the impl reads ctx.req.param() directly.
 */
export async function ImagingMgmt_deleteImageLink(
  ctx: ValidatedContext<never, never, ImagingMgmt_deleteImageLinkParams>
): Promise<Response> {
  return deleteImageLink(ctx as BaseContext);
}
