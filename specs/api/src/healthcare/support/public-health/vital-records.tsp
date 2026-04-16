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
 * Vital Records module.
 *
 * Provides models and operations for collecting and submitting birth certificates,
 * death certificates, and fetal death reports to state vital records offices.
 * Aligned with CDC/NCHS standard certificates (U.S. Standard Certificate of Live
 * Birth 2003 revision, U.S. Standard Certificate of Death 2003 revision, and
 * U.S. Standard Report of Fetal Death 2003 revision) and FHIR Vital Records
 * Common Library IG.
 */
namespace Healthcare.Support.PublicHealth.VitalRecords;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Manner of death as reported on the U.S. Standard Certificate of Death.")
enum MannerOfDeath {
  @doc("Natural — death resulting solely from disease or functional disorders of the body")
  natural,

  @doc("Accident — death resulting from an accidental injury or unintentional cause")
  accident,

  @doc("Suicide — death resulting from an intentional self-inflicted injury")
  suicide,

  @doc("Homicide — death resulting from injury inflicted by another person")
  homicide,

  @doc("Pending investigation — manner has not yet been determined; pending autopsy or investigation")
  pending,

  @doc("Undetermined — investigation was complete but manner could not be determined")
  undetermined,
}

@doc("Status of a vital records document in the state registration workflow.")
enum VitalRecordStatus {
  @doc("The record has been initiated but is not yet complete or ready for submission")
  draft,

  @doc("The record has been electronically submitted to the state vital records office")
  submitted,

  @doc("The state vital records office has registered and issued the certificate")
  registered,

