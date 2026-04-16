/**
 * Indian Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to Indian healthcare under the
 * Ayushman Bharat Digital Mission (ABDM).
 * These are carried in the identifiers[] array on Patient, Practitioner, and Organization resources.
 *
 * Regulatory basis: Healthcare Identifiers (ABDM Health Data Management Policy),
 * DPDP Act 2023 (Digital Personal Data Protection Act),
 * Aadhaar Act 2016 and Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits
 * and Services) Act, 2016 (restricts Aadhaar use — see notes below),
 * NMC Act 2020, PMJAY Scheme Guidelines.
 */

namespace Localization.IN;

@doc("Indian healthcare identifier system URIs. Set Identifier.system to the appropriate URI and Identifier.value to the identifier value.")
enum INIdentifierSystem {
  @doc("ABHA Number — Ayushman Bharat Health Account number (formerly Health ID). 14-digit unique identifier issued by the National Health Authority (NHA) under ABDM. Format: XX-XXXX-XXXX-XXXX (14 digits, dash-separated). The ABHA Number is the primary patient identifier in the ABDM ecosystem. Voluntary in principle; effectively required for ABDM-connected services. Must NOT be linked to Aadhaar in application logic (linkage is the patient's choice and is managed by NHA).")
  abhaNumber: "https://healthid.ndhm.gov.in",

  @doc("ABHA Address — Ayushman Bharat Health Account address (Health ID username). Format: username@abdm (e.g., firstname.lastname@abdm). Self-selected by the patient during ABHA registration. Used as a human-readable identifier for sharing health records via the Health Information Exchange. The @abdm suffix indicates the ABDM-issued address space.")
  abhaAddress: "https://healthid.ndhm.gov.in/abha-address",

  @doc("Aadhaar — 12-digit unique identification number issued by the Unique Identification Authority of India (UIDAI). RESTRICTED — Aadhaar must NEVER be stored in full in health information systems. Use of Aadhaar for health identification purposes is restricted under the Aadhaar Act 2016 and the Supreme Court judgment in K.S. Puttaswamy v. Union of India (2018). Aadhaar may be used as an optional verification mechanism for ABHA creation but must not be retained after verification.")
  aadhaar: "https://uidai.gov.in",

  @doc("HFIR ID — Health Facility Registry Identifier. Unique identifier assigned to health facilities registered in the Health Facility Registry (HFR), a component of ABDM. Maintained by the NHA. Replaces the legacy facility code systems in ABDM-connected systems.")
  hfirId: "https://facility.abdm.gov.in",

  @doc("NMC Registration Number — National Medical Commission registration number. Issued to registered allopathic medical practitioners under the National Medical Commission Act 2020. Replaced MCI (Medical Council of India) registration. Format: state code + registration number (varies by State Medical Council).")
  nmcRegistration: "https://www.nmc.org.in/registration",

  @doc("State Medical Council Registration — Registration number issued by individual State Medical Councils recognised by the NMC. Format varies by state council. Use alongside NMC registration for full provider identification.")
  stateMedicalCouncil: "https://abdm.gov.in/hpr/practitioner",

  @doc("HPR ID — Healthcare Professionals Registry identifier. Unique identifier assigned to healthcare professionals registered in the Healthcare Professionals Registry (HPR), a component of ABDM. Covers all regulated and non-allopathic practitioners (AYUSH, nursing, pharmacy, etc.).")
  hprId: "https://hpr.abdm.gov.in",

  @doc("PMJAY Beneficiary ID — Pradhan Mantri Jan Arogya Yojana (Ayushman Bharat) beneficiary identification number. Assigned to PM-JAY scheme beneficiaries by the National Health Authority. Used for PM-JAY insurance claim processing.")
  pmjayBeneficiaryId: "https://pmjay.gov.in/beneficiary",

  @doc("CGHS Beneficiary ID — Central Government Health Scheme beneficiary ID. Issued to central government employees and their dependants. Used for CGHS-funded healthcare claims.")
  cghsBeneficiaryId: "https://cghs.gov.in/beneficiary",
}

/**
 * Validation Patterns for Indian Identifiers
 *
 * ABHA Number:    ^\d{2}-\d{4}-\d{4}-\d{4}$  (14 digits in XX-XXXX-XXXX-XXXX format)
 *   Note: The 14-digit number has a Verhoeff check digit as the last digit.
 *   Validation requires the Verhoeff algorithm (multiplication table + permutation table).
 *
 * ABHA Address:   ^[a-zA-Z][a-zA-Z0-9._]{1,61}@abdm$
 *   Username: 2–62 characters, alphanumeric with dots and underscores, starts with a letter.
 *   Domain suffix: always "@abdm"
 *
 * Aadhaar (RESTRICTED — NEVER STORE):
 *   Full: ^\d{12}$  Verhoeff check digit on all 12 digits.
 *   Masked: Do not store even masked Aadhaar in health records. Use ABHA Number instead.
 *
 * NMC Registration: Format varies by State Medical Council.
 *   Common format example (Delhi): ^\d{5}/\d{4}$ (registration_number/year)
 *   Tamil Nadu: Varies. Always include the issuing State Medical Council as context.
 *
 * HPR ID:         14-digit numeric, issued by ABDM HPR. Format: ^\d{14}$
 *
 * HFIR ID:        Alphanumeric, assigned by HFR. Format varies; typically a UUID or
 *                 structured alphanumeric code assigned by NHA.
 *
 * PMJAY Beneficiary ID: Alphanumeric, format varies by state. Typically 9–24 characters.
 */
