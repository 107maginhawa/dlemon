/**
 * updatePatientCommunicationConsent —
 *   PATCH /dental/patients/:patientId/communication-consent
 *
 * P1-28: set/update a patient's per-channel communication consent. Partial — only
 * the supplied channels change; registration consent is preserved. Audited write.
 */

import { UnauthorizedError, NotFoundError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { updatePatientChannelConsent } from '@/handlers/person/repos/person-dental-patient.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { UpdatePatientCommunicationConsentParams, UpdatePatientCommunicationConsentBody } from '@/generated/openapi/validators';

export async function updatePatientCommunicationConsent(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId } = ctx.req.valid('param') as UpdatePatientCommunicationConsentParams;
  const body = ctx.req.valid('json') as UpdatePatientCommunicationConsentBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const channels = {
    ...(body.sms !== undefined ? { sms: body.sms } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.marketing !== undefined ? { marketing: body.marketing } : {}),
  };

  const consent = await updatePatientChannelConsent(db, patientId, channels, user.id);
  if (!consent) throw new NotFoundError('Patient not found');

  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    branchId: patient.preferredBranchId ?? undefined,
    action: 'patient.communication_consent.updated',
    resourceType: 'dental_patient',
    resourceId: patientId,
  });

  return ctx.json(
    {
      registrationConsent: consent.registrationConsent,
      channels: consent.channels ?? {},
      channelsUpdatedAt: consent.channelsUpdatedAt ?? null,
    },
    200,
  );
}
