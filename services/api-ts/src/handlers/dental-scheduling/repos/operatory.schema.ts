import { pgTable, text, boolean, uuid, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

export const dentalOperatories = pgTable('dental_operatory', {
  ...baseEntityFields,
  branchId: uuid('branch_id')
    .notNull()
    .references(() => dentalBranches.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  branchIdx: index('dental_operatory_branch_id_idx').on(table.branchId),
}));

export type DentalOperatory = typeof dentalOperatories.$inferSelect;
export type NewDentalOperatory = typeof dentalOperatories.$inferInsert;