  @doc("A previously registered certificate has been amended due to corrections")
  amended,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Apgar scores recorded at one minute, five minutes, and optionally ten minutes post-delivery, used on the birth certificate for perinatal outcomes reporting.")
model ApgarScoresData {
  @doc("Apgar score at one minute post-delivery (0–10 scale)")
  oneMinute: int32;

  @doc("Apgar score at five minutes post-delivery (0–10 scale)")
  fiveMinute: int32;

  @doc("Apgar score at ten minutes post-delivery, recorded when the five-minute score is below 7")
  tenMinute?: int32;
}

@doc("A single entry in the cause of death chain (Part I of the U.S. Standard Certificate of Death), representing an immediate, underlying, or intermediate cause of death with the estimated interval to death.")
model CauseOfDeathChain {
  @doc("The cause of death at this position in the causal chain (ICD-10 coded)")
  cause: CodeableConcept;

  @doc("Approximate interval between onset of cause and death (e.g., 'minutes', '2 hours', '3 weeks', 'years')")
  interval: string;

  @doc("Sequence number in the causal chain: 1 = immediate cause, 2 = underlying cause leading to (1), 3 = underlying cause leading to (2), etc.")
  sequence: int32;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("Birth certificate data collected by the facility attendant, supporting electronic submission to the state vital records office per CDC/NCHS U.S. Standard Certificate of Live Birth.")
model BirthCertificateData extends HealthcareBaseEntity {
  @doc("Reference to the Patient record for the newborn")
  newborn: Reference;

  @doc("Reference to the Patient record for the mother")
  mother: Reference;

  @doc("Reference to the Patient record for the father or second parent (absent if not applicable)")
  father?: Reference;

  @doc("Reference to the Organisation (birth facility or home birth location) where the birth occurred")
  facilityOfBirth: Reference;

  @doc("Date and time of birth (local time of birth facility)")
  birthDateTime: utcDateTime;

  @doc("Reference to the Practitioner (physician, CNM, or other attendant) who attended the birth")
  attendingProvider: Reference;

  @doc("Birth weight expressed as a Quantity (e.g., '3.4 kg' or '3400 g')")
  birthWeight: Quantity;

  @doc("Gestational age at birth expressed as a Quantity (e.g., '39 weeks' or '39+2 weeks')")
  gestationalAge: Quantity;

  @doc("Method of delivery (SNOMED CT coded — e.g., spontaneous vaginal, cesarean, forceps)")
  deliveryMethod: CodeableConcept;

  @doc("Plurality — the number of fetuses delivered in this delivery (1 = singleton, 2 = twins, etc.)")
  plurality?: int32;

  @doc("Birth order within a multiple delivery (1 = first born, 2 = second born, etc.)")
  birthOrder?: int32;

  @doc("Apgar scores at one minute and five minutes post-delivery")
  apgarScores?: ApgarScoresData;

  @doc("Complications of labour or delivery (SNOMED CT or ICD-10-CM coded)")
  complications?: CodeableConcept[];

  @doc("Current status of the birth certificate in the state registration workflow")
  status: VitalRecordStatus;
}

@doc("Death certificate data collected by the certifying physician, supporting electronic submission to the state vital records office per CDC/NCHS U.S. Standard Certificate of Death.")
model DeathCertificateData extends HealthcareBaseEntity {
  @doc("Reference to the Patient (deceased) for whom the death certificate is being filed")
  deceased: Reference;

  @doc("Date and time of death as certified by the attending or certifying physician")
  dateOfDeath: utcDateTime;

  @doc("Place where death occurred (e.g., 'Inpatient', 'Emergency room/outpatient', 'Home', 'Nursing home')")
  placeOfDeath?: string;

  @doc("Manner of death as classified by the certifying physician or medical examiner")
  mannerOfDeath: MannerOfDeath;

  @doc("Cause of death chain (Part I) — immediate cause and sequence of conditions leading to death")
  causeOfDeath: CauseOfDeathChain[];

  @doc("Other significant conditions contributing to death but not resulting in the underlying cause (Part II)")
  contributingConditions?: CodeableConcept[];

  @doc("Whether an autopsy was performed")
  autopsyPerformed?: boolean;

  @doc("Whether tobacco use contributed to death ('Yes', 'No', 'Probably', 'Unknown')")
  tobaccoContributed?: string;

  @doc("Pregnancy status at the time of death for females aged 10–54 years")
  pregnancyStatus?: string;

  @doc("Reference to the Practitioner (physician) who certified the cause and manner of death")
  certifyingPhysician: Reference;

  @doc("Reference to the Practitioner who pronounced the death (may differ from certifying physician)")
  pronouncedBy?: Reference;

  @doc("Current status of the death certificate in the state registration workflow")
  status: VitalRecordStatus;
}

@doc("Fetal death report data collected by the attending provider, supporting electronic submission to the state vital records office per CDC/NCHS U.S. Standard Report of Fetal Death.")
model FetalDeathReport extends HealthcareBaseEntity {
  @doc("Reference to the Patient record for the mother")
  mother: Reference;

  @doc("Reference to the Organisation (facility) where the delivery occurred")
  facility: Reference;

  @doc("Date and time of delivery of the fetus")
  deliveryDate: utcDateTime;

  @doc("Gestational age at delivery expressed as a Quantity (e.g., '24 weeks')")
  gestationalAge: Quantity;

  @doc("Estimated weight of the fetus expressed as a Quantity (e.g., '600 g')")
  estimatedWeight?: Quantity;

  @doc("Cause of fetal death if determined by the attending provider or autopsy (ICD-10-CM coded)")
  causeOfDeath?: CodeableConcept;

  @doc("Current status of the fetal death report in the state registration workflow")
  status: FetalDeathReportStatus;
}

@doc("Status of a fetal death report in the state registration workflow.")
enum FetalDeathReportStatus {
  @doc("The report has been initiated but is not yet complete or ready for submission")
  draft,

  @doc("The report has been submitted to the state vital records office")
  submitted,

  @doc("The state vital records office has registered the fetal death")
  registered,
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for birth certificate data queries.")
model BirthCertificateSearchParams {
  @doc("Filter by newborn patient reference ID") @query newborn?: string;
  @doc("Filter by mother patient reference ID") @query mother?: string;
  @doc("Filter by birth facility reference ID") @query facilityOfBirth?: string;
  @doc("Filter by attending provider reference ID") @query attendingProvider?: string;
  @doc("Filter by registration status") @query status?: VitalRecordStatus;
  @doc("Filter births on or after this date") @query birthFrom?: utcDateTime;
  @doc("Filter births on or before this date") @query birthTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for death certificate data queries.")
model DeathCertificateSearchParams {
  @doc("Filter by deceased patient reference ID") @query deceased?: string;
  @doc("Filter by certifying physician reference ID") @query certifyingPhysician?: string;
  @doc("Filter by manner of death") @query mannerOfDeath?: MannerOfDeath;
  @doc("Filter by registration status") @query status?: VitalRecordStatus;
  @doc("Filter deaths on or after this date") @query deathFrom?: utcDateTime;
  @doc("Filter deaths on or before this date") @query deathTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for fetal death report queries.")
model FetalDeathReportSearchParams {
  @doc("Filter by mother patient reference ID") @query mother?: string;
  @doc("Filter by facility reference ID") @query facility?: string;
  @doc("Filter by report status") @query status?: FetalDeathReportStatus;
  @doc("Filter deliveries on or after this date") @query deliveryFrom?: utcDateTime;
  @doc("Filter deliveries on or before this date") @query deliveryTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Birth certificate management — collect, edit, and submit birth certificate data to the state vital records office, supporting the U.S. Standard Certificate of Live Birth.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/vital-records/birth-certificates")
interface BirthCertificateManagement {
  @doc("Create a new birth certificate data record.")
  @operationId("createBirthCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBirthCertificate(
    @body body: BirthCertificateData,
  ): {
    @statusCode statusCode: 201;
    @body result: BirthCertificateData;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a birth certificate data record by its logical ID.")
  @operationId("getBirthCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBirthCertificate(
    @path @doc("BirthCertificateData logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BirthCertificateData;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a birth certificate data record.")
  @operationId("updateBirthCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBirthCertificate(
    @path @doc("BirthCertificateData logical ID") id: UUID,
    @body body: BirthCertificateData,
  ): {
    @statusCode statusCode: 200;
    @body result: BirthCertificateData;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a birth certificate data record (only permitted for records in 'draft' status).")
  @operationId("deleteBirthCertificate")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBirthCertificate(
    @path @doc("BirthCertificateData logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search birth certificate records by newborn, mother, facility, provider, status, or birth date range.")
  @operationId("searchBirthCertificates")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBirthCertificates(
    ...BirthCertificateSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BirthCertificateData>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a completed birth certificate to the state vital records office via the electronic birth registration system (EBRS).")
  @operationId("submitBirthCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitBirthCertificate(
    @path @doc("BirthCertificateData logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: BirthCertificateData;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Death certificate management — collect, certify, and submit death certificate data to the state vital records office, supporting the U.S. Standard Certificate of Death.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/vital-records/death-certificates")
interface DeathCertificateManagement {
  @doc("Create a new death certificate data record.")
  @operationId("createDeathCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDeathCertificate(
    @body body: DeathCertificateData,
  ): {
    @statusCode statusCode: 201;
    @body result: DeathCertificateData;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a death certificate data record by its logical ID.")
  @operationId("getDeathCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDeathCertificate(
    @path @doc("DeathCertificateData logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DeathCertificateData;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a death certificate data record.")
  @operationId("updateDeathCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDeathCertificate(
    @path @doc("DeathCertificateData logical ID") id: UUID,
    @body body: DeathCertificateData,
  ): {
    @statusCode statusCode: 200;
    @body result: DeathCertificateData;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a death certificate data record (only permitted for records in 'draft' status).")
  @operationId("deleteDeathCertificate")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDeathCertificate(
    @path @doc("DeathCertificateData logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search death certificate records by deceased patient, certifying physician, manner of death, status, or date of death range.")
  @operationId("searchDeathCertificates")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDeathCertificates(
    ...DeathCertificateSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DeathCertificateData>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a completed death certificate to the state vital records office via the electronic death registration system (EDRS).")
  @operationId("submitDeathCertificate")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitDeathCertificate(
    @path @doc("DeathCertificateData logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: DeathCertificateData;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Fetal death report management — collect and submit fetal death reports to the state vital records office per the U.S. Standard Report of Fetal Death.")
@tag("Healthcare:Support")
@useAuth(bearerAuth)
@route("/public-health/vital-records/fetal-death-reports")
interface FetalDeathReportManagement {
  @doc("Create a new fetal death report record.")
  @operationId("createFetalDeathReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createFetalDeathReport(
    @body body: FetalDeathReport,
  ): {
    @statusCode statusCode: 201;
    @body result: FetalDeathReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a fetal death report by its logical ID.")
  @operationId("getFetalDeathReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getFetalDeathReport(
    @path @doc("FetalDeathReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: FetalDeathReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a fetal death report record.")
  @operationId("updateFetalDeathReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateFetalDeathReport(
    @path @doc("FetalDeathReport logical ID") id: UUID,
    @body body: FetalDeathReport,
  ): {
    @statusCode statusCode: 200;
    @body result: FetalDeathReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a fetal death report record (only permitted for records in 'draft' status).")
  @operationId("deleteFetalDeathReport")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteFetalDeathReport(
    @path @doc("FetalDeathReport logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search fetal death reports by mother, facility, status, or delivery date range.")
  @operationId("searchFetalDeathReports")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchFetalDeathReports(
    ...FetalDeathReportSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FetalDeathReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Submit a completed fetal death report to the state vital records office.")
  @operationId("submitFetalDeathReport")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/submit")
  submitFetalDeathReport(
    @path @doc("FetalDeathReport logical ID") id: UUID,
    @body body: { note?: string },
  ): {
    @statusCode statusCode: 200;
    @body result: FetalDeathReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
