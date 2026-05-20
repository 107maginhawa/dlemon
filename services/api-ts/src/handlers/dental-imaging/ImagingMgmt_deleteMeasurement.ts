import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_deleteMeasurementParams } from '@/generated/openapi/validators';
import { deleteMeasurement } from './deleteMeasurement';

/**
 * ImagingMgmt_deleteMeasurement
 *
 * Path: DELETE /dental/imaging/measurements/{measurementId}
 * OperationId: ImagingMgmt_deleteMeasurement
 */
export async function ImagingMgmt_deleteMeasurement(
  ctx: ValidatedContext<never, never, ImagingMgmt_deleteMeasurementParams>
): Promise<Response> {
  return deleteMeasurement(ctx as any);
}
