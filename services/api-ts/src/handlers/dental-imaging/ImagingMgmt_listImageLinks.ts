import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_listImageLinksParams } from '@/generated/openapi/validators';
import { listImageLinks } from './listImageLinks';

/**
 * ImagingMgmt_listImageLinks
 *
 * Path: GET /dental/imaging/images/{imageId}/links
 * OperationId: ImagingMgmt_listImageLinks
 *
 * ValidatedContext narrows to BaseContext — the impl reads ctx.req.param() directly.
 */
export async function ImagingMgmt_listImageLinks(
  ctx: ValidatedContext<never, never, ImagingMgmt_listImageLinksParams>
): Promise<Response> {
  return listImageLinks(ctx as BaseContext);
}
