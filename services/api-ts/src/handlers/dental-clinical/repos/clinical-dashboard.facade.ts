/**
 * clinical-dashboard.facade.ts
 *
 * Facade exposing dental-clinical aggregations to dental-org dashboard handlers.
 * Returns pre-aggregated summary objects so callers don't query schemas directly.
 */

import { eq, inArray, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { labOrders } from './lab-order.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

const PENDING_LAB_STATUSES = ['ordered', 'in_fabrication'] as const;

export interface PendingLabOrderSummary {
  totalPending: number;
  ordered: number;
  inFabrication: number;
  overdueDelivery: number;
}

/**
 * FR0.8: Lab orders requiring attention in a branch.
 * Joins lab orders to visits via visitId — only orders whose visit belongs
 * to the branch are counted. Visit schema is imported inside the facade
 * (allowed — facade files are exempt from the boundary checker).
 */
export async function getPendingLabOrderSummaryForBranch(
  db: DatabaseInstance,
  branchId: string,
): Promise<PendingLabOrderSummary> {
  const branchVisits = await db
    .select({ id: dentalVisits.id })
    .from(dentalVisits)
    .where(eq(dentalVisits.branchId, branchId));
  const visitIds = branchVisits.map((v) => v.id);

  if (visitIds.length === 0) {
    return { totalPending: 0, ordered: 0, inFabrication: 0, overdueDelivery: 0 };
  }

  const pendingOrders = await db
    .select()
    .from(labOrders)
    .where(
      and(
        inArray(labOrders.visitId, visitIds),
        inArray(labOrders.status, [...PENDING_LAB_STATUSES]),
      ),
    );

  const now = new Date();
  return {
    totalPending: pendingOrders.length,
    ordered: pendingOrders.filter((o) => o.status === 'ordered').length,
    inFabrication: pendingOrders.filter((o) => o.status === 'in_fabrication').length,
    overdueDelivery: pendingOrders.filter((o) => {
      if (!o.expectedDeliveryDate) return false;
      return new Date(o.expectedDeliveryDate) < now;
    }).length,
  };
}
