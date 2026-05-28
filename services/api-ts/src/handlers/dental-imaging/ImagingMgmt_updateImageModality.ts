import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_updateImageModalityBody, ImagingMgmt_updateImageModalityParams } from '@/generated/openapi/validators';
import { updateImageModality } from './updateImageModality';

/**
 * ImagingMgmt_updateImageModality
 *
 * Path: PATCH /dental/imaging/images/{imageId}/modality
 * OperationId: ImagingMgmt_updateImageModality
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_updateImageModality(
  ctx: ValidatedContext<ImagingMgmt_updateImageModalityBody, never, ImagingMgmt_updateImageModalityParams>
): Promise<Response> {
  return updateImageModality(ctx as BaseContext);
}