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
 * Labor and Delivery module.
 *
 * Provides models and operations for managing the complete obstetric episode:
 * antepartum pregnancy records, active labor and delivery documentation,
 * newborn assessments, and postpartum care. Aligned with FHIR R4 EpisodeOfCare,
 * Encounter, Observation, and Patient resources.
 */
namespace Healthcare.Clinical.Hospital.LaborDelivery;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Phase of the obstetric episode.")
enum PregnancyStatus {
  @doc("The patient is pregnant and has not yet begun active labor")
  antepartum,

  @doc("The patient is in active labor")
  inLabor,

  @doc("Delivery has occurred")
  delivered,

  @doc("The patient is in the postpartum recovery period")
  postpartum,
}

@doc("How labor was initiated.")
enum LaborType {
  @doc("Labor began spontaneously without medical intervention")
  spontaneous,

  @doc("Labor was initiated medically (e.g., Pitocin, Foley balloon)")
  induced,

  @doc("Labor started spontaneously but was accelerated with oxytocin or amniotomy")
  augmented,
}

@doc("Method by which the infant was delivered.")
enum DeliveryMethod {
  @doc("Normal spontaneous vaginal delivery")
  vaginal,

  @doc("Abdominal delivery via surgical incision")
  cesarean,

  @doc("Vaginal delivery assisted with a vacuum cup")
  vacuumAssisted,

  @doc("Vaginal delivery assisted with obstetric forceps")
  forcepsAssisted,

  @doc("Vaginal Birth After Caesarean")
  vbac,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Apgar scores recorded at standard time intervals after birth.")
model ApgarScores {
  @doc("Apgar score at 1 minute after birth (0–10)")
  @minValue(0)
  @maxValue(10)
  oneMinute: int32;

  @doc("Apgar score at 5 minutes after birth (0–10)")
  @minValue(0)
  @maxValue(10)
  fiveMinute: int32;

  @doc("Apgar score at 10 minutes after birth (0–10), recorded if the 5-minute score was below 7")
  @minValue(0)
  @maxValue(10)
  tenMinute?: int32;
}

@doc("Contraction pattern details recorded during active labor monitoring.")
model ContractionPattern {
  @doc("Number of contractions per 10-minute window")
  frequencyPer10Min?: float32;

  @doc("Average duration of contractions in seconds")
  durationSeconds?: int32;

  @doc("Subjective or objective strength of contractions (mild, moderate, strong)")
  intensity?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A longitudinal pregnancy record tracking the full obstetric history from conception through delivery.")
model PregnancyRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient (mother) this pregnancy record belongs to")
  patient: Reference;

  @doc("Estimated Due Date calculated from LMP or ultrasound dating")
  edd: utcDateTime;

  @doc("Last Menstrual Period start date")
  lmp?: utcDateTime;

  @doc("Gravida — total number of pregnancies including the current one")
  gravida: int32;

  @doc("Para — number of pregnancies reaching viable gestational age (typically ≥20 weeks)")
  para: int32;

  @doc("Current gestational age in completed weeks")
  gestationalAge?: int32;

  @doc("References to prenatal visit Encounter resources")
  prenatalVisits?: Reference[];

  @doc("Pregnancy complications identified during the antepartum period (SNOMED CT coded)")
  complications?: CodeableConcept[];

  @doc("Current phase of the obstetric episode")
  status: PregnancyStatus;
}

@doc("An active labor and delivery record documenting the intrapartum course of a single pregnancy.")
model LaborRecord extends HealthcareBaseEntity {
  @doc("Reference to the PregnancyRecord this labor belongs to")
  pregnancyRecord: Reference;

  @doc("Reference to the Patient (mother)")
  patient: Reference;

  @doc("Reference to the inpatient Encounter for this labor admission")
  encounter: Reference;

  @doc("Date and time labor onset was documented (SROM, regular contractions, or induction start)")
  laborOnset: utcDateTime;

  @doc("Date and time of delivery of the infant")
  deliveryTime?: utcDateTime;

  @doc("How labor was initiated")
  laborType: LaborType;

  @doc("The method by which the infant was ultimately delivered")
  deliveryMethod: DeliveryMethod;

  @doc("Cervical dilation in centimetres at last documented examination (0–10)")
  @minValue(0)
  @maxValue(10)
  cervicalDilation?: float32;

  @doc("Cervical effacement percentage at last documented examination (0–100)")
  @minValue(0)
  @maxValue(100)
  effacement?: float32;

  @doc("Fetal station relative to the ischial spines (–5 to +5)")
  @minValue(-5)
  @maxValue(5)
  station?: int32;

  @doc("Most recent fetal heart rate in beats per minute")
  fetalHeartRate?: int32;

  @doc("Contraction pattern recorded at last assessment")
  contractionPattern?: ContractionPattern;

  @doc("Whether epidural analgesia was administered during labor")
  epidural?: boolean;

  @doc("Intrapartum complications (SNOMED CT coded)")
  complications?: CodeableConcept[];
}

@doc("A newborn assessment record created at the time of delivery.")
model NewbornRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient resource representing the mother")
  mother: Reference;

