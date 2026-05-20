import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_updateImageCalibrationBody, ImagingMgmt_updateImageCalibrationParams } from '@/generated/openapi/validators';
import { updateImageCalibration } from './updateImageCalibration';

/**
 * ImagingMgmt_updateImageCalibration
 *
 * Path: PATCH /dental/imaging/images/{imageId}/calibration
 * OperationId: ImagingMgmt_updateImageCalibration
 */
export async function ImagingMgmt_updateImageCalibration(
  ctx: ValidatedContext<ImagingMgmt_updateImageCalibrationBody, never, ImagingMgmt_updateImageCalibrationParams>
): Promise<Response> {
  return updateImageCalibration(ctx as any);
}
