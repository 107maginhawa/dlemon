/**
 * Australian Healthcare Value Sets
 *
 * Australian-specific value set extensions for health information system implementations.
 * These supplement core value sets with AIHW and METeOR standard coded values.
 *
 * Sources: AIHW METeOR (Metadata Online Registry), AIHW IHI, SNOMED CT AU Edition (ADHA).
 */

namespace Localization.AU;

@doc("Indigenous status codes per AIHW standard (METeOR identifier 602543). Collected for all patients and used in national health reporting. Required by ACSQHC NSQHS Standards for Aboriginal and Torres Strait Islander health equity reporting.")
enum AUIndigenousStatus {
  @doc("1 — Aboriginal but not Torres Strait Islander origin. Person identifies as being of Aboriginal descent.")
  aboriginal: "1",

  @doc("2 — Torres Strait Islander but not Aboriginal origin. Person identifies as being of Torres Strait Islander descent.")
  torresStraitIslander: "2",

  @doc("3 — Both Aboriginal and Torres Strait Islander origin. Person identifies as being of both Aboriginal and Torres Strait Islander descent.")
  both: "3",

  @doc("4 — Neither Aboriginal nor Torres Strait Islander origin.")
  neither: "4",

  @doc("9 — Not stated / inadequately described. Should not be confused with 'neither'; use 9 only when the question was not answered or could not be determined.")
  notStated: "9",
}

@doc("Source of referral to hospital codes per AIHW Admitted Patient Care (APC) data collection. Identifies who referred the patient or the basis on which the patient sought care.")
enum AUSourceOfReferral {
  @doc("1 — Self / family / friend. Patient presented without a formal referral.")
  selfFamily: "1",

  @doc("2 — Specialist / consultant.")
  specialist: "2",

  @doc("3 — General practitioner (GP).")
  generalPractitioner: "3",

  @doc("4 — Emergency department at another hospital.")
  externalEmergencyDept: "4",

  @doc("5 — Admitted patient at another hospital (inter-hospital transfer).")
  interHospitalTransfer: "5",

  @doc("6 — Admitted patient at this hospital (same hospital transfer between units/wards).")
  sameHospitalTransfer: "6",

  @doc("7 — Residential aged care facility.")
  agedCare: "7",

  @doc("8 — Other community health services.")
  communityHealth: "8",

  @doc("9 — Other welfare agency.")
  welfareAgency: "9",

  @doc("10 — Court / corrections / custodial.")
  custodial: "10",

  @doc("99 — Not elsewhere classified.")
  other: "99",
}

@doc("Mode of separation (discharge type) codes per AIHW Admitted Patient Care data collection. Identifies the basis on which the episode ended and where the patient went.")
enum AUModeOfSeparation {
  @doc("1 — Discharge to an admitted patient episode in the same hospital.")
  dischargedSameHospital: "1",

  @doc("2 — Discharge to home / usual accommodation.")
  dischargedHome: "2",

  @doc("3 — Transfer to another hospital / residential care facility.")
  transfer: "3",

  @doc("4 — Left against medical advice or discharged at own risk.")
  leftAMA: "4",

  @doc("5 — Statistical discharge.")
  statisticalDischarge: "5",

  @doc("6 — Death.")
  death: "6",

  @doc("7 — Discharge to a non-admitted patient care type (e.g., outpatient or ED) in the same hospital.")
  dischargedNonAdmitted: "7",

  @doc("8 — Discharge to residential aged care facility.")
  dischargedAgedCare: "8",

  @doc("9 — Not applicable — still in hospital.")
  stillInHospital: "9",

  @doc("99 — Other.")
  other: "99",
}

@doc("Australian state and territory codes per ISO 3166-2:AU and AIHW usage.")
enum AUStateTerritoryCode {
  @doc("NSW — New South Wales")
  nsw: "NSW",

  @doc("VIC — Victoria")
  vic: "VIC",

  @doc("QLD — Queensland")
  qld: "QLD",

  @doc("SA — South Australia")
  sa: "SA",

  @doc("WA — Western Australia")
  wa: "WA",

  @doc("TAS — Tasmania")
  tas: "TAS",

  @doc("ACT — Australian Capital Territory")
  act: "ACT",

  @doc("NT — Northern Territory")
  nt: "NT",

  @doc("OT — Other territories (Christmas Island, Cocos (Keeling) Islands, etc.)")
  ot: "OT",
}

@doc("Establishment type codes for Australian health establishments per AIHW. Identifies the category of institution providing care.")
enum AUEstablishmentType {
  @doc("1 — Public acute hospital (including public psychiatric hospitals).")
  publicAcute: "1",

  @doc("2 — Public psychiatric hospital.")
  publicPsychiatric: "2",

  @doc("3 — Private acute hospital.")
  privateAcute: "3",

  @doc("4 — Private psychiatric hospital.")
  privatePsychiatric: "4",

  @doc("5 — Day hospital facility (free-standing).")
  dayHospital: "5",

  @doc("6 — Hospice (free-standing).")
  hospice: "6",
}
