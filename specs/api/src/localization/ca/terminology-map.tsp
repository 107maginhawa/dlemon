/**
 * Canadian Terminology Mappings
 *
 * Maps Canadian-specific code systems to international standards.
 * Enables interoperability between Canadian local systems and international
 * healthcare data exchange standards (FHIR R4, IPS, HL7v2).
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.CA;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    Canadian hospitals use ICD-10-CA (Canadian modification) for acute care morbidity coding.
 *    ICD-10-CA is maintained by CIHI and aligns with WHO ICD-10 at the 3-character chapter level.
 *    Canadian-specific codes appear from the 4th character onward.
 *    For international exchange, truncate to the WHO ICD-10 parent code.
 *    System URI for ICD-10-CA: "https://www.cihi.ca/en/canadian-classification-health-interventions"
 *
 * 2. Procedure Coding
 *    CCI (Canadian Classification of Health Interventions) is used for acute care procedure coding.
 *    CCI has a unique 7-character code structure: [Section].[Group].[Attribute]^^[Qualifier].
 *    No direct mapping to CPT, ICD-10-PCS, or OPCS-4.
 *    SNOMED CT procedure concepts are preferred for international procedure exchange.
 *    Infoway provides partial CCI-to-SNOMED mapping via pan-Canadian terminology services.
 *
 * 3. Medication Coding
 *    DIN (Drug Identification Number) is the Health Canada regulatory drug identifier (8 digits).
 *    CCDD is the clinical drug dataset for use in clinical information systems.
 *    CCDD is SNOMED CT-aligned (maintained by Infoway).
 *    Mapping path: DIN → CCDD → SNOMED CT → ATC → RxNorm (for international exchange)
 *    Infoway publishes the authoritative DIN-to-CCDD crosswalk.
 *
 * 4. Provider Identification
 *    Canada does not have a national provider identifier equivalent to the US NPI.
 *    Provincial medical college registration numbers are the primary practitioner identifiers.
 *    Each province issues its own licence through its college (CPSO, CPSBC, CPSA, CMQ, etc.).
 *    For FHIR Practitioner: carry provincial licence as Practitioner.identifier with
 *      system = provincial college URI (e.g., "https://www.cpso.on.ca")
 *      value  = licence number
 *    Infoway is developing a pan-Canadian provider registry; check current status.
 *
 * 5. Patient Identification
 *    There is no pan-Canadian patient identifier. Provincial health card numbers are used.
 *    Implementations must carry the province/territory of issue alongside the card number.
 *    FHIR Patient.identifier.system should use the province-specific Infoway NamingSystem URI.
 *    For inter-provincial patient matching, a clinical record linkage (probabilistic matching)
 *    approach using demographic attributes is typically required.
 *
 * 6. Facility Identification
 *    Facility OOIDs (Infoway-assigned OIDs) are used in HL7 v2 MSH segments.
 *    For FHIR Organization: carry the facility OID as Organization.identifier.
 *    Provincial facility registries maintain local facility codes; there is no single national registry.
 *
 * 7. Discharge Disposition
 *    CIHI DAD discharge disposition codes are Canadian-specific.
 *    They partially overlap with NUBC codes (used in the US) and NHS Data Dictionary codes (UK).
 *    For international exchange, map to HL7 v3 Encounter Discharge Disposition value set
 *    where approximate equivalents exist (e.g., CIHI 7 = HL7 "exp" for died).
 *
 * 8. Laboratory Coding
 *    pCLOCD (pan-Canadian LOINC Observation Code Database) is the recommended laboratory
 *    observation code system for Canadian implementations.
 *    pCLOCD is a curated subset of LOINC maintained by Infoway; the underlying system URI
 *    is the LOINC root ("http://loinc.org"). pCLOCD codes are valid LOINC codes.
 *    No special translation is required between pCLOCD and international LOINC use.
 */
