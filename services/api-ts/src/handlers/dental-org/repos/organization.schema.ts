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
  // PHI go-live gating hook. Self-service onboarding sets 'provisional'; admin/seed
  // provisioning and all back-compat rows default to 'live'. Stored as text (not a
  // pg enum) to keep the value safe to reference in the partial-unique-index
  // predicate within drizzle-orm's single-transaction migrator (avoids 55P04).
  // NOTE: enforcement (block PHI writes until 'live') is a designed FAST-FOLLOW —
  // this column is only the hook; nothing gates on it yet.
  status: text('status').$type<OrgStatus>().notNull().default('live'),
  imagingTier: imagingTierEnum('imaging_tier'), // nullable — NULL treated as 'free'
}, (table) => ({
  nameOwnerUnique: uniqueIndex('dental_org_name_owner_unique').on(table.name, table.ownerPersonId),
}));

export type DentalOrganization = typeof dentalOrganizations.$inferSelect;
export type NewDentalOrganization = typeof dentalOrganizations.$inferInsert;

export const VALID_ORG_TIERS = ['solo', 'clinic', 'group', 'enterprise'] as const;
export type OrgTier = typeof VALID_ORG_TIERS[number];

/**
 * Org lifecycle status (PHI go-live gating hook).
 * - 'provisional' — self-service onboarded; PHI write-gating enforcement is a fast-follow
 * - 'live'        — admin/seed provisioned or back-compat default; full access
 * - 'suspended'   — reserved for future ops use
 */
export const VALID_ORG_STATUSES = ['provisional', 'live', 'suspended'] as const;
export type OrgStatus = typeof VALID_ORG_STATUSES[number];

export const VALID_IMAGING_TIERS = ['free', 'basic', 'addon'] as const;
export type ImagingTier = typeof VALID_IMAGING_TIERS[number];

/** Coerce null imagingTier to 'free' — use this in all imaging handlers */
export function resolveImagingTier(tier: ImagingTier | null | undefined): ImagingTier {
  return tier ?? 'free';
}
