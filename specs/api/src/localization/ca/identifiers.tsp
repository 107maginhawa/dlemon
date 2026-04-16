/**
 * Canadian Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to Canadian healthcare.
 * These are carried in the identifiers[] array on Patient, Practitioner, and Organization resources.
 *
 * Regulatory basis: Canada Health Act (R.S.C. 1985), provincial health insurance legislation,
 * PIPEDA (Personal Information Protection and Electronic Documents Act, S.C. 2000, c. 5),
 * provincial health privacy laws, provincial medical licensing regulations.
 *
 * Note: Canada does not have a single national patient identifier. Each province and territory
 * issues its own health card number. Implementations must handle all provincial identifiers.
 */

namespace Localization.CA;

@doc("Canadian healthcare identifier system URIs. Set Identifier.system to the appropriate URI and Identifier.value to the identifier value.")
enum CAIdentifierSystem {
  @doc("ON — Ontario Health Card Number (OHIP). Format: 4 digits + 2 letters + 1 check digit (e.g., 1234-567-890-AB). Issued by the Ontario Ministry of Health under the Health Insurance Act.")
  ohipON: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-on-patient-hcn",

  @doc("BC — BC Services Card / Personal Health Number (PHN). 10-digit numeric identifier. Issued by the BC Ministry of Health. Format: ^\d{10}$. Luhn check digit.")
  bcPHN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-bc-patient-hcn",

  @doc("AB — Alberta Personal Health Number (PHN, AHCIP). 9-digit numeric identifier. Issued by Alberta Health Services under the Alberta Health Care Insurance Plan (AHCIP).")
  ahcipAB: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-ab-patient-hcn",

  @doc("QC — Quebec Health Insurance Number (RAMQ number). Format: 4 letters + 8 digits (e.g., LAST9901011234). Issued by the Régie de l'assurance maladie du Québec (RAMQ). First 4 chars: 3 letters of last name + 1 letter of first name. Digits: YYMMDD + 2 sequence digits.")
  ramqQC: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-qc-patient-hcn",

  @doc("MB — Manitoba Health Card Number. 9-digit numeric identifier. Issued by Manitoba Health.")
  mbHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-mb-patient-hcn",

  @doc("SK — Saskatchewan Health Card Number. 9-digit numeric identifier. Issued by Saskatchewan Health Authority.")
  skHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-sk-patient-hcn",

  @doc("NS — Nova Scotia Health Card Number. Format: varies. Issued by Nova Scotia Health Authority.")
  nsHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-ns-patient-hcn",

  @doc("NB — New Brunswick Medicare Card Number. 9-digit numeric identifier. Issued by the New Brunswick Department of Health.")
  nbHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-nb-patient-hcn",

  @doc("NL — Newfoundland and Labrador Medical Care Plan (MCP) number. Format: varies. Issued by Newfoundland and Labrador Health Services.")
  nlMCP: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-nl-patient-hcn",

  @doc("PE — Prince Edward Island Health Card Number. Format: varies. Issued by PEI Health PEI.")
  peHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-pe-patient-hcn",

  @doc("NT — Northwest Territories Health Care Card number.")
  ntHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-nt-patient-hcn",

  @doc("YT — Yukon Health Care Insurance Plan card number.")
  ytHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-yt-patient-hcn",

  @doc("NU — Nunavut Health Care Card number.")
  nuHCN: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-nu-patient-hcn",

  @doc("CPSO Number — College of Physicians and Surgeons of Ontario registration number. Used as the representative example of provincial medical college registration numbers. Each province has an equivalent college (CPSBC, CPSA, CMQ, etc.).")
  cpsoON: "https://www.cpso.on.ca",

  @doc("Provincial physician licence — Generic system URI root for provincial physician college registration numbers. Append province code to specialise (e.g., /bc for College of Physicians and Surgeons of BC, /ab for CPSA).")
  provincialPhysicianLicence: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-license-number",

  @doc("OOID — Organization OID. Canada Health Infoway-assigned organizational OID for health information systems and facilities. Used in HL7 v2 MSH segments and FHIR Organization resources.")
  facilityOOID: "https://fhir.infoway-inforoute.ca/NamingSystem/ca-hc-din",

  @doc("SIN — Social Insurance Number. RESTRICTED — 9-digit federal identifier used for tax and employment purposes. MUST NOT be used as a patient identifier in health systems. Do not collect or store for healthcare purposes.")
  sin: "urn:oid:2.16.840.1.113883.4.513",
}

/**
 * Validation Patterns for Canadian Identifiers
 *
 * ON OHIP:    ^\d{4}-?\d{3}-?\d{3}-?[A-Z]{2}$  (e.g., 1234-567-890-AB)
 *             Ontario uses a version code (2 letters) appended to the numeric portion.
 *
 * BC PHN:     ^\d{10}$  Luhn check digit on the 10-digit number.
 *
 * AB PHN:     ^\d{9}$
 *
 * QC RAMQ:    ^[A-Z]{4}\d{8}$  (e.g., SMIT84011212 for Smith born 1984-01-12, card 12)
 *             First 3 chars: first 3 letters of last name (padded with X if shorter).
 *             4th char: first letter of first name.
 *             Digits 1–2: birth year (YY). Digits 3–4: birth month (MM; +50 for females).
 *             Digits 5–6: birth day. Digits 7–8: sequence number.
 *
 * SIN (RESTRICTED — do not store):
 *             ^\d{9}$  Luhn check digit.
 *
 * Provincial physician licence: Format varies by college. Each college defines its own format.
 *   CPSO (ON):  ^\d{5,6}$
 *   CPSBC (BC): ^\d{5}$
 *   CPSA (AB):  ^\d{5}$
 */
