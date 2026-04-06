import { apiGet, apiPost, apiPatch, ApiError } from '../api'
import { sanitizeObject } from '../utils/api'
import { formatDate } from '../utils/format'
import type { components } from '@monobase/api-spec/types'

// ============================================================================
// Person Types
// ============================================================================

export interface PersonalInfo {
  firstName: string
  lastName: string
  middleName?: string
  dateOfBirth: Date
  gender?: 'male' | 'female' | 'non-binary' | 'other' | 'prefer-not-to-say'
  avatar?: { file?: string; url: string } | null
}

export interface OptionalAddress {
  street1?: string
  street2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export interface ContactInfo {
  email?: string
  phone?: string
}

export interface Preferences {
  languagesSpoken: string[]
  timezone: string
}

// ============================================================================
// API Type Aliases
// ============================================================================

type ApiPerson = components["schemas"]["Person"]
type ApiPersonCreate = components["schemas"]["PersonCreateRequest"]

// ============================================================================
// Frontend Types
// ============================================================================

/**
 * Frontend representation of a Person with Date objects
 */
export interface Person {
  id: string
  version: number
  createdAt: Date
  createdBy: string
  updatedAt: Date
  updatedBy: string
  firstName: string
  lastName?: string
  middleName?: string
  dateOfBirth?: Date
  gender?: string
  avatar?: {
    file?: string
    url: string
  }
  contactInfo?: {
    email?: string
    phone?: string
  }
  primaryAddress?: {
    street1?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  languagesSpoken?: string[]
  timezone?: string
}

/**
 * Frontend data for creating a person
 */
export interface CreatePersonData {
  firstName: string
  lastName?: string
  middleName?: string
  dateOfBirth?: Date
  gender?: string
  contactInfo?: {
    email?: string
    phone?: string
  }
  primaryAddress?: {
    street1?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  languagesSpoken?: string[]
  timezone?: string
}

/**
 * Frontend data for updating a person
 */
export interface UpdatePersonData {
  firstName?: string
  lastName?: string | null
  middleName?: string | null
  dateOfBirth?: Date | null
  gender?: string | null
  avatar?: { file?: string; url: string } | null
  contactInfo?: { email?: string; phone?: string } | null
  primaryAddress?: {
    street1?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  } | null
  languagesSpoken?: string[] | null
  timezone?: string | null
}

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Convert API Person response to Frontend Person
 */
export function mapApiPersonToFrontend(api: ApiPerson): Person {
  return {
    id: api.id,
    version: api.version,
    createdAt: new Date(api.createdAt),
    createdBy: api.createdBy || '',
    updatedAt: new Date(api.updatedAt),
    updatedBy: api.updatedBy || '',
    firstName: api.firstName,
    lastName: api.lastName,
    middleName: api.middleName,
    dateOfBirth: api.dateOfBirth ? new Date(api.dateOfBirth) : undefined,
    gender: api.gender,
    avatar: api.avatar,
    contactInfo: api.contactInfo,
    primaryAddress: api.primaryAddress,
    languagesSpoken: api.languagesSpoken,
    timezone: api.timezone,
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get the current user's person profile
 */
export async function getMyProfile(): Promise<Person | null> {
  try {
    const apiPerson = await apiGet<ApiPerson>('/persons/me')
    return mapApiPersonToFrontend(apiPerson)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create a new person profile for the current user
 */
export async function createMyPerson(data: CreatePersonData): Promise<Person> {
  const apiRequest = sanitizeObject({
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    dateOfBirth: data.dateOfBirth ? formatDate(data.dateOfBirth, { format: 'date' }) : undefined,
    gender: data.gender,
    contactInfo: data.contactInfo,
    primaryAddress: data.primaryAddress,
    languagesSpoken: data.languagesSpoken,
    timezone: data.timezone,
  }, {
    nullable: []  // CREATE operations: empty fields are omitted, not sent as null
  }) as ApiPersonCreate
  
  const apiPerson = await apiPost<ApiPerson>('/persons', apiRequest)
  return mapApiPersonToFrontend(apiPerson)
}

/**
 * Update the current user's personal information
 */
export async function updateMyPersonalInfo(personId: string, data: PersonalInfo): Promise<Person> {
  const updateData = sanitizeObject({
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    dateOfBirth: formatDate(data.dateOfBirth, { format: 'date' }),
    gender: data.gender,
    avatar: data.avatar ? {
      file: data.avatar.file,
      url: data.avatar.url
    } : null,
  }, {
    nullable: ['lastName', 'middleName', 'dateOfBirth', 'gender', 'avatar']
  })
  const apiPerson = await apiPatch<ApiPerson>(`/persons/${personId}`, updateData)
  return mapApiPersonToFrontend(apiPerson)
}

/**
 * Update the current user's contact information
 */
export async function updateMyContactInfo(personId: string, data: ContactInfo): Promise<Person> {
  const updateData = sanitizeObject({
    contactInfo: {
      email: data.email,
      phone: data.phone,
    }
  }, {
    nullable: ['contactInfo']
  })
  const apiPerson = await apiPatch<ApiPerson>(`/persons/${personId}`, updateData)
  return mapApiPersonToFrontend(apiPerson)
}

/**
 * Update the current user's address
 */
export async function updateMyAddress(personId: string, data: OptionalAddress): Promise<Person> {
  const updateData = sanitizeObject({
    primaryAddress: {
      street1: data.street1,
      street2: data.street2,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
    }
  }, {
    nullable: ['primaryAddress', 'primaryAddress.street2']
  })
  const apiPerson = await apiPatch<ApiPerson>(`/persons/${personId}`, updateData)
  return mapApiPersonToFrontend(apiPerson)
}

/**
 * Update the current user's preferences
 */
export async function updateMyPreferences(personId: string, data: Preferences): Promise<Person> {
  const updateData = sanitizeObject({
    languagesSpoken: data.languagesSpoken,
    timezone: data.timezone,
  }, {
    nullable: ['languagesSpoken', 'timezone']
  })
  const apiPerson = await apiPatch<ApiPerson>(`/persons/${personId}`, updateData)
  return mapApiPersonToFrontend(apiPerson)
}
