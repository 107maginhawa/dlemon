/**
 * US Healthcare Value Sets
 *
 * US-specific value set extensions for American healthcare implementations.
 * These supplement core value sets with federally mandated and US-standard coded values.
 *
 * Sources: NUBC, OMB, US Core FHIR IG, CMS, DEA, ONC USCDI.
 */

namespace Localization.US;

@doc("NUBC discharge disposition codes for US facility billing (UB-04 form). Used in EncounterHospitalization.dischargeDisposition. Maintained by the National Uniform Billing Committee.")
enum USDischargeDisposition {
  @doc("01 — Discharged to home or self care (routine discharge).")
  home: "01",

  @doc("02 — Discharged/transferred to a short-term general hospital for inpatient care.")
  transferShortTermHospital: "02",

  @doc("03 — Discharged/transferred to a skilled nursing facility (SNF) with Medicare certification.")
  transferSNF: "03",

  @doc("04 — Discharged/transferred to an intermediate care facility (ICF).")
  transferICF: "04",

  @doc("05 — Discharged/transferred to a designated cancer center or children's hospital.")
  transferDesignatedFacility: "05",

  @doc("06 — Discharged/transferred to home under care of organized home health service organization.")
  homeHealthOrg: "06",

  @doc("07 — Left against medical advice (AMA) or discontinued care.")
  leftAMA: "07",

  @doc("09 — Admitted as an inpatient to this hospital.")
  admittedInpatient: "09",

  @doc("20 — Expired (or did not recover — Religious Non-Medical Health Care Patient).")
  expired: "20",

  @doc("21 — Discharged/transferred to court/law enforcement.")
  lawEnforcement: "21",

  @doc("30 — Still patient (expected to return for outpatient services).")
  stillPatient: "30",

  @doc("40 — Expired at home (hospice).")
  expiredAtHomeHospice: "40",

  @doc("41 — Expired in a medical facility such as hospital, SNF, ICF, or freestanding hospice.")
  expiredMedicalFacility: "41",

  @doc("42 — Expired — place unknown.")
  expiredUnknown: "42",

  @doc("43 — Discharged/transferred to a federal health care facility.")
  federalHealthCareFacility: "43",

  @doc("50 — Discharged to hospice — home.")
  hospiceHome: "50",

  @doc("51 — Discharged to hospice — medical facility.")
  hospiceMedicalFacility: "51",

  @doc("61 — Discharged/transferred within this institution to a hospital-based Medicare-approved swing bed.")
  swingBed: "61",

  @doc("62 — Discharged/transferred to an inpatient rehabilitation facility (IRF) including rehabilitation distinct part units of a hospital.")
  inpatientRehab: "62",

  @doc("63 — Discharged/transferred to a Medicare-certified long-term care hospital (LTCH).")
  longTermCareHospital: "63",

  @doc("64 — Discharged/transferred to a nursing facility certified under Medicaid but not certified under Medicare.")
  medicaidNursingFacility: "64",

  @doc("65 — Discharged/transferred to a psychiatric hospital or psychiatric distinct part unit of a hospital.")
  psychiatricFacility: "65",

  @doc("66 — Discharged/transferred to a critical access hospital (CAH).")
  criticalAccessHospital: "66",

  @doc("69 — Discharged/transferred to a designated disaster alternative care site.")
  disasterAlternativeSite: "69",

  @doc("70 — Discharged/transferred to another type of health care institution not defined elsewhere.")
  otherInstitution: "70",
}

@doc("OMB race categories as required for US federal reporting under the OMB Revisions to the Standards for the Classification of Federal Data on Race and Ethnicity (1997). Required for USCDI v3 compliance.")
enum USRaceCategory {
  @doc("American Indian or Alaska Native")
  americanIndianAlaskaNative: "1002-5",

  @doc("Asian")
  asian: "2028-9",

  @doc("Black or African American")
  blackAfricanAmerican: "2054-5",

  @doc("Native Hawaiian or Other Pacific Islander")
  nativeHawaiianPacificIslander: "2076-8",

  @doc("White")
  white: "2106-3",

