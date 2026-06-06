/**
 * Database schema for patients - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 */

import { pgTable, uuid, jsonb, index, uniqueIndex, text, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { persons, type PersonCreateRequest, type Address, type ContactInfo } from '../../person/repos/person.schema';

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

  // Dental-specific extensions
  // loose-coupling: references dental_branch.id (cross-module — no DB-level FK to avoid coupling patient to dental-org)
  preferredBranchId: uuid('preferred_branch_id'),
  dentalHistorySummary: text('dental_history_summary'),
  needsFollowUp: boolean('needs_follow_up').default(false),
  hasActivePaymentPlan: boolean('has_active_payment_plan').default(false),

  // FR2.9: Patient status management
  status: text('status').default('active').notNull(), // 'active' | 'archived'
  archivedAt: timestamp('archived_at'),
  archiveNote: text('archive_note'), // EM-PAT-003: reason stored at archive time

  // FR2.16: Emergency contact
  emergencyContact: jsonb('emergency_contact').$type<EmergencyContact>(),

  // FR2.17: Communication preferences
  communicationPreferences: jsonb('communication_preferences').$type<CommunicationPreferences>(),

  // FR2.18: Recall / next visit tracking
  recallDate: text('recall_date'), // ISO date string e.g. "2026-08-15"
  recallNote: text('recall_note'),

  // FR2.12: Follow-up notes log (append-only JSONB array)
  followUpNotes: jsonb('follow_up_notes').$type<FollowUpNote[]>().default(sql`'[]'::jsonb`),
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
  primaryAddress?: Address;
  contactInfo?: ContactInfo;
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
  preferredBranchId?: string;
  dentalHistorySummary?: string;
}

export interface PatientUpdateRequest {
  primaryProvider?: ProviderInfoUpdate | null;
  primaryPharmacy?: PharmacyInfoUpdate | null;
  preferredBranchId?: string | null;
  dentalHistorySummary?: string | null;
  needsFollowUp?: boolean | null;
  // FR2.16
  emergencyContact?: EmergencyContact | null;
  // FR2.17
  communicationPreferences?: CommunicationPreferences | null;
  // FR2.18
  recallDate?: string | null;
  recallNote?: string | null;
}

// FR2.16: Emergency contact info
export interface EmergencyContact {
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

// FR2.17: Communication preferences
export interface CommunicationPreferences {
  preferredChannel?: 'sms' | 'email' | 'phone' | 'none';
  reminderOptIn?: boolean;
  preferredLanguage?: string;
}

// FR2.12: Follow-up note entry
export interface FollowUpNote {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
  createdBy: string; // userId
}

// Helper type for queries with joined person data
export type PatientWithPerson = Omit<Patient, 'person'> & {
  person: PersonData;
};