/**
 * getPayerArAging — GET /dental/billing/claims/aging
 *
 * P1-26: AR-by-payer aging worklist. Outstanding insurance claims aged by
 * submission date into current / 31–60 / 61–90 / 90+ buckets, grouped by payer.
 */

import type { HandlerContext } from '@/types/app';
import { UnauthorizedError } from '@/core/errors';
import type { DatabaseInstance } from '@/core/database';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { DentalInsuranceClaimRepository } from './repos/dental-insurance-claim.repo';
import { getInsurerNamesForBilling } from '@/handlers/dental-patient/repos/insurance-billing.facade';
import { computePayerAging, type AgingClaim } from './utils/aging';

export async function getPayerArAging(ctx: HandlerContext): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const query = ctx.req.valid('query') as { branchId?: string; asOf?: string };
  const db = ctx.get('database') as DatabaseInstance;

  // EM-BIL-002: branchId is OPTIONAL. When supplied, enforce membership. When
  // omitted, scope the payer-aging to the caller's own active branches — never
  // every org's claims (cross-tenant financial-data + PHI leak).
  let allowedBranchIds: string[] | undefined;
  if (query.branchId) {
    await assertBranchAccess(db, user.id, query.branchId);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const asOf = query.asOf ? new Date(query.asOf) : new Date();

  // RLS P1b activation: route the dental_insurance_claim read through
  // withTenantTx so the app_rls policy enforces the branch scope as a second
  // wall. Scope = the asserted branch when supplied, else the caller's
  // active-branch set (EM-BIL-002). The downstream insurer-name lookup reads a
  // patient-anchored table that is not yet RLS-armed (P3), so it stays on db.
  const scopeBranchIds = query.branchId ? [query.branchId] : (allowedBranchIds ?? []);
  const claims = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    new DentalInsuranceClaimRepository(tx).findMany({ branchId: query.branchId, allowedBranchIds }),
  );

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
