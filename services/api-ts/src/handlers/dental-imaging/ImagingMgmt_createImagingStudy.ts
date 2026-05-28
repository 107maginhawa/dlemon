import type { ValidatedContext, BaseContext } from '@/types/app';
import type { ImagingMgmt_createImagingStudyBody } from '@/generated/openapi/validators';
import { createImagingStudy } from './createImagingStudy';

/**
 * ImagingMgmt_createImagingStudy
 *
 * Path: POST /dental/imaging/studies
 * OperationId: ImagingMgmt_createImagingStudy
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function ImagingMgmt_createImagingStudy(
  ctx: ValidatedContext<ImagingMgmt_createImagingStudyBody, never, never>
): Promise<Response> {
  return createImagingStudy(ctx as BaseContext);
}