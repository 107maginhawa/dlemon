import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_deleteImageParams } from '@/generated/openapi/validators';
import { deleteImage } from './deleteImage';

/**
 * ImagingMgmt_deleteImage
 *
 * Path: DELETE /dental/imaging/images/{imageId}
 * OperationId: ImagingMgmt_deleteImage
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_deleteImage(
  ctx: ValidatedContext<never, never, ImagingMgmt_deleteImageParams>
): Promise<Response> {
  return deleteImage(ctx as BaseContext);
}