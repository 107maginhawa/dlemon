import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_updateImageCalibrationBody, ImagingMgmt_updateImageCalibrationParams } from '@/generated/openapi/validators';
import { updateImageCalibration } from './updateImageCalibration';

/**
 * ImagingMgmt_updateImageCalibration
 *
 * Path: PATCH /dental/imaging/images/{imageId}/calibration
 * OperationId: ImagingMgmt_updateImageCalibration
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_updateImageCalibration(
  ctx: ValidatedContext<ImagingMgmt_updateImageCalibrationBody, never, ImagingMgmt_updateImageCalibrationParams>
): Promise<Response> {
  return updateImageCalibration(ctx as BaseContext);
}
