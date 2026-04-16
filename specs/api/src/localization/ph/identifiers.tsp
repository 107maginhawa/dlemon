/**
 * Philippine Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to Philippine healthcare.
 * These extend the core Identifier model via the identifiers[] array on resources.
 *
 * Usage: Set Identifier.system to the appropriate URI and Identifier.value to the ID.
 */

namespace Localization.PH;

@doc("Philippine healthcare identifier system URIs.")
enum PHIdentifierSystem {
  @doc("PhilHealth Identification Number (PIN). 12-digit unique member identifier. Format: XX-XXXXXXXXX-X")
  philhealthPin: "https://philhealth.gov.ph/pin",

  @doc("Professional Regulation Commission (PRC) License Number. Required for all licensed healthcare professionals in the Philippines under RA 2382.")
  prcLicense: "https://prc.gov.ph/license",

  @doc("Hospital Record Number (HRN). Institution-scoped medical record identifier. Format varies by facility.")
  hospitalRecordNumber: "https://monobase.health/identifier/ph/hrn",

  @doc("PhilHealth Accreditation Number. Facility-level identifier for PhilHealth-accredited providers.")
  philhealthAccreditation: "https://philhealth.gov.ph/accreditation",

  @doc("DOH License to Operate (LTO) Number. Required for all healthcare facilities under DOH licensing.")
  dohLto: "https://doh.gov.ph/lto",
}

/**
 * Validation Patterns for Philippine Identifiers
 *
 * PhilHealth PIN: ^\d{2}-\d{9}-\d$  (e.g., 01-234567890-1)
 * PRC License: ^\d{7}$  (7-digit number)
 * DOH LTO: Varies by facility type and region
 */
