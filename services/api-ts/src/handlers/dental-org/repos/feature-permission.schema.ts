/**
 * Drizzle schema for granular feature permissions (P2-17).
 *
 * One row = one org-level override of a (role, feature) decision. The ABSENCE
 * of a row means "use the catalog default" (see permissions/catalog.ts), so the
 * table is strictly additive and existing orgs are never locked out.
 */

import { pgTable, text, boolean, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { dentalOrganizations } from './organization.schema';
import { memberRoleEnum } from './membership.schema';

export const dentalFeaturePermissions = pgTable('dental_feature_permission', {
  ...baseEntityFields,
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => dentalOrganizations.id, { onDelete: 'cascade' }),
  role: memberRoleEnum('role').notNull(),
  // Catalog feature key (e.g. 'billing.invoice.void'). Validated against the
  // catalog at the handler layer; stored as text so adding features needs no
  // migration.
  feature: text('feature').notNull(),
  // The override decision: explicit allow (true) or deny (false).
  allowed: boolean('allowed').notNull(),
}, (table) => ({
  // At most one override per (org, role, feature).
  orgRoleFeatureUnique: uniqueIndex('dental_feature_permission_org_role_feature_unique')
    .on(table.organizationId, table.role, table.feature),
}));

export type DentalFeaturePermission = typeof dentalFeaturePermissions.$inferSelect;
export type NewDentalFeaturePermission = typeof dentalFeaturePermissions.$inferInsert;
