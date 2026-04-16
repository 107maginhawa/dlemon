/**
 * US Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to United States healthcare.
 * These are carried in the identifiers[] array on Patient, Practitioner, and Organization resources.
 *
 * Privacy note: SSN and Aadhaar-equivalent identifiers are RESTRICTED. Never store full SSN.
 * Regulatory basis: HIPAA Privacy Rule (45 CFR Part 164), 42 CFR Part 2 (substance abuse records),
 * CMS enrollment regulations (42 CFR Part 424).
 */

namespace Localization.US;

@doc("US healthcare identifier system URIs. Set Identifier.system to the appropriate URI and Identifier.value to the identifier value.")
enum USIdentifierSystem {
  @doc("NPI — National Provider Identifier. 10-digit unique identifier for all HIPAA-covered healthcare providers. Mandatory on all electronic transactions under 45 CFR 162.410. Type 1 NPI: individual providers. Type 2 NPI: organizational providers.")
  npi: "http://hl7.org/fhir/sid/us-npi",

  @doc("SSN — Social Security Number. RESTRICTED — never store or transmit the full 9-digit SSN. If collected at all, store only the last 4 digits. Superseded by MBI for Medicare beneficiary identification.")
  ssn: "http://hl7.org/fhir/sid/us-ssn",

  @doc("MBI — Medicare Beneficiary Identifier. 11-character alphanumeric identifier assigned by CMS. Replaced HICN (Health Insurance Claim Number) as of January 2020. Format: 1AN-AN-AAAA-AN (non-SSN-based).")
  mbi: "http://hl7.org/fhir/sid/us-medicare-beneficiary-id",

  @doc("Medicaid ID — State Medicaid recipient identifier. Format and length vary by state; the system URI below is the canonical HL7 root. Individual states may define sub-namespaces (e.g., /ca, /ny).")
  medicaidId: "http://hl7.org/fhir/sid/us-medicaid",

  @doc("DEA Number — Drug Enforcement Administration registration number. Required for practitioners who prescribe controlled substances. Format: 2 letters + 7 digits with check digit.")
  deaNumber: "https://www.deadiversion.usdoj.gov/registration",

  @doc("State Medical License — License number issued by a state medical board. The full identifier must be qualified with the issuing state. Example system URI for California: https://www.mbc.ca.gov/license. Append the two-letter state code for each state.")
  stateMedicalLicense: "https://www.fsmb.org/licensure",

  @doc("Driver's License — RESTRICTED. State-issued driver's license number used as an auxiliary patient identity verification document. Never use as primary patient identifier. System URI identifies the root; append state abbreviation for the issuing state.")
  driversLicense: "http://hl7.org/fhir/sid/us-drivers-license",

  @doc("EIN — Employer Identification Number (Tax ID). IRS-issued 9-digit number for organizational entities. Used to identify payer and provider organizations on claims.")
  ein: "urn:oid:2.16.840.1.113883.4.4",

  @doc("TIN — Tax Identification Number. May refer to SSN (individual) or EIN (organization) as used in billing contexts. Treat with the same restrictions as SSN when referencing individual practitioners.")
  tin: "https://www.irs.gov/tin",

  @doc("CLIA — Clinical Laboratory Improvement Amendments certificate number. Required for all laboratory facilities performing clinical testing on human specimens under 42 CFR Part 493.")
  cliaNumber: "https://www.cms.gov/clia",

  @doc("UPIN — Unique Physician Identification Number. DEPRECATED — replaced by NPI as of 2008. Retained for legacy record mapping only.")
  upin: "http://hl7.org/fhir/sid/us-upin",
}

/**
 * Validation Patterns for US Identifiers
 *
 * NPI:            ^\d{10}$
 *   Check digit: Luhn algorithm applied to the 10-digit NPI.
 *
 * SSN (RESTRICTED — last 4 only):
 *   Full (never store): ^\d{3}-\d{2}-\d{4}$
 *   Last 4 only:        ^\d{4}$
 *
 * MBI:            ^[1-9][AC-HJ-KM-NP-RT-Y]\d[AC-HJ-KM-NP-RT-Y]\d[AC-HJ-KM-NP-RT-Y]{2}\d[AC-HJ-KM-NP-RT-Y]{2}\d{2}$
 *   Note: The MBI excludes the letters B, D, I, L, O, S, Z and uses an 11-character fixed format.
 *
 * DEA Number:     ^[A-Z]{2}\d{7}$
 *   Check digit algorithm: Sum of digits 1, 3, 5 + 2 × (sum of digits 2, 4, 6); check digit = last digit of total.
 *   First letter: registrant type code (A–F, M, P, R, X).
 *   Second letter: first letter of registrant's last name.
 *
 * EIN:            ^\d{2}-\d{7}$
 *
 * CLIA:           ^\d{2}D\d{7}$  (where D is a letter; varies by state prefix)
 *
 * State Medical License: Pattern varies by state medical board. Typically 5–10 alphanumeric characters.
 *
 * Driver's License: Pattern varies by state (2–18 alphanumeric characters depending on state DMV).
 *
 * Medicaid ID: Format varies by state (6–20 alphanumeric characters).
 */
