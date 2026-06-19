/**
 * addPatientCredit — POST /dental/billing/patients/:patientId/credits
 *
 * Phase 4.1 (BR-052): add a positive credit to a patient's ledger (manual
 * goodwill, overpayment, or refund-to-credit). Audited. Branch = explicit
 * (membership asserted) or the patient's preferred branch.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getBranchOrgId, getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import { getPatientBranchForBilling } from '@/handlers/patient/repos/patient-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import type { AddPatientCreditBody, AddPatientCreditParams } from '@/generated/openapi/validators';

export async function addPatientCredit(
  ctx: ValidatedContext<AddPatientCreditBody, never, AddPatientCreditParams>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { patientId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  if (body.amountCents <= 0) throw new ValidationError('Credit amount must be positive');

  const patient = await getPatientBranchForBilling(db, patientId);
  if (!patient) throw new NotFoundError('Patient');

  const branchId = body.branchId ?? patient.preferredBranchId;
  if (!branchId) throw new ValidationError('No branch for credit (patient has no preferred branch)');
  await assertBranchAccess(db, user.id, branchId);

  const membership = await getActiveMembershipId(db, user.id, branchId);
  const credit = await new DentalPatientCreditRepository(db).create({
    patientId,
    branchId,
    amountCents: body.amountCents,
    source: body.source,
    note: body.note ?? null,
    createdByMemberId: membership?.id ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  const org = await getBranchOrgId(db, branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: org?.organizationId ?? branchId,
    branchId,
    eventType: 'data-modification',
    action: 'patient_credit.added',
    resourceType: 'dental_patient_credit',
    resourceId: credit.id,
    metadata: { patientId, amountCents: body.amountCents, source: body.source },
  }, { failClosed: true });

  return ctx.json({
    id: credit.id,
    patientId: credit.patientId,
    branchId: credit.branchId,
    amountCents: credit.amountCents,
    source: credit.source,
    invoiceId: credit.invoiceId ?? undefined,
    note: credit.note ?? undefined,
    createdAt: credit.createdAt.toISOString(),
  }, 201);
}
