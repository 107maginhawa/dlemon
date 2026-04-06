import { apiGet, apiPost, apiPatch, apiDelete, ApiError, type PaginatedResponse } from '../api'
import { sanitizeObject, mapPaginatedResponse } from '../utils/api'
import type { components } from '@monobase/api-spec/types'
import { mapApiPersonToFrontend, type Person as PersonType } from './person'

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiProvider = components["schemas"]["Provider"]
type ApiPerson = components["schemas"]["Person"]

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderType = 'pharmacist' | 'other'

export interface Provider {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  personId: string
  person: PersonType // Prefer expanded Person object
  providerType: ProviderType
  yearsOfExperience?: number
  biography?: string
  minorAilmentsSpecialties?: string[]
  minorAilmentsPracticeLocations?: string[]
}

export interface ProviderCreateRequest {
  person?: {
    firstName: string
    lastName: string
    middleName?: string
    dateOfBirth: string
    gender?: string
    languagesSpoken?: string[]
    timezone?: string
  }
  providerType: ProviderType
  yearsOfExperience?: number
  biography?: string
  minorAilmentsSpecialties?: string[]
  minorAilmentsPracticeLocations?: string[]
}

export interface ProviderUpdateRequest {
  yearsOfExperience?: number | null
  biography?: string | null
  minorAilmentsSpecialties?: string[] | null
  minorAilmentsPracticeLocations?: string[] | null
}

export interface ProviderQueryParams {
  minorAilmentsSpecialty?: string
  minorAilmentsPracticeLocation?: string
  languageSpoken?: string
  expand?: string
  limit?: number
  offset?: number
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API Provider response to Frontend Provider
 * Expects person to be expanded - throws if not provided
 */
function mapApiProviderToFrontend(api: ApiProvider & { person: ApiPerson | string }): Provider {
  // Require expanded person object for better DX
  if (typeof api.person === 'string') {
    throw new Error('Provider.person must be expanded. Use expand=person query parameter.')
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
    providerType: api.providerType as ProviderType,
    yearsOfExperience: api.yearsOfExperience,
    biography: api.biography,
    minorAilmentsSpecialties: api.minorAilmentsSpecialties,
    minorAilmentsPracticeLocations: api.minorAilmentsPracticeLocations,
  }
}

// ============================================================================
// Provider Service Functions
// ============================================================================

/**
 * List providers with optional filtering
 * Always expands person for better DX
 */
export async function listProviders(
  params?: Omit<ProviderQueryParams, 'expand'>
): Promise<PaginatedResponse<Provider>> {
  const response = await apiGet<PaginatedResponse<ApiProvider & { person: ApiPerson }>>('/providers', {
    ...params,
    expand: 'person'
  })
  return mapPaginatedResponse(response, mapApiProviderToFrontend)
}

/**
 * Get a specific provider by ID
 * Use 'me' as the provider ID to get the current authenticated user's profile
 * Always expands person for better DX
 */
export async function getProvider(id: string): Promise<Provider> {
  const apiProvider = await apiGet<ApiProvider & { person: ApiPerson }>(`/providers/${id}`, { expand: 'person' })
  return mapApiProviderToFrontend(apiProvider)
}

/**
 * Create a new provider profile
 */
export async function createProvider(
  data: ProviderCreateRequest
): Promise<Provider> {
  const created = await apiPost<ApiProvider>('/providers', sanitizeObject(data, { nullable: [] }))
  const apiProvider = await apiGet<ApiProvider & { person: ApiPerson }>(`/providers/${created.id}`, { expand: 'person' })
  return mapApiProviderToFrontend(apiProvider)
}

/**
 * Update an existing provider profile
 */
export async function updateProvider(
  id: string,
  updates: ProviderUpdateRequest
): Promise<Provider> {
  await apiPatch<ApiProvider>(`/providers/${id}`, sanitizeObject(updates, {
    nullable: ['yearsOfExperience', 'biography', 'minorAilmentsSpecialties', 'minorAilmentsPracticeLocations']
  }))
  const apiProvider = await apiGet<ApiProvider & { person: ApiPerson }>(`/providers/${id}`, { expand: 'person' })
  return mapApiProviderToFrontend(apiProvider)
}

/**
 * Delete a provider profile (soft delete)
 */
export async function deleteProvider(id: string): Promise<void> {
  return apiDelete<void>(`/providers/${id}`)
}

// ============================================================================
// "My" Provider Functions (Current User)
// ============================================================================

/**
 * Get current user's provider profile
 */
export async function getMyProvider(): Promise<Provider | null> {
  try {
    return await getProvider('me')
  } catch (error) {
    // Return null if provider doesn't exist (404)
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create provider profile for current user
 */
export async function createMyProvider(
  data: Omit<ProviderCreateRequest, 'person'>
): Promise<Provider> {
  return createProvider(data as ProviderCreateRequest)
}

/**
 * Update current user's provider profile
 */
export async function updateMyProvider(
  providerId: string,
  updates: ProviderUpdateRequest
): Promise<Provider> {
  return updateProvider(providerId, updates)
}

/**
 * Delete current user's provider profile
 */
export async function deleteMyProvider(): Promise<void> {
  return deleteProvider('me')
}
