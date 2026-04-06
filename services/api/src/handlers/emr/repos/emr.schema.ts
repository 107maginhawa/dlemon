/**
 * Database schema for EMR module - matches TypeSpec API definition
 * Uses Drizzle ORM with PostgreSQL
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
  index,
  check,
  pgEnum,
  unique
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntityFields } from '@/core/database.schema';
import { patients } from '../../patient/repos/patient.schema';
import { providers } from '../../provider/repos/provider.schema';

// Consultation status enum - matches TypeSpec definition
export const consultationStatusEnum = pgEnum('consultation_status', [
  'draft',
  'finalized', 
  'amended'
]);

// Consultation Notes - Primary documentation entity for medical consultations
export const consultationNotes = pgTable('consultation_note', {
  // Base entity fields (includes id, timestamps, version, audit fields)
  ...baseEntityFields,
  
  // Required relationship fields per TypeSpec
  patient: uuid('patient_id')
    .notNull()
    .references(() => patients.id, { onDelete: 'cascade' }),

  provider: uuid('provider_id')
    .notNull()
    .references(() => providers.id, { onDelete: 'cascade' }),

  // Optional context field for idempotency per TypeSpec
  context: varchar('context', { length: 255 }),
  
  // Core documentation fields - all optional per TypeSpec
  chiefComplaint: text('chief_complaint'),

  assessment: text('assessment'),

  plan: text('plan'),
  
  // Flexible clinical data (JSONB) - matches TypeSpec with standardized units
  vitals: jsonb('vitals').$type<{
    temperatureCelsius?: number;
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    weightKg?: number;
    heightCm?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    notes?: string;
    [key: string]: any;
  }>(),
  
  symptoms: jsonb('symptoms').$type<{
    onset?: string;              // ISO 8601 datetime string
    durationHours?: number;
    severity?: 'mild' | 'moderate' | 'severe';
    description?: string;
    associated?: string[];
    denies?: string[];
    [key: string]: any;
  }>(),
  
  prescriptions: jsonb('prescriptions').$type<Array<{
    id?: string;
    medication: string;
    dosageAmount?: number;
    dosageUnit?: string;
    frequency?: string;
    durationDays?: number;
    instructions?: string;
    notes?: string;
    [key: string]: any;
  }>>(),
  
  followUp: jsonb('follow_up').$type<{
    needed: boolean;
    timeframeDays?: number;
    instructions?: string;
    specialistReferral?: string;
    [key: string]: any;
  }>(),
  
  // Integration support for external systems (e.g., Mapflow)
  externalDocumentation: jsonb('external_documentation').$type<Record<string, any>>(),
  
  // Workflow fields
  status: consultationStatusEnum('status')
    .notNull()
    .default('draft'),

  finalizedAt: timestamp('finalized_at'),

  // Track who finalized the consultation per TypeSpec
  finalizedBy: uuid('finalized_by'),
}, (table) => ({
  // Performance indexes for common query patterns
  patientIdx: index('consultation_notes_patient_id_idx').on(table.patient),
  providerIdx: index('consultation_notes_provider_id_idx').on(table.provider),
  statusIdx: index('consultation_notes_status_idx').on(table.status),
  finalizedAtIdx: index('consultation_notes_finalized_at_idx').on(table.finalizedAt),
  finalizedByIdx: index('consultation_notes_finalized_by_idx').on(table.finalizedBy),
  contextIdx: index('consultation_notes_context_idx').on(table.context),

  // Compound indexes for common queries
  patientStatusIdx: index('consultation_notes_patient_status_idx')
    .on(table.patient, table.status),
  providerStatusIdx: index('consultation_notes_provider_status_idx')
    .on(table.provider, table.status),
  patientCreatedAtIdx: index('consultation_notes_patient_created_at_idx')
    .on(table.patient, table.createdAt),

  // Partial indexes for finalized consultations (better performance)
  finalizedConsultationsIdx: index('consultation_notes_finalized_idx')
    .on(table.patient, table.finalizedAt)
    .where(sql`${table.status} = 'finalized'`),

  // Draft consultations index for provider workflow
  draftConsultationsIdx: index('consultation_notes_draft_idx')
    .on(table.provider, table.createdAt)
    .where(sql`${table.status} = 'draft'`),

  // Context uniqueness for idempotency (only when context is provided)
  uniqueContext: unique('consultation_notes_context_unique').on(table.context),

  // Check constraints for text field lengths (nullable)
  chiefComplaintLengthCheck: check(
    'consultation_notes_chief_complaint_length_check',
    sql`${table.chiefComplaint} IS NULL OR (LENGTH(${table.chiefComplaint}) >= 1 AND LENGTH(${table.chiefComplaint}) <= 500)`
  ),
  assessmentLengthCheck: check(
    'consultation_notes_assessment_length_check',
    sql`${table.assessment} IS NULL OR (LENGTH(${table.assessment}) >= 1 AND LENGTH(${table.assessment}) <= 2000)`
  ),
  planLengthCheck: check(
    'consultation_notes_plan_length_check',
    sql`${table.plan} IS NULL OR (LENGTH(${table.plan}) >= 1 AND LENGTH(${table.plan}) <= 2000)`
  ),

  // Status workflow constraint - finalized consultations must have finalizedAt and finalizedBy
  finalizedAtConstraint: check(
    'consultation_notes_finalized_at_constraint',
    sql`(${table.status} = 'finalized' AND ${table.finalizedAt} IS NOT NULL AND ${table.finalizedBy} IS NOT NULL) OR ${table.status} != 'finalized'`
  ),
}));

// Type exports for TypeScript
export type ConsultationNote = typeof consultationNotes.$inferSelect;
export type NewConsultationNote = typeof consultationNotes.$inferInsert;

// TypeScript enum matching PostgreSQL enum
export type ConsultationStatus = 'draft' | 'finalized' | 'amended';

// JSONB field interfaces for type safety - standardized units
export interface VitalsData {
  temperatureCelsius?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  weightKg?: number;
  heightCm?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  notes?: string;
  [key: string]: any;
}

export interface SymptomsData {
  onset?: string;              // ISO 8601 datetime string
  durationHours?: number;
  severity?: 'mild' | 'moderate' | 'severe';
  description?: string;
  associated?: string[];
  denies?: string[];
  [key: string]: any;
}

export interface PrescriptionData {
  id?: string;
  medication: string;
  dosageAmount?: number;
  dosageUnit?: string;
  frequency?: string;
  durationDays?: number;
  instructions?: string;
  notes?: string;
  [key: string]: any;
}

export interface FollowUpData {
  needed: boolean;
  timeframeDays?: number;
  instructions?: string;
  specialistReferral?: string;
  [key: string]: any;
}

// Request types for API endpoints - matches TypeSpec models exactly
export interface CreateConsultationRequest {
  patient: string;                      // Required per TypeSpec
  provider: string;                     // Required per TypeSpec
  context?: string;                     // Optional context for idempotency
  chiefComplaint?: string;              // Optional per TypeSpec
  assessment?: string;                  // Optional per TypeSpec
  plan?: string;                        // Optional per TypeSpec
  vitals?: VitalsData;
  symptoms?: SymptomsData;
  prescriptions?: PrescriptionData[];
  followUp?: FollowUpData;
}

export interface UpdateConsultationRequest {
  chiefComplaint?: string | null;       // Can be null to clear per TypeSpec
  assessment?: string | null;           // Can be null to clear per TypeSpec
  plan?: string | null;                 // Can be null to clear per TypeSpec
  vitals?: VitalsData | null;           // Can be null to clear per TypeSpec
  symptoms?: SymptomsData | null;       // Can be null to clear per TypeSpec
  prescriptions?: PrescriptionData[] | null; // Can be null to clear per TypeSpec
  followUp?: FollowUpData | null;       // Can be null to clear per TypeSpec
  externalDocumentation?: Record<string, any> | null; // Can be null to clear per TypeSpec
}

// Patient health summary - matches TypeSpec model
export interface PatientHealthSummary {
  patient: string;
  recentConsultations: number;
  lastConsultation?: Date;
  activePrescriptions?: Array<{
    medication: string;
    prescribedDate: Date;
    consultation: string;
  }>;
}

// Helper types for queries with joined data
export interface ConsultationNoteWithDetails extends ConsultationNote {
  patient?: any;
  provider?: any;
}

// Response type for paginated consultation lists
export interface PaginatedConsultationResponse {
  data: ConsultationNote[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
