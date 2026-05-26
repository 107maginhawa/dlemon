import { z } from 'zod';
import { INVENTORY_CATEGORIES, ADJUSTMENT_TYPES } from './repos/inventory.schema';

export const InventoryBranchParams = z.object({
  branchId: z.string().uuid(),
});

export const InventoryItemParams = z.object({
  branchId: z.string().uuid(),
  itemId: z.string().uuid(),
});

export const CreateInventoryItemBody = z.object({
  name: z.string().min(1, 'name is required'),
  category: z.enum(INVENTORY_CATEGORIES),
  unit: z.string().min(1, 'unit is required'),
  quantityOnHand: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export const UpdateInventoryItemBody = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  unit: z.string().min(1).optional(),
  quantityOnHand: z.number().int().nonnegative().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });

export const CreateAdjustmentBody = z.object({
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  quantity: z.number().int().refine((n) => n !== 0, { message: 'quantity must be non-zero' }),
  reason: z.string().optional(),
});
