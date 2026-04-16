/**
 * US Healthcare Code Systems
 *
 * Code system URIs specific to United States healthcare.
 * These supplement the core international code systems (ICD-10, SNOMED CT, LOINC)
 * and are required for US payer billing, federal reporting, and regulatory compliance.
 *
 * Regulatory basis: CMS billing requirements, HIPAA transaction standards (45 CFR Part 162),
 * 21st Century Cures Act (Pub. L. 114-255), ONC Health IT Certification Program.
 */

namespace Localization.US;

@doc("US healthcare code system URIs for use in Coding.system fields.")
enum USCodingSystem {
  @doc("ICD-10-CM — US Clinical Modification for diagnosis coding. Maintained by CMS/NCHS. Required for all US payer claims under HIPAA 5010 transactions.")
  icd10cm: "http://hl7.org/fhir/sid/icd-10-cm",

  @doc("ICD-10-PCS — US Procedure Coding System for inpatient hospital procedures. Maintained by CMS. Required for inpatient claims under HIPAA 5010.")
  icd10pcs: "http://www.cms.gov/Medicare/Coding/ICD10",

  @doc("CPT — Current Procedural Terminology. Maintained by AMA. Required for physician and outpatient procedure billing across all US payers.")
  cpt: "http://www.ama-assn.org/go/cpt",

  @doc("HCPCS Level II — Healthcare Common Procedure Coding System. Maintained by CMS. Covers durable medical equipment, supplies, and services not in CPT.")
  hcpcs: "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",

  @doc("NDC — National Drug Code. 11-digit FDA drug identifier. Required for drug claims and medication administration reporting.")
  ndc: "http://hl7.org/fhir/sid/ndc",

  @doc("NPI — National Provider Identifier. 10-digit CMS provider ID. Mandatory on all HIPAA standard transactions under 45 CFR 162.410.")
  npi: "http://hl7.org/fhir/sid/us-npi",

  @doc("NUBC — National Uniform Billing Committee discharge status codes. Used on UB-04 claim forms for inpatient and outpatient facility billing.")
  nubc: "https://www.nubc.org/CodeSystem/PatDischargeStatus",

  @doc("CMS Place of Service codes. Required on CMS-1500 claim forms to identify the setting where services were rendered.")
  placeOfService: "https://www.cms.gov/Medicare/Coding/place-of-service-codes",

  @doc("CVX — CDC vaccine administered codes. Required for immunization reporting to state immunization information systems (IIS) and CMS quality programs.")
  cvx: "http://hl7.org/fhir/sid/cvx",

  @doc("MVX — CDC vaccine manufacturer codes. Used alongside CVX to identify the manufacturer of an administered vaccine.")
  mvx: "http://hl7.org/fhir/sid/mvx",

  @doc("DRG — MS-DRG (Medicare Severity Diagnosis Related Group). Maintained by CMS. Basis for inpatient prospective payment system (IPPS) reimbursement.")
  drg: "https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/AcuteInpatientPPS/MS-DRG-Classifications-and-Software",

  @doc("Revenue Codes — NUBC Revenue Codes for UB-04 facility billing. Identifies the service department and charge category.")
  revenueCodes: "https://www.nubc.org/CodeSystem/RevenueCodes",

  @doc("DEA Schedule — US Drug Enforcement Administration controlled substance schedules I–V.")
  deaSchedule: "https://www.deadiversion.usdoj.gov/schedules",
}
