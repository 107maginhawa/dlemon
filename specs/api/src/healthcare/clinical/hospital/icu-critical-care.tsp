import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * ICU and Critical Care module.
 *
 * Provides models and operations for managing ICU admissions, ventilator
 * management, critical care flowsheets, and severity scoring tools.
 * Covers the full spectrum of intensive care documentation aligned with
 * FHIR R4 Encounter, Observation, and DeviceUseStatement resources.
 */
namespace Healthcare.Clinical.Hospital.ICU;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of an ICU admission.")
enum ICUAdmissionStatus {
  @doc("Patient has been admitted to the ICU")
  admitted,

  @doc("Patient's condition has been stabilized")
  stabilized,

  @doc("Patient is undergoing ventilator weaning protocol")
  weaning,

  @doc("Patient is clinically ready for transfer to a lower level of care")
  readyForTransfer,

  @doc("Patient has been transferred out of the ICU")
  transferred,

  @doc("Patient expired while in the ICU")
  expired,
}

@doc("Ventilator mode used for mechanical respiratory support.")
enum VentilatorMode {
  @doc("Assist Control ventilation — delivers a set breath for every patient trigger or at minimum rate")
  AC,

  @doc("Synchronized Intermittent Mandatory Ventilation")
  SIMV,

  @doc("Continuous Positive Airway Pressure")
  CPAP,

  @doc("Bilevel Positive Airway Pressure")
  BiPAP,

  @doc("Pressure Support ventilation — augments patient-initiated breaths")
  pressureSupport,

  @doc("High-Flow Nasal Cannula oxygen therapy")
  highFlow,
}

@doc("Validated severity scoring tool used in critical care.")
enum SeverityScoringTool {
  @doc("Acute Physiology and Chronic Health Evaluation II or III")
  APACHE,

  @doc("Sequential Organ Failure Assessment")
  SOFA,

  @doc("Simplified Acute Physiology Score")
  SAPS,

  @doc("National Early Warning Score 2")
  NEWS2,

  @doc("Quick SOFA — rapid bedside organ dysfunction screen")
  qSOFA,

