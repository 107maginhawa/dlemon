/**
 * Australian Healthcare Code Systems
 *
 * Code system URIs specific to Australian healthcare.
 * These supplement the core international code systems and are used
 * alongside ICD-10, SNOMED CT, and LOINC in Australian health information systems.
 *
 * Regulatory basis: Australian Institute of Health and Welfare (AIHW) national data standards,
 * Australian Digital Health Agency (ADHA) specifications, ACSQHC NSQHS Standards,
 * TGA (Therapeutic Goods Administration) drug regulation.
 */

namespace Localization.AU;

@doc("Australian healthcare code system URIs for use in Coding.system fields.")
enum AUCodingSystem {
  @doc("ICD-10-AM — International Statistical Classification of Diseases and Related Health Problems, 10th Revision, Australian Modification. Maintained by AIHW under agreement with WHO. Required for all admitted patient episodes in Australian hospitals. Currently 12th edition.")
  icd10am: "https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ICD-10-AM",

  @doc("ACHI — Australian Classification of Health Interventions. Companion classification to ICD-10-AM for procedure coding in admitted patient care. Published together with ICD-10-AM and ACS in the same edition cycle.")
  achi: "https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ACHI",

  @doc("ACS — Australian Coding Standards. National standards and guidelines for applying ICD-10-AM and ACHI codes, maintained by AIHW. Not a code system itself but provides the authoritative coding rules.")
  acs: "https://www.aihw.gov.au/reports-data/myhospitals/content/data-sources/ACS",

  @doc("PBS — Pharmaceutical Benefits Scheme item codes. Maintained by the Australian Government Department of Health and Aged Care. Identifies subsidised medicines listed on the PBS. Required for PBS prescription claims submitted to Services Australia.")
  pbs: "http://pbs.gov.au/code/item",

  @doc("MBS — Medicare Benefits Schedule item codes. Maintained by the Australian Government Department of Health and Aged Care. Identifies Medicare-rebatable professional attendances, investigations, and procedures.")
  mbs: "http://www.health.gov.au/medicare-benefits-schedule",

  @doc("AMT — Australian Medicines Terminology. Maintained by the Australian Digital Health Agency (ADHA). The national standard for representing medicines in Australian digital health systems. AMT is SNOMED CT-based and aligns with the international SNOMED CT drug model. Replaces legacy product codes in eHealth systems.")
  amt: "http://snomed.info/sct",

  @doc("NCTIS — National Clinical Terminology and Information Service. ADHA-maintained extensions and reference sets for the Australian SNOMED CT release.")
  nctis: "http://health.gov.au/id/nctis",

  @doc("Australian Immunisation Register (AIR) vaccine codes. Maintained by Services Australia. Used in AIR reporting of administered vaccines. Supplements CVX codes for Australian-specific vaccines and schedules.")
  airVaccineCodes: "https://www.servicesaustralia.gov.au/organisations/health-professionals/services/medicare/australian-immunisation-register-health-professionals",

  @doc("ANZSCO — Australian and New Zealand Standard Classification of Occupations. Used for healthcare provider occupation classification in national datasets.")
  anzsco: "https://www.abs.gov.au/AUSSTATS/abs@.nsf/DetailsPage/1220.02013,%20Version%201.3",
}
