/**
 * Database schema for providers - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, uuid, jsonb, varchar, integer, text, index, unique, boolean } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';
import { persons, type Person } from '../../person/repos/person.schema';

// Providers table - matches TypeSpec Provider model
export const providers = pgTable('provider', {
  // Base entity fields (includes id, timestamps, version, audit fields)
  ...baseEntityFields,
  
  // Provider-specific fields from TypeSpec
  person: uuid('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),

  // Simple provider fields
  providerType: varchar('provider_type', { length: 50 }).notNull(),
  yearsOfExperience: integer('years_of_experience'),
  biography: text('biography'),

  // Minor ailments fields (arrays in JSONB)
  minorAilmentsSpecialties: jsonb('minor_ailments_specialties').$type<string[]>(),
  minorAilmentsPracticeLocations: jsonb('minor_ailments_practice_locations').$type<string[]>(),
}, (table) => ({
  // Indexes for search and performance
  personIdx: index('providers_person_id_idx').on(table.person),
  providerTypeIdx: index('providers_provider_type_idx').on(table.providerType),
  // Ensure one provider per person
  uniquePersonId: unique('providers_person_id_unique').on(table.person),
}));

// Type exports for TypeScript
export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;

// Provider type enum - matches TypeSpec
export type ProviderType =
  | 'dentist'
  | 'hygienist'
  | 'orthodontist'
  | 'endodontist'
  | 'periodontist'
  | 'oral_surgeon'
  | 'pediatric_dentist'
  | 'pharmacist'
  | 'other';

// Expanded person data for responses - from Person table
export type PersonData = Person;

// Request types — mirrors the TypeSpec CreateProviderRequest.
// The provider profile is always created for the authenticated user, so the
// person is derived from the session (not accepted in the request body).
export interface ProviderCreateRequest {
  providerType: ProviderType;
  yearsOfExperience?: number;
  biography?: string;
  minorAilmentsSpecialties?: string[];
  minorAilmentsPracticeLocations?: string[];
}

export interface ProviderUpdateRequest {
  yearsOfExperience?: number | null;
  biography?: string | null;
  minorAilmentsSpecialties?: string[] | null;
  minorAilmentsPracticeLocations?: string[] | null;
}

// Helper type for queries with joined person data
export interface ProviderWithPerson extends Omit<Provider, 'person'> {
  person: PersonData;
}