  @doc("Glasgow Coma Scale")
  GCS,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Ventilator settings applied during a ventilation episode.")
model VentilatorSettings {
  @doc("Fraction of inspired oxygen as a decimal (0.21–1.0)")
  FiO2: float32;

  @doc("Positive End-Expiratory Pressure in cmH₂O")
  PEEP: float32;

  @doc("Tidal volume in mL")
  tidalVolume?: float32;

  @doc("Mandatory respiratory rate in breaths per minute")
  rate?: int32;

  @doc("Pressure support level in cmH₂O (for PS and SIMV+PS modes)")
  pressureSupport?: float32;
}

@doc("Hemodynamic monitoring parameters recorded in a critical care flowsheet entry.")
model HemodynamicParameters {
  @doc("Mean Arterial Pressure in mmHg")
  MAP?: float32;

  @doc("Central Venous Pressure in mmHg")
  CVP?: float32;

  @doc("Cardiac Output in L/min")
  CO?: float32;

  @doc("Systemic Vascular Resistance in dynes·s/cm⁵")
  SVR?: float32;
}

@doc("Ventilatory parameters captured in a flowsheet entry.")
model VentilatoryParameters {
  @doc("Current ventilator mode")
  mode?: VentilatorMode;

  @doc("Peak inspiratory pressure in cmH₂O")
  peakPressure?: float32;

  @doc("Plateau pressure in cmH₂O")
  plateauPressure?: float32;

  @doc("Arterial oxygen saturation percentage (SpO₂)")
  spO2?: float32;

  @doc("End-tidal CO₂ in mmHg")
  etCO2?: float32;
}

@doc("Fluid intake and output totals for a flowsheet period.")
model IntakeOutputRecord {
  @doc("Total fluid intake in mL for the period")
  totalIntakeMl?: float32;

  @doc("Total urine output in mL for the period")
  urineOutputMl?: float32;

  @doc("Total other output (drains, nasogastric, etc.) in mL for the period")
  otherOutputMl?: float32;

  @doc("Net fluid balance in mL (positive = net gain)")
  netBalanceMl?: float32;
}

@doc("Sedation and neurological assessment scores.")
model SedationScore {
  @doc("Richmond Agitation-Sedation Scale score (–5 to +4)")
  RASS?: int32;

  @doc("Glasgow Coma Scale total score (3–15)")
  GCS?: int32;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("An ICU admission record linking a patient to an ICU bed for a period of intensive care.")
model ICUAdmission extends HealthcareBaseEntity {
  @doc("Reference to the Patient admitted to the ICU")
  patient: Reference;

  @doc("Reference to the Encounter associated with this ICU stay")
  encounter: Reference;

  @doc("Date and time the patient was admitted to the ICU")
  admissionTime: utcDateTime;

  @doc("Date and time the patient was discharged or transferred from the ICU")
  dischargeTime?: utcDateTime;

  @doc("Whether the patient required mechanical ventilation during this admission")
  ventilatorRequired: boolean;

  @doc("Whether contact, droplet, or airborne isolation precautions are in place")
  isolationRequired: boolean;

  @doc("Acuity score at the time of admission (e.g., APACHE II score on day 1)")
  acuityScore?: int32;

  @doc("Primary diagnosis driving ICU admission (SNOMED CT or ICD-10-CM coded)")
  primaryDiagnosis: CodeableConcept;

  @doc("Reference to the Practitioner (intensivist) primarily responsible for this patient")
  attendingIntensivist: Reference;

  @doc("Reference to the Location resource representing the assigned ICU bed")
  bed: Reference;

  @doc("Current clinical status of this ICU admission")
  status: ICUAdmissionStatus;
}

@doc("A ventilator management record documenting a discrete episode of mechanical ventilation.")
model VentilatorRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient on ventilatory support")
  patient: Reference;

  @doc("Reference to the Encounter during which ventilation occurred")
  encounter: Reference;

  @doc("Ventilator mode in use for this episode")
  mode: VentilatorMode;

  @doc("Ventilator settings applied for this episode")
  settings: VentilatorSettings;

  @doc("Date and time mechanical ventilation was initiated")
  startTime: utcDateTime;

  @doc("Date and time mechanical ventilation was discontinued")
  endTime?: utcDateTime;

  @doc("Reference to the weaning protocol document or order if a weaning trial is in progress")
  weaningProtocol?: Reference;
}

@doc("A time-stamped critical care flowsheet entry capturing multi-system monitoring data.")
model CriticalCareFlowsheet extends HealthcareBaseEntity {
  @doc("Reference to the Patient this flowsheet entry belongs to")
  patient: Reference;

  @doc("Reference to the Encounter this flowsheet entry is associated with")
  encounter: Reference;

  @doc("Date and time this flowsheet data was recorded")
  recordedAt: utcDateTime;

  @doc("Reference to the Practitioner (nurse or intensivist) who recorded this entry")
  performer: Reference;

  @doc("Hemodynamic monitoring parameters captured at this time point")
  hemodynamics?: HemodynamicParameters;

  @doc("Ventilatory parameters captured at this time point")
  ventilatoryParams?: VentilatoryParameters;

  @doc("Fluid intake and output totals for this flowsheet period")
  intakeOutput?: IntakeOutputRecord;

  @doc("Sedation and neurological assessment scores")
  sedationScore?: SedationScore;

  @doc("Neurovascular assessment findings (e.g., pupil reactivity, limb movement)")
  neurovascularChecks?: string;

  @doc("Drain output details (e.g., chest tube, Jackson-Pratt, CSF drain output in mL)")
  drainOutput?: string;
}

@doc("A severity score calculated using a validated critical care scoring tool.")
model SeverityScore extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom this score was calculated")
  patient: Reference;

  @doc("Reference to the Encounter associated with this severity assessment")
  encounter: Reference;

  @doc("The validated scoring tool used to calculate this severity score")
  tool: SeverityScoringTool;

  @doc("The calculated total score")
  score: float32;

  @doc("Date and time the score was calculated")
  calculatedAt: utcDateTime;

