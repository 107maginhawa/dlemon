/**
 * Drizzle schema for dental branches (clinic locations)
 */

import { pgTable, text, boolean, uuid } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalOrganizations } from './organization.schema';

export const dentalBranches = pgTable('dental_branch', {
  ...baseEntityFields,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => dentalOrganizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  timezone: text('timezone').notNull(),
  workingHours: text('working_hours'), // JSON string
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
});

export type DentalBranch = typeof dentalBranches.$inferSelect;
export type NewDentalBranch = typeof dentalBranches.$inferInsert;
