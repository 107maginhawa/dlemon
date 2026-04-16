/**
 * Philippine Healthcare Code Systems
 *
 * Local code systems used in Philippine healthcare facilities.
 * These extend the core international code systems and are used
 * alongside WHO ICD-10, SNOMED CT, and LOINC in Philippine implementations.
 *
 * Regulatory basis: PhilHealth Circular No. 27 S. 2003, DOH AO 2012-0012
 */

namespace Localization.PH;

@doc("Philippine healthcare code system URIs for use in Coding.system fields.")
enum PHCodingSystem {
  @doc("Philippine National Drug Formulary. Maintained by DOH. Used for essential medicine lists and drug procurement.")
  pndf: "https://doh.gov.ph/pndf",

  @doc("PhilHealth Relative Value Scale. Used for procedure valuation and reimbursement calculation.")
  rvs: "https://philhealth.gov.ph/rvs",

  @doc("PhilHealth Case Type Classification. Determines documentation requirements and reimbursement rates. Values: A, B, C, D.")
  philhealthCaseType: "https://philhealth.gov.ph/case-type",

  @doc("PhilHealth Claim Defect Codes. Used to identify incomplete or incorrect claim submissions.")
  philhealthDefectCode: "https://philhealth.gov.ph/defect-code",

  @doc("DOH National Health Facility Registry codes. Unique facility identifiers for all registered Philippine health facilities.")
  nhfr: "https://nhfr.doh.gov.ph/facility-code",
}
