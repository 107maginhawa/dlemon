import { pgTable, uuid, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalBranches } from '../../dental-org/repos/branch.schema';

export const POSTOP_CATEGORIES = ['extraction', 'implant', 'root_canal', 'filling', 'crown', 'cleaning', 'surgery', 'orthodontic', 'other'] as const;
export type PostopCategory = typeof POSTOP_CATEGORIES[number];

export const dentalPostopTemplates = pgTable('dental_postop_template', {
  ...baseEntityFields,
  branchId: uuid('branch_id').notNull().references(() => dentalBranches.id, { onDelete: 'cascade' }),
  category: text('category').notNull().$type<PostopCategory>(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  active: boolean('active').notNull().default(true),
}, (table) => ({
  branchIdx: index('dental_postop_template_branch_idx').on(table.branchId),
  categoryIdx: index('dental_postop_template_category_idx').on(table.category),
}));

export type DentalPostopTemplate = typeof dentalPostopTemplates.$inferSelect;
export type NewDentalPostopTemplate = typeof dentalPostopTemplates.$inferInsert;
