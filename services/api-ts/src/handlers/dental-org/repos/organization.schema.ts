/**
 * Drizzle schema for dental organizations
 */

import { pgTable, text, boolean, pgEnum, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const orgTierEnum = pgEnum('org_tier', ['solo', 'clinic', 'group', 'enterprise']);
export const imagingTierEnum = pgEnum('imaging_tier', ['free', 'basic', 'addon']);

export const dentalOrganizations = pgTable('dental_organization', {
  ...baseEntityFields,
  name: text('name').notNull(),
  tier: orgTierEnum('tier').notNull(),
  // loose-coupling: references person.id (cross-module — no DB-level FK to avoid coupling dental-org to core person)
  ownerPersonId: uuid('owner_person_id').notNull(),
  countryCode: text('country_code').notNull(),
  active: boolean('active').notNull().default(true),
  imagingTier: imagingTierEnum('imaging_tier'), // nullable — NULL treated as 'free'
}, (table) => ({
  nameOwnerUnique: uniqueIndex('dental_org_name_owner_unique').on(table.name, table.ownerPersonId),
}));

export type DentalOrganization = typeof dentalOrganizations.$inferSelect;
export type NewDentalOrganization = typeof dentalOrganizations.$inferInsert;

export const VALID_ORG_TIERS = ['solo', 'clinic', 'group', 'enterprise'] as const;
export type OrgTier = typeof VALID_ORG_TIERS[number];

export const VALID_IMAGING_TIERS = ['free', 'basic', 'addon'] as const;
export type ImagingTier = typeof VALID_IMAGING_TIERS[number];

/** Coerce null imagingTier to 'free' — use this in all imaging handlers */
export function resolveImagingTier(tier: ImagingTier | null | undefined): ImagingTier {
  return tier ?? 'free';
}
