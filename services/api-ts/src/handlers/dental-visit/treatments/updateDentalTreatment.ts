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
import { recomputePlanForTreatment } from '@/handlers/dental-patient/repos/treatment-plan.facade';
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

  // EF-VIS-001: completed/locked visits cannot be modified — lock gate
  if (visit.status === 'completed' || visit.status === 'locked') {
    throw new BusinessLogicError('Visit is immutable and cannot be modified', 'VISIT_IMMUTABLE');
  }

  // BR-007 / AC-VIS-003: performed and verified treatment fields are immutable
  // (code, tooth, surface, etc.) — status transitions are still allowed.
  // MODULE_SPEC AC-VIS-003 is explicit: a PATCH changing cdt_code on a
  // status==='performed' treatment must return 422 (TREATMENT_IMMUTABLE).
  if (treatment.status === 'performed' || treatment.status === 'verified') {
    const fieldEdit = body.cdtCode || body.toothNumber !== undefined || body.surfaces || body.description || body.conditionCode;
    if (fieldEdit) throw new BusinessLogicError('Performed treatment is immutable', 'TREATMENT_IMMUTABLE');
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
    // TR-P1-08: a dismissed item leaves the plan's completion denominator — recompute.
    await recomputePlanForTreatment(db, treatmentId);
    // V-VIS-006: dismiss is a clinically-significant terminal transition — audit it.
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    await logAuditEvent(db, ctx.get('logger'), {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      action: 'treatment.dismissed',
      resourceType: 'dental_treatment',
      resourceId: treatmentId,
      metadata: { visitId: treatment.visitId, reason },
    });
    return ctx.json(dismissed);
  }

  // Decline (informed refusal) — requires a refusalReason
  if (body.status === 'declined') {
    if (!body.refusalReason?.trim()) {
      throw new BusinessLogicError('refusalReason is required when declining a treatment', 'REFUSAL_REASON_REQUIRED');
    }
    const refusalReason = body.refusalReason.trim();
    const declined = await repo.decline(treatmentId, refusalReason);
    // TR-P1-08: a declined item leaves the plan's completion denominator — recompute.
    await recomputePlanForTreatment(db, treatmentId);
    // V-VIS-006: patient refusal is a clinically- and legally-significant terminal
    // transition — audit it (refusalReason captured for the compliance record).
    const branchForAudit = await getBranchOrgId(db, visit.branchId);
    await logAuditEvent(db, ctx.get('logger'), {
      personId: user.id,
      tenantId: branchForAudit?.organizationId ?? visit.branchId,
      branchId: visit.branchId,
      action: 'treatment.declined',
      resourceType: 'dental_treatment',
      resourceId: treatmentId,
      metadata: { visitId: treatment.visitId, refusalReason },
    });
    return ctx.json(declined);
  }

  // EC4: priceCents is locked at creation — updates are ignored
  const patch: Partial<Pick<DentalTreatment, 'status' | 'toothNumber' | 'surfaces' | 'cdtCode' | 'description' | 'conditionCode' | 'clinicalNotes' | 'performedAt' | 'phase' | 'priority'>> = {};
  if (body.status) patch.status = body.status as DentalTreatment['status'];
  if (body.status === 'performed') patch.performedAt = new Date();
  if (body.toothNumber !== undefined) patch.toothNumber = body.toothNumber;
  if (body.surfaces) patch.surfaces = body.surfaces;
  if (body.cdtCode) patch.cdtCode = body.cdtCode;
  if (body.description) patch.description = body.description;
  if (body.conditionCode) patch.conditionCode = body.conditionCode;
  if (body.clinicalNotes !== undefined) patch.clinicalNotes = body.clinicalNotes;
  // P1-18: phase + priority are sequencing metadata (not clinical-record fields),
  // so they remain editable even on performed/verified items.
  if (body.phase !== undefined) patch.phase = body.phase as DentalTreatment['phase'];
  if (body.priority !== undefined) patch.priority = body.priority;

  const updated = await repo.update(treatmentId, patch);

  // TR-P1-08 / TP-BR-005: a status transition (→performed/→verified) can change the
  // parent plan's completion — recompute it (no-op if the treatment isn't plan-linked).
  if (body.status) await recomputePlanForTreatment(db, treatmentId);

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
