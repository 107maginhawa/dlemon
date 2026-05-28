import type { ValidatedContext, BaseContext } from '@/types/app';
import type { PatientImageMgmt_listPatientImagesParams } from '@/generated/openapi/validators';
import { listPatientImages } from './listPatientImages';

/**
 * PatientImageMgmt_listPatientImages
 *
 * Path: GET /dental/patients/{patientId}
 * OperationId: PatientImageMgmt_listPatientImages
 *
 * ValidatedContext<Body, Query, Param> structurally extends BaseContext —
 * the narrowing cast is safe; it only drops the typed .req.valid() overloads
 * that the underlying handler does not use (it calls ctx.req.param() / ctx.req.json() directly).
 */
export async function PatientImageMgmt_listPatientImages(
  ctx: ValidatedContext<never, never, PatientImageMgmt_listPatientImagesParams>
): Promise<Response> {
  return listPatientImages(ctx as BaseContext);
}