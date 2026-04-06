// ============================================================================
// Paginated Response Types
// ============================================================================

import type { PaginatedResponse } from '../api'

/**
 * Map a paginated API response to frontend types
 * Applies a mapper function to each item in the data array
 * 
 * @param response - Paginated API response
 * @param mapper - Function to transform individual items from API to Frontend type
 * @returns Paginated response with transformed data
 * 
 * @example
 * ```typescript
 * const apiResponse = await apiGet<PaginatedResponse<ApiNotification>>('/notifications')
 * return mapPaginatedResponse(apiResponse, mapApiNotificationToFrontend)
 * ```
 */
export function mapPaginatedResponse<TApi, TFrontend>(
  response: PaginatedResponse<TApi>,
  mapper: (item: TApi) => TFrontend
): PaginatedResponse<TFrontend> {
  return {
    data: response.data.map(mapper),
    pagination: response.pagination,
  }
}

// ============================================================================
// String Normalization
// ============================================================================

/**
 * Normalize string field - trim and convert empty strings to undefined
 * Used for cleaning form data before API submission
 */
export function normalizeStringField(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Configuration for sanitizing objects before API submission
 */
export interface SanitizeConfig {
  /** Fields that can be set to null (supports dot notation for nested fields) */
  nullable?: string[]
}/**
 * Sanitize object for API submission with nullable configuration
 *
 * Rules:
 * - All fields are optional by default (omitted if undefined)
 * - Fields in nullable array: Send null if value is null, empty string, or empty object
 * - Fields NOT in nullable array: Omit if value is null, empty string, or empty object
 * - Supports dot notation for nested fields (e.g., 'address.street2')
 * - String fields are normalized before checking if empty
 *
 * @param data - Object to sanitize
 * @param config - Configuration specifying which fields are nullable
 * @param prefix - Internal parameter for tracking nested paths
 * @returns Sanitized object
 *
 * @example
 * // Simple nullable fields
 * sanitizeObject(data, {
 *   nullable: ['lastName', 'middleName']
 * })
 *
 * @example
 * // Nested nullable fields
 * sanitizeObject(data, {
 *   nullable: ['primaryAddress', 'primaryAddress.street2', 'primaryAddress.coordinates']
 * })
 */
export function sanitizeObject<T extends Record<string, any>>(
  data: T,
  config: SanitizeConfig,
  prefix: string = ''
): Partial<T> {
  const result: any = {}
  const { nullable = [] } = config

  for (const [key, value] of Object.entries(data)) {
    const fullPath = prefix ? `${prefix}.${key}` : key

    // Skip undefined values
    if (value === undefined) continue

    // Check if this field is nullable
    const isNullable = nullable.includes(fullPath)

    // Check if value is originally empty (before processing)
    const isOriginallyEmpty =
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (typeof value === 'object' && !Array.isArray(value) && value !== null && Object.keys(value).length === 0)

    if (isOriginallyEmpty) {
      if (isNullable) {
        result[key] = null
      }
      // Non-nullable + empty → omit
      continue
    }    // Process value based on type
    let processedValue = value

    if (typeof value === 'string') {
      // Normalize string fields
      const normalized = normalizeStringField(value)
      if (normalized) {
        processedValue = normalized
      } else {
        // Normalized to empty
        if (isNullable) {
          result[key] = null
        }
        // Non-nullable + empty after normalization → omit
        continue
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively process nested objects
      processedValue = sanitizeObject(value, config, fullPath)

      // Check if processed result is empty
      if (Object.keys(processedValue).length === 0) {
        if (isNullable) {
          result[key] = null
        }
        // Non-nullable + empty after processing → omit
        continue
      }
    }

    // Include processed value
    result[key] = processedValue
  }

  return result
}
