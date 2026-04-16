/**
 * Canadian Healthcare Code Systems
 *
 * Code system URIs specific to Canadian healthcare.
 * These supplement the core international code systems and are used
 * alongside ICD-10, SNOMED CT, and LOINC in Canadian health information systems.
 *
 * Regulatory basis: Canada Health Act (R.S.C. 1985), Canadian Institute for Health Information (CIHI)
 * national data standards, Canada Health Infoway pan-Canadian standards,
 * Health Canada drug regulation (Food and Drugs Act).
 */

namespace Localization.CA;

@doc("Canadian healthcare code system URIs for use in Coding.system fields.")
enum CACodingSystem {
  @doc("ICD-10-CA — Canadian enhancement of ICD-10 for morbidity coding in Canadian hospitals. Maintained by CIHI in partnership with WHO. Used for all acute care inpatient diagnoses submitted to CIHI's Discharge Abstract Database (DAD). Currently aligned with WHO ICD-10 with Canadian-specific extensions.")
  icd10ca: "https://www.cihi.ca/en/canadian-classification-health-interventions",

  @doc("CCI — Canadian Classification of Health Interventions. Canadian standard for classifying health interventions performed in acute care, day surgery, and ambulatory care settings. Maintained by CIHI. Published together with ICD-10-CA.")
  cci: "https://www.cihi.ca/en/canadian-classification-health-interventions",

  @doc("DIN — Drug Identification Number. Assigned by Health Canada to all marketed drug products in Canada under the Food and Drugs Act. 8-digit numeric identifier on all drug product labels. Required for drug identification in Canadian pharmacy dispensing systems.")
  din: "https://health-products.canada.ca/api/drug/",

  @doc("NPN — Natural Product Number. Assigned by Health Canada to licensed natural health products (NHPs) including vitamins, minerals, herbal remedies, and homeopathic medicines under the Natural Health Products Regulations.")
  npn: "https://health-products.canada.ca/lnhpd-bdpsnh/",

  @doc("CCDD — Canadian Clinical Drug Dataset. Maintained by Canada Health Infoway and CIHI. A national drug terminology dataset aligned with SNOMED CT drug concepts for use in clinical information systems. Covers prescription and over-the-counter drug products marketed in Canada.")
  ccdd: "https://www.infoway-inforoute.ca/en/solutions/digital-health-foundation/standards/ccdd",

  @doc("SNOMED CT CA Edition — The Canadian National Release Centre (NRC) publishes a Canadian Edition of SNOMED CT including a national extension module. Maintained by Canada Health Infoway.")
  snomedCtCA: "http://snomed.info/sct",

  @doc("pCLOCD — pan-Canadian LOINC Observation Code Database. Canada Health Infoway curated subset of LOINC codes for Canadian laboratory observation reporting. Maintained by Infoway.")
  pclocd: "http://loinc.org",

  @doc("HCPCS Canada — HCPCS-compatible codes adapted for Canadian fee schedule submissions. Province-specific fee schedules each maintain their own code systems but are broadly aligned to CPT/HCPCS structure.")
  hcpcsCA: "https://www.cihi.ca/en/national-grouping-system-for-complex-continuing-care",
}
