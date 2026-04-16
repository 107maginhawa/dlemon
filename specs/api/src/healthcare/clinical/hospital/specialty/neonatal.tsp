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
 * Neonatal and NICU module.
 *
 * Provides models and operations for managing neonatal intensive care unit (NICU)
 * admissions, neonatal vital signs, feeding records, and newborn screening.
 * Aligned with FHIR R4 Encounter, Observation, and NutritionOrder resources
 * and the AAP / ACOG neonatal care standards.
 */
namespace Healthcare.Clinical.Hospital.Specialty.Neonatal;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("NICU level of care designation per AAP policy statement (2012), reflecting the complexity of neonatal services provided.")
enum NICULevelOfCare {
  @doc("Level I — well-newborn nursery providing care for healthy term newborns")
  levelI,

  @doc("Level II — special care nursery for moderately ill neonates or those recovering from intensive care")
  levelII,

  @doc("Level III — NICU for critically ill neonates requiring continuous life support and complex surgical care")
  levelIII,

  @doc("Level IV — regional NICU with the full spectrum of care including complex paediatric surgery and cardiology")
  levelIV,
}

@doc("Admission status of a NICU patient.")
enum NICUAdmissionStatus {
  @doc("The neonate has been admitted and is receiving NICU care")
  admitted,

  @doc("The neonate is clinically stable with no immediate deterioration expected")
  stable,

  @doc("The neonate is in a critical condition requiring intensive intervention")
  critical,

  @doc("The neonate is showing clinical improvement")
  improving,

  @doc("The neonate is clinically ready for transfer to a lower level of care or to another facility")
  readyForTransfer,

  @doc("The neonate has been discharged home or to another facility")
  discharged,
}

@doc("Type of enteral or parenteral nutrition provided in a feeding record.")
enum FeedingType {
  @doc("Maternal or donor breast milk provided by bottle, direct breastfeeding, or gavage")
  breastMilk,

  @doc("Commercial infant formula")
  formula,

  @doc("Total parenteral nutrition administered intravenously")
  totalParenteralNutrition,

  @doc("Combined breast milk and formula feeding in the same shift")
  combinedBreastFormula,
}

@doc("Route by which feeding is delivered to the neonate.")
enum FeedingRoute {
  @doc("Oral — by mouth via bottle or breastfeeding (for neonates who are able to suck)")
  oral,

  @doc("Orogastric tube — tube inserted through the mouth into the stomach")
  orogastric,

  @doc("Nasogastric tube — tube inserted through the nose into the stomach")
  nasogastric,

  @doc("Gastrostomy — tube inserted directly into the stomach through the abdominal wall")
  gastrostomy,

  @doc("Intravenous — TPN or IV dextrose solution administered through a central or peripheral line")
  intravenous,
}

@doc("Status of a newborn screening specimen and result workflow.")
enum NewbornScreeningStatus {
  @doc("The heel-stick or venipuncture specimen has been collected but not yet sent")
  collected,

  @doc("The specimen has been sent to the state newborn screening laboratory")
  sentToLab,

  @doc("Results have been received from the laboratory")
  resultsReceived,

  @doc("All screening results are within normal reference ranges")
  normal,

