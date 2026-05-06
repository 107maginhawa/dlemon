/**
 * getDashboardSummary — GET /dental/dashboard/summary
 *
 * FR0.7: Active payment plans — count + total outstanding across all active plans
 * FR0.8: Lab order status — pending/in-fabrication orders requiring attention
 *
 * Optional ?branchId= scopes via invoice/visit branchId.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalPaymentPlans } from '@/handlers/dental-billing/repos/dental-payment-plan.schema';
import { dentalInvoices } from '@/handlers/dental-billing/repos/dental-invoice.schema';
import { labOrders } from '@/handlers/dental-clinical/repos/lab-order.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';
import { eq, inArray, and } from 'drizzle-orm';

export async function getDashboardSummary(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const db = ctx.get('database') as DatabaseInstance;
  const branchId = ctx.req.query('branchId');

  // Branch-level authorization
  if (!branchId) {
    throw new ValidationError('branchId query parameter is required');
  }
  await assertBranchAccess(db, user.id, branchId);

  const activePlanStatuses = ['onTrack', 'behind'] as const;
  const pendingLabStatuses = ['ordered', 'inFabrication'] as const;

  // FR0.7: Active payment plans (optionally scoped by branch via invoice.branchId)
  let activePlans;
  if (branchId) {
    const branchInvoices = await db
      .select({ id: dentalInvoices.id })
      .from(dentalInvoices)
      .where(eq(dentalInvoices.branchId, branchId));
    const invoiceIds = branchInvoices.map(i => i.id);

    activePlans = invoiceIds.length > 0
      ? await db.select().from(dentalPaymentPlans).where(
          and(
            inArray(dentalPaymentPlans.invoiceId, invoiceIds),
            inArray(dentalPaymentPlans.status, activePlanStatuses as any)
          )
        )
      : [];
  } else {
    activePlans = await db.select().from(dentalPaymentPlans).where(
      inArray(dentalPaymentPlans.status, activePlanStatuses as any)
    );
  }

  const activePlanCount = activePlans.length;
  const activePlanTotalOutstandingCents = activePlans.reduce((acc, p) => acc + (p.totalCents ?? 0), 0);
  const behindCount = activePlans.filter(p => p.status === 'behind').length;

  // FR0.8: Lab orders requiring attention (optionally scoped by branch via visit.branchId)
  let pendingLabOrders;
  if (branchId) {
    const branchVisits = await db
      .select({ id: dentalVisits.id })
      .from(dentalVisits)
      .where(eq(dentalVisits.branchId, branchId));
    const visitIds = branchVisits.map(v => v.id);

    pendingLabOrders = visitIds.length > 0
      ? await db.select().from(labOrders).where(
          and(
            inArray(labOrders.visitId, visitIds),
            inArray(labOrders.status, pendingLabStatuses as any)
          )
        )
      : [];
  } else {
    pendingLabOrders = await db.select().from(labOrders).where(
      inArray(labOrders.status, pendingLabStatuses as any)
    );
  }

  const labOrderSummary = {
    totalPending: pendingLabOrders.length,
    ordered: pendingLabOrders.filter(o => o.status === 'ordered').length,
    inFabrication: pendingLabOrders.filter(o => o.status === 'inFabrication').length,
    overdueDelivery: pendingLabOrders.filter(o => {
      if (!o.expectedDeliveryDate) return false;
      return new Date(o.expectedDeliveryDate) < new Date();
    }).length,
  };

  return ctx.json({
    activePaymentPlans: {
      count: activePlanCount,
      behindCount,
      totalOutstandingCents: activePlanTotalOutstandingCents,
    },
    labOrders: labOrderSummary,
  }, 200);
}
