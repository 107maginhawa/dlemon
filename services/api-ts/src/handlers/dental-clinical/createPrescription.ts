/**
 * createPrescription handler
 *
 * POST /dental/visits/{visitId}/prescriptions
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { ValidationError, UnauthorizedError, NotFoundError } from '@/core/errors';
import { PrescriptionRepository } from './repos/prescription.repo';
import { medicalHistoryEntries } from './repos/medical-history.schema';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { eq, and } from 'drizzle-orm';
import type { User } from '@/types/auth';

export async function createPrescription(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const visitId = ctx.req.param('visitId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  if (!body['patientId'] || typeof body['patientId'] !== 'string') throw new ValidationError('patientId is required');
  if (!body['prescriberMemberId'] || typeof body['prescriberMemberId'] !== 'string') throw new ValidationError('prescriberMemberId is required');
  if (!body['drugName'] || typeof body['drugName'] !== 'string') throw new ValidationError('drugName is required');
  if (!body['dosage'] || typeof body['dosage'] !== 'string') throw new ValidationError('dosage is required');
  if (!body['frequency'] || typeof body['frequency'] !== 'string') throw new ValidationError('frequency is required');

  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization via parent visit
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const repo = new PrescriptionRepository(db);

  // FR1.12: Allergy cross-check — warn (non-blocking) if drug matches a patient allergy
  const patientId = body['patientId'] as string;
  const drugName = (body['drugName'] as string).toLowerCase();
  const allergies = await db.select().from(medicalHistoryEntries).where(
    and(
      eq(medicalHistoryEntries.patientId, patientId),
      eq(medicalHistoryEntries.entryType, 'allergy'),
      eq(medicalHistoryEntries.active, true)
    )
  );
  const allergyWarnings = allergies
    .filter(a => a.displayName.toLowerCase().includes(drugName) || drugName.includes(a.displayName.toLowerCase()))
    .map(a => a.displayName);

  const prescription = await repo.createOne({
    visitId,
    patientId: body['patientId'] as string,
    prescriberMemberId: body['prescriberMemberId'] as string,
    rxNormCode: typeof body['rxNormCode'] === 'string' ? body['rxNormCode'] : undefined,
    drugName: body['drugName'] as string,
    dosage: body['dosage'] as string,
    frequency: body['frequency'] as string,
    duration: typeof body['duration'] === 'string' ? body['duration'] : undefined,
    quantity: typeof body['quantity'] === 'string' ? body['quantity'] : undefined,
    instructions: typeof body['instructions'] === 'string' ? body['instructions'] : undefined,
    dispenseAsWritten: body['dispenseAsWritten'] === true,
  });

  return ctx.json({
    ...prescription,
    warnings: allergyWarnings.length > 0
      ? { allergyConflicts: allergyWarnings }
      : undefined,
  }, 201);
}
