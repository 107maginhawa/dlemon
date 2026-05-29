/**
 * Drizzle schema for lab orders
 *
 * State machine: ordered → in_fabrication → delivered → fitted (or cancelled)
 */

import { pgTable, uuid, text, boolean, timestamp, pgEnum, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { patients } from '../../patient/repos/patient.schema';

export const labOrderStatusEnum = pgEnum('lab_order_status', [
  'ordered',
  'in_fabrication',
  'delivered',
  'fitted',
  'cancelled',
]);

export const labOrders = pgTable('lab_order', {
  ...baseEntityFields,
  visitId: uuid('visit_id').notNull().references(() => dentalVisits.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id),
  // V-CLI-003 / spec §7 / WF-017: FDI tooth notation the lab order is for.
  // Nullable — not every lab order is tooth-specific (e.g. full denture, study models).
  toothFdi: text('tooth_fdi'),
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
  replacedByOrderId: uuid('replaced_by_order_id').references((): AnyPgColumn => labOrders.id, { onDelete: 'set null' }),
});

export type LabOrder = typeof labOrders.$inferSelect;
export type NewLabOrder = typeof labOrders.$inferInsert;

export const VALID_LAB_ORDER_STATUSES = ['ordered', 'in_fabrication', 'delivered', 'fitted', 'cancelled'] as const;
export type LabOrderStatus = typeof VALID_LAB_ORDER_STATUSES[number];

/** Valid forward-only transitions */
export const LAB_ORDER_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
  ordered: ['in_fabrication', 'cancelled'],
  in_fabrication: ['delivered', 'cancelled'],
  delivered: ['fitted', 'cancelled'],
  fitted: [],
  cancelled: [],
};
