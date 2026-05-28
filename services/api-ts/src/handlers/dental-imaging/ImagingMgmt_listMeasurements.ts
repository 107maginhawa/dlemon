import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_listMeasurementsParams } from '@/generated/openapi/validators';
import { listMeasurements } from './listMeasurements';

/**
 * ImagingMgmt_listMeasurements
 *
 * Path: GET /dental/imaging/images/{imageId}/measurements
 * OperationId: ImagingMgmt_listMeasurements
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_listMeasurements(
  ctx: ValidatedContext<never, never, ImagingMgmt_listMeasurementsParams>
): Promise<Response> {
  return listMeasurements(ctx as BaseContext);
}
