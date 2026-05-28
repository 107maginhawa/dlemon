import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_deleteMeasurementParams } from '@/generated/openapi/validators';
import { deleteMeasurement } from './deleteMeasurement';

/**
 * ImagingMgmt_deleteMeasurement
 *
 * Path: DELETE /dental/imaging/measurements/{measurementId}
 * OperationId: ImagingMgmt_deleteMeasurement
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_deleteMeasurement(
  ctx: ValidatedContext<never, never, ImagingMgmt_deleteMeasurementParams>
): Promise<Response> {
  return deleteMeasurement(ctx as BaseContext);
}
