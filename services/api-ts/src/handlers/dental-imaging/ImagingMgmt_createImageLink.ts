import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_createImageLinkBody, ImagingMgmt_createImageLinkParams } from '@/generated/openapi/validators';
import { createImageLink } from './createImageLink';

/**
 * ImagingMgmt_createImageLink
 *
 * Path: POST /dental/imaging/images/{imageId}/links
 * OperationId: ImagingMgmt_createImageLink
 *
 * ValidatedContext narrows to BaseContext — the impl reads ctx.req.param()/json() directly.
 */
export async function ImagingMgmt_createImageLink(
  ctx: ValidatedContext<ImagingMgmt_createImageLinkBody, never, ImagingMgmt_createImageLinkParams>
): Promise<Response> {
  return createImageLink(ctx as BaseContext);
}
