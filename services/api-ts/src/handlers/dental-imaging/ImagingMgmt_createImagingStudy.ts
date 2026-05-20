import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_createImagingStudyBody } from '@/generated/openapi/validators';
import { createImagingStudy } from './createImagingStudy';

/**
 * ImagingMgmt_createImagingStudy
 *
 * Path: POST /dental/imaging/studies
 * OperationId: ImagingMgmt_createImagingStudy
 */
export async function ImagingMgmt_createImagingStudy(
  ctx: ValidatedContext<ImagingMgmt_createImagingStudyBody, never, never>
): Promise<Response> {
  return createImagingStudy(ctx as any);
}