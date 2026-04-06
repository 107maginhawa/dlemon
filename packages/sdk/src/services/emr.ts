/**
 * EMR (Electronic Medical Records) Service
 *
 * Handles EMR-specific operations for telemedicine minor ailments:
 * - Consultation notes (ConsultationNote)
 * - EMR patient listing (reuses Patient from patient module)
 *
 * Note: This follows the actual TypeSpec API specification
 */

import { apiGet, apiPost, apiPatch, type PaginatedResponse } from '../api'
import { mapPaginatedResponse, sanitizeObject } from '../utils/api'
import type { components } from '@monobase/api-spec/types'
import { mapApiPatientToFrontend, type Patient } from './patient'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiConsultationNote = components["schemas"]["ConsultationNote"]
type ApiVitalsData = components["schemas"]["VitalsData"]
type ApiSymptomsData = components["schemas"]["SymptomsData"]
type ApiPrescriptionData = components["schemas"]["PrescriptionData"]
type ApiFollowUpData = components["schemas"]["FollowUpData"]
type ApiPatient = components["schemas"]["Patient"]

// ============================================================================
// Frontend Types
// ============================================================================

export type ConsultationStatus = 'draft' | 'finalized' | 'amended'
export type SymptomSeverity = 'mild' | 'moderate' | 'severe'

/**
 * Vital signs data structure
 */
export interface VitalsData {
  temperatureCelsius?: number
  systolicBp?: number
  diastolicBp?: number
  heartRate?: number
  weightKg?: number
  heightCm?: number
  respiratoryRate?: number
  oxygenSaturation?: number
  notes?: string
}

/**
 * Symptoms data structure
 */
export interface SymptomsData {
  onset?: Date
  durationHours?: number
  severity?: SymptomSeverity
  description?: string
  associated?: string[]
  denies?: string[]
}

/**
 * Prescription data structure
 */
export interface PrescriptionData {
  id?: string
  medication: string
  dosageAmount?: number
  dosageUnit?: string
  frequency?: string
  durationDays?: number
  instructions?: string
  notes?: string
}

/**
 * Follow-up data structure
 */
export interface FollowUpData {
  needed: boolean
  timeframeDays?: number
  instructions?: string
  specialistReferral?: string
}

/**
 * Consultation note - Core EMR documentation model
 */
export interface ConsultationNote {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  patient: string
  provider: string
  context?: string
  chiefComplaint?: string
  assessment?: string
  plan?: string
  vitals?: VitalsData
  symptoms?: SymptomsData
  prescriptions?: PrescriptionData[]
  followUp?: FollowUpData
  externalDocumentation?: Record<string, unknown>
  status: ConsultationStatus
  finalizedAt?: Date
  finalizedBy?: string
}

/**
 * Create consultation request
 */
export interface CreateConsultationRequest {
  patient: string
  provider: string
  context?: string
  chiefComplaint?: string
  assessment?: string
  plan?: string
  vitals?: VitalsData
  symptoms?: SymptomsData
  prescriptions?: PrescriptionData[]
  followUp?: FollowUpData
}

/**
 * Update consultation request
 */
export interface UpdateConsultationRequest {
  chiefComplaint?: string | null
  assessment?: string | null
  plan?: string | null
  vitals?: VitalsData | null
  symptoms?: SymptomsData | null
  prescriptions?: PrescriptionData[] | null
  followUp?: FollowUpData | null
  externalDocumentation?: Record<string, unknown> | null
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API ConsultationNote to Frontend ConsultationNote
 */
function mapApiConsultationNoteToFrontend(api: ApiConsultationNote): ConsultationNote {
  return {
    id: api.id,
    version: api.version,
    createdAt: new Date(api.createdAt),
    createdBy: api.createdBy || '',
    updatedAt: new Date(api.updatedAt),
    updatedBy: api.updatedBy || '',
    patient: api.patient,
    provider: api.provider,
    context: api.context,
    chiefComplaint: api.chiefComplaint,
    assessment: api.assessment,
    plan: api.plan,
    vitals: api.vitals,
    symptoms: api.symptoms ? {
      ...api.symptoms,
      onset: api.symptoms.onset ? new Date(api.symptoms.onset) : undefined,
      severity: api.symptoms.severity as SymptomSeverity | undefined,
    } : undefined,
    prescriptions: api.prescriptions,
    followUp: api.followUp,
    externalDocumentation: api.externalDocumentation,
    status: api.status as ConsultationStatus,
    finalizedAt: api.finalizedAt ? new Date(api.finalizedAt) : undefined,
    finalizedBy: api.finalizedBy,
  }
}

// ============================================================================
// Consultation Operations
// ============================================================================

/**
 * List consultations
 * Results are automatically filtered by role: providers see their own, patients see their own, admins see all
 */
export async function listConsultations(params?: {
  patient?: string
  status?: ConsultationStatus
  offset?: number
  limit?: number
}): Promise<PaginatedResponse<ConsultationNote>> {
  const response = await apiGet<PaginatedResponse<ApiConsultationNote>>('/emr/consultations', params)
  return mapPaginatedResponse(response, mapApiConsultationNoteToFrontend)
}

/**
 * Get consultation note by ID
 */
export async function getConsultation(id: string): Promise<ConsultationNote> {
  const apiConsultation = await apiGet<ApiConsultationNote>(`/emr/consultations/${id}`)
  return mapApiConsultationNoteToFrontend(apiConsultation)
}

/**
 * Create consultation note
 */
export async function createConsultation(data: CreateConsultationRequest): Promise<ConsultationNote> {
  const sanitized = sanitizeObject(data, {
    nullable: []  // CREATE operation: empty fields omitted, not sent as null
  })
  const apiConsultation = await apiPost<ApiConsultationNote>('/emr/consultations', sanitized)
  return mapApiConsultationNoteToFrontend(apiConsultation)
}

/**
 * Update consultation note
 */
export async function updateConsultation(id: string, data: UpdateConsultationRequest): Promise<ConsultationNote> {
  const sanitized = sanitizeObject(data, {
    nullable: ['chiefComplaint', 'assessment', 'plan', 'vitals', 'symptoms', 'prescriptions', 'followUp', 'externalDocumentation']
  })
  const apiConsultation = await apiPatch<ApiConsultationNote>(`/emr/consultations/${id}`, sanitized)
  return mapApiConsultationNoteToFrontend(apiConsultation)
}

/**
 * Finalize consultation note
 */
export async function finalizeConsultation(id: string): Promise<ConsultationNote> {
  const apiConsultation = await apiPost<ApiConsultationNote>(`/emr/consultations/${id}/finalize`, {})
  return mapApiConsultationNoteToFrontend(apiConsultation)
}

// ============================================================================
// EMR Patient Operations
// ============================================================================

/**
 * List patients who have consultations with the current authenticated provider
 * Results are automatically filtered to the current provider
 * Returns regular Patient[] type (reuses patient module)
 */
export async function listEMRPatients(params?: {
  expand?: string
  offset?: number
  limit?: number
}): Promise<PaginatedResponse<Patient>> {
  const response = await apiGet<PaginatedResponse<ApiPatient>>('/emr/patients', params)
  return mapPaginatedResponse(response, (api) => mapApiPatientToFrontend(api as any))
}
