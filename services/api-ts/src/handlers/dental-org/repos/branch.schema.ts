/**
 * Drizzle schema for dental branches (clinic locations)
 */

import { pgTable, text, boolean, uuid, jsonb } from 'drizzle-orm/pg-core';
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
  // FR8.1-FR8.8: Unified branch settings blob
  settings: jsonb('settings').$type<BranchSettings>(),
});

/**
 * FR8.1-FR8.8: Unified branch settings structure
 * Stored as JSONB — GET returns current, PUT merges top-level keys.
 */
export interface BranchSettings {
  // FR8.1: Clinic configuration
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  // FR8.2: Dentist profile
  dentistName?: string;
  dentistLicenseNumber?: string;
  dentistSpecialty?: string;
  // FR8.3: Treatment fee schedule (map cdtCode → price in cents)
  feeSchedule?: Record<string, number>;
  // FR8.7: Visit notes format toggle
  visitNotesFormat?: 'structured' | 'freetext';
  // FR8.8: Locale settings
  locale?: string;       // e.g. 'en-PH'
  currency?: string;     // e.g. 'PHP'
  dateFormat?: string;   // e.g. 'MM/DD/YYYY'
  // P1-24: appointment reminder + recall cadence policy. Stored here (JSONB) to
  // avoid a config table/migration; a hardcoded default applies when absent.
  reminderPolicy?: {
    leadHours?: number[];                       // e.g. [72, 24, 2]
    channels?: ('sms' | 'email' | 'push' | 'in-app')[];
    recallReattemptDays?: number;               // min days between recall outreach
    recallMaxAttempts?: number;                 // cap on recall outreach attempts
  };
}

export type DentalBranch = typeof dentalBranches.$inferSelect;
export type NewDentalBranch = typeof dentalBranches.$inferInsert;
