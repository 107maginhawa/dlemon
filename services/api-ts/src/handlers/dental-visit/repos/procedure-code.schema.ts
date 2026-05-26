import { pgTable, text, integer, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const dentalProcedureCodes = pgTable('dental_procedure_code', {
  ...baseEntityFields,
  cdtCode: text('cdt_code').notNull().unique(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  defaultFeePhp: integer('default_fee_php').notNull().default(0),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  cdtCodeIdx: index('dental_procedure_code_cdt_idx').on(table.cdtCode),
  categoryIdx: index('dental_procedure_code_category_idx').on(table.category),
}));

export type DentalProcedureCode = typeof dentalProcedureCodes.$inferSelect;
export type NewDentalProcedureCode = typeof dentalProcedureCodes.$inferInsert;
