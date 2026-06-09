/**
 * acceptCasePresentation —
 *   POST /dental/patients/:patientId/case-presentations/:presentationId/accept
 *
 * P1-20 (Phase 1, staff bearerAuth): the patient accepts the presented case on the
 * staff's authenticated session. We:
 *   1. capture an immutable consent e-signature (reuse V-CLN-005 consent-form e-sig);
 *   2. transition the plan presented → approved through TREATMENT_PLAN_FSM, appending
 *      a P2-8 status-history row;
 *   3. mark the presentation decision = accepted (terminal — re-deciding is 422).
 *
 * Accept does NOT auto-book — scheduling stays a staff action (P1-21
 * attach-appointment) against real calendar slots; accept just unlocks it.
 */

import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  BusinessLogicError,
} from '@/core/errors';
import { getPatientForDentalPatient } from '@/handlers/patient/repos/patient-dental-patient.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { CasePresentationRepository } from '../repos/case-presentation.repo';
import { TreatmentPlanRepository } from '../repos/treatment-plan.repo';
import { TREATMENT_PLAN_FSM } from '../repos/treatment-plan.schema';
import { writeAcceptanceConsent } from '@/handlers/dental-clinical/repos/case-presentation-consent.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import type { DatabaseInstance } from '@/core/database';
import type { HandlerContext } from '@/types/app';
import type { AcceptCasePresentationParams, AcceptCasePresentationBody } from '@/generated/openapi/validators';

export async function acceptCasePresentation(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const { patientId, presentationId } = ctx.req.valid('param') as AcceptCasePresentationParams;
  const body = ctx.req.valid('json') as AcceptCasePresentationBody;

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const patient = await getPatientForDentalPatient(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');
  // E1: accept = chairside signature capture on the staff session — reachable by
  // the broader chairside set (clinicians + coordinator + reception/assist).
  if (!patient.preferredBranchId) throw new ForbiddenError('Patient has no assigned branch');
  await assertBranchRole(db, user.id, patient.preferredBranchId, [
    'dentist_owner', 'dentist_associate', 'treatment_coordinator',
    'staff_full', 'front_desk', 'dental_assistant',
  ]);
  if (patient.status === 'archived') {
    throw new ForbiddenError('Cannot modify an archived patient', 'PATIENT_ARCHIVED');
  }

  const repo = new CasePresentationRepository(db, logger);
  const presentation = await repo.findOneById(presentationId, patientId);
  if (!presentation) throw new NotFoundError('Case presentation not found');

  // Immutability: a decided presentation is terminal (mirrors V-CLN-005 consent e-sig).
  if (presentation.decision) {
    throw new BusinessLogicError(
      'Case presentation has already been decided and cannot be changed',
      'PRESENTATION_DECIDED',
    );
  }

  const planRepo = new TreatmentPlanRepository(db, logger);
  const plan = await planRepo.findOneById(presentation.treatmentPlanId, patientId);
  if (!plan) throw new NotFoundError('Treatment plan not found');

  // FSM guard: accept is only legal from 'presented' → 'approved'.
  if (!TREATMENT_PLAN_FSM[plan.status].includes('approved')) {
    throw new BusinessLogicError(
      `Cannot accept a plan in status '${plan.status}' (accept requires 'presented')`,
      'PLAN_INVALID_TRANSITION',
    );
  }

  // G3: converge with approveTreatmentPlan — link the patient's pending
  // treatments to the plan before resolving the consent anchor. This is the
  // same step approveTreatmentPlan performs; doing it here keeps the two
  // approval paths persisting the SAME truth (linked items + approval record),
  // and makes accept robust even for a plan presented before the G1 fix.
  // Idempotent: only unlinked treatments are claimed.
  await planRepo.linkPendingTreatments(plan.id, patientId);

  // 1. Immutable consent e-sig, hung off the plan's visit.
  const visitId = await repo.findPlanVisitId(plan.id, patientId);
  if (!visitId) {
    throw new BusinessLogicError(
      'Plan has no linked treatment items to consent to',
      'PLAN_HAS_NO_ITEMS',
    );
  }
  const consent = await writeAcceptanceConsent(db, {
    visitId,
    patientId,
    signatureData: body.signatureData,
    signerName: body.signerName,
    acceptedPlanVersionId: presentation.planVersionId,
    createdBy: user.id,
  });

  // G3: record a TreatmentPlanApproval (parity with approveTreatmentPlan) so an
  // accepted case-presentation yields the SAME persisted approval truth as the
  // staff approval path. The approver is the patient who signed.
  await planRepo.createApproval({
    treatmentPlanId: plan.id,
    approvedByPersonId: patient.personId,
    method: 'signature',
    consentFormId: consent.id,
    planVersionId: presentation.planVersionId ?? null,
    signatureData: body.signatureData ?? null,
    createdBy: user.id,
    updatedBy: user.id,
  });

  // 2. Plan presented → approved (+ P2-8 status-history row).
  const updatedPlan = await planRepo.update(plan.id, patientId, {
    status: 'approved',
    approvedAt: new Date(),
  });
  await planRepo.recordStatusHistory({
    treatmentPlanId: plan.id,
    fromStatus: plan.status,
    toStatus: 'approved',
    changedByPersonId: user.id,
    createdBy: user.id,
    updatedBy: user.id,
  });

  // 3. Presentation decision = accepted (terminal).
  const decided = await repo.decide(presentationId, patientId, 'accepted', {
    signatureData: body.signatureData,
    signerName: body.signerName,
    consentFormId: consent.id,
  });
  if (!decided) {
    // Lost a race: another request decided it first.
    throw new BusinessLogicError(
      'Case presentation has already been decided and cannot be changed',
      'PRESENTATION_DECIDED',
    );
  }

  // dental-audit P1-B: accepting a presented case is a sensitive clinical approval
  // (patient e-signature) — write an audit row with before/after plan status.
  const branchForAudit = await getBranchOrgId(db, patient.preferredBranchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? patient.preferredBranchId,
    branchId: patient.preferredBranchId,
    eventType: 'data-modification',
    action: 'case_presentation.accepted',
    resourceType: 'dental_case_presentation',
    resourceId: presentationId,
    before: { decision: null, planStatus: plan.status },
    after: { decision: 'accepted', planStatus: 'approved' },
    metadata: { treatmentPlanId: plan.id, consentFormId: consent.id },
  });

  logger?.info(
    { action: 'acceptCasePresentation', patientId, presentationId, planId: plan.id, consentFormId: consent.id },
    'Case presentation accepted',
  );

  return ctx.json({ presentation: decided, plan: updatedPlan, consentFormId: consent.id }, 200);
}
