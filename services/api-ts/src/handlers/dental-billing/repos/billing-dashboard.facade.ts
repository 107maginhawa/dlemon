/**
 * billing-dashboard.facade.ts
 *
 * Facade exposing dental-billing aggregations to dental-org dashboard handlers.
 * Returns pre-aggregated summary objects so callers don't query schemas directly.
 */

import { eq, inArray, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { dentalInvoices } from './dental-invoice.schema';
import { dentalPaymentPlans } from './dental-payment-plan.schema';

const ACTIVE_PLAN_STATUSES = ['on_track', 'behind'] as const;

export interface ActivePaymentPlanSummary {
  count: number;
  behindCount: number;
  totalOutstandingCents: number;
}

/**
 * FR0.7: Active payment plans across a branch.
 * Joins via invoice.branchId — only plans whose invoice belongs to the branch are counted.
 */
export async function getActivePaymentPlanSummaryForBranch(
  db: DatabaseInstance,
  branchId: string,
): Promise<ActivePaymentPlanSummary> {
  const branchInvoices = await db
    .select({ id: dentalInvoices.id })
    .from(dentalInvoices)
    .where(eq(dentalInvoices.branchId, branchId));
  const invoiceIds = branchInvoices.map((i) => i.id);

  if (invoiceIds.length === 0) {
    return { count: 0, behindCount: 0, totalOutstandingCents: 0 };
  }

  const activePlans = await db
    .select()
    .from(dentalPaymentPlans)
    .where(
      and(
        inArray(dentalPaymentPlans.invoiceId, invoiceIds),
        inArray(dentalPaymentPlans.status, [...ACTIVE_PLAN_STATUSES]),
      ),
    );

  return {
    count: activePlans.length,
    behindCount: activePlans.filter((p) => p.status === 'behind').length,
    totalOutstandingCents: activePlans.reduce((acc, p) => acc + (p.totalCents ?? 0), 0),
  };
}
