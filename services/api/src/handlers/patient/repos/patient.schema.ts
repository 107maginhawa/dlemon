/**
 * Database schema for patients - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, uuid, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { persons, type PersonCreateRequest } from '../../person/repos/person.schema';

// Patients table - matches TypeSpec Patient model
export const patients = pgTable('patient', {
  // Base entity fields (includes id, timestamps, version, audit fields)
  ...baseEntityFields,
  
  // Patient-specific fields from TypeSpec
  person: uuid('person_id')
    .notNull()
    .references(() => persons.id, { onDelete: 'cascade' }),
  
  // Primary care provider information (optional)
  primaryProvider: jsonb('primary_provider').$type<ProviderInfo>(),
  
  // Primary pharmacy information (optional)
  primaryPharmacy: jsonb('primary_pharmacy').$type<PharmacyInfo>(),
}, (table) => ({
  // Indexes for search and performance
  personIdx: index('patients_person_id_idx').on(table.person),
  // Ensure one patient per person
  uniquePersonId: uniqueIndex('patients_person_id_unique').on(table.person),
}));

// Type exports for TypeScript
export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;

// Provider info type - matches TypeSpec ProviderInfo model
export interface ProviderInfo {
  name: string;
  specialty?: string;
  phone?: string; // PhoneNumber in E.164 format
  fax?: string; // FaxNumber - more permissive format
}

// Pharmacy info type - matches TypeSpec PharmacyInfo model
export interface PharmacyInfo {
  name: string;
  address?: string;
  phone?: string; // PhoneNumber in E.164 format
  fax?: string; // FaxNumber - more permissive format
}

// Provider info for updates (with nullable fields) - matches TypeSpec ProviderInfoUpdate
export interface ProviderInfoUpdate {
  name?: string;
  specialty?: string | null;
  phone?: string | null;
  fax?: string | null;
}

// Pharmacy info for updates (with nullable fields) - matches TypeSpec PharmacyInfoUpdate
export interface PharmacyInfoUpdate {
  name?: string;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
}

// Expanded person data for responses - from Person table
export interface PersonData {
  id: string;
  firstName: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  primaryAddress?: any;
  contactInfo?: any;
  languagesSpoken?: string[];
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Request types - simplified to match TypeSpec
export interface PatientCreateRequest {
  person?: PersonCreateRequest; // Person demographic information
  primaryProvider?: ProviderInfo;
  primaryPharmacy?: PharmacyInfo;
}

export interface PatientUpdateRequest {
  primaryProvider?: ProviderInfoUpdate | null;
  primaryPharmacy?: PharmacyInfoUpdate | null;
}

// Helper type for queries with joined person data
export interface PatientWithPerson extends Patient {
  person: PersonData;
}