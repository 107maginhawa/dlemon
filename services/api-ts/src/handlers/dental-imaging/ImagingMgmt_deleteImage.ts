import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_deleteImageParams } from '@/generated/openapi/validators';
import { deleteImage } from './deleteImage';

/**
 * ImagingMgmt_deleteImage
 *
 * Path: DELETE /dental/imaging/images/{imageId}
 * OperationId: ImagingMgmt_deleteImage
 */
export async function ImagingMgmt_deleteImage(
  ctx: ValidatedContext<never, never, ImagingMgmt_deleteImageParams>
): Promise<Response> {
  return deleteImage(ctx as any);
}