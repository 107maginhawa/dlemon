import type { ValidatedContext } from '@/types/app';
import type { PatientImageMgmt_listPatientImagesParams } from '@/generated/openapi/validators';
import { listPatientImages } from './listPatientImages';

/**
 * PatientImageMgmt_listPatientImages
 *
 * Path: GET /dental/patients/{patientId}
 * OperationId: PatientImageMgmt_listPatientImages
 */
export async function PatientImageMgmt_listPatientImages(
  ctx: ValidatedContext<never, never, PatientImageMgmt_listPatientImagesParams>
): Promise<Response> {
  return listPatientImages(ctx as any);
}