/**
 * getCollectionsKpis — GET /dental/billing/collections/kpis
 *
 * Phase 3.1: read-only AR KPI dashboard. DSO, collection rate, write-off total,
 * outstanding AR, and the current aging breakdown — computed from the branch's
 * non-voided invoices. EM-BIL-002 branch-scoped (omitted branchId → caller's
 * active branches via withTenantTx).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getActiveBranchIdsForPerson } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { getInvoicesForKpis } from './repos/billing-report.facade';
import { computeBillingKpis } from './utils/kpis';
import type { GetCollectionsKpisQuery } from '@/generated/openapi/validators';

export async function getCollectionsKpis(
  ctx: ValidatedContext<never, GetCollectionsKpisQuery, never>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');
  const query = ctx.req.valid('query');

  let allowedBranchIds: string[] | undefined;
  if (query.branchId) {
    await assertBranchAccess(db, user.id, query.branchId);
  } else {
    allowedBranchIds = await getActiveBranchIdsForPerson(db, user.id);
  }

  const asOf = query.asOf ? new Date(query.asOf) : new Date();
  const scopeBranchIds = query.branchId ? [query.branchId] : (allowedBranchIds ?? []);
  const invoices = await withTenantTx(db, { branchIds: scopeBranchIds }, (tx) =>
    getInvoicesForKpis(tx, query.branchId, allowedBranchIds),
  );

  const kpis = computeBillingKpis(invoices, asOf);

  logger?.info(
    { action: 'getCollectionsKpis', branchId: query.branchId, outstandingArCents: kpis.outstandingArCents, dsoDays: kpis.dsoDays },
    'Collections KPIs computed',
  );

  return ctx.json({ asOf: asOf.toISOString(), ...kpis }, 200);
}