  @doc("One or more results are abnormal and referral or follow-up is required")
  abnormalReferral,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Apgar scores assigned at one minute, five minutes, and optionally ten minutes after birth.")
model ApgarScore {
  @doc("Apgar score at one minute post-delivery (0–10 scale)")
  oneMinute: int32;

  @doc("Apgar score at five minutes post-delivery (0–10 scale)")
  fiveMinute: int32;

  @doc("Apgar score at ten minutes post-delivery, recorded when the five-minute score is below 7 (0–10 scale)")
  tenMinute?: int32;
}

@doc("Neonatal blood pressure measurement including optional mean arterial pressure and cuff size documentation.")
model NeonatalBP {
  @doc("Systolic blood pressure in mmHg")
  systolic: int32;

  @doc("Diastolic blood pressure in mmHg")
  diastolic: int32;

  @doc("Mean arterial pressure (MAP) in mmHg, calculated or measured invasively")
  mean?: int32;

  @doc("Cuff size used for the measurement (e.g., 'neonatal', 'premature', '1')")
  cuffSize?: string;
}

@doc("The result for a single condition tested as part of the newborn screening panel.")
model NewbornScreeningResult {
  @doc("The specific condition tested (LOINC or SNOMED CT coded — e.g., PKU, congenital hypothyroidism)")
  test: CodeableConcept;

  @doc("The raw result value as reported by the screening laboratory")
  result: string;

  @doc("Applicable normal reference range (e.g., '<2.0 mg/dL') for interpretation context")
  normalRange?: string;

  @doc("Whether this result is outside the normal reference range for the condition")
  abnormal: boolean;

  @doc("Whether this abnormal result requires immediate specialist referral or repeat testing")
  referralNeeded: boolean;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A NICU admission record for a newborn, linking the neonate to the mother, capturing gestational age, birth weight, Apgar scores, and level of care.")
model NICUAdmission extends HealthcareBaseEntity {
  @doc("Reference to the Patient (newborn) admitted to the NICU")
  patient: Reference;

  @doc("Reference to the Patient record for the newborn's mother")
  motherPatient: Reference;

  @doc("Reference to the Encounter representing this NICU admission")
  encounter: Reference;

  @doc("Date and time the neonate was admitted to the NICU")
  admissionTime: utcDateTime;

  @doc("Gestational age at birth expressed as a Quantity (e.g., '28 weeks + 3 days')")
  gestationalAge: Quantity;

  @doc("Birth weight expressed as a Quantity (e.g., '1.2 kg' or '1200 g')")
  birthWeight: Quantity;

  @doc("Apgar scores recorded at one, five, and optionally ten minutes post-delivery")
  apgarScores: ApgarScore;

  @doc("Admission diagnoses or reasons for NICU care (SNOMED CT or ICD-10-CM coded)")
  admissionReason: CodeableConcept[];

  @doc("AAP NICU level of care designation assigned at admission")
  levelOfCare: NICULevelOfCare;

  @doc("Current clinical status of the admitted neonate")
  status: NICUAdmissionStatus;
}

@doc("A neonatal vital signs record capturing physiological measurements performed at a discrete point in time, including temperature, cardiorespiratory parameters, and incubator settings.")
model NeonatalVitals extends HealthcareBaseEntity {
  @doc("Reference to the Patient (neonate) for whom vitals are recorded")
  patient: Reference;

  @doc("Reference to the Encounter during which vitals were recorded")
  encounter?: Reference;

  @doc("Date and time the vitals observation was recorded")
  recordedAt: utcDateTime;

  @doc("Reference to the Practitioner or nursing staff who recorded the vitals")
  performer: Reference;

  @doc("Core body temperature (axillary, rectal, or skin) as a Quantity")
  temperature?: Quantity;

  @doc("Heart rate in beats per minute")
  heartRate?: int32;

  @doc("Respiratory rate in breaths per minute")
  respiratoryRate?: int32;

  @doc("Peripheral oxygen saturation (SpO2) as a percentage (0–100)")
  oxygenSaturation?: int32;

  @doc("Blood pressure measurement including systolic, diastolic, and mean values")
  bloodPressure?: NeonatalBP;

  @doc("Current weight as a Quantity (e.g., '1350 g') — typically measured daily in the NICU")
  weight?: Quantity;

  @doc("Head circumference as a Quantity (e.g., '28 cm') — part of the growth assessment")
  headCircumference?: Quantity;

  @doc("Fraction of inspired oxygen (FiO2) being delivered, expressed as a decimal (0.21–1.0)")
  fiO2?: float64;

  @doc("Incubator or radiant warmer set-point temperature as a Quantity")
  incubatorTemp?: Quantity;
}

@doc("A neonatal feeding record documenting the type, volume, tolerance, and route of a single feeding episode.")
model FeedingRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient (neonate) receiving the feeding")
  patient: Reference;

  @doc("Reference to the Encounter during which feeding was provided")
  encounter?: Reference;

  @doc("Date and time feeding was initiated or recorded")
  recordedAt: utcDateTime;

  @doc("Type of nutrition provided in this feeding episode")
  type: FeedingType;

  @doc("Volume of feed provided (e.g., '20 mL') — absent for direct breastfeeding sessions")
  volume?: Quantity;

  @doc("Duration of a breastfeeding session in minutes (present only for direct breastfeeding)")
  duration?: int32;

  @doc("Clinical tolerance of the feeding — describes how well the neonate tolerated the feed")
  tolerance?: string;

  @doc("Pre-feed gastric residual volume aspirated from the feeding tube (e.g., '5 mL')")
  residual?: Quantity;

  @doc("Route by which the feeding was delivered")
  route: FeedingRoute;
}

@doc("A newborn screening record documenting the state metabolic and genetic screening panel performed on a newborn in the first days of life.")
model NewbornScreening extends HealthcareBaseEntity {
  @doc("Reference to the Patient (newborn) whose blood was collected for screening")
  patient: Reference;

  @doc("Date the screening specimen was collected")
  screeningDate: utcDateTime;

  @doc("Reference to the Practitioner who collected the specimen and ordered the panel")
  performer: Reference;

  @doc("Date and time the blood specimen was collected from the newborn")
  sampleCollectedAt: utcDateTime;

  @doc("Method used to collect the blood sample")
  sampleType: NewbornScreeningSampleType;

  @doc("Conditions included on the ordered newborn screening panel (LOINC coded)")
  testsOrdered: CodeableConcept[];

  @doc("Individual test results returned by the state newborn screening laboratory")
  results?: NewbornScreeningResult[];

  @doc("Current status of the specimen and result workflow")
  status: NewbornScreeningStatus;
}

@doc("Method of blood sample collection for newborn screening.")
enum NewbornScreeningSampleType {
  @doc("Capillary heel-stick — the standard collection method for newborn dried blood spot cards")
  heelStick,

