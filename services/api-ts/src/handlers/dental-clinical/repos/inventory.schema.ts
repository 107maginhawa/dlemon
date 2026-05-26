/**
 * Drizzle schema for dental inventory items + stock adjustments (P2-004)
 *
 * Inventory tracks dental supplies/materials at the branch level (not patient level).
 * Adjustments are append-only ledger entries; the item's quantityOnHand is the
 * materialized running total maintained in the same DB transaction.
 */

import { pgTable, uuid, text, integer, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

export const INVENTORY_CATEGORIES = [
  'consumable',
  'instrument',
  'medication',
  'equipment',
  'other',
] as const;
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number];

export const ADJUSTMENT_TYPES = ['restock', 'usage', 'disposal', 'correction'] as const;
export type AdjustmentType = typeof ADJUSTMENT_TYPES[number];

export const dentalInventoryItems = pgTable('dental_inventory_item', {
  ...baseEntityFields,
  branchId: uuid('branch_id')
    .notNull()
    .references(() => dentalBranches.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull().$type<InventoryCategory>(),
  unit: text('unit').notNull(),
  quantityOnHand: integer('quantity_on_hand').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(10),
  notes: text('notes'),
}, (table) => ({
  branchIdx: index('dental_inventory_item_branch_idx').on(table.branchId),
}));

export type DentalInventoryItem = typeof dentalInventoryItems.$inferSelect;
export type NewDentalInventoryItem = typeof dentalInventoryItems.$inferInsert;

export const dentalInventoryAdjustments = pgTable('dental_inventory_adjustment', {
  ...baseEntityFields,
  itemId: uuid('item_id')
    .notNull()
    .references(() => dentalInventoryItems.id, { onDelete: 'cascade' }),
  adjustmentType: text('adjustment_type').notNull().$type<AdjustmentType>(),
  quantity: integer('quantity').notNull(),
  reason: text('reason'),
}, (table) => ({
  itemIdx: index('dental_inventory_adjustment_item_idx').on(table.itemId),
}));

export type DentalInventoryAdjustment = typeof dentalInventoryAdjustments.$inferSelect;
export type NewDentalInventoryAdjustment = typeof dentalInventoryAdjustments.$inferInsert;
