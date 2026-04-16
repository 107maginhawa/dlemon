/**
 * Indian Healthcare Value Sets
 *
 * India-specific value set extensions for ABDM-connected health information system implementations.
 * These supplement core value sets with NHA, Ministry of Health, and ABDM standard coded values.
 *
 * Sources: ABDM Health Data Management Policy, Ministry of AYUSH, NHA PM-JAY HBP codes,
 * Ministry of Statistics and Programme Implementation (state/UT codes).
 */

namespace Localization.IN;

@doc("Indian state and Union Territory codes. Based on ISO 3166-2:IN codes and used in ABDM Health Facility Registry (HFR) and Healthcare Professionals Registry (HPR) to indicate the state of registration or practice.")
enum INStateTerritoryCode {
  @doc("AN — Andaman and Nicobar Islands (UT)")
  andamanNicobar: "AN",

  @doc("AP — Andhra Pradesh")
  andhrapradesh: "AP",

  @doc("AR — Arunachal Pradesh")
  arunachalpradesh: "AR",

  @doc("AS — Assam")
  assam: "AS",

  @doc("BR — Bihar")
  bihar: "BR",

  @doc("CH — Chandigarh (UT)")
  chandigarh: "CH",

  @doc("CT — Chhattisgarh")
  chhattisgarh: "CT",

  @doc("DH — Dadra and Nagar Haveli and Daman and Diu (UT)")
  dadraAndNagarHaveli: "DH",

  @doc("DL — Delhi (UT / NCT)")
  delhi: "DL",

  @doc("GA — Goa")
  goa: "GA",

  @doc("GJ — Gujarat")
  gujarat: "GJ",

  @doc("HP — Himachal Pradesh")
  himachalpradesh: "HP",

  @doc("HR — Haryana")
  haryana: "HR",

  @doc("JH — Jharkhand")
  jharkhand: "JH",

  @doc("JK — Jammu and Kashmir (UT)")
  jammuKashmir: "JK",

  @doc("KA — Karnataka")
  karnataka: "KA",

  @doc("KL — Kerala")
  kerala: "KL",

  @doc("LA — Ladakh (UT)")
  ladakh: "LA",

  @doc("LD — Lakshadweep (UT)")
  lakshadweep: "LD",

  @doc("MH — Maharashtra")
  maharashtra: "MH",

  @doc("ML — Meghalaya")
  meghalaya: "ML",

  @doc("MN — Manipur")
  manipur: "MN",

  @doc("MP — Madhya Pradesh")
  madhyapradesh: "MP",

  @doc("MZ — Mizoram")
  mizoram: "MZ",

  @doc("NL — Nagaland")
  nagaland: "NL",

  @doc("OR — Odisha")
  odisha: "OR",

  @doc("PB — Punjab")
  punjab: "PB",

  @doc("PY — Puducherry (UT)")
  puducherry: "PY",

  @doc("RJ — Rajasthan")
  rajasthan: "RJ",

  @doc("SK — Sikkim")
  sikkim: "SK",

  @doc("TG — Telangana")
  telangana: "TG",

  @doc("TN — Tamil Nadu")
  tamilnadu: "TN",

  @doc("TR — Tripura")
  tripura: "TR",

  @doc("UP — Uttar Pradesh")
  uttarpradesh: "UP",

  @doc("UT — Uttarakhand")
  uttarakhand: "UT",

  @doc("WB — West Bengal")
  westbengal: "WB",
}

@doc("Hospital type codes used in the ABDM Health Facility Registry (HFR) to classify the ownership and management type of health facilities.")
enum INHospitalType {
  @doc("GOVT — Government — facility owned and operated by central or state government.")
  government: "GOVT",

  @doc("PRIV — Private — for-profit private facility.")
  private: "PRIV",

  @doc("TRUST — Trust / Non-Governmental Organisation (NGO) — non-profit or charitable facility.")
  trust: "TRUST",

  @doc("PSU — Public Sector Undertaking — facility operated by a government-owned enterprise.")
  psu: "PSU",

  @doc("CGHS — Central Government Health Scheme facility.")
  cghs: "CGHS",

  @doc("ESI — Employees' State Insurance Corporation facility.")
  esi: "ESI",

  @doc("RAILWAY — Railways / defence / paramilitary facility.")
  railway: "RAILWAY",

  @doc("AYUSH — AYUSH facility (Ayurveda, Yoga, Unani, Siddha, or Homeopathy practice).")
  ayush: "AYUSH",

  @doc("MIXED — Mixed facility offering both allopathic and AYUSH services.")
  mixed: "MIXED",
}

@doc("AYUSH treatment system types. Recognised traditional and complementary medical systems under the Ministry of AYUSH, Government of India.")
enum INAYUSHSystem {
  @doc("AY — Ayurveda. India's oldest system of traditional medicine based on the Charaka Samhita and Sushruta Samhita.")
  ayurveda: "AY",

  @doc("YO — Yoga and Naturopathy. Integrative systems promoting health through postures, breathing, and natural therapies.")
  yogaNaturopathy: "YO",

  @doc("UN — Unani. Greco-Arabic system of medicine practiced in South Asia, based on the humoral theory of Galen.")
  unani: "UN",

  @doc("SI — Siddha. One of the oldest medical systems originating in Tamil Nadu, using minerals, metals, and herbal preparations.")
  siddha: "SI",

  @doc("HO — Homeopathy. System of medicine based on the principle of like cures like, using highly diluted preparations.")
  homeopathy: "HO",

  @doc("SO — Sowa Rigpa. Traditional Tibetan system of medicine, recognised as the 6th AYUSH system in 2020. Practiced in Ladakh, Himachal Pradesh, and Sikkim.")
  sowaRigpa: "SO",
}

@doc("PM-JAY (Pradhan Mantri Jan Arogya Yojana) HBP (Health Benefit Package) category codes. PM-JAY provides health cover of INR 5 lakh per family per year for secondary and tertiary care hospitalisation. Package codes are assigned by the National Health Authority.")
enum INPMJAYPackageCategory {
  @doc("MED — Medical management (non-surgical) packages.")
  medical: "MED",

  @doc("SRG — Surgical packages.")
  surgical: "SRG",

  @doc("ONC — Oncology packages (radiation, chemotherapy, surgical oncology).")
  oncology: "ONC",

  @doc("CAR — Cardiology and cardiothoracic surgery packages.")
  cardiology: "CAR",

  @doc("NEU — Neurology and neurosurgery packages.")
  neurology: "NEU",

  @doc("ORT — Orthopaedics and trauma packages.")
  orthopaedics: "ORT",

  @doc("OPH — Ophthalmology packages.")
  ophthalmology: "OPH",

  @doc("OBS — Obstetrics and gynaecology packages.")
  obstetrics: "OBS",

  @doc("PED — Paediatric packages.")
  paediatrics: "PED",

  @doc("BUR — Burns management packages.")
  burns: "BUR",

  @doc("URO — Urology packages.")
  urology: "URO",

  @doc("PSY — Mental health packages.")
  mentalHealth: "PSY",

  @doc("DEN — Dental packages.")
  dental: "DEN",

  @doc("ICU — Intensive care and polytrauma packages.")
  icu: "ICU",

  @doc("AYU — AYUSH packages under PM-JAY.")
  ayush: "AYU",
}
