import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../../common/models.tsp";
import "../../../../common/errors.tsp";
import "../../../../common/pagination.tsp";
import "../../../../common/security.tsp";
import "../../../core/primitives.tsp";
import "../../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Cardiology specialty module.
 *
 * Covers cardiac catheterisation laboratory records, echocardiography reports,
 * electrophysiology study records, and cardiac rehabilitation tracking.
 * Aligns with FHIR Procedure, DiagnosticReport, Observation, and CarePlan
 * resources. Supports ACC/AHA data standards for quality reporting.
 */
namespace Healthcare.Clinical.Hospital.Specialty.Cardiology;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of cardiac catheterisation procedure performed.")
enum CathType {
  @doc("Diagnostic catheterisation — coronary angiography without intervention")
  diagnostic,
  @doc("Interventional catheterisation — PCI, stent placement, valvuloplasty, etc.")
  interventional,
  @doc("Electrophysiology study — mapping and ablation of cardiac arrhythmias")
  electrophysiology,
}

@doc("Type of echocardiogram study performed.")
enum EchoType {
  @doc("Standard transthoracic echocardiogram (TTE) using external chest transducer")
  transthoracic,
  @doc("Transesophageal echocardiogram (TEE) using esophageal probe")
  transesophageal,
  @doc("Stress echocardiogram — images obtained at rest and peak exercise or pharmacological stress")
  stress,
  @doc("Contrast-enhanced echocardiogram using ultrasound contrast agent")
  contrast,
}

@doc("Phase of cardiac rehabilitation programme.")
enum CardiacRehabPhase {
  @doc("Phase I — inpatient rehabilitation beginning during hospitalisation")
  phaseI,
  @doc("Phase II — outpatient supervised exercise programme (typically 36 sessions over 12 weeks)")
  phaseII,
  @doc("Phase III — community-based maintenance programme")
  phaseIII,
  @doc("Phase IV — independent long-term maintenance")
  phaseIV,
}

@doc("Patient risk stratification level for cardiac rehabilitation.")
enum CardiacRehabRisk {
  @doc("Low risk — no significant ischaemia, good LV function, no complex arrhythmias")
  low,
  @doc("Moderate risk — mild-to-moderate LV dysfunction or mild ischaemia")
  moderate,
  @doc("High risk — severe LV dysfunction, significant ischaemia, or complex arrhythmias")
  high,
}

@doc("Enrolment status of a cardiac rehabilitation programme.")
enum CardiacRehabStatus {
  @doc("Patient has been enrolled but has not yet started attending sessions")
  enrolled,
  @doc("Patient is actively attending supervised sessions")
  active,
  @doc("Patient has completed the prescribed number of sessions")
  completed,
  @doc("Patient voluntarily withdrew from the programme")
  withdrawn,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A coronary or vascular finding documented during cardiac catheterisation.")
model CathFinding {
  @doc("The vessel examined (SNOMED CT coded, e.g., LAD, RCA, LCx)")
  vessel: CodeableConcept;

  @doc("Degree of stenosis as a percentage (0 = no obstruction, 100 = total occlusion)")
  @minValue(0)
  @maxValue(100)
  stenosisPercent?: int32;

  @doc("Narrative description of the finding")
  description: string;

  @doc("Clinical significance of the finding (e.g., 'Haemodynamically significant', 'Borderline')")
  significance?: string;
}

@doc("Haemodynamic measurements recorded during cardiac catheterisation.")
model HemodynamicData {
  @doc("Left ventricular end-diastolic pressure (LVEDP) in mmHg")
  lvedp?: int32;

  @doc("Cardiac output in litres per minute (thermodilution or Fick method)")
  cardiacOutput?: float64;

  @doc("Left ventricular ejection fraction as a percentage")
  @minValue(0)
  @maxValue(100)
  ejectionFraction?: float64;

  @doc("Pulmonary capillary wedge pressure (PCWP) in mmHg")
  pulmonaryWedgePressure?: int32;

  @doc("Right atrial pressure (RAP) in mmHg")
  rightAtrialPressure?: int32;
}

@doc("Record of a coronary or vascular stent deployed during interventional catheterisation.")
model StentRecord {
  @doc("The vessel in which the stent was placed")
  vessel: CodeableConcept;

  @doc("Stent type (e.g., drug-eluting stent, bare metal stent, bioresorbable)")
  stentType: string;

  @doc("Nominal stent diameter in mm")
  diameter: Quantity;

  @doc("Stent length in mm")
  length: Quantity;

  @doc("Stent manufacturer name")
  manufacturer: string;

  @doc("Manufacturing lot number for device traceability")
  lotNumber?: string;

  @doc("Maximum deployment pressure in atmospheres (atm)")
  deploymentPressure?: Quantity;
}

@doc("Echocardiographic finding for a cardiac valve.")
model ValvularFinding {
  @doc("Name of the valve assessed (mitral, aortic, tricuspid, pulmonic)")
  valve: string;

  @doc("Description of valvular stenosis severity (e.g., 'mild', 'moderate', 'severe', 'none')")
  stenosis?: string;

  @doc("Degree of valvular regurgitation")
  regurgitation?: "none" | "trace" | "mild" | "moderate" | "severe";

  @doc("Mean or peak gradient across the valve in mmHg")
  gradient?: float64;

  @doc("Valve orifice area in cm2 (planimetry or continuity equation)")
  area?: float64;

  @doc("Additional notes on valvular morphology or haemodynamics")
  notes?: string;
}

@doc("Baseline electrophysiological intervals measured during an EP study.")
model EPIntervals {
  @doc("PR interval in milliseconds")
  prInterval?: int32;

  @doc("QRS duration in milliseconds")
  qrsWidth?: int32;

  @doc("QTc interval in milliseconds")
  qtInterval?: int32;

  @doc("AH interval in milliseconds — conduction time from low atrium to His bundle")
  ahInterval?: int32;

  @doc("HV interval in milliseconds — conduction time from His bundle to ventricular myocardium")
  hvInterval?: int32;

  @doc("Sinus node recovery time (SNRT) in milliseconds")
  snrt?: int32;

  @doc("Corrected sinus node recovery time (cSNRT) in milliseconds")
  csnrt?: int32;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("Cardiac catheterisation laboratory record documenting procedure details, haemodynamic data, findings, and any interventions. Extends HealthcareBaseEntity.")
model CardiacCathRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient who underwent catheterisation")
  patient: Reference;

  @doc("Reference to the Encounter in which the procedure was performed")
  encounter: Reference;

  @doc("The procedure performed, coded using SNOMED CT or CPT")
  procedure: CodeableConcept;

  @doc("Type of catheterisation performed")
  cathType: CathType;

  @doc("Vascular access site (e.g., right radial, right femoral)")
  accessSite: CodeableConcept;

  @doc("Reference to the Practitioner (interventional cardiologist) who performed the procedure")
  operator: Reference;

  @doc("References to Practitioners who assisted with the procedure")
  assistants?: Reference[];

  @doc("Date and time the procedure started")
  startTime: utcDateTime;

  @doc("Date and time the procedure ended")
  endTime?: utcDateTime;

  @doc("Total volume of contrast agent used in mL")
  contrastUsed?: Quantity;

  @doc("Total fluoroscopy time in minutes")
  fluoroscopyTime?: Quantity;

  @doc("Coronary and vascular findings documented during the procedure")
  findings: CathFinding[];

  @doc("Procedural complications encountered (SNOMED CT coded)")
  complications?: CodeableConcept[];

  @doc("Intracardiac haemodynamic measurements obtained during catheterisation")
  hemodynamics?: HemodynamicData;

  @doc("Records of stents deployed during the procedure")
  stentsPlaced?: StentRecord[];

  @doc("Free-text procedural note")
  note?: string;
}

@doc("Echocardiography report documenting cardiac structure, function, and valvular assessment. Extends HealthcareBaseEntity.")
model EchocardiogramReport extends HealthcareBaseEntity {
  @doc("Reference to the Patient who underwent echocardiography")
  patient: Reference;

  @doc("Reference to the Encounter, if performed in an inpatient or outpatient setting")
  encounter?: Reference;

  @doc("Reference to the Practitioner (cardiologist or sonographer) who performed and/or interpreted the study")
  performer: Reference;

  @doc("Date and time the echocardiogram was performed")
  performedAt: utcDateTime;

  @doc("Type of echocardiogram performed")
  type: EchoType;

  @doc("Left ventricular ejection fraction (LVEF) as a percentage")
  @minValue(0)
  @maxValue(100)
  ejectionFraction?: float64;

  @doc("LV internal diastolic dimension (LVIDd) in cm")
  lvDiastolicDimension?: Quantity;

  @doc("LV internal systolic dimension (LVIDs) in cm")
  lvSystolicDimension?: Quantity;

  @doc("Segments with wall motion abnormalities (AHA 17-segment model notation)")
  wallMotionAbnormalities?: string[];

  @doc("Valvular assessment for all four cardiac valves")
  valvularFindings: ValvularFinding[];

  @doc("Description of pericardial effusion (e.g., 'none', 'small', 'moderate with early tamponade physiology')")
  pericardialEffusion?: string;

  @doc("Right heart assessment including RV size, function, and estimated RVSP")
  rightHeartFindings?: string;

  @doc("Overall clinical conclusion and impression")
  conclusion: string;

  @doc("Reference to the associated ImagingStudy resource containing DICOM data")
  imagingStudy?: Reference;
}

@doc("Electrophysiology study record documenting intracardiac mapping, arrhythmia induction, and ablation outcomes. Extends HealthcareBaseEntity.")
model EPStudyRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient who underwent the EP study")
  patient: Reference;

  @doc("Reference to the Encounter in which the study was performed")
  encounter: Reference;

  @doc("The procedure performed (e.g., EP study, catheter ablation, device implantation)")
  procedure: CodeableConcept;

  @doc("Reference to the Practitioner (electrophysiologist) who performed the study")
  operator: Reference;

  @doc("Date and time the EP study started")
  startTime: utcDateTime;

  @doc("Date and time the EP study ended")
  endTime?: utcDateTime;

  @doc("Vascular access sites used for catheter delivery")
  accessSites?: CodeableConcept[];

  @doc("Baseline electrophysiological intervals measured at the start of the study")
  baselineIntervals?: EPIntervals;

  @doc("Arrhythmias induced during programmed stimulation")
  inducedArrhythmias?: string[];

  @doc("Whether catheter ablation was performed during this study")
  ablationPerformed?: boolean;

  @doc("Target of ablation (e.g., accessory pathway, slow pathway, PV antrum — SNOMED CT coded)")
  ablationTarget?: CodeableConcept;

  @doc("Energy source used for ablation")
  ablationEnergy?: "RF" | "cryo";

  @doc("Whether the ablation achieved its primary endpoint")
  ablationSuccessful?: boolean;

  @doc("Whether a cardiac device was implanted (ICD, pacemaker, CRT) during this procedure")
  deviceImplanted?: boolean;

  @doc("Type of cardiac device implanted, if any")
  deviceType?: string;

  @doc("Procedural complications (SNOMED CT coded)")
  complications?: CodeableConcept[];

  @doc("Free-text EP study note")
  note?: string;
}

@doc("Cardiac rehabilitation programme enrolment and progress record. Extends HealthcareBaseEntity.")
model CardiacRehab extends HealthcareBaseEntity {
  @doc("Reference to the Patient enrolled in the cardiac rehabilitation programme")
  patient: Reference;

  @doc("Reference to the ServiceRequest or referral that initiated this enrolment")
  referral?: Reference;

  @doc("Phase of cardiac rehabilitation")
  phase: CardiacRehabPhase;

  @doc("Date the patient was enrolled in the programme")
  startDate: plainDate;

  @doc("Date the patient completed or withdrew from the programme")
  endDate?: plainDate;

  @doc("Total number of sessions prescribed for this programme phase")
  sessions: int32;

  @doc("Number of sessions the patient has attended to date")
  completedSessions: int32;

  @doc("Baseline functional capacity measured at enrolment (METs)")
  baselineFunctionalCapacity?: Quantity;

  @doc("Most recently measured functional capacity (METs)")
  currentFunctionalCapacity?: Quantity;

  @doc("Patient risk stratification level — determines supervision requirements")
  riskStratification: CardiacRehabRisk;

  @doc("Current enrolment status")
  status: CardiacRehabStatus;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for cardiac catheterisation records.")
model CardiacCathSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by operator reference ID") @query operator?: string;
  @doc("Filter by cath type") @query cathType?: CathType;
  @doc("Filter procedures started at or after this date-time") @query startFrom?: utcDateTime;
  @doc("Filter procedures started at or before this date-time") @query startTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for echocardiogram reports.")
model EchoSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter by echo type") @query type?: EchoType;
  @doc("Filter studies performed at or after this date-time") @query performedFrom?: utcDateTime;
  @doc("Filter studies performed at or before this date-time") @query performedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for EP study records.")
model EPStudySearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by operator reference ID") @query operator?: string;
  @doc("Filter by whether ablation was performed") @query ablationPerformed?: boolean;
  @doc("Filter studies started at or after this date-time") @query startFrom?: utcDateTime;
  @doc("Filter studies started at or before this date-time") @query startTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for cardiac rehabilitation records.")
model CardiacRehabSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by rehabilitation phase") @query phase?: CardiacRehabPhase;
  @doc("Filter by enrolment status") @query status?: CardiacRehabStatus;
  @doc("Filter by risk stratification level") @query riskStratification?: CardiacRehabRisk;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Cardiac catheterisation record management — document, retrieve, update, and search cath lab procedure records.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/cardiology/cath-records")
interface CardiacCathManagement {
  @doc("Create a new cardiac catheterisation record.")
  @operationId("createCardiacCathRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCardiacCathRecord(
    @body body: CardiacCathRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: CardiacCathRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cardiac catheterisation record by its logical ID.")
  @operationId("getCardiacCathRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCardiacCathRecord(
    @path @doc("CardiacCathRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CardiacCathRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cardiac catheterisation record.")
  @operationId("updateCardiacCathRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCardiacCathRecord(
    @path @doc("CardiacCathRecord logical ID") id: UUID,
    @body body: CardiacCathRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: CardiacCathRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cardiac catheterisation record.")
  @operationId("deleteCardiacCathRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCardiacCathRecord(
    @path @doc("CardiacCathRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cardiac catheterisation records by patient, encounter, operator, or date range.")
  @operationId("searchCardiacCathRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCardiacCathRecords(
    ...CardiacCathSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CardiacCathRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Echocardiogram report management — create, retrieve, update, and search echo reports.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/cardiology/echo-reports")
interface EchoManagement {
  @doc("Create a new echocardiogram report.")
  @operationId("createEchoReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createEchoReport(
    @body body: EchocardiogramReport,
  ): {
    @statusCode statusCode: 201;
    @body result: EchocardiogramReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an echocardiogram report by its logical ID.")
  @operationId("getEchoReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getEchoReport(
    @path @doc("EchocardiogramReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: EchocardiogramReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an echocardiogram report.")
  @operationId("updateEchoReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateEchoReport(
    @path @doc("EchocardiogramReport logical ID") id: UUID,
    @body body: EchocardiogramReport,
  ): {
    @statusCode statusCode: 200;
    @body result: EchocardiogramReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an echocardiogram report.")
  @operationId("deleteEchoReport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteEchoReport(
    @path @doc("EchocardiogramReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search echocardiogram reports by patient, performer, echo type, or date range.")
  @operationId("searchEchoReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchEchoReports(
    ...EchoSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EchocardiogramReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("EP study record management — create, retrieve, update, and search electrophysiology study records.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/cardiology/ep-studies")
interface EPStudyManagement {
  @doc("Create a new EP study record.")
  @operationId("createEPStudy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createEPStudy(
    @body body: EPStudyRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: EPStudyRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an EP study record by its logical ID.")
  @operationId("getEPStudy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getEPStudy(
    @path @doc("EPStudyRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: EPStudyRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an EP study record.")
  @operationId("updateEPStudy")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateEPStudy(
    @path @doc("EPStudyRecord logical ID") id: UUID,
    @body body: EPStudyRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: EPStudyRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an EP study record.")
  @operationId("deleteEPStudy")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteEPStudy(
    @path @doc("EPStudyRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search EP study records by patient, operator, ablation status, or date range.")
  @operationId("searchEPStudies")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchEPStudies(
    ...EPStudySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<EPStudyRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Cardiac rehabilitation management — enrol patients, track sessions, and monitor functional capacity progress.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/cardiology/cardiac-rehab")
interface CardiacRehabManagement {
  @doc("Create a new cardiac rehabilitation enrolment record.")
  @operationId("createCardiacRehab")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCardiacRehab(
    @body body: CardiacRehab,
  ): {
    @statusCode statusCode: 201;
    @body result: CardiacRehab;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cardiac rehabilitation record by its logical ID.")
  @operationId("getCardiacRehab")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCardiacRehab(
    @path @doc("CardiacRehab logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CardiacRehab;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cardiac rehabilitation record.")
  @operationId("updateCardiacRehab")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCardiacRehab(
    @path @doc("CardiacRehab logical ID") id: UUID,
    @body body: CardiacRehab,
  ): {
    @statusCode statusCode: 200;
    @body result: CardiacRehab;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cardiac rehabilitation record.")
  @operationId("deleteCardiacRehab")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCardiacRehab(
    @path @doc("CardiacRehab logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cardiac rehabilitation records by patient, phase, status, or risk stratification.")
  @operationId("searchCardiacRehabs")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCardiacRehabs(
    ...CardiacRehabSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CardiacRehab>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