  @doc("Other Race")
  otherRace: "2131-1",

  @doc("Unknown")
  unknown: "UNK",

  @doc("Asked but no answer / declined to specify")
  askedDeclined: "ASKU",
}

@doc("OMB ethnicity categories for US federal reporting. Required alongside race for USCDI v3 compliance.")
enum USEthnicityCategory {
  @doc("Hispanic or Latino")
  hispanicOrLatino: "2135-2",

  @doc("Not Hispanic or Latino")
  notHispanicOrLatino: "2186-5",

  @doc("Unknown")
  unknown: "UNK",

  @doc("Asked but no answer / declined to specify")
  askedDeclined: "ASKU",
}

@doc("US Core birth sex codes. Used for administrative sex recorded at birth per US Core FHIR IG. Distinct from gender identity.")
enum USCoreBirthSex {
  @doc("Male")
  male: "M",

  @doc("Female")
  female: "F",

  @doc("Unknown")
  unknown: "UNK",
}

@doc("US Core Gender Identity codes per US Core FHIR IG v6.1. Based on the Gender Harmony Project logical model. Distinct from birth sex.")
enum USGenderIdentity {
  @doc("Female gender identity")
  female: "female",

  @doc("Male gender identity")
  male: "male",

  @doc("Non-binary gender identity")
  nonBinary: "non-binary",

  @doc("Transgender male / Female-to-Male (FTM)")
  transgenderMale: "transgender-male",

  @doc("Transgender female / Male-to-Female (MTF)")
  transgenderFemale: "transgender-female",

  @doc("Genderqueer, neither exclusively male nor female")
  genderqueer: "genderqueer",

  @doc("Other gender identity not listed")
  other: "other",

  @doc("Chooses not to disclose")
  nonDisclose: "non-disclose",
}

@doc("DEA controlled substance schedules I through V. Used to classify medications for prescribing restrictions. Defined under 21 USC 812 and 21 CFR Part 1308.")
enum USControlledSubstanceSchedule {
  @doc("Schedule I — High abuse potential, no accepted medical use (e.g., heroin, LSD, marijuana at federal level). Cannot be prescribed.")
  scheduleI: "I",

  @doc("Schedule II — High abuse potential, severe dependence risk, accepted medical use with severe restrictions (e.g., oxycodone, fentanyl, Adderall, methadone). Requires paper or electronic DEA-compliant prescription; no refills.")
  scheduleII: "II",

  @doc("Schedule III — Moderate to low physical dependence potential (e.g., buprenorphine, ketamine, testosterone). Up to 5 refills in 6 months.")
  scheduleIII: "III",

  @doc("Schedule IV — Low abuse potential relative to Schedule III (e.g., benzodiazepines, tramadol, zolpidem). Up to 5 refills in 6 months.")
  scheduleIV: "IV",

  @doc("Schedule V — Lowest abuse potential (e.g., cough preparations with <200mg codeine per 100mL). May be dispensed without a prescription in some states subject to state law.")
  scheduleV: "V",
}

@doc("US preferred language codes for patient communication. Drawn from BCP-47 language tags and the US Core IG preferred language value set.")
enum USPreferredLanguage {
  @doc("English")
  english: "en",

  @doc("Spanish")
  spanish: "es",

  @doc("Chinese (Cantonese / Traditional)")
  chineseTraditional: "zh-TW",

  @doc("Chinese (Mandarin / Simplified)")
  chineseSimplified: "zh-CN",

  @doc("French")
  french: "fr",

  @doc("Vietnamese")
  vietnamese: "vi",

  @doc("Tagalog")
  tagalog: "tl",

  @doc("Arabic")
  arabic: "ar",

  @doc("Korean")
  korean: "ko",

  @doc("Russian")
  russian: "ru",

  @doc("Portuguese")
  portuguese: "pt",

  @doc("Haitian Creole")
  haitianCreole: "ht",

  @doc("Polish")
  polish: "pl",

  @doc("Japanese")
  japanese: "ja",

  @doc("Italian")
  italian: "it",

  @doc("German")
  german: "de",

  @doc("Unknown / not stated")
  unknown: "und",
}
