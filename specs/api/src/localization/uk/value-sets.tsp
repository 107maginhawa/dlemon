/**
 * UK Healthcare Value Sets
 *
 * UK-specific value set extensions for NHS and independent sector healthcare implementations.
 * These supplement core value sets with NHS Data Dictionary coded values.
 *
 * Sources: NHS Data Dictionary, SNOMED CT UK Edition, NHS England.
 */

namespace Localization.UK;

@doc("NHS ethnic category codes per NHS Data Dictionary. Required for NHS Commissioning Data Set (CDS) submissions and equality monitoring under the Equality Act 2010.")
enum UKEthnicCategory {
  @doc("A — White British")
  whiteBritish: "A",

  @doc("B — White Irish")
  whiteIrish: "B",

  @doc("C — Any other White background")
  whiteOther: "C",

  @doc("D — White and Black Caribbean")
  mixedWhiteBlackCaribbean: "D",

  @doc("E — White and Black African")
  mixedWhiteBlackAfrican: "E",

  @doc("F — White and Asian")
  mixedWhiteAsian: "F",

  @doc("G — Any other mixed background")
  mixedOther: "G",

  @doc("H — Asian or Asian British — Indian")
  asianIndian: "H",

  @doc("J — Asian or Asian British — Pakistani")
  asianPakistani: "J",

  @doc("K — Asian or Asian British — Bangladeshi")
  asianBangladeshi: "K",

  @doc("L — Any other Asian background")
  asianOther: "L",

  @doc("M — Black or Black British — Caribbean")
  blackCaribbean: "M",

  @doc("N — Black or Black British — African")
  blackAfrican: "N",

  @doc("P — Any other Black background")
  blackOther: "P",

  @doc("R — Chinese")
  chinese: "R",

  @doc("S — Any other ethnic group")
  otherEthnicGroup: "S",

  @doc("Z — Not stated")
  notStated: "Z",

  @doc("99 — Not known")
  notKnown: "99",
}

@doc("NHS discharge destination codes per NHS Data Dictionary. Used in Commissioning Data Sets (CDS) for admitted patient care. Identifies where the patient went after hospital discharge.")
enum UKDischargeDestination {
  @doc("19 — Usual place of residence unless listed below, for example, a private dwelling whether owner occupied or owned by Local Authority, housing association or other landlord.")
  usualResidence: "19",

  @doc("29 — Temporary place of residence when usually resident elsewhere (includes hotel, residential educational establishment).")
  temporaryResidence: "29",

  @doc("30 — Repatriation from high security psychiatric accommodation in an NHS Hospital Provider (NHS Trust or NHS Foundation Trust).")
  highSecurityPsychRepatriation: "30",

  @doc("37 — Court/Police/Prison (not in NHS accommodation).")
  courtPolicePrison: "37",

  @doc("38 — Penal establishment or police station not in an NHS Hospital.")
  penalEstablishment: "38",

  @doc("48 — High security psychiatric accommodation in an NHS Hospital Provider (NHS Trust or NHS Foundation Trust).")
  highSecurityPsych: "48",

  @doc("49 — NHS other Hospital Provider — high security psychiatric accommodation.")
  nhsOtherHighSecurity: "49",

  @doc("50 — NHS other Hospital Provider — medium secure unit.")
  nhsMediumSecure: "50",

  @doc("51 — NHS other Hospital Provider — Ward for general patients or the younger physically disabled or A and E department.")
  nhsGeneralWard: "51",

  @doc("52 — NHS other Hospital Provider — Ward for maternity patients or Neonates.")
  nhsMaternityWard: "52",

  @doc("53 — NHS other Hospital Provider — Ward for patients who are mentally ill or have Learning Disabilities.")
  nhsMentalHealthWard: "53",

  @doc("54 — NHS run Care Home.")
  nhsCareHome: "54",

  @doc("65 — Local Authority residential accommodation i.e. where care is provided.")
  localAuthorityResidential: "65",

  @doc("66 — Local Authority foster care.")
  localAuthorityFosterCare: "66",

  @doc("79 — Not applicable — patient died or stillbirth.")
  died: "79",

  @doc("84 — Non-NHS run hospital — medium secure unit.")
  nonNhsMediumSecure: "84",

  @doc("85 — Non-NHS (other than Local Authority) run Care Home.")
  nonNhsCareHome: "85",

  @doc("87 — Non-NHS run hospital.")
  nonNhsHospital: "87",

  @doc("88 — Non-NHS (other than Local Authority) run Hospice.")
  nonNhsHospice: "88",

  @doc("98 — Not applicable — information not available.")
  notAvailable: "98",
}

