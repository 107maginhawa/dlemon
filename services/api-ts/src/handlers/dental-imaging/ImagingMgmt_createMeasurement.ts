import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_createMeasurementBody, ImagingMgmt_createMeasurementParams } from '@/generated/openapi/validators';
import { createMeasurement } from './createMeasurement';

/**
 * ImagingMgmt_createMeasurement
 *
 * Path: POST /dental/imaging/images/{imageId}/measurements
 * OperationId: ImagingMgmt_createMeasurement
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_createMeasurement(
  ctx: ValidatedContext<ImagingMgmt_createMeasurementBody, never, ImagingMgmt_createMeasurementParams>
): Promise<Response> {
  return createMeasurement(ctx as BaseContext);
}
