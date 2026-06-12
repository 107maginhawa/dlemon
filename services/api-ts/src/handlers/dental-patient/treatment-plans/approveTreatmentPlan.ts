/**
 * approveTreatmentPlan — POST /dental/patients/:patientId/treatment-plans/:planId/approval
 *
 * CR-05 / TP-BR-005 (TR-P1-08): records a patient approval of a treatment plan and
 * binds the plan's items.
 *
 * On approval:
 *  1. Writes an append-only dental_treatment_plan_approval record (who/method/consent).
 *  2. Links the patient's currently-pending (diagnosed/planned) treatments to the plan
 *     as its items (so completion can be derived — TP-BR-005).
 *  3. Moves the header to `approved` (+ approvedAt) and recomputes its derived status.
 *
 * Only a `presented` or already-`approved` plan can be approved; draft/cancelled/
 * completed plans are rejected.
 */

import { UnauthorizedError, NotFoundError, BusinessLogicError, ForbiddenError } from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';

export async function approveTreatmentPlan(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, planId } = ctx.req.valid('param') as { patientId: string; planId: string };
  const body = ctx.req.valid('json') as {
    approvedByPersonId: string;
    method: 'portal' | 'signature' | 'verbal';
    consentFormId?: string | null;
    planVersionId?: string | null;
    signatureData?: string | null;
  };

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new TreatmentPlanRepository(db, logger);
  const plan = await repo.findOneById(planId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  if (plan.status !== 'presented' && plan.status !== 'approved') {
    throw new BusinessLogicError(
      `A ${plan.status} plan cannot be approved (must be presented).`,
      'PLAN_NOT_APPROVABLE',
    );
  }

  // 1. CR-05 approval record
  const approval = await repo.createApproval({
    treatmentPlanId: planId,
    approvedByPersonId: body.approvedByPersonId,
    method: body.method,
    consentFormId: body.consentFormId ?? null,
    planVersionId: body.planVersionId ?? null,
    signatureData: body.signatureData ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  // 2. Bind items + 3. move header to approved
  await repo.linkPendingTreatments(planId, patientId);
  if (plan.status === 'presented') {
    await repo.update(planId, patientId, { status: 'approved', approvedAt: new Date() });
    // P2-8: capture the presented → approved transition on the status timeline.
    await repo.recordStatusHistory({
      treatmentPlanId: planId,
      fromStatus: 'presented',
      toStatus: 'approved',
      changedByPersonId: user.id,
      createdBy: user.id,
      updatedBy: user.id,
    });
  }

  // Derive completion (covers the rare case where linked items are already done).
  await repo.recomputeStatus(planId, patientId);
  // TP-BR-006: keep the denormalized total in lock-step with the linked items.
  const finalPlan = await repo.recomputeTotal(planId, patientId);

  // dental-audit P1-B / dental-patient G5: plan approval is a sensitive clinical
  // sign-off — write an audit row with before/after status (fail-closed so the
  // approval can't silently commit without its trail).
  const auditBranchId = patient.preferredBranchId ?? undefined;
  const branchForAudit = auditBranchId ? await getBranchOrgId(db, auditBranchId) : null;
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? auditBranchId ?? patientId,
    branchId: auditBranchId,
    eventType: 'data-modification',
    action: 'treatment_plan.approved',
    resourceType: 'dental_treatment_plan',
    resourceId: planId,
    before: { status: plan.status },
    after: { status: finalPlan?.status ?? 'approved', approvalMethod: approval.method },
  }, { failClosed: true });

  logger?.info(
    { action: 'approveTreatmentPlan', patientId, planId, approvalId: approval.id, method: approval.method },
    'Treatment plan approved',
  );

  return ctx.json({ approval, plan: finalPlan }, 201);
}
