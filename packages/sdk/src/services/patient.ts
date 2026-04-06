import { apiGet, apiPost, apiPatch, ApiError } from '../api'
import { sanitizeObject } from '../utils/api'
import type { components } from '@monobase/api-spec/types'
import { mapApiPersonToFrontend, type Person as PersonType } from './person'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiPatient = components["schemas"]["Patient"]
type ApiPerson = components["schemas"]["Person"]

// ============================================================================
// Frontend Types
// ============================================================================

export interface PrimaryProvider {
  name: string
  specialty?: string | null
  phone?: string | null
  fax?: string | null
}

export interface PrimaryPharmacy {
  name: string
  address?: string | null
  phone?: string | null
  fax?: string | null
}

export interface Patient {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  personId: string
  person: PersonType // Prefer expanded Person object
  primaryProvider?: PrimaryProvider | null
  primaryPharmacy?: PrimaryPharmacy | null
}

export interface CreatePatientData {
  person?: any // PersonCreateRequest - handled by person module
  primaryProvider?: PrimaryProvider | null
  primaryPharmacy?: PrimaryPharmacy | null
}

export interface UpdatePatientData {
  primaryProvider?: PrimaryProvider | null
  primaryPharmacy?: PrimaryPharmacy | null
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API Patient response to Frontend Patient
 * Expects person to be expanded - throws if not provided
 */
export function mapApiPatientToFrontend(api: ApiPatient & { person: ApiPerson | string }): Patient {
  // Require expanded person object for better DX
  if (typeof api.person === 'string') {
    throw new Error('Patient.person must be expanded. Use expand=person query parameter.')
  }

  return {
    id: api.id,
    version: api.version,
    createdAt: new Date(api.createdAt),
    createdBy: api.createdBy || '',
    updatedAt: new Date(api.updatedAt),
    updatedBy: api.updatedBy || '',
    personId: api.person.id,
    person: mapApiPersonToFrontend(api.person),
    primaryProvider: api.primaryProvider || null,
    primaryPharmacy: api.primaryPharmacy || null,
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get the current user's patient profile
 */
export async function getMyPatientProfile(): Promise<Patient | null> {
  try {
    const apiPatient = await apiGet<ApiPatient & { person?: ApiPerson }>('/patients/me', { expand: 'person' })
    return mapApiPatientToFrontend(apiPatient)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create a new patient profile
 */
export async function createPatient(data: CreatePatientData): Promise<Patient> {
  const apiRequest = sanitizeObject({
    person: data.person,
    primaryProvider: data.primaryProvider,
    primaryPharmacy: data.primaryPharmacy,
  }, {
    nullable: []  // No nullable fields in CREATE operations
  })

  // Note: POST doesn't support expand param, so we need to fetch with expand after creation
  const created = await apiPost<ApiPatient>('/patients', apiRequest)
  const apiPatient = await apiGet<ApiPatient & { person: ApiPerson }>(`/patients/${created.id}`, { expand: 'person' })
  return mapApiPatientToFrontend(apiPatient)
}

/**
 * Update patient profile
 */
export async function updatePatient(patientId: string, data: UpdatePatientData): Promise<Patient> {
  const apiRequest = sanitizeObject({
    primaryProvider: data.primaryProvider,
    primaryPharmacy: data.primaryPharmacy,
  }, {
    nullable: ['primaryProvider', 'primaryProvider.specialty', 'primaryProvider.phone', 'primaryProvider.fax',
               'primaryPharmacy', 'primaryPharmacy.address', 'primaryPharmacy.phone', 'primaryPharmacy.fax']
  })

  // PATCH doesn't support expand, so fetch with expand after update
  await apiPatch<ApiPatient>(`/patients/${patientId}`, apiRequest)
  const apiPatient = await apiGet<ApiPatient & { person: ApiPerson }>(`/patients/${patientId}`, { expand: 'person' })
  return mapApiPatientToFrontend(apiPatient)
}

/**
 * Update patient's primary provider
 */
export async function updatePrimaryProvider(patientId: string, data: PrimaryProvider | null): Promise<Patient> {
  const apiRequest = sanitizeObject({
    primaryProvider: data,
  }, {
    nullable: ['primaryProvider', 'primaryProvider.specialty', 'primaryProvider.phone', 'primaryProvider.fax']
  })

  await apiPatch<ApiPatient>(`/patients/${patientId}`, apiRequest)
  const apiPatient = await apiGet<ApiPatient & { person: ApiPerson }>(`/patients/${patientId}`, { expand: 'person' })
  return mapApiPatientToFrontend(apiPatient)
}

/**
 * Update patient's primary pharmacy
 */
export async function updatePrimaryPharmacy(patientId: string, data: PrimaryPharmacy | null): Promise<Patient> {
  const apiRequest = sanitizeObject({
    primaryPharmacy: data,
  }, {
    nullable: ['primaryPharmacy', 'primaryPharmacy.address', 'primaryPharmacy.phone', 'primaryPharmacy.fax']
  })

  await apiPatch<ApiPatient>(`/patients/${patientId}`, apiRequest)
  const apiPatient = await apiGet<ApiPatient & { person: ApiPerson }>(`/patients/${patientId}`, { expand: 'person' })
  return mapApiPatientToFrontend(apiPatient)
}