  @doc("Individual component values used in the score calculation, keyed by component name")
  components?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for querying ICU admissions.")
model ICUAdmissionSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by attending intensivist reference ID") @query attendingIntensivist?: string;
  @doc("Filter by admission status") @query status?: ICUAdmissionStatus;
  @doc("Filter by bed (location) reference ID") @query bed?: string;
  @doc("Filter admissions starting at or after this date-time") @query admittedFrom?: utcDateTime;
  @doc("Filter admissions starting at or before this date-time") @query admittedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying ventilator records.")
model VentilatorRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by ventilator mode") @query mode?: VentilatorMode;
  @doc("Filter records starting at or after this date-time") @query startedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying critical care flowsheet entries.")
model FlowsheetSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter entries recorded at or after this date-time") @query recordedFrom?: utcDateTime;
  @doc("Filter entries recorded at or before this date-time") @query recordedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying severity scores.")
model SeverityScoreSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by scoring tool") @query tool?: SeverityScoringTool;
  @doc("Filter scores calculated at or after this date-time") @query calculatedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Lifecycle management of ICU admissions, including admission, status transitions, and discharge documentation.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/icu/admissions")
interface ICUAdmissionManagement {
  @doc("Admit a patient to the ICU.")
  @operationId("createICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createICUAdmission(
    @body body: ICUAdmission,
  ): {
    @statusCode statusCode: 201;
    @body result: ICUAdmission;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an ICU admission by its logical ID.")
  @operationId("getICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getICUAdmission(
    @path @doc("ICUAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ICUAdmission;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an ICU admission record.")
  @operationId("updateICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateICUAdmission(
    @path @doc("ICUAdmission logical ID") id: UUID,
    @body body: ICUAdmission,
  ): {
    @statusCode statusCode: 200;
    @body result: ICUAdmission;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an ICU admission record.")
  @operationId("deleteICUAdmission")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteICUAdmission(
    @path @doc("ICUAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition an ICU admission to a new clinical status.")
  @operationId("transitionICUAdmissionStatus")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/status")
  transitionStatus(
    @path @doc("ICUAdmission logical ID") id: UUID,
    @body body: { status: ICUAdmissionStatus; reason?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: ICUAdmission;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ICU admissions using filter criteria.")
  @operationId("searchICUAdmissions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchICUAdmissions(
    ...ICUAdmissionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ICUAdmission>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Ventilator management — create, update, and retrieve ventilation episodes for ICU patients.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/icu/ventilator-records")
interface VentilatorManagement {
  @doc("Create a new ventilator record for a patient.")
  @operationId("createVentilatorRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createVentilatorRecord(
    @body body: VentilatorRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: VentilatorRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a ventilator record by its logical ID.")
  @operationId("getVentilatorRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getVentilatorRecord(
    @path @doc("VentilatorRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: VentilatorRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a ventilator record — settings changes, mode changes, or end-of-ventilation documentation.")
  @operationId("updateVentilatorRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateVentilatorRecord(
    @path @doc("VentilatorRecord logical ID") id: UUID,
    @body body: VentilatorRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: VentilatorRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a ventilator record.")
  @operationId("deleteVentilatorRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteVentilatorRecord(
    @path @doc("VentilatorRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ventilator records by patient, encounter, or mode.")
  @operationId("searchVentilatorRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchVentilatorRecords(
    ...VentilatorRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<VentilatorRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Critical care flowsheet management — manage time-stamped multi-system monitoring entries.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/icu/flowsheets")
interface FlowsheetManagement {
  @doc("Create a new critical care flowsheet entry.")
  @operationId("createFlowsheetEntry")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createFlowsheetEntry(
    @body body: CriticalCareFlowsheet,
  ): {
    @statusCode statusCode: 201;
    @body result: CriticalCareFlowsheet;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a flowsheet entry by its logical ID.")
  @operationId("getFlowsheetEntry")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getFlowsheetEntry(
    @path @doc("CriticalCareFlowsheet logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CriticalCareFlowsheet;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a critical care flowsheet entry.")
  @operationId("updateFlowsheetEntry")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateFlowsheetEntry(
    @path @doc("CriticalCareFlowsheet logical ID") id: UUID,
    @body body: CriticalCareFlowsheet,
  ): {
    @statusCode statusCode: 200;
    @body result: CriticalCareFlowsheet;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a flowsheet entry.")
  @operationId("deleteFlowsheetEntry")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteFlowsheetEntry(
    @path @doc("CriticalCareFlowsheet logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search flowsheet entries by patient, encounter, performer, or time range.")
  @operationId("searchFlowsheetEntries")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchFlowsheetEntries(
    ...FlowsheetSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CriticalCareFlowsheet>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Severity score management — record and retrieve validated critical care severity scores.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/icu/severity-scores")
interface SeverityScoreManagement {
  @doc("Record a new severity score for a patient.")
  @operationId("createSeverityScore")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSeverityScore(
    @body body: SeverityScore,
  ): {
    @statusCode statusCode: 201;
    @body result: SeverityScore;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a severity score by its logical ID.")
  @operationId("getSeverityScore")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSeverityScore(
    @path @doc("SeverityScore logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SeverityScore;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a severity score record.")
  @operationId("updateSeverityScore")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSeverityScore(
    @path @doc("SeverityScore logical ID") id: UUID,
    @body body: SeverityScore,
  ): {
    @statusCode statusCode: 200;
    @body result: SeverityScore;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a severity score record.")
  @operationId("deleteSeverityScore")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSeverityScore(
    @path @doc("SeverityScore logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search severity scores by patient, encounter, tool, or calculation date.")
  @operationId("searchSeverityScores")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchSeverityScores(
    ...SeverityScoreSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SeverityScore>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
