/**
 * US Terminology Mappings
 *
 * Maps US-specific code systems to international standards.
 * Enables interoperability between US local systems and international
 * healthcare data exchange standards (FHIR R4, IPS, HL7v2).
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.US;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    The US uses ICD-10-CM (Clinical Modification) — NOT the WHO ICD-10 base.
 *    CodingSystem.icd10cm ("http://hl7.org/fhir/sid/icd-10-cm") is the correct system URI.
 *    ICD-10-CM codes are a superset of WHO ICD-10: the first 3 characters align,
 *    but US codes add clinical specificity via additional characters.
 *    For international exchange, truncate to the ICD-10 parent code where needed.
 *
 * 2. Inpatient Procedure Coding
 *    US inpatient procedures use ICD-10-PCS (Procedure Coding System).
 *    ICD-10-PCS has no direct mapping to ICD-10 Volume 3 or CPT.
 *    For international exchange, prefer SNOMED CT procedure codes alongside ICD-10-PCS.
 *
 * 3. Outpatient/Physician Procedure Coding
 *    US outpatient procedures use CPT-4 (AMA). CPT does not have a direct ICD-10 mapping.
 *    For international exchange, represent procedures using SNOMED CT procedure codes.
 *    HCPCS Level II extends CPT for supplies, DME, and non-physician services.
 *
 * 4. Medication Coding
 *    The US uses NDC (11-digit) as the primary drug code on claims.
 *    NDC maps to RxNorm via the RxNorm/NDC crosswalk maintained by NLM.
 *    Mapping path: NDC → RxNorm (CUI) → SNOMED CT → ATC (international)
 *    RxNorm is the preferred system for clinical decision support and FHIR medication resources.
 *    NLM RxNorm API provides authoritative NDC → RxNorm mappings.
 *
 * 5. Provider Identification
 *    The US NPI (10-digit, Luhn check) is the canonical provider identifier for HIPAA transactions.
 *    For international exchange, carry the NPI as a local identifier:
 *      system = "http://hl7.org/fhir/sid/us-npi"
 *      value  = 10-digit NPI
 *    No direct mapping to other countries' provider ID systems exists.
 *
 * 6. Vaccine Coding
 *    CDC CVX codes are the US standard for vaccine administered coding.
 *    CVX maps to SNOMED CT vaccine product codes and ATC vaccine codes.
 *    Mapping maintained by CDC: https://www2.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx
 *
 * 7. Facility Identification
 *    US facility identifiers include:
 *    - NPI (Type 2): organizational NPI assigned to the facility
 *    - CMS Certification Number (CCN): for Medicare/Medicaid certified facilities
 *    - CLIA number: for clinical laboratories
 *    All are carried as local identifiers with their respective system URIs.
 *
 * 8. Discharge Disposition
 *    US NUBC discharge disposition codes are distinct from European DRG or WHO codes.
 *    For international exchange, map NUBC codes to the HL7 v3 Encounter Discharge Disposition
 *    value set where equivalents exist. No complete crosswalk is standardized.
 */
