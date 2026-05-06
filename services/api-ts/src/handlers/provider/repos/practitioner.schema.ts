/**
 * Database schema for practitioners and practitioner roles
 * FHIR R4-aligned: complex fields stored as JSONB
 */

import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { providers } from './provider.schema';

// ─── Practitioners ──────────────────────────────────────────────────────────

export const practitioners = pgTable('practitioners', {
  ...baseEntityFields,

  // Link to provider record (organization/practice)
  providerId: uuid('provider_id')
    .notNull()
    .references(() => providers.id, { onDelete: 'cascade' }),

  // FHIR R4 active flag
  active: boolean('active').notNull().default(true),

  // FHIR name array (HumanName[])
  name: jsonb('name').$type<Array<{
    use?: string;
    text?: string;
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  }>>().notNull().default([]),

  // FHIR telecom (ContactPoint[])
  telecom: jsonb('telecom').$type<Array<{
    system?: string;
    value?: string;
    use?: string;
    rank?: number;
  }>>(),

  // FHIR address (Address[])
  address: jsonb('address').$type<Array<{
    use?: string;
    type?: string;
    text?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>>(),

  // FHIR demographics
  gender: varchar('gender', { length: 20 }),
  birthDate: varchar('birth_date', { length: 10 }), // YYYY-MM-DD

  // FHIR photo (Attachment[])
  photo: jsonb('photo').$type<Array<{
    contentType?: string;
    url?: string;
    title?: string;
  }>>(),

  // FHIR qualification (Practitioner.qualification[])
  qualification: jsonb('qualification').$type<Array<{
    identifier?: Array<{ system?: string; value?: string }>;
    code: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
    period?: { start?: string; end?: string };
    issuer?: { resourceType: string; id: string; display?: string };
  }>>().notNull().default([]),

  // FHIR credential (Practitioner.credential[])
  credential: jsonb('credential').$type<Array<{
    identifier?: Array<{ system?: string; value?: string }>;
    code?: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
    period?: { start?: string; end?: string };
    issuer?: { resourceType: string; id: string; display?: string };
  }>>().notNull().default([]),

  // FHIR specialties (CodeableConcept[])
  specialties: jsonb('specialties').$type<Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>>().notNull().default([]),

  // FHIR languages (CodeableConcept[])
  languages: jsonb('languages').$type<Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>>(),

  // Soft-delete
  deactivatedAt: timestamp('deactivated_at'),

  // tenantId for multi-tenancy
  tenantId: varchar('tenant_id', { length: 255 }).notNull().default('default'),
}, (table) => ({
  providerIdx: index('practitioners_provider_id_idx').on(table.providerId),
  activeIdx: index('practitioners_active_idx').on(table.active),
  tenantIdx: index('practitioners_tenant_id_idx').on(table.tenantId),
}));

export type Practitioner = typeof practitioners.$inferSelect;
export type NewPractitioner = typeof practitioners.$inferInsert;

// ─── Practitioner Roles ──────────────────────────────────────────────────────

export const practitionerRoles = pgTable('practitioner_roles', {
  ...baseEntityFields,

  // Reference to Practitioner
  practitionerId: uuid('practitioner_id')
    .notNull()
    .references(() => practitioners.id, { onDelete: 'cascade' }),

  // FHIR active flag
  active: boolean('active').notNull().default(true),

  // FHIR period
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),

  // FHIR practitioner reference (who plays this role)
  practitionerRef: jsonb('practitioner_ref').$type<{
    resourceType: string;
    id: string;
    display?: string;
  }>().notNull(),

  // FHIR organization reference
  organizationRef: jsonb('organization_ref').$type<{
    resourceType: string;
    id: string;
    display?: string;
  }>().notNull(),

  // FHIR code (CodeableConcept[]) — role codes
  code: jsonb('code').$type<Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>>().notNull().default([]),

  // FHIR specialty (CodeableConcept[])
  specialty: jsonb('specialty').$type<Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>>().notNull().default([]),

  // FHIR location references
  location: jsonb('location').$type<Array<{
    resourceType: string;
    id: string;
    display?: string;
  }>>(),

  // FHIR healthcareService references
  healthcareService: jsonb('healthcare_service').$type<Array<{
    resourceType: string;
    id: string;
    display?: string;
  }>>(),

  // FHIR telecom
  telecom: jsonb('telecom').$type<Array<{
    system?: string;
    value?: string;
    use?: string;
    rank?: number;
  }>>(),

  // FHIR availableTime
  availableTime: jsonb('available_time').$type<Array<{
    daysOfWeek?: string[];
    allDay?: boolean;
    availableStartTime?: string;
    availableEndTime?: string;
  }>>(),

  // FHIR notAvailable
  notAvailable: jsonb('not_available').$type<Array<{
    description: string;
    during?: { start?: string; end?: string };
  }>>(),

  // Soft-delete
  deactivatedAt: timestamp('deactivated_at'),

  // tenantId for multi-tenancy
  tenantId: varchar('tenant_id', { length: 255 }).notNull().default('default'),
}, (table) => ({
  practitionerIdx: index('practitioner_roles_practitioner_id_idx').on(table.practitionerId),
  activeIdx: index('practitioner_roles_active_idx').on(table.active),
  tenantIdx: index('practitioner_roles_tenant_id_idx').on(table.tenantId),
}));

export type PractitionerRole = typeof practitionerRoles.$inferSelect;
export type NewPractitionerRole = typeof practitionerRoles.$inferInsert;
