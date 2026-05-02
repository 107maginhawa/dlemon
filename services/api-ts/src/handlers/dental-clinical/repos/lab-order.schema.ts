/**
 * Drizzle schema for lab orders
 *
 * State machine: ordered → inFabrication → delivered → fitted (or cancelled)
 */

import { pgTable, uuid, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const labOrderStatusEnum = pgEnum('lab_order_status', [
  'ordered',
  'inFabrication',
  'delivered',
  'fitted',
  'cancelled',
]);

export const labOrders = pgTable('lab_order', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull(),
  patientId: uuid('patient_id').notNull(),
  labName: text('lab_name').notNull(),
  description: text('description').notNull(),
  status: labOrderStatusEnum('status').notNull().default('ordered'),
  orderedAt: timestamp('ordered_at').notNull().defaultNow(),
  expectedDeliveryDate: timestamp('expected_delivery_date'),
  deliveredAt: timestamp('delivered_at'),
  fittedAt: timestamp('fitted_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  isDefective: boolean('is_defective').notNull().default(false),
  replacedByOrderId: uuid('replaced_by_order_id'),
});

export type LabOrder = typeof labOrders.$inferSelect;
export type NewLabOrder = typeof labOrders.$inferInsert;

export const VALID_LAB_ORDER_STATUSES = ['ordered', 'inFabrication', 'delivered', 'fitted', 'cancelled'] as const;
export type LabOrderStatus = typeof VALID_LAB_ORDER_STATUSES[number];

/** Valid forward-only transitions */
export const LAB_ORDER_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
  ordered: ['inFabrication', 'cancelled'],
  inFabrication: ['delivered', 'cancelled'],
  delivered: ['fitted', 'cancelled'],
  fitted: [],
  cancelled: [],
};
