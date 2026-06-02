/**
 * LabOrderRepository — data access for lab orders
 *
 * State machine: ordered → inFabrication → delivered → fitted (or cancelled)
 * No backward transitions, no skipping states.
 */

import { eq, and } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import {
  labOrders,
  type LabOrder,
  type NewLabOrder,
  type LabOrderStatus,
  LAB_ORDER_TRANSITIONS,
} from './lab-order.schema';

export interface LabOrderFilters {
  visitId?: string;
  patientId?: string;
  status?: LabOrderStatus;
}

export class LabOrderRepository extends DatabaseRepository<LabOrder, NewLabOrder, LabOrderFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, labOrders, logger);
  }

  protected buildWhereConditions(filters?: LabOrderFilters) {
    if (!filters) return undefined;
    const conditions = [];
    if (filters.visitId) conditions.push(eq(labOrders.visitId, filters.visitId));
    if (filters.patientId) conditions.push(eq(labOrders.patientId, filters.patientId));
    if (filters.status) conditions.push(eq(labOrders.status, filters.status));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  override async findMany(filters?: LabOrderFilters): Promise<LabOrder[]> {
    const where = this.buildWhereConditions(filters);
    return where
      ? await this.db.select().from(labOrders).where(where)
      : await this.db.select().from(labOrders);
  }

  override async findOneById(id: string): Promise<LabOrder | null> {
    const [row] = await this.db.select().from(labOrders).where(eq(labOrders.id, id));
    return row ?? null;
  }

  async updateStatus(
    id: string,
    newStatus: LabOrderStatus,
    extra?: Partial<Pick<LabOrder, 'expectedDeliveryDate' | 'cancelReason' | 'isDefective'>>,
  ): Promise<{ order: LabOrder | null; error?: string }> {
    const order = await this.findOneById(id);
    if (!order) return { order: null };

    const allowed = LAB_ORDER_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      return { order: null, error: `Cannot transition from ${order.status} to ${newStatus}` };
    }

    const timestamps: Partial<LabOrder> = {};
    if (newStatus === 'delivered') timestamps.deliveredAt = new Date();
    if (newStatus === 'fitted') timestamps.fittedAt = new Date();
    if (newStatus === 'cancelled') timestamps.cancelledAt = new Date();

    const [updated] = await this.db
      .update(labOrders)
      .set({ status: newStatus, ...timestamps, ...extra, updatedAt: new Date() })
      .where(eq(labOrders.id, id))
      .returning();
    return { order: updated ?? null };
  }

  async update(
    id: string,
    patch: Partial<Pick<LabOrder, 'expectedDeliveryDate' | 'dueDate' | 'shade' | 'material' | 'cancelReason' | 'isDefective' | 'replacedByOrderId'>>,
  ): Promise<LabOrder | null> {
    const [updated] = await this.db
      .update(labOrders)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(labOrders.id, id))
      .returning();
    return updated ?? null;
  }
}
