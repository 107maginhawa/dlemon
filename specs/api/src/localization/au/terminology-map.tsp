/**
 * Australian Terminology Mappings
 *
 * Maps Australian-specific code systems to international standards.
 * Enables interoperability between Australian local systems and international
 * healthcare data exchange standards (FHIR R4, IPS, HL7v2).
 *
 * Note: Actual code-level mappings are maintained in a terminology service.
 * This file documents the mapping relationships and policies.
 */

namespace Localization.AU;

/**
 * MAPPING RELATIONSHIPS:
 *
 * 1. Diagnosis Coding
 *    Australian hospitals use ICD-10-AM (Australian Modification), not WHO ICD-10 base.
 *    ICD-10-AM codes share the same 3-character chapter structure as WHO ICD-10 but include
 *    Australian-specific extensions and modifications from the 4th character onward.
 *    For international exchange, truncate to the ICD-10 parent code where necessary.
 *    System URI for ICD-10-AM: "https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ICD-10-AM"
 *
 * 2. Procedure Coding
 *    ACHI (Australian Classification of Health Interventions) is used for inpatient procedure coding.
 *    ACHI codes have no direct mapping to CPT or ICD-10-PCS.
 *    ADHA provides a partial SNOMED CT to ACHI map via the NCTIS reference sets.
 *    For international exchange, prefer SNOMED CT procedure concepts alongside ACHI.
 *
 * 3. Medication Coding
 *    AMT (Australian Medicines Terminology) is SNOMED CT-based and uses SNOMED CT concept IDs.
 *    System URI is the SNOMED CT root "http://snomed.info/sct" — AMT concepts are within the
 *    SNOMED CT AU Edition module.
 *    AMT → SNOMED CT: direct (AMT IS SNOMED CT-based)
 *    AMT → PBS: PBS item codes are linked to AMT via the AMT/PBS crosswalk maintained by ADHA.
 *    Mapping path for international exchange: AMT → SNOMED CT → ATC → RxNorm
 *
 * 4. Provider Identification
 *    AHPRA registration number is the canonical credential identifier for regulated health practitioners.
 *    HPI-I is the eHealth identifier for practitioners registered with the HI Service.
 *    No direct international equivalent for either. Carry as local identifiers with Australian system URIs.
 *    For FHIR Practitioner: use Practitioner.identifier with system "http://ns.electronichealth.net.au/id/hi/hpii/1.0".
 *
 * 5. Patient Identification
 *    IHI (Individual Healthcare Identifier) is the national patient identifier.
 *    Verified against the HI Service (operated by Services Australia).
 *    Must only be used in systems connected to the HI Service or My Health Record.
 *    Medicare Card Number is a secondary identifier used for Medicare rebate claims.
 *
 * 6. Facility Identification
 *    HPI-O is the eHealth identifier for healthcare organisations.
 *    ABN can be used for billing/invoicing contexts.
 *    AIHW Establishment Number is used in national reporting datasets.
 *    For FHIR Organization: carry HPI-O as Organization.identifier.
 *
 * 7. Indigenous Status
 *    AIHW indigenous status codes (1–4, 9) have no direct HL7 international equivalent.
 *    For international exchange, these can be represented using SNOMED CT concepts
 *    from the ADHA SNOMED CT AU Extension for Indigenous status.
 *
 * 8. PBS and MBS Codes
 *    PBS item codes are specific to the Australian subsidy scheme and have no international equivalent.
 *    MBS item codes identify Medicare-rebatable services and have no direct international mapping.
 *    Both are used in claims/billing contexts and should be carried as local codes.
 */
