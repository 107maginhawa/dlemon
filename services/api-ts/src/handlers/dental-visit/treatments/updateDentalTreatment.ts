/**
 * updateDentalTreatment handler
 *
 * PATCH /dental/visits/{visitId}/treatments/{treatmentId}
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { TreatmentRepository } from '../repos/treatment.repo';
import { VisitRepository } from '../repos/visit.repo';
import type { DentalTreatment, DentalTreatmentStatus } from '../repos/treatment.schema';
import { TREATMENT_TRANSITIONS } from '../repos/treatment.schema';
import { hasSignedConsentForVisit } from '@/handlers/dental-clinical/repos/clinical-visit.facade';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { User } from '@/types/auth';
import type { UpdateDentalTreatmentBody, UpdateDentalTreatmentParams } from '@/generated/openapi/validators';
import { logAuditEvent } from '@/core/audit-logger';

export async function updateDentalTreatment(
  ctx: ValidatedContext<UpdateDentalTreatmentBody, never, UpdateDentalTreatmentParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { treatmentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new TreatmentRepository(db);

  const treatment = await repo.findOneById(treatmentId);
  if (!treatment) throw new NotFoundError('Dental treatment');

  // Branch authorization — look up visit to get branchId
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(treatment.visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-007: verified treatment fields are immutable (status transitions still allowed)
  if (treatment.status === 'verified') {
    const fieldEdit = body.cdtCode || body.toothNumber !== undefined || body.surfaces || body.description || body.conditionCode;
    if (fieldEdit) throw new BusinessLogicError('Verified treatment is immutable', 'TREATMENT_IMMUTABLE');
  }

  // Validate status transition if a new status is requested
  if (body.status) {
    const currentStatus = treatment.status as DentalTreatmentStatus;
    const newStatus = body.status as DentalTreatmentStatus;
    const allowed = TREATMENT_TRANSITIONS[currentStatus];
    if (!allowed.includes(newStatus)) {
      throw new BusinessLogicError(
        `Invalid status transition: '${currentStatus}' → '${newStatus}'. Allowed: [${allowed.join(', ') || 'none'}]`,
      );
    }
  }

  // Require signed consent before marking a treatment as performed (P0-003)
  if (body.status === 'performed') {
    if (!await hasSignedConsentForVisit(db, treatment.visitId)) {
      throw new BusinessLogicError(
        'Signed consent form required before marking treatment as performed',
        'TREATMENT_CONSENT_REQUIRED',
      );
    }
  }

  // Dismiss with reason
  if (body.status === 'dismissed') {
    const reason = body.dismissReason ?? 'Dismissed';
    const dismissed = await repo.dismiss(treatmentId, reason);
    return ctx.json(dismissed);
  }

  // Decline (informed refusal) — requires a refusalReason
  if (body.status === 'declined') {
    if (!body.refusalReason?.trim()) {
      throw new BusinessLogicError('refusalReason is required when declining a treatment', 'REFUSAL_REASON_REQUIRED');
    }
    const declined = await repo.decline(treatmentId, body.refusalReason.trim());
    return ctx.json(declined);
  }

  // EC4: priceCents is locked at creation — updates are ignored
  const patch: Partial<Pick<DentalTreatment, 'status' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode' | 'clinicalNotes' | 'performedAt'>> = {};
  if (body.status) patch.status = body.status as DentalTreatment['status'];
  if (body.status === 'performed') patch.performedAt = new Date();
  if (body.toothNumber !== undefined) patch.toothNumber = body.toothNumber;
  if (body.surfaces) patch.surfaces = body.surfaces;
  if (body.cdtCode) patch.cdtCode = body.cdtCode;
  if (body.description) patch.description = body.description;
  if (body.conditionCode) patch.conditionCode = body.conditionCode;
  if (body.clinicalNotes !== undefined) patch.clinicalNotes = body.clinicalNotes;

  const updated = await repo.update(treatmentId, patch);

  if (body.status === 'performed' && visit) {
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    await logAuditEvent(db, ctx.get('logger'), {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      action: 'treatment.performed',
      resourceType: 'dental_treatment',
      resourceId: treatmentId,
      metadata: { visitId: treatment.visitId },
    });
  }

  return ctx.json(updated);
}
