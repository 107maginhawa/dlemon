/**
 * listDentalPatients — GET /dental/patients
 *
 * FR2.1: List patients with pagination and branchId filter
 * FR2.2: Search patients by name (q param)
 * FR2.10: Filter by follow-up indicator (needsFollowUp=true)
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { PatientRepository } from '../patient/repos/patient.repo';
import { BranchRepository } from '../dental-org/repos/branch.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import type { ListDentalPatientsQuery } from '@/generated/openapi/validators';

export async function listDentalPatients(
  ctx: ValidatedContext<never, ListDentalPatientsQuery, never>
) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const q = ctx.req.valid('query');

  // Branch-level authorization
  if (q['branchId']) {
    await assertBranchAccess(db, user.id, q['branchId']);
  }

  const filters: Record<string, any> = {};

  // When a branchId is provided, expand it to all branches in the same org
  // so patients from any branch in the org are visible (not just one branch)
  if (q['branchId']) {
    const branchRepo = new BranchRepository(db, logger);
    const branch = await branchRepo.findOneById(q['branchId']);
    if (branch?.organizationId) {
      const orgBranches = await branchRepo.listByOrg(branch.organizationId);
      filters['branchIds'] = orgBranches.map((b: any) => b.id);
    } else {
      filters['branchId'] = q['branchId'];
    }
  }

  if (q['q']) filters['q'] = q['q'];
  if (q['needsFollowUp'] === true) filters['needsFollowUp'] = true;
  if (q['status']) filters['status'] = q['status'];

  const limit = Math.min(q.limit ?? 50, 200);
  const offset = q.offset ?? 0;

  const repo = new PatientRepository(db, logger);
  const [allPatients, total] = await Promise.all([
    repo.findManyWithPerson(filters, { pagination: { limit, offset } }),
    repo.countWithPerson(filters),
  ]);

  const mapped = allPatients.map((p: any) => {
    const person = p.person as any;
    const firstName = person?.firstName ?? '';
    const lastName = person?.lastName ?? '';
    return {
      id: p.id,
      displayName: [firstName, lastName].filter(Boolean).join(' ') || 'Unknown',
      dateOfBirth: person?.dateOfBirth ?? null,
      gender: person?.gender ?? null,
      preferredBranchId: p.preferredBranchId ?? null,
      needsFollowUp: p.needsFollowUp ?? false,
      hasActivePaymentPlan: p.hasActivePaymentPlan ?? false,
      status: p.status ?? 'active',
      recallDate: p.recallDate ?? null,
      createdAt: p.createdAt,
      person,
    };
  });

  logger?.info({ action: 'listDentalPatients', filters, count: mapped.length }, 'Dental patients listed');

  return ctx.json({ patients: mapped, total, limit, offset }, 200);
}
