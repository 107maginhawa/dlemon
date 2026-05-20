/**
 * createPrescription handler
 *
 * POST /dental/visits/{visitId}/prescriptions
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PrescriptionRepository } from './repos/prescription.repo';
import { medicalHistoryEntries } from './repos/medical-history.schema';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
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
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate']);

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