  @doc("Venipuncture — used when adequate heel-stick volume cannot be obtained")
  venipuncture,
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for NICU admission queries.")
model NICUAdmissionSearchParams {
  @doc("Filter by patient (newborn) reference ID") @query patient?: string;
  @doc("Filter by mother patient reference ID") @query motherPatient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by level of care") @query levelOfCare?: NICULevelOfCare;
  @doc("Filter by admission status") @query status?: NICUAdmissionStatus;
  @doc("Filter admissions on or after this date") @query admittedFrom?: utcDateTime;
  @doc("Filter admissions on or before this date") @query admittedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for neonatal vital sign queries.")
model NeonatalVitalsSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter vitals recorded at or after this date") @query recordedFrom?: utcDateTime;
  @doc("Filter vitals recorded at or before this date") @query recordedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for neonatal feeding record queries.")
model FeedingRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by feeding type") @query type?: FeedingType;
  @doc("Filter by feeding route") @query route?: FeedingRoute;
  @doc("Filter records on or after this date") @query recordedFrom?: utcDateTime;
  @doc("Filter records on or before this date") @query recordedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for newborn screening queries.")
model NewbornScreeningSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by screening status") @query status?: NewbornScreeningStatus;
  @doc("Filter by collection date on or after this value") @query collectedFrom?: utcDateTime;
  @doc("Filter by collection date on or before this value") @query collectedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("NICU admission management — create and manage neonatal intensive care admissions with gestational age, birth weight, Apgar scores, and level of care.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/neonatal/nicu-admissions")
interface NICUAdmissionManagement {
  @doc("Create a new NICU admission record.")
  @operationId("createNICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createNICUAdmission(
    @body body: NICUAdmission,
  ): {
    @statusCode statusCode: 201;
    @body result: NICUAdmission;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a NICU admission by its logical ID.")
  @operationId("getNICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getNICUAdmission(
    @path @doc("NICUAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: NICUAdmission;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a NICU admission record.")
  @operationId("updateNICUAdmission")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateNICUAdmission(
    @path @doc("NICUAdmission logical ID") id: UUID,
    @body body: NICUAdmission,
  ): {
    @statusCode statusCode: 200;
    @body result: NICUAdmission;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a NICU admission record.")
  @operationId("deleteNICUAdmission")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteNICUAdmission(
    @path @doc("NICUAdmission logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search NICU admissions by patient, mother, level of care, status, or date range.")
  @operationId("searchNICUAdmissions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchNICUAdmissions(
    ...NICUAdmissionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NICUAdmission>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Neonatal vital signs management — record and retrieve neonatal physiological measurements including temperature, cardiorespiratory parameters, and ventilator settings.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/neonatal/vitals")
interface NeonatalVitalsManagement {
  @doc("Record a new set of neonatal vital signs.")
  @operationId("createNeonatalVitals")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createNeonatalVitals(
    @body body: NeonatalVitals,
  ): {
    @statusCode statusCode: 201;
    @body result: NeonatalVitals;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a neonatal vitals record by its logical ID.")
  @operationId("getNeonatalVitals")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getNeonatalVitals(
    @path @doc("NeonatalVitals logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: NeonatalVitals;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a neonatal vitals record.")
  @operationId("updateNeonatalVitals")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateNeonatalVitals(
    @path @doc("NeonatalVitals logical ID") id: UUID,
    @body body: NeonatalVitals,
  ): {
    @statusCode statusCode: 200;
    @body result: NeonatalVitals;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a neonatal vitals record.")
  @operationId("deleteNeonatalVitals")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteNeonatalVitals(
    @path @doc("NeonatalVitals logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search neonatal vitals by patient, encounter, performer, or date range.")
  @operationId("searchNeonatalVitals")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchNeonatalVitals(
    ...NeonatalVitalsSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NeonatalVitals>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Neonatal feeding record management — document enteral and parenteral feeding episodes including type, volume, route, and tolerance.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/neonatal/feeding-records")
interface FeedingRecordManagement {
  @doc("Record a new neonatal feeding episode.")
  @operationId("createFeedingRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createFeedingRecord(
    @body body: FeedingRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: FeedingRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a feeding record by its logical ID.")
  @operationId("getFeedingRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getFeedingRecord(
    @path @doc("FeedingRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: FeedingRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a feeding record.")
  @operationId("updateFeedingRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateFeedingRecord(
    @path @doc("FeedingRecord logical ID") id: UUID,
    @body body: FeedingRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: FeedingRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a feeding record.")
  @operationId("deleteFeedingRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteFeedingRecord(
    @path @doc("FeedingRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search feeding records by patient, type, route, or date range.")
  @operationId("searchFeedingRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchFeedingRecords(
    ...FeedingRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FeedingRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Newborn screening management — record, track, and retrieve state metabolic and genetic screening panels and results for newborns.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/neonatal/newborn-screenings")
interface NewbornScreeningManagement {
  @doc("Create a new newborn screening record.")
  @operationId("createNewbornScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createNewbornScreening(
    @body body: NewbornScreening,
  ): {
    @statusCode statusCode: 201;
    @body result: NewbornScreening;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a newborn screening record by its logical ID.")
  @operationId("getNewbornScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getNewbornScreening(
    @path @doc("NewbornScreening logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: NewbornScreening;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a newborn screening record with laboratory results.")
  @operationId("updateNewbornScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateNewbornScreening(
    @path @doc("NewbornScreening logical ID") id: UUID,
    @body body: NewbornScreening,
  ): {
    @statusCode statusCode: 200;
    @body result: NewbornScreening;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a newborn screening record.")
  @operationId("deleteNewbornScreening")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteNewbornScreening(
    @path @doc("NewbornScreening logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search newborn screening records by patient, status, or collection date range.")
  @operationId("searchNewbornScreenings")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchNewbornScreenings(
    ...NewbornScreeningSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NewbornScreening>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
