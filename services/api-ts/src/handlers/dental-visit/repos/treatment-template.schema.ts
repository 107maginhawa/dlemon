/**
 * Drizzle schema for dental treatment templates (FR1.8)
 *
 * Templates allow reusable treatment sets that can be applied to a visit in one action.
 * They belong to a branch and contain a list of treatment items.
 */

import { pgTable, uuid, text, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export interface TemplateTreatmentItem {
  cdtCode: string;
  description: string;
  priceCents: number;
  toothNumber?: number;
  surfaces?: string[];
}

export const dentalTreatmentTemplates = pgTable('dental_treatment_template', {
  ...baseEntityFields,
  branchId: uuid('branch_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  items: jsonb('items').notNull().$type<TemplateTreatmentItem[]>(),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  branchIdx: index('dental_treatment_template_branch_id_idx').on(table.branchId),
}));

export type DentalTreatmentTemplate = typeof dentalTreatmentTemplates.$inferSelect;
export type NewDentalTreatmentTemplate = typeof dentalTreatmentTemplates.$inferInsert;
