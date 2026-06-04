/**
 * getPayerArAging — GET /dental/billing/claims/aging
 *
 * P1-26: AR-by-payer aging worklist. Outstanding insurance claims aged by
 * submission date into current / 31–60 / 61–90 / 90+ buckets, grouped by payer.
 */

import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { getInsurerNamesForBilling } from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { computePayerAging, type AgingClaim } from './utils/aging';

export async function getPayerArAging(ctx: any): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as { branchId?: string; asOf?: string };
  const db = ctx.get('database') as DatabaseInstance;

  if (query.branchId) {
    await assertBranchAccess(db, user.id, query.branchId);
  }

  const asOf = query.asOf ? new Date(query.asOf) : new Date();

  const repo = new DentalInsuranceClaimRepository(db);
  const claims = await repo.findMany({ branchId: query.branchId });

  const agingClaims: AgingClaim[] = claims.map((c) => ({
    insuranceProfileId: c.insuranceProfileId,
    status: c.status,
    billedAmountCents: c.billedAmountCents,
    paidByPayerCents: c.paidByPayerCents ?? 0,
    disallowedCents: c.disallowedCents ?? null,
    submittedAt: c.submittedAt,
    createdAt: c.createdAt,
  }));

  const profileIds = [...new Set(agingClaims.map((c) => c.insuranceProfileId))];
  const payerNames = await getInsurerNamesForBilling(db, profileIds);

  const { payers, summary } = computePayerAging(agingClaims, payerNames, asOf);

  return ctx.json({ asOf: asOf.toISOString(), summary, payers }, 200);
}
