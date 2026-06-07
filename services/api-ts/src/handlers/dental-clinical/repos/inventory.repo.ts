/**
 * InventoryRepository — data access for dental inventory items and adjustments.
 *
 * createAdjustment performs item.quantityOnHand += adjustment.quantity inside the
 * same DB transaction so the ledger and running total never disagree.
 */

import { eq, and, sql } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import {
  dentalInventoryItems,
  dentalInventoryAdjustments,
  type DentalInventoryItem,
  type NewDentalInventoryItem,
  type DentalInventoryAdjustment,
  type NewDentalInventoryAdjustment,
} from './inventory.schema';

export class InventoryRepository {
  constructor(
    private readonly db: DatabaseInstance,
    private readonly logger?: Logger,
  ) {}

  async findByBranchId(branchId: string): Promise<DentalInventoryItem[]> {
    return this.db
      .select()
      .from(dentalInventoryItems)
      .where(eq(dentalInventoryItems.branchId, branchId));
  }

  async findOneById(id: string, branchId: string): Promise<DentalInventoryItem | null> {
    const [row] = await this.db
      .select()
      .from(dentalInventoryItems)
      .where(and(eq(dentalInventoryItems.id, id), eq(dentalInventoryItems.branchId, branchId)));
    return row ?? null;
  }

  async createItem(
    values: Omit<NewDentalInventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalInventoryItem> {
    const [row] = await this.db.insert(dentalInventoryItems).values(values).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  }

  async updateItem(
    id: string,
    branchId: string,
    values: Partial<Pick<DentalInventoryItem, 'name' | 'category' | 'unit' | 'quantityOnHand' | 'reorderLevel' | 'notes' | 'updatedBy'>>,
  ): Promise<DentalInventoryItem | null> {
    const [row] = await this.db
      .update(dentalInventoryItems)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(dentalInventoryItems.id, id), eq(dentalInventoryItems.branchId, branchId)))
      .returning();
    return row ?? null;
  }

  /**
   * Insert an adjustment ledger entry AND update the item's running quantityOnHand
   * in the same transaction. Returns the inserted adjustment row.
   */
  async createAdjustment(
    values: Omit<NewDentalInventoryAdjustment, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<DentalInventoryAdjustment> {
    return this.db.transaction(async (tx) => {
      const [adjustment] = await tx
        .insert(dentalInventoryAdjustments)
        .values(values)
        .returning();
      if (!adjustment) throw new Error('Adjustment insert returned no row');

      await tx
        .update(dentalInventoryItems)
        .set({
          quantityOnHand: sql`${dentalInventoryItems.quantityOnHand} + ${values.quantity}`,
          updatedAt: new Date(),
          updatedBy: values.updatedBy ?? null,
        })
        .where(eq(dentalInventoryItems.id, values.itemId));

      return adjustment;
    });
  }

  async findAdjustmentsByItemId(itemId: string): Promise<DentalInventoryAdjustment[]> {
    return this.db
      .select()
      .from(dentalInventoryAdjustments)
      .where(eq(dentalInventoryAdjustments.itemId, itemId));
  }
}