  @doc("Reference to the Encounter resource for the delivery event")
  deliveryEncounter: Reference;

  @doc("Date and time of birth")
  birthTime: utcDateTime;

  @doc("Birth weight as a FHIR Quantity (value in grams, unit 'g')")
  birthWeight: Quantity;

  @doc("Gestational age at delivery in completed weeks")
  gestationalAge: int32;

  @doc("Apgar scores at 1, 5, and optionally 10 minutes")
  apgarScores: ApgarScores;

  @doc("Newborn's sex as a CodeableConcept (SNOMED CT administrative sex)")
  gender: CodeableConcept;

  @doc("Neonatal complications noted at birth or during initial assessment (SNOMED CT coded)")
  complications?: CodeableConcept[];

  @doc("Whether the newborn required NICU admission")
  nicu: boolean;

  @doc("Whether breastfeeding was initiated within the first hour after birth")
  breastfeedingInitiated?: boolean;
}

@doc("A postpartum assessment capturing maternal recovery in the hours to days following delivery.")
model PostpartumAssessment extends HealthcareBaseEntity {
  @doc("Reference to the Patient (mother) being assessed")
  patient: Reference;

  @doc("Reference to the postpartum Encounter")
  encounter: Reference;

  @doc("Fundal height measurement in centimetres below the umbilicus")
  fundusHeight?: float32;

  @doc("Lochia characteristics (e.g., 'rubra, moderate, no clots') — free text or coded")
  lochia?: string;

  @doc("Perineal or abdominal incision assessment findings")
  perinealAssessment?: string;

  @doc("Breastfeeding assessment including latch quality, supply adequacy, and maternal comfort")
  breastfeedingAssessment?: string;

  @doc("Emotional and mental health screening findings (e.g., Edinburgh Postnatal Depression Scale result)")
  emotionalScreening?: string;

  @doc("Additional clinical notes for this postpartum assessment")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for querying pregnancy records.")
model PregnancySearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by pregnancy status") @query status?: PregnancyStatus;
  @doc("Filter by EDD at or after this date") @query eddFrom?: utcDateTime;
  @doc("Filter by EDD at or before this date") @query eddTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying labor records.")
model LaborSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by delivery method") @query deliveryMethod?: DeliveryMethod;
  @doc("Filter by labor type") @query laborType?: LaborType;
  @doc("Filter labor onsets at or after this date-time") @query laborOnsetFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying newborn records.")
model NewbornSearchParams {
  @doc("Filter by mother patient reference ID") @query mother?: string;
  @doc("Filter by delivery encounter reference ID") @query deliveryEncounter?: string;
  @doc("Filter by NICU admission status") @query nicu?: boolean;
  @doc("Filter births at or after this date-time") @query birthFrom?: utcDateTime;
  @doc("Filter births at or before this date-time") @query birthTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for querying postpartum assessments.")
model PostpartumSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Pregnancy record management — create and manage longitudinal obstetric pregnancy records.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/labor-delivery/pregnancies")
interface PregnancyManagement {
  @doc("Create a new pregnancy record.")
  @operationId("createPregnancyRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPregnancyRecord(
    @body body: PregnancyRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: PregnancyRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a pregnancy record by its logical ID.")
  @operationId("getPregnancyRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPregnancyRecord(
    @path @doc("PregnancyRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PregnancyRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a pregnancy record.")
  @operationId("updatePregnancyRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePregnancyRecord(
    @path @doc("PregnancyRecord logical ID") id: UUID,
    @body body: PregnancyRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: PregnancyRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a pregnancy record.")
  @operationId("deletePregnancyRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePregnancyRecord(
    @path @doc("PregnancyRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search pregnancy records by patient, status, or EDD range.")
  @operationId("searchPregnancyRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPregnancyRecords(
    ...PregnancySearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PregnancyRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Labor record management — document the intrapartum course including progress, delivery method, and complications.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/labor-delivery/labor-records")
interface LaborManagement {
  @doc("Create a new labor record.")
  @operationId("createLaborRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createLaborRecord(
    @body body: LaborRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: LaborRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a labor record by its logical ID.")
  @operationId("getLaborRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getLaborRecord(
    @path @doc("LaborRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: LaborRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a labor record with intrapartum progress or delivery outcome.")
  @operationId("updateLaborRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateLaborRecord(
    @path @doc("LaborRecord logical ID") id: UUID,
    @body body: LaborRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: LaborRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a labor record.")
  @operationId("deleteLaborRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteLaborRecord(
    @path @doc("LaborRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search labor records by patient, encounter, delivery method, or labor onset date.")
  @operationId("searchLaborRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchLaborRecords(
    ...LaborSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<LaborRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Newborn record management — create and manage neonatal assessment records at the time of delivery.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/labor-delivery/newborns")
interface NewbornManagement {
  @doc("Create a newborn record for a delivered infant.")
  @operationId("createNewbornRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createNewbornRecord(
    @body body: NewbornRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: NewbornRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a newborn record by its logical ID.")
  @operationId("getNewbornRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getNewbornRecord(
    @path @doc("NewbornRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: NewbornRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a newborn record with additional assessment findings.")
  @operationId("updateNewbornRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateNewbornRecord(
    @path @doc("NewbornRecord logical ID") id: UUID,
    @body body: NewbornRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: NewbornRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a newborn record.")
  @operationId("deleteNewbornRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteNewbornRecord(
    @path @doc("NewbornRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search newborn records by mother, encounter, NICU status, or birth date range.")
  @operationId("searchNewbornRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchNewbornRecords(
    ...NewbornSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NewbornRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Postpartum assessment management — document maternal recovery and screening in the postpartum period.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/labor-delivery/postpartum-assessments")
interface PostpartumManagement {
  @doc("Create a postpartum assessment.")
  @operationId("createPostpartumAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPostpartumAssessment(
    @body body: PostpartumAssessment,
  ): {
    @statusCode statusCode: 201;
    @body result: PostpartumAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a postpartum assessment by its logical ID.")
  @operationId("getPostpartumAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPostpartumAssessment(
    @path @doc("PostpartumAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PostpartumAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a postpartum assessment.")
  @operationId("updatePostpartumAssessment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePostpartumAssessment(
    @path @doc("PostpartumAssessment logical ID") id: UUID,
    @body body: PostpartumAssessment,
  ): {
    @statusCode statusCode: 200;
    @body result: PostpartumAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a postpartum assessment.")
  @operationId("deletePostpartumAssessment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePostpartumAssessment(
    @path @doc("PostpartumAssessment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search postpartum assessments by patient or encounter.")
  @operationId("searchPostpartumAssessments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPostpartumAssessments(
    ...PostpartumSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PostpartumAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
