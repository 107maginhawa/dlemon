import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_updateImageModalityBody, ImagingMgmt_updateImageModalityParams } from '@/generated/openapi/validators';
import { updateImageModality } from './updateImageModality';

/**
 * ImagingMgmt_updateImageModality
 *
 * Path: PATCH /dental/imaging/images/{imageId}/modality
 * OperationId: ImagingMgmt_updateImageModality
 */
export async function ImagingMgmt_updateImageModality(
  ctx: ValidatedContext<ImagingMgmt_updateImageModalityBody, never, ImagingMgmt_updateImageModalityParams>
): Promise<Response> {
  return updateImageModality(ctx as any);
}