/**
 * Philippine Healthcare Value Sets
 *
 * Local value set extensions for Philippine healthcare implementations.
 * These supplement core value sets with Philippine-specific coded values.
 */

namespace Localization.PH;

@doc("Philippine discharge disposition codes. Used in EncounterHospitalization.dischargeDisposition alongside core NUBC codes.")
enum PHDischargeDisposition {
  @doc("Patient cleared for discharge and sent home")
  mayGoHome: "may-go-home",

  @doc("Discharge Against Medical Advice. Patient leaves despite recommendation to stay. Requires signed DAMA consent form per DOH guidelines.")
  dama: "dama",

  @doc("Patient also known as HAMA (Home Against Medical Advice). Equivalent to DAMA.")
  hama: "hama",

  @doc("Patient expired during hospitalization")
  expired: "expired",

  @doc("Patient transferred to another facility for higher level of care")
  transferred: "transferred",

  @doc("Patient left without notifying staff (absconded)")
  absconded: "absconded",

  @doc("Patient referred to outpatient services for continued care")
  referredOutpatient: "referred-outpatient",
}

@doc("PhilHealth Case Type classification. Determines documentation requirements and reimbursement rates per PhilHealth Circular No. 18 S. 2009.")
enum PHCaseType {
  @doc("Case Type A — Simple cases. Minimal documentation required.")
  typeA: "A",

  @doc("Case Type B — Moderate cases. Standard documentation.")
  typeB: "B",

  @doc("Case Type C — Complex cases. Enhanced documentation required.")
  typeC: "C",

  @doc("Case Type D — Highly complex cases. Full clinical abstract/discharge summary REQUIRED for claims processing.")
  typeD: "D",
}

@doc("Philippine hospital ward/service types based on DOH AO 2012-0012 classification.")
enum PHWardType {
  @doc("Emergency Department/Ward")
  emergency: "emergency",

  @doc("Intensive Care Unit")
  icu: "icu",

  @doc("Intensive Coronary Care Unit")
  iccu: "iccu",

  @doc("General Medical Ward")
  medicalWard: "medical-ward",

  @doc("General Surgical Ward")
  surgicalWard: "surgical-ward",

  @doc("Pediatric Ward")
  pediatricWard: "pediatric-ward",

  @doc("Obstetric/Maternity Ward")
  obstetricWard: "obstetric-ward",

  @doc("Nursery / Neonatal Intensive Care")
  nursery: "nursery",

  @doc("Burns Ward")
  burnsWard: "burns-ward",

  @doc("Post-operative Ward")
  postOperative: "post-operative",

  @doc("Postnatal Ward")
  postnatal: "postnatal",

  @doc("Psychiatric Ward")
  psychiatric: "psychiatric",

  @doc("Isolation Ward")
  isolation: "isolation",

  @doc("Private Room")
  privateRoom: "private-room",

  @doc("Semi-Private Room")
  semiPrivate: "semi-private",

  @doc("Charity/Service Ward")
  charityWard: "charity-ward",
}

@doc("Philippine hospital classification levels per DOH AO 2012-0012.")
enum PHHospitalLevel {
  @doc("Level 1 — Primary care facility. Basic emergency and outpatient services.")
  level1: "L1",

  @doc("Level 2 — Secondary care facility. Departmentalized hospital with clinical laboratory, imaging, and pharmacy.")
  level2: "L2",

  @doc("Level 3 — Tertiary care facility. Teaching/training hospital with specialized departments and residency programs.")
  level3: "L3",
}
