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
import { dentalMemberships } from '@/handlers/dental-org/repos/membership.schema';
import { eq, and } from 'drizzle-orm';
import type { User } from '@/types/auth';
import type { CreatePrescriptionBody, CreatePrescriptionParams } from '@/generated/openapi/validators';

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
    throw new BusinessLogicError('Cannot add prescriptions to a locked or completed visit', 'VISIT_LOCKED');
  }

  // EM-CLI-005: Validate that prescriberMemberId refers to an active membership in this branch.
  // Prevents callers from specifying a member ID from a different branch or an inactive member.
  const [prescriberMembership] = await db
    .select({ id: dentalMemberships.id, role: dentalMemberships.role })
    .from(dentalMemberships)
    .where(
      and(
        eq(dentalMemberships.id, body.prescriberMemberId),
        eq(dentalMemberships.branchId, visit.branchId),
        eq(dentalMemberships.status, 'active'),
      ),
    )
    .limit(1);
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
  });

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_prescription_create', prescriptionId: prescription.id, visitId, prescriberMemberId: body.prescriberMemberId, by: user.id },
    'Prescription created',
  );

  return ctx.json({
    ...prescription,
    warnings: allergyWarnings.length > 0
      ? { allergyConflicts: allergyWarnings }
      : undefined,
  }, 201);
}
