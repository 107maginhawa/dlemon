import { getNames, getCode } from 'country-list'

/**
 * Country data structure
 *
 * IMPORTANT: Country codes MUST be uppercase per ISO 3166-1 alpha-2 standard.
 * This ensures compatibility with:
 * - BCP 47 region subtags (e.g., "en-US", "fr-CA")
 * - Domain country codes (e.g., .US, .UK)
 * - International banking standards (IBAN, SWIFT)
 * - Geographic information systems
 *
 * @example
 * { code: 'US', name: 'United States' }
 * { code: 'GB', name: 'United Kingdom' }
 * { code: 'JP', name: 'Japan' }
 */
export interface Country {
  /** ISO 3166-1 alpha-2 country code (uppercase) */
  code: string
  /** Country name */
  name: string
}

const countryNames = getNames()

export const COUNTRIES: Country[] = countryNames.map((name: string) => ({
  code: getCode(name) || '',
  name
}))
