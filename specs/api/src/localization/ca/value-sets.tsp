/**
 * Canadian Healthcare Value Sets
 *
 * Canadian-specific value set extensions for health information system implementations.
 * These supplement core value sets with CIHI and pan-Canadian standard coded values.
 *
 * Sources: CIHI Discharge Abstract Database (DAD) data dictionary,
 * Canada Health Infoway pan-Canadian standards, Statistics Canada.
 */

namespace Localization.CA;

@doc("Canadian province and territory codes per Statistics Canada geographic codes and ISO 3166-2:CA.")
enum CAProvinceTerritory {
  @doc("AB — Alberta")
  alberta: "AB",

  @doc("BC — British Columbia")
  britishColumbia: "BC",

  @doc("MB — Manitoba")
  manitoba: "MB",

  @doc("NB — New Brunswick")
  newBrunswick: "NB",

  @doc("NL — Newfoundland and Labrador")
  newfoundlandLabrador: "NL",

  @doc("NS — Nova Scotia")
  novaScotia: "NS",

  @doc("NT — Northwest Territories")
  northwestTerritories: "NT",

  @doc("NU — Nunavut")
  nunavut: "NU",

  @doc("ON — Ontario")
  ontario: "ON",

  @doc("PE — Prince Edward Island")
  pei: "PE",

  @doc("QC — Quebec")
  quebec: "QC",

  @doc("SK — Saskatchewan")
  saskatchewan: "SK",

  @doc("YT — Yukon")
  yukon: "YT",
}

@doc("CIHI discharge disposition codes for the Discharge Abstract Database (DAD). Identifies where the patient went following discharge from an acute care hospital episode.")
enum CADischargeDisposition {
  @doc("1 — Discharged home with no planned readmission.")
  dischargedHome: "1",

  @doc("2 — Transferred to another acute care facility.")
  transferAcute: "2",

  @doc("3 — Transferred to a residential care facility (e.g., long-term care, nursing home).")
  transferResidentialCare: "3",

  @doc("4 — Transferred to a continuing care facility.")
  transferContinuingCare: "4",

  @doc("5 — Transferred to a mental health facility.")
  transferMentalHealth: "5",

  @doc("6 — Discharged to a corrections facility.")
  corrections: "6",

  @doc("7 — Died in hospital.")
  died: "7",

  @doc("8 — Left against medical advice (LAMA).")
  leftAMA: "8",

  @doc("9 — Stillbirth.")
  stillbirth: "9",

  @doc("10 — Sign-out (elective leave, temporary discharge).")
  signOut: "10",

  @doc("12 — Transferred to a rehabilitation facility.")
  transferRehab: "12",

  @doc("99 — Other disposition.")
  other: "99",
}

@doc("CIHI admission category codes for the Discharge Abstract Database. Identifies the administrative category under which the patient was admitted.")
enum CAAdmissionCategory {
  @doc("1 — Elective — patient chose the time of admission.")
  elective: "1",

  @doc("2 — Urgent — required admission within 24 hours.")
  urgent: "2",

  @doc("3 — Emergency — immediate unplanned admission.")
  emergency: "3",

  @doc("9 — Not applicable / newborn.")
  notApplicable: "9",
}

@doc("CIHI service delivery types for the National Ambulatory Care Reporting System (NACRS) and DAD. Identifies the type of care delivered during the encounter.")
enum CAServiceDeliveryType {
  @doc("1 — Emergency medicine services.")
  emergency: "1",

  @doc("2 — Surgical day care.")
  surgicalDayCare: "2",

  @doc("3 — Medical day care.")
  medicalDayCare: "3",

  @doc("4 — Oncology day care.")
  oncologyDayCare: "4",

  @doc("5 — Renal dialysis.")
  renalDialysis: "5",

  @doc("6 — Pulmonary function / cardiorespiratory.")
  pulmonaryFunction: "6",

  @doc("7 — Diagnostic imaging.")
  diagnosticImaging: "7",

  @doc("8 — Laboratory.")
  laboratory: "8",

  @doc("9 — Community health / primary care clinic.")
  communityHealth: "9",

  @doc("10 — Mental health outpatient clinic.")
  mentalHealthOutpatient: "10",

  @doc("99 — Other ambulatory care service.")
  other: "99",
}

@doc("Canadian official language of service codes. Canada has two official languages (English and French) with service obligations under the Official Languages Act (R.S.C. 1985, c. 31).")
enum CAOfficialLanguage {
  @doc("EN — English")
  english: "EN",

  @doc("FR — French")
  french: "FR",

  @doc("BI — Bilingual (English and French)")
  bilingual: "BI",
}
