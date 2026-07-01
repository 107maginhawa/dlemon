import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_updateMeasurementBody, ImagingMgmt_updateMeasurementParams } from '@/generated/openapi/validators';
import { updateMeasurement } from './updateMeasurement';

/**
 * ImagingMgmt_updateMeasurement
 *
 * Path: PATCH /dental/imaging/measurements/{measurementId}
 * OperationId: ImagingMgmt_updateMeasurement
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext — the
 * narrowing cast is safe; the handler reads ctx.req.param() / ctx.req.json() directly.
 */
export async function ImagingMgmt_updateMeasurement(
  ctx: ValidatedContext<ImagingMgmt_updateMeasurementBody, never, ImagingMgmt_updateMeasurementParams>
): Promise<Response> {
  return updateMeasurement(ctx as BaseContext);
}
