/**
 * listInsuranceClaims — GET /dental/billing/claims
 *
 * P1-26 worklist: filter by branch, status, payer (insuranceProfileId), patient.
 * Branch-scoped — the caller must be an active member of the requested branch.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import type { InsuranceClaimStatus } from './repos/dental-insurance-claim.schema';

export async function listInsuranceClaims(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as {
    branchId?: string;
    status?: InsuranceClaimStatus;
    insuranceProfileId?: string;
    patientId?: string;
  };

  const db = ctx.get('database') as DatabaseInstance;

  // EM-BIL-002: branchId is OPTIONAL. When supplied, enforce membership. When
  // omitted, scope the worklist to the caller's own active branches — never
  // every org's claims (cross-tenant financial-data + PHI leak).
  let allowedBranchIds: string[] | undefined;
  if (query.branchId) {
    await assertBranchAccess(db, user.id, query.branchId);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const repo = new DentalInsuranceClaimRepository(db);
  const claims = await repo.findMany({
    branchId: query.branchId,
    status: query.status,
    insuranceProfileId: query.insuranceProfileId,
    patientId: query.patientId,
    allowedBranchIds,
  });

  return ctx.json({ items: claims, total: claims.length }, 200);
}
