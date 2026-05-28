import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_getImagingStudyParams } from '@/generated/openapi/validators';
import { getImagingStudy } from './getImagingStudy';

/**
 * ImagingMgmt_getImagingStudy
 *
 * Path: GET /dental/imaging/studies/{studyId}
 * OperationId: ImagingMgmt_getImagingStudy
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_getImagingStudy(
  ctx: ValidatedContext<never, never, ImagingMgmt_getImagingStudyParams>
): Promise<Response> {
  return getImagingStudy(ctx as BaseContext);
}