/**
 * UK Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to United Kingdom healthcare.
 * These are carried in the identifiers[] array on Patient, Practitioner, and Organization resources.
 *
 * Regulatory basis: NHS Act 2006, Health and Social Care Act 2012,
 * UK GDPR (UK General Data Protection Regulation), Data Protection Act 2018,
 * NHS England Data Security and Protection Toolkit (DSPT).
 */

namespace Localization.UK;

@doc("UK healthcare identifier system URIs. Set Identifier.system to the appropriate URI and Identifier.value to the identifier value.")
enum UKIdentifierSystem {
  @doc("NHS Number — 10-digit unique identifier assigned to all patients registered with the NHS in England, Wales, and the Isle of Man. Format: 3-3-4 digits (e.g., 943-476-5919). Validated using Modulus 11 check digit algorithm. The NHS Number is the national patient identifier and must be verified against the Personal Demographics Service (PDS) before use in clinical data exchange.")
  nhsNumber: "https://fhir.nhs.uk/Id/nhs-number",

  @doc("GMC Number — General Medical Council registration number. Issued to all licensed medical practitioners in the UK. 7-digit number. Required on all NHS medical appointments and prescriptions. Lookup available via GMC List of Registered Medical Practitioners.")
  gmcNumber: "https://fhir.hl7.org.uk/Id/gmc-number",

  @doc("NMC Number — Nursing and Midwifery Council registration number (PIN). Issued to registered nurses, midwives, and nursing associates in the UK. Format: 2 digits + 5 letters (e.g., 99A1234E). Renewal required every 3 years via revalidation.")
  nmcNumber: "https://fhir.hl7.org.uk/Id/nmc-number",

  @doc("GPhC Number — General Pharmaceutical Council registration number. Issued to registered pharmacists and pharmacy technicians in Great Britain. Format: 7-digit numeric. Northern Ireland pharmacists are registered with PSNI (Pharmaceutical Society of Northern Ireland).")
  gphcNumber: "https://fhir.hl7.org.uk/Id/gphc-number",

  @doc("ODS Code — Organisation Data Service code. Assigned by NHS England to all NHS and independent sector organisations in England. Used to identify practices, trusts, hospitals, CCGs, and other entities in NHS data flows. Lookup available via the ODS portal.")
  odsCode: "https://fhir.nhs.uk/Id/ods-organization-code",

  @doc("ODS Site Code — ODS site code for a specific site (building/address) within an organisation. Parent-child relationship with the ODS organisation code.")
  odsSiteCode: "https://fhir.nhs.uk/Id/ods-site-code",

  @doc("SDS User ID — Spine Directory Service user identifier. Unique identifier for NHS staff registered in the NHS Spine. Used in Spine-connected system authentication and audit logging. Associated with an NHS Smartcard.")
  sdsUserId: "https://fhir.nhs.uk/Id/sds-user-id",

  @doc("SDS Role Profile ID — Spine Directory Service role profile identifier. Represents a specific role context for a user at a specific organisation. A single SDS User ID may have multiple role profiles.")
  sdsRoleProfileId: "https://fhir.nhs.uk/Id/sds-role-profile-id",

  @doc("CHI Number — Community Health Index number. 10-digit patient identifier used in Scotland (NHS Scotland). Different system from the NHS Number. Managed by Public Health Scotland.")
  chiNumber: "https://fhir.nhs.uk/Id/chi-number",

  @doc("H&C Number — Health and Care Number. 10-digit patient identifier used in Northern Ireland (Health and Social Care Northern Ireland). Separate from NHS Number and CHI Number.")
  hcNumber: "https://fhir.nhs.uk/Id/hc-number",
}

/**
 * Validation Patterns for UK Identifiers
 *
 * NHS Number (England/Wales):  ^\d{10}$
 *   Modulus 11 check digit algorithm:
 *   1. Multiply each of the first 9 digits by the weights 10 through 2.
 *   2. Sum the products.
 *   3. Subtract from the next higher multiple of 11.
 *   4. If the remainder is 10, the NHS Number is invalid.
 *   5. If the remainder is 11, the check digit is 0.
 *   6. The check digit must equal the 10th digit.
 *
 * GMC Number:       ^\d{7}$
 *
 * NMC Number:       ^\d{2}[A-Z]\d{4}[A-Z]$  (e.g., 99A1234E)
 *
 * GPhC Number:      ^\d{7}$
 *
 * ODS Code:         ^[A-Z]\d{5}$  (trust/CCG format; GP practice format: [A-Z]\d{5})
 *   Note: ODS code formats vary by organisation type. GP practices use format like A81001.
 *   Trusts and CCGs use format like RJ1, 13T. Validate via ODS API.
 *
 * SDS User ID:      ^[0-9]{12}$  (12-digit numeric; format may vary by implementation)
 *
 * CHI Number:       ^\d{10}$
 *   Modulus 11 check algorithm (different weights from NHS Number).
 *
 * H&C Number:       ^\d{10}$
 */
