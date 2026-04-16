/**
 * US Healthcare Compliance Notes
 *
 * HIPAA and US regulatory compliance flags for sensitive health information categories.
 * These flags are used to apply heightened access controls, consent enforcement,
 * and audit requirements mandated by federal and state law.
 *
 * Regulatory basis:
 *   - HIPAA Privacy Rule (45 CFR Part 164)
 *   - HIPAA Security Rule (45 CFR Parts 160 and 164)
 *   - 42 CFR Part 2 (Confidentiality of Substance Use Disorder Patient Records)
 *   - 45 CFR Part 164.514(e) — Limited Data Set and minimum necessary standard
 *   - State mental health parity and privacy laws (vary by state)
 *   - State HIV/AIDS confidentiality laws (vary by state)
 *   - State reproductive health privacy laws (vary by state)
 */

namespace Localization.US;

@doc("HIPAA and US regulatory sensitivity flags for clinical data categories. These flags indicate that a record or document falls under a heightened legal protection category requiring additional consent, access restriction, or audit controls beyond standard HIPAA safeguards.")
enum USHIPAASensitivityFlag {
  @doc("42 CFR Part 2 — Substance use disorder (SUD) records. Federal law (42 CFR Part 2) prohibits disclosure of SUD records without explicit written patient consent except in narrow emergency exceptions. Stricter than standard HIPAA. Applies to records from federally assisted SUD programs. Must not be included in general-purpose record requests or CCD exports without explicit consent.")
  isSubstanceAbuse42CFRPart2: "SUD",

  @doc("HIV/AIDS status. Subject to heightened state confidentiality laws in most US states (e.g., NY Public Health Law Article 27-F). Many states require specific written informed consent prior to testing and disclosure. Disclosure without consent may carry criminal penalties under state law.")
  isHIV: "HIV",

  @doc("Mental health records. Subject to heightened privacy protections in most US states (e.g., California Welfare & Institutions Code 5328, NY Mental Hygiene Law Article 33). May restrict disclosure to employers, law enforcement, and family members beyond standard HIPAA rules.")
  isMentalHealth: "MH",

  @doc("Reproductive health information including abortion, contraception, fertility treatment, and pregnancy. Subject to rapidly evolving state law protections post-Dobbs v. Jackson Women's Health Organization (2022). Some states explicitly prohibit disclosure of reproductive health information to out-of-state entities or law enforcement. Apply strict data residency and access controls.")
  isReproductive: "REP",

  @doc("Genetic information. Protected under GINA (Genetic Information Nondiscrimination Act, Pub. L. 110-233) and enhanced state law protections. Prohibits use in insurance underwriting decisions. HIPAA Privacy Rule explicitly prohibits use of genetic information for health plan underwriting.")
  isGenetic: "GEN",

  @doc("Psychotherapy notes. Separately defined under HIPAA (45 CFR 164.501) as notes recorded in any medium by a mental health professional in a one-on-one counseling session. Subject to more restrictive authorization requirements than other mental health records. May NOT be included in a general treatment authorization.")
  isPsychotherapyNotes: "PSY",
}

@doc("State consent law indicators. Flags denoting that a record is subject to a particular state's health privacy law that provides greater patient rights than the federal HIPAA floor. Implementations operating in multi-state environments must evaluate the most restrictive applicable law.")
enum USStateConsentIndicator {
  @doc("California CMIA — Confidentiality of Medical Information Act (California Civil Code 56 et seq.). California's medical privacy law provides stronger protections than HIPAA in several areas, including mental health, substance abuse, and HIV records. California also has CMIA-specific breach notification requirements separate from HIPAA.")
  californiaCMIA: "CA-CMIA",

  @doc("Texas Health & Safety Code Chapter 181 — Texas Medical Records Privacy Act. Stricter than HIPAA in some respects, including patient rights to access electronic PHI.")
  texasMRPA: "TX-MRPA",

  @doc("New York Mental Hygiene Law — applies to mental health and substance abuse records held by facilities licensed by the New York State Office of Mental Health.")
  newYorkMHL: "NY-MHL",

  @doc("Washington My Health MY Data Act (MHMD Act, effective 2024). Broad state consumer health data privacy law applying to entities not covered by HIPAA. Covers a wide range of health-related data beyond traditional PHI.")
  washingtonMHMD: "WA-MHMD",

  @doc("Illinois Genetic Information Privacy Act (GIPA). Regulates collection, retention, and disclosure of genetic information by employers and insurers in Illinois.")
  illinoisGIPA: "IL-GIPA",
}

@doc("HIPAA minimum necessary designation. Indicates the data classification level required under the HIPAA minimum necessary standard (45 CFR 164.502(b)). Covered entities must make reasonable efforts to limit PHI access, use, and disclosure to the minimum necessary to accomplish the intended purpose.")
enum USMinimumNecessaryDesignation {
  @doc("Full PHI — access to the complete patient record is clinically or operationally necessary for this use case. Appropriate for treating providers directly involved in the patient's current episode of care.")
  fullPHI: "FULL",

  @doc("Limited Data Set — PHI with direct identifiers removed per 45 CFR 164.514(e). May be used for research, public health, and healthcare operations under a Data Use Agreement (DUA). Retains dates, geographic data at city/state/ZIP level, and certain other indirect identifiers.")
  limitedDataSet: "LDS",

  @doc("De-identified data — PHI fully de-identified under either the Safe Harbor method (18 identifiers removed, 45 CFR 164.514(b)) or Expert Determination method (45 CFR 164.514(b)(1)). No longer considered PHI once de-identified; may be used and disclosed without HIPAA authorization.")
  deidentified: "DEID",

  @doc("Summary statistics — aggregate data with no individual-level records. Appropriate for quality reporting, population health analytics, and public-facing dashboards.")
  summaryStatistics: "SUMM",

  @doc("Restricted — applies to especially sensitive categories (42 CFR Part 2, psychotherapy notes, HIV, reproductive health). Access requires explicit patient authorization beyond standard TPO (Treatment, Payment, Operations) authorization.")
  restricted: "RESTR",
}