@doc("NHS admission method codes per NHS Data Dictionary. Identifies how the patient came to be admitted to hospital. Required on CDS submissions.")
enum UKAdmissionMethod {
  @doc("11 — Waiting list — Elective admission from waiting list.")
  waitingList: "11",

  @doc("12 — Booked — Elective admission, booked.")
  booked: "12",

  @doc("13 — Planned — Elective admission, planned.")
  planned: "13",

  @doc("21 — Accident and Emergency or dental casualty department.")
  ae: "21",

  @doc("22 — GP: after a request for immediate admission has been made direct to a Hospital Provider.")
  gpDirectAdmission: "22",

  @doc("23 — Bed bureau.")
  bedBureau: "23",

  @doc("24 — Consultant clinic.")
  consultantClinic: "24",

  @doc("25 — Admission via Mental Health Crisis Resolution Team.")
  crisisResolution: "25",

  @doc("28 — Other means.")
  otherEmergency: "28",

  @doc("31 — Admitted ante-partum.")
  antePartum: "31",

  @doc("32 — Admitted post-partum.")
  postPartum: "32",

  @doc("81 — Transfer of any admitted patient from other Hospital Provider.")
  transfer: "81",

  @doc("82 — The birth of a baby in this Health Care Provider.")
  birth: "82",

  @doc("83 — Baby born outside the Health Care Provider.")
  bornOutside: "83",

  @doc("98 — Not applicable.")
  notApplicable: "98",

  @doc("99 — Not known.")
  notKnown: "99",
}

@doc("NHS main specialty codes per NHS Data Dictionary. Identifies the clinical specialty responsible for the patient's care during an episode.")
enum UKSpecialtyCode {
  @doc("100 — General Surgery")
  generalSurgery: "100",

  @doc("101 — Urology")
  urology: "101",

  @doc("110 — Trauma and Orthopaedics")
  traumaOrthopaedics: "110",

  @doc("120 — Ear, Nose and Throat")
  ent: "120",

  @doc("130 — Ophthalmology")
  ophthalmology: "130",

  @doc("140 — Oral Surgery")
  oralSurgery: "140",

  @doc("150 — Neurosurgery")
  neurosurgery: "150",

  @doc("160 — Plastic Surgery")
  plasticSurgery: "160",

  @doc("170 — Cardiothoracic Surgery")
  cardiothoracicSurgery: "170",

  @doc("191 — Paediatric Surgery")
  paediatricSurgery: "191",

  @doc("300 — General Medicine")
  generalMedicine: "300",

  @doc("301 — Gastroenterology")
  gastroenterology: "301",

  @doc("302 — Endocrinology")
  endocrinology: "302",

  @doc("303 — Clinical Haematology")
  clinicalHaematology: "303",

  @doc("320 — Cardiology")
  cardiology: "320",

  @doc("330 — Dermatology")
  dermatology: "330",

  @doc("340 — Respiratory Medicine")
  respiratoryMedicine: "340",

  @doc("350 — Infectious Diseases")
  infectiousDiseases: "350",

  @doc("360 — Genitourinary Medicine")
  genitourinaryMedicine: "360",

  @doc("370 — Medical Oncology")
  medicalOncology: "370",

  @doc("400 — Neurology")
  neurology: "400",

  @doc("410 — Rheumatology")
  rheumatology: "410",

  @doc("420 — Paediatrics")
  paediatrics: "420",

  @doc("430 — Geriatric Medicine")
  geriatricMedicine: "430",

  @doc("501 — Obstetrics")
  obstetrics: "501",

  @doc("502 — Gynaecology")
  gynaecology: "502",

  @doc("560 — Midwifery")
  midwifery: "560",

  @doc("700 — Learning Disability")
  learningDisability: "700",

  @doc("710 — Adult Mental Illness")
  adultMentalIllness: "710",

  @doc("711 — Child and Adolescent Psychiatry")
  camhs: "711",

  @doc("713 — Old Age Psychiatry")
  oldAgePsychiatry: "713",

  @doc("800 — Clinical Oncology (previously Radiotherapy)")
  clinicalOncology: "800",

  @doc("812 — Haematology")
  haematology: "812",

  @doc("822 — Chemical Pathology")
  chemicalPathology: "822",

  @doc("834 — Medical Microbiology and Virology")
  microbiologyVirology: "834",

  @doc("900 — Emergency Medicine")
  emergencyMedicine: "900",

  @doc("901 — Accident and Emergency")
  ae: "901",

  @doc("950 — Anaesthetics")
  anaesthetics: "950",

  @doc("960 — Intensive Care Medicine")
  intensiveCare: "960",
}
