/**
 * getDashboardSummary — GET /dental/dashboard/summary
 *
 * FR0.7: Active payment plans — count + total outstanding across all active plans
 * FR0.8: Lab order status — pending/in-fabrication orders requiring attention
 *
 * Optional ?branchId= scopes via invoice/visit branchId.
 */

import type { BaseContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getActivePaymentPlanSummaryForBranch } from '@/handlers/dental-billing/repos/billing-dashboard.facade';
import { getPendingLabOrderSummaryForBranch } from '@/handlers/dental-clinical/repos/clinical-dashboard.facade';

export async function getDashboardSummary(ctx: BaseContext) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.query('branchId');

  if (!branchId) {
    throw new ValidationError('branchId query parameter is required');
  }
  // N-ORG-01: this endpoint returns practice-wide FINANCIALS (outstanding
  // balances, active payment plans, lab orders). ROLE_PERMISSION_MATRIX Dashboard
  // row gates these to the owner (staff_scheduling = No access; staff_full =
  // "no financials"), and API_CONTRACTS GET /dental/dashboard says Auth:
  // dentist_owner. So restrict to dentist_owner — not any active branch member.
  await assertBranchRole(db, user.id, branchId, ['dentist_owner']);

  const [planSummary, labOrderSummary] = await Promise.all([
    getActivePaymentPlanSummaryForBranch(db, branchId),
    getPendingLabOrderSummaryForBranch(db, branchId),
  ]);

  return ctx.json({
    activePaymentPlans: {
      count: planSummary.count,
      behindCount: planSummary.behindCount,
      totalOutstandingCents: planSummary.totalOutstandingCents,
    },
    labOrders: labOrderSummary,
  }, 200);
}
