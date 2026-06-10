import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_updateImageMetadataBody, ImagingMgmt_updateImageMetadataParams } from '@/generated/openapi/validators';
import { updateImageMetadata } from './updateImageMetadata';

/**
 * ImagingMgmt_updateImageMetadata
 *
 * Path: PATCH /dental/imaging/images/{imageId}/metadata
 * OperationId: ImagingMgmt_updateImageMetadata
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_updateImageMetadata(
  ctx: ValidatedContext<ImagingMgmt_updateImageMetadataBody, never, ImagingMgmt_updateImageMetadataParams>
): Promise<Response> {
  return updateImageMetadata(ctx as BaseContext);
}
