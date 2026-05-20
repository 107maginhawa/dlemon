import type { ValidatedContext } from '@/types/app';
import type { ImagingMgmt_getImagingStudyParams } from '@/generated/openapi/validators';
import { getImagingStudy } from './getImagingStudy';

/**
 * ImagingMgmt_getImagingStudy
 *
 * Path: GET /dental/imaging/studies/{studyId}
 * OperationId: ImagingMgmt_getImagingStudy
 */
export async function ImagingMgmt_getImagingStudy(
  ctx: ValidatedContext<never, never, ImagingMgmt_getImagingStudyParams>
): Promise<Response> {
  return getImagingStudy(ctx as any);
}