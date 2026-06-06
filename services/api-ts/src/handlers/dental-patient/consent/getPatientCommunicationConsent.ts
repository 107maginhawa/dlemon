/**
 * getPatientCommunicationConsent —
 *   GET /dental/patients/:patientId/communication-consent
 *
 * P1-28: read a patient's per-channel communication consent (sms/email/phone/
 * marketing) alongside the registration consent gate.
 */

import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientPersonConsent } from '@/handlers/person/repos/person-dental-patient.facade';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { GetPatientCommunicationConsentParams } from '@/generated/openapi/validators';

export async function getPatientCommunicationConsent(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as GetPatientCommunicationConsentParams;

  const db = ctx.get('database') as DatabaseInstance;

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  const consent = await getPatientPersonConsent(db, patientId);

  return ctx.json(
    {
      registrationConsent: consent?.registrationConsent ?? false,
      channels: consent?.channels ?? {},
      channelsUpdatedAt: consent?.channelsUpdatedAt ?? null,
    },
    200,
  );
}
