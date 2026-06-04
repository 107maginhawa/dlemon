/**
 * createPrescription handler
 *
 * POST /dental/visits/{visitId}/prescriptions
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ForbiddenError, BusinessLogicError } from '@/core/errors';
import { getVisitOrThrow } from '@/handlers/dental-visit/utils/visit.service';
import { PrescriptionRepository } from '../repos/prescription.repo';
import { medicalHistoryEntries } from '../repos/medical-history.schema';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActiveMembershipByIdForClinical } from '@/handlers/dental-org/repos/org-clinical.facade';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import { eq, and } from 'drizzle-orm';
import type { User } from '@/types/auth';
import type { CreatePrescriptionBody, CreatePrescriptionParams } from '@/generated/openapi/validators';
import { checkDrugInteractions } from '../utils/drug-interactions';

export async function createPrescription(
  ctx: ValidatedContext<CreatePrescriptionBody, never, CreatePrescriptionParams>
): Promise<Response> {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const { visitId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visit = await getVisitOrThrow(db, visitId);
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-003: writes to locked or completed visits are blocked
  if (visit.status === 'locked' || visit.status === 'completed') {
    throw new BusinessLogicError('Cannot add prescriptions to a locked or completed visit', 'VISIT_IMMUTABLE');
  }

  // EM-CLI-005: Validate that prescriberMemberId refers to an active membership in this branch.
  // Prevents callers from specifying a member ID from a different branch or an inactive member.
  const prescriberMembership = await getActiveMembershipByIdForClinical(db, body.prescriberMemberId, visit.branchId);
  if (!prescriberMembership) {
    throw new ForbiddenError('prescriberMemberId does not correspond to an active membership in this branch');
  }

  const repo = new PrescriptionRepository(db);

  // FR1.12: Allergy cross-check — warn (non-blocking) if drug matches a patient allergy
  const drugName = body.drugName.toLowerCase();
  const allergies = await db.select().from(medicalHistoryEntries).where(
    and(
      eq(medicalHistoryEntries.patientId, body.patientId),
      eq(medicalHistoryEntries.entryType, 'allergy'),
      eq(medicalHistoryEntries.active, true)
    )
  );
  const allergyWarnings = allergies
    .filter(a => a.displayName.toLowerCase().includes(drugName) || drugName.includes(a.displayName.toLowerCase()))
    .map(a => a.displayName);

  // P1-2: Drug-drug interaction check — warn (non-blocking) if drug interacts with
  // any active medication. Uses a curated dental-relevant interaction reference;
  // NOT a full drug interaction database. See utils/drug-interactions.ts for scope.
  const activeMedications = await db.select().from(medicalHistoryEntries).where(
    and(
      eq(medicalHistoryEntries.patientId, body.patientId),
      eq(medicalHistoryEntries.entryType, 'medication'),
      eq(medicalHistoryEntries.active, true)
    )
  );
  const drugInteractions = checkDrugInteractions(
    body.drugName,
    activeMedications.map(m => m.displayName),
  );

  const prescription = await repo.createOne({
    visitId,
    patientId: body.patientId,
    prescriberMemberId: body.prescriberMemberId,
    rxNormCode: body.rxNormCode,
    drugName: body.drugName,
    dosage: body.dosage,
    frequency: body.frequency,
    duration: body.duration,
    quantity: body.quantity,
    instructions: body.instructions,
    dispenseAsWritten: body.dispenseAsWritten ?? false,
    // P2-13: US-context legal Rx fields (record-only). Optional + additive;
    // `controlledSubstanceSchedule` defaults to 'none' when omitted.
    controlledSubstanceSchedule: body.controlledSubstanceSchedule ?? 'none',
    prescriberDea: body.prescriberDea,
    prescriberNpi: body.prescriberNpi,
  });

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_prescription_create', prescriptionId: prescription.id, visitId, prescriberMemberId: body.prescriberMemberId, by: user.id },
    'Prescription created',
  );

  // V-CLN-001: persist an audit row for the AUDIT_CONTRACTS "Write prescription" event.
  const branchForAudit = await getBranchOrgId(db, visit.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: user.id,
    tenantId: branchForAudit?.organizationId ?? visit.branchId,
    branchId: visit.branchId,
    action: 'prescription.created',
    resourceType: 'dental_prescription',
    resourceId: prescription.id,
    metadata: { visitId, patientId: body.patientId, prescriberMemberId: body.prescriberMemberId },
  });

  const hasAllergyWarnings = allergyWarnings.length > 0;
  const hasDrugInteractions = drugInteractions.length > 0;

  return ctx.json({
    ...prescription,
    warnings: (hasAllergyWarnings || hasDrugInteractions)
      ? {
          ...(hasAllergyWarnings ? { allergyConflicts: allergyWarnings } : {}),
          ...(hasDrugInteractions ? { drugInteractions } : {}),
        }
      : undefined,
  }, 201);
}
