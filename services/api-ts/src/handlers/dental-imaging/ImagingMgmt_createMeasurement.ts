import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_createMeasurementBody, ImagingMgmt_createMeasurementParams } from '@/generated/openapi/validators';
import { createMeasurement } from './createMeasurement';

/**
 * ImagingMgmt_createMeasurement
 *
 * Path: POST /dental/imaging/images/{imageId}/measurements
 * OperationId: ImagingMgmt_createMeasurement
 */
export async function ImagingMgmt_createMeasurement(
  ctx: ValidatedContext<ImagingMgmt_createMeasurementBody, never, ImagingMgmt_createMeasurementParams>
): Promise<Response> {
  return createMeasurement(ctx as any);
}
