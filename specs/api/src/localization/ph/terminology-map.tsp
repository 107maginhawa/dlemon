/**
 * Philippine Terminology Mappings
 *
 * Maps Philippine-specific code systems to international standards.
 * These mappings enable interoperability between PH local systems and
 * international healthcare data exchange.
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.PH;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    Philippine hospitals use WHO ICD-10 (NOT ICD-10-CM).
 *    CodingSystem.icd10 ("http://hl7.org/fhir/sid/icd-10") is the correct system URI.
 *    PhilHealth requires ICD-10 codes on all claims per Circular No. 27 S. 2003.
 *
 * 2. Procedure Coding
 *    PH uses RVS (Relative Value Scale) for procedure pricing.
 *    RVS codes map approximately to CPT codes but are NOT identical.
 *    Mapping: RVS → CPT is partial (many RVS codes have CPT equivalents).
 *    For international exchange, prefer SNOMED CT procedure codes.
 *
 * 3. Medication Coding
 *    PH uses PNDF (Philippine National Drug Formulary) for essential medicines.
 *    PNDF entries can be mapped to RxNorm via generic drug name matching.
 *    WHO ATC codes (CodingSystem.atcWho) provide an intermediate mapping layer.
 *    Mapping path: PNDF → ATC → RxNorm
 *
 * 4. Provider Identification
 *    PH uses PRC license numbers (Professional Regulation Commission).
 *    No direct international equivalent. Map to local identifier with system URI.
 *    For international exchange, use Practitioner.identifier with:
 *      system = "https://prc.gov.ph/license"
 *      value = PRC license number
 *
 * 5. Insurance/Payer Identification
 *    PhilHealth PIN is the primary insurance identifier.
 *    No direct equivalent to US NPI for payer identification.
 *    Map to Coverage.identifier with:
 *      system = "https://philhealth.gov.ph/pin"
 *      value = PhilHealth PIN
 *
 * 6. Facility Identification
 *    DOH NHFR (National Health Facility Registry) code is the facility identifier.
 *    Map to Organization.identifier with:
 *      system = "https://nhfr.doh.gov.ph/facility-code"
 *      value = NHFR code
 */
