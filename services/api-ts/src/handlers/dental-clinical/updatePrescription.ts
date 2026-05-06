/**
 * updatePrescription handler
 *
 * PATCH /dental/visits/{visitId}/prescriptions/{prescriptionId}
 */

import type { HandlerContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PrescriptionRepository } from './repos/prescription.repo';
import { VisitRepository } from '@/handlers/dental-visit/repos/visit.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { User } from '@/types/auth';

export async function updatePrescription(ctx: HandlerContext) {
  const user = ctx.get('user') as User | undefined;
  if (!user?.id) throw new UnauthorizedError('Authentication required');

  const prescriptionId = ctx.req.param('prescriptionId')!;
  const body = await ctx.req.json().catch(() => ({})) as Record<string, unknown>;

  const db = ctx.get('database') as DatabaseInstance;
  const repo = new PrescriptionRepository(db);

  const existing = await repo.findOneById(prescriptionId);
  if (!existing) throw new NotFoundError('Prescription');

  // Branch-level authorization via parent visit
  const visitRepo = new VisitRepository(db);
  const visit = await visitRepo.findOneById(existing.visitId);
  if (!visit) throw new NotFoundError('Visit');
  await assertBranchAccess(db, user.id, visit.branchId);

  const patch: Record<string, unknown> = {};
  if (typeof body['rxNormCode'] === 'string') patch['rxNormCode'] = body['rxNormCode'];
  if (typeof body['drugName'] === 'string') patch['drugName'] = body['drugName'];
  if (typeof body['dosage'] === 'string') patch['dosage'] = body['dosage'];
  if (typeof body['frequency'] === 'string') patch['frequency'] = body['frequency'];
  if (typeof body['duration'] === 'string') patch['duration'] = body['duration'];
  if (typeof body['quantity'] === 'string') patch['quantity'] = body['quantity'];
  if (typeof body['instructions'] === 'string') patch['instructions'] = body['instructions'];

  const updated = await repo.update(prescriptionId, patch as any);
  return ctx.json(updated);
}
