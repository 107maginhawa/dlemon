/**
 * UK Terminology Mappings
 *
 * Maps UK-specific code systems to international standards.
 * Enables interoperability between NHS local systems and international
 * healthcare data exchange standards (FHIR R4, IPS, HL7v2).
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.UK;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    UK hospitals use WHO ICD-10 (specifically the 5th edition, ICD-10 version 5) for HES submissions.
 *    System URI: "http://hl7.org/fhir/sid/icd-10" (international ICD-10 base)
 *    NHS Digital mandates ICD-10 for admitted patient care Commissioning Data Set (CDS) submissions.
 *    SNOMED CT is the preferred system for clinical recording; ICD-10 is derived from SNOMED CT
 *    via the SNOMED CT to ICD-10 map maintained by NHS Digital / SNOMED International.
 *
 * 2. Procedure Coding
 *    OPCS-4 is mandatory for admitted patient procedures in NHS England CDS submissions.
 *    System URI: "https://www.datadictionary.nhs.uk/data_elements/main_operative_procedure_-_opcs_code.html"
 *    OPCS-4 → SNOMED CT procedure concepts: partial mapping available from NHS Digital.
 *    For international exchange, prefer SNOMED CT procedure concepts.
 *
 * 3. Medication Coding
 *    dm+d (Dictionary of Medicines and Devices) is the NHS standard for ePrescribing and dispensing.
 *    dm+d codes map to SNOMED CT via the dm+d/SNOMED CT integration maintained by NHS Digital.
 *    dm+d also provides linkage to ATC (WHO Anatomical Therapeutic Chemical) codes.
 *    Mapping path: dm+d → SNOMED CT → ATC (international) → RxNorm (via NLM/SNOMED crosswalk)
 *    The BNF classification provides a prescribing-oriented drug taxonomy alongside dm+d.
 *
 * 4. Provider Identification
 *    GMC Number is the canonical UK medical practitioner identifier.
 *    NMC Number for nurses/midwives; GPhC Number for pharmacists.
 *    No direct international equivalent. Carry as local identifier with UK system URI.
 *    For FHIR Practitioner: use Practitioner.identifier with appropriate system URI.
 *
 * 5. Patient Identification
 *    NHS Number (England/Wales) is verified against the Personal Demographics Service (PDS).
 *    NHS Number is the national patient identifier for health and care in England/Wales.
 *    CHI Number used in Scotland; H&C Number in Northern Ireland.
 *    No single UK-wide patient identifier; implementers must handle all three.
 *
 * 6. Facility Identification
 *    ODS Code is the canonical NHS organisation and site identifier.
 *    ODS Code maps to FHIR Organization.identifier (system: fhir.nhs.uk/Id/ods-organization-code).
 *    No direct international mapping; carry as local identifier.
 *
 * 7. READ Codes (Legacy)
 *    READ v2 and CTV3 are legacy GP coding systems being replaced by SNOMED CT.
 *    NHS England mandated SNOMED CT in all new GP system implementations.
 *    READ to SNOMED CT maps are maintained by NHS Digital for data migration purposes.
 *    Do not use READ codes in new implementations; use SNOMED CT UK Edition.
 *
 * 8. Ethnic Categories
 *    NHS ethnic categories (NHS Data Dictionary codes A–Z) do not have a direct HL7 international
 *    equivalent. For international exchange, map to HL7 v3 Race/Ethnicity value set concepts
 *    where approximate equivalents exist.
 */
