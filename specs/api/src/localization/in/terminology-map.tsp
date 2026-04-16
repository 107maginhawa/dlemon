/**
 * Indian Terminology Mappings
 *
 * Maps Indian healthcare-specific code systems to international standards.
 * Enables interoperability between ABDM local systems and international
 * healthcare data exchange standards (FHIR R4, IPS, HL7v2).
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.IN;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    India (ABDM) mandates WHO ICD-10 for allopathic diagnosis coding.
 *    System URI: "http://hl7.org/fhir/sid/icd-10"
 *    There is no Indian-specific ICD-10 modification; the WHO base edition is used directly.
 *    For AYUSH diagnoses, SNOMED CT concepts from the AYUSH extension should be used.
 *    NRCeS (National Resource Centre for EHR Standards) maintains guidance on ICD-10 use in India.
 *
 * 2. Procedure Coding
 *    ABDM mandates SNOMED CT for procedure coding.
 *    System URI: "http://snomed.info/sct"
 *    There is no Indian-specific procedure classification equivalent to CPT, OPCS-4, or ACHI.
 *    For billing/insurance contexts (PM-JAY), HBP (Health Benefit Package) codes are used.
 *    Mapping path: Clinical procedure (SNOMED CT) → PM-JAY HBP code (for PM-JAY claims)
 *
 * 3. Medication Coding
 *    ABDM mandates SNOMED CT (AMT-equivalent) for medication coding in EHR contexts.
 *    For procurement and essential medicines: NLEM drug names (generic names per WHO INN).
 *    CDSCO drug codes for Schedule H, H1, and X controlled drugs.
 *    No single authoritative Indian drug code database equivalent to NDC or DIN exists at scale.
 *    Mapping path: NLEM generic name → WHO INN → ATC → SNOMED CT drug concept → RxNorm
 *
 * 4. Provider Identification
 *    HPR ID (Healthcare Professionals Registry) is the ABDM primary provider identifier.
 *    NMC registration number is required for allopathic practitioners.
 *    State Medical Council registration is also required (state-level).
 *    AYUSH practitioners are registered with their respective national councils (CCIM, CCH, etc.)
 *    and HPR covers all registered practitioners under one system.
 *    For FHIR Practitioner: use Practitioner.identifier with:
 *      system = "https://hpr.abdm.gov.in"
 *      value  = HPR ID
 *    And additionally carry the NMC/State Council number with respective system URI.
 *
 * 5. Patient Identification
 *    ABHA Number (14-digit) is the primary ABDM patient identifier.
 *    ABHA Address (username@abdm) is the human-readable federated health record address.
 *    Aadhaar must NEVER be stored or used as a patient identifier in health applications.
 *    For FHIR Patient: use Patient.identifier with:
 *      system = "https://healthid.ndhm.gov.in"
 *      value  = 14-digit ABHA Number
 *    Optionally include ABHA Address:
 *      system = "https://healthid.ndhm.gov.in/abha-address"
 *      value  = username@abdm
 *
 * 6. Facility Identification
 *    HFIR ID (Health Facility Registry Identifier) is the ABDM facility identifier.
 *    For FHIR Organization: use Organization.identifier with:
 *      system = "https://facility.abdm.gov.in"
 *      value  = HFIR ID
 *
 * 7. AYUSH Coding
 *    ABDM supports AYUSH clinical documentation alongside allopathic records.
 *    AYUSH diagnoses: mapped to SNOMED CT using concepts from the ABDM AYUSH extension.
 *    AYUSH medicines: classified using ATC-equivalent codes where available.
 *    Ministry of AYUSH is developing a national AYUSH drug code registry; check current status.
 *
 * 8. PM-JAY Package Codes
 *    PM-JAY HBP codes are specific to the Ayushman Bharat public insurance scheme.
 *    They have no direct international equivalent; carry as local codes for claims contexts.
 *    Each HBP code maps to one or more SNOMED CT procedure concepts.
 *    NHA publishes the authoritative HBP code list and rate schedule annually.
 */
