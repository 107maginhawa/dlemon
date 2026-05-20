import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_listMeasurementsParams } from '@/generated/openapi/validators';
import { listMeasurements } from './listMeasurements';

/**
 * ImagingMgmt_listMeasurements
 *
 * Path: GET /dental/imaging/images/{imageId}/measurements
 * OperationId: ImagingMgmt_listMeasurements
 */
export async function ImagingMgmt_listMeasurements(
  ctx: ValidatedContext<never, never, ImagingMgmt_listMeasurementsParams>
): Promise<Response> {
  return listMeasurements(ctx as any);
}
