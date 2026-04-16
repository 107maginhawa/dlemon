/**
 * Australian Healthcare Identifiers
 *
 * Identifier types and validation patterns specific to Australian healthcare.
 * These are carried in the identifiers[] array on Patient, Practitioner, and Organization resources.
 *
 * Regulatory basis: Healthcare Identifiers Act 2010 (Cth), Healthcare Identifiers Regulations 2010,
 * My Health Records Act 2012 (Cth), Privacy Act 1988 (Cth), Australian Privacy Principles (APPs).
 *
 * The Healthcare Identifiers Service (HI Service) is operated by Services Australia.
 */

namespace Localization.AU;

@doc("Australian healthcare identifier system URIs. Set Identifier.system to the appropriate URI and Identifier.value to the identifier value.")
enum AUIdentifierSystem {
  @doc("IHI — Individual Healthcare Identifier. 16-digit numeric identifier assigned to all individuals enrolled in Medicare or the HI Service. Maintained by Services Australia. The IHI is the national patient identifier for My Health Record and eHealth system interoperability. Format: 8003 60xx xxxx xxxx (prefix 8003 60 + 10 digits + Luhn check). Sensitive information under the Healthcare Identifiers Act 2010.")
  ihi: "http://ns.electronichealth.net.au/id/hi/ihi/1.0",

  @doc("HPI-I — Healthcare Provider Identifier – Individual. 16-digit numeric identifier assigned to individual healthcare providers registered with the HI Service. Used in My Health Record documents and secure messaging. Format: 8003 61xx xxxx xxxx (prefix 8003 61 + 10 digits + Luhn check).")
  hpii: "http://ns.electronichealth.net.au/id/hi/hpii/1.0",

  @doc("HPI-O — Healthcare Provider Identifier – Organisation. 16-digit numeric identifier assigned to healthcare organisations registered with the HI Service. Used in My Health Record and inter-organisation secure messaging. Format: 8003 62xx xxxx xxxx (prefix 8003 62 + 10 digits + Luhn check).")
  hpio: "http://ns.electronichealth.net.au/id/hi/hpio/1.0",

  @doc("Medicare Card Number. Assigned to Medicare card holders. Format: 10-digit base number + 1-digit individual reference number on the card. The card also carries an expiry date. Validated using Luhn-derived check digit on positions 1–9.")
  medicareCardNumber: "http://ns.electronichealth.net.au/id/medicare-number",

  @doc("DVA File Number — Department of Veterans' Affairs file number. Issued to eligible veterans and their dependants. Provides access to DVA-funded health care. Format: state letter prefix + alphanumeric number (e.g., NVIC123456).")
  dvaFileNumber: "http://ns.electronichealth.net.au/id/dva",

  @doc("AHPRA Registration Number — Australian Health Practitioner Regulation Agency registration number. Issued to all regulated health practitioners in Australia under the Health Practitioner Regulation National Law. Format: profession prefix + 10-digit number (e.g., MED0001234567 for medical practitioners).")
  ahpraNumber: "http://ns.electronichealth.net.au/id/ahpra-registration-number",

  @doc("My Health Record — CDA Document Identifier. Used to identify clinical documents uploaded to the My Health Record system. System URI is ADHA-defined.")
  myHealthRecordDocId: "http://ns.electronichealth.net.au/id/pcehr/precid/1.0",

  @doc("CSP Number — Contracted Service Provider number. Assigned by ADHA to organisations contracted to provide services to the My Health Record system.")
  cspNumber: "http://ns.electronichealth.net.au/id/csp/1.0",

  @doc("ABN — Australian Business Number. 11-digit identifier issued by the Australian Business Register (ABR) to all registered business entities. Used for GST, invoicing, and supplier identification in healthcare billing contexts.")
  abn: "http://ns.electronichealth.net.au/id/abn",
}

/**
 * Validation Patterns for Australian Identifiers
 *
 * IHI:            ^800360\d{10}$  (16 digits, prefix 800360)
 *   Luhn check digit applied to the 16-digit number.
 *
 * HPI-I:          ^800361\d{10}$  (16 digits, prefix 800361)
 *   Luhn check digit applied to the 16-digit number.
 *
 * HPI-O:          ^800362\d{10}$  (16 digits, prefix 800362)
 *   Luhn check digit applied to the 16-digit number.
 *
 * Medicare Card Number:  ^\d{10}$
 *   10-digit number on card. The individual reference number (IRN, 1 digit) is appended
 *   on forms but is separate from the card number. Check digit on positions 1–9 using
 *   weights 1,3,7,9,1,3,7,9 (sum mod 10 = 0 for valid numbers).
 *
 * DVA File Number:  ^[NVQSWT][A-Z0-9]{1,9}$
 *   Starts with state/territory code letter (N=NSW, V=VIC, Q=QLD, S=SA/NT, W=WA, T=TAS).
 *
 * AHPRA Number:   ^[A-Z]{3}\d{10}$
 *   Three-letter profession prefix (e.g., MED, NUR, PHO, DEN, OPT, PSY, PHY, PHA, CHI, OST, POD, OCC, OPT, PRE, PTH, RAD)
 *   followed by 10-digit numeric.
 *
 * ABN:            ^\d{11}$
 *   Modulus 89 check digit algorithm.
 */
