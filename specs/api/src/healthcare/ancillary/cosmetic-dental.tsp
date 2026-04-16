import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../common/models.tsp";
import "../../common/errors.tsp";
import "../../common/pagination.tsp";
import "../../common/security.tsp";
import "../core/primitives.tsp";
import "../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Cosmetic Dentistry module.
 *
 * Provides models and operations for managing cosmetic dental treatment cases,
 * smile design workflows, tooth whitening sessions, veneer restorations, and
 * before/after photographic documentation. Supports comprehensive aesthetic
 * treatment planning and outcome tracking from initial consultation through
 * case completion.
 */
namespace Healthcare.Ancillary.CosmeticDental;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Current lifecycle status of a cosmetic dental treatment case.")
enum CosmeticCaseStatus {
  @doc("The patient has had an initial consultation and the treatment plan is being developed")
  consultation,

  @doc("The smile design or treatment plan has been reviewed and approved by the patient")
  designApproved,

  @doc("Active treatment is in progress (e.g., preparations, temporaries placed)")
  inTreatment,

  @doc("All procedures in the treatment plan have been completed")
  completed,

  @doc("The case has been cancelled by the patient or provider")
  cancelled,
}

@doc("Whitening treatment method used in a whitening session.")
enum WhiteningMethod {
  @doc("Professional in-office whitening treatment using high-concentration agent with light or heat activation")
  inOffice,

  @doc("Patient-administered take-home whitening kit with custom trays")
  takeHome,

  @doc("Combined approach using both in-office treatment and take-home maintenance")
  combined,
}

@doc("Lifecycle status of a veneer restoration.")
enum VeneerStatus {
  @doc("The veneer has been treatment-planned but preparation has not begun")
  planned,

  @doc("The tooth has been prepared (reduced) for veneer placement")
  prepped,

  @doc("A temporary veneer has been placed while the final restoration is being fabricated")
  temporaryPlaced,

  @doc("The final veneer has been adhesively bonded to the tooth")
  bonded,

  @doc("The veneer case is fully completed including final adjustments and polishing")
  completed,
}

@doc("Type of photograph in a before/after documentation series.")
enum PhotoType {
  @doc("Photograph taken before any treatment has commenced")
  before,

  @doc("Photograph taken during an intermediate stage of treatment")
  during,

  @doc("Photograph taken after treatment completion")
  after,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A cosmetic dental treatment case coordinating all aesthetic procedures for a patient under a unified treatment plan.")
model CosmeticCase extends HealthcareBaseEntity {
  @doc("Reference to the patient receiving cosmetic treatment")
  patient: Reference;

  @doc("Reference to the treating provider (dentist or specialist)")
  provider: Reference;

  @doc("Current status of this cosmetic treatment case")
  status: CosmeticCaseStatus;

  @doc("Date and time of the initial cosmetic consultation")
  consultationDate: utcDateTime;

  @doc("List of planned or performed cosmetic procedures for this case")
  procedures: CodeableConcept[];

  @doc("Narrative description of the cosmetic goals and treatment scope")
  description?: string;

  @doc("Clinical and administrative notes associated with this case")
  note?: Annotation[];
}

@doc("A smile design record capturing digital and physical design artefacts for a cosmetic case, including patient approval workflow.")
model SmileDesign extends HealthcareBaseEntity {
  @doc("Reference to the parent CosmeticCase this design belongs to")
  cosmeticCase: Reference;

  @doc("Reference to the digital smile design document or file resource")
  designDocument?: Reference;

  @doc("Reference to the wax-up model used for physical mockup and patient preview")
  waxUpReference?: Reference;

  @doc("Reference to the digital mockup image or video presented to the patient")
  digitalMockup?: Reference;

  @doc("Whether the patient has formally approved this smile design")
  patientApproved?: boolean;

  @doc("Date and time the patient signed off on the smile design")
  approvedDate?: utcDateTime;

  @doc("Clinical notes regarding design rationale, modifications, or patient feedback")
  note?: string;
}

@doc("A tooth whitening session record documenting baseline shade, product used, method, and treatment outcome.")
model WhiteningRecord extends HealthcareBaseEntity {
  @doc("Reference to the patient receiving the whitening treatment")
  patient: Reference;

  @doc("Reference to the encounter during which this whitening session was performed, if applicable")
  encounter?: Reference;

  @doc("Reference to the cosmetic case this session is part of, if applicable")
  cosmeticCase?: Reference;

  @doc("Date and time of the whitening session")
  sessionDate: utcDateTime;

  @doc("Reference to the provider or dental professional who performed the session")
  performer: Reference;

  @doc("Name and concentration of the whitening product used")
  product: string;

  @doc("Whitening method applied in this session")
  method: WhiteningMethod;

  @doc("Tooth shade recorded before whitening using a standard shade guide (e.g., 'A3', 'B2')")
  baselineShade: string;

  @doc("Tooth shade recorded after whitening, if achieved and measurable in this session")
  resultShade?: string;

  @doc("Patient-reported tooth sensitivity score on a 0 (none) to 10 (severe) scale")
  @minValue(0)
  @maxValue(10)
  sensitivityScore?: int32;

  @doc("Clinical notes regarding the session, patient response, or instructions given")
  note?: string;
}

@doc("A veneer restoration record for a single tooth, tracking shade, material, preparation design, and fabrication/bonding status.")
model VeneerRecord extends HealthcareBaseEntity {
  @doc("Reference to the patient receiving the veneer")
  patient: Reference;

  @doc("Reference to the parent CosmeticCase this veneer is part of")
  cosmeticCase: Reference;

  @doc("Universal or FDI tooth number identifying the tooth receiving the veneer")
  toothNumber: int32;

  @doc("Shade selected for the veneer using a standard shade guide (e.g., 'A1', 'BL2', 'OM1')")
  shade: string;

  @doc("Material used for the veneer (e.g., feldspathic porcelain, e.max, zirconia)")
  material: CodeableConcept;

  @doc("Preparation design used (e.g., 'feather edge', 'chamfer', 'butt joint') — documented from prep notes or scan")
  prepDesign?: string;

  @doc("Current fabrication and placement status of this veneer")
  status: VeneerStatus;
}

@doc("A before/after photographic record documenting the visual progress of a cosmetic dental case.")
model BeforeAfterPhoto extends HealthcareBaseEntity {
  @doc("Reference to the cosmetic case this photograph documents")
  cosmeticCase: Reference;

  @doc("Reference to the patient — denormalized for photo browsing without case join")
  patient: Reference;

  @doc("Classification of this photograph in the documentation timeline")
  photoType: PhotoType;

  @doc("Reference to the stored image file resource")
  photoReference: Reference;

  @doc("Date and time the photograph was taken")
  capturedAt: utcDateTime;

  @doc("Reference to the staff member who captured the photograph")
  capturedBy?: Reference;

  @doc("Description of the view, angle, or clinical context of this photograph")
  description?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for cosmetic cases.")
model CosmeticCaseSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by provider reference ID") @query provider?: string;
  @doc("Filter by case status") @query status?: CosmeticCaseStatus;
  @doc("Filter by consultation date on or after this date") @query consultationFrom?: utcDateTime;
  @doc("Filter by consultation date on or before this date") @query consultationTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for whitening records.")
model WhiteningRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by cosmetic case reference ID") @query cosmeticCase?: string;
  @doc("Filter by whitening method") @query method?: WhiteningMethod;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter sessions on or after this date") @query sessionFrom?: utcDateTime;
  @doc("Filter sessions on or before this date") @query sessionTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for veneer records.")
model VeneerRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by cosmetic case reference ID") @query cosmeticCase?: string;
  @doc("Filter by veneer status") @query status?: VeneerStatus;
  @doc("Filter by tooth number") @query toothNumber?: int32;
  ...OffsetPaginationParams;
}

@doc("Search parameters for before/after photos.")
model BeforeAfterPhotoSearchParams {
  @doc("Filter by cosmetic case reference ID") @query cosmeticCase?: string;
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by photo type") @query photoType?: PhotoType;
  @doc("Filter by photographer reference ID") @query capturedBy?: string;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Supporting request models
// ---------------------------------------------------------------------------

@doc("Request body for transitioning a cosmetic case to a new status.")
model CosmeticCaseStatusTransitionRequest {
  @doc("Target status to transition the case to")
  status: CosmeticCaseStatus;

  @doc("Optional note documenting the reason for this status change")
  note?: string;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Cosmetic case management — full lifecycle of cosmetic dental treatment cases from consultation through completion.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/cosmetic-dental/cases")
interface CosmeticCaseManagement {
  @doc("Create a new cosmetic dental case.")
  @operationId("createCosmeticCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCosmeticCase(
    @body body: CosmeticCase,
  ): {
    @statusCode statusCode: 201;
    @body result: CosmeticCase;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a cosmetic case by its logical ID.")
  @operationId("getCosmeticCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCosmeticCase(
    @path @doc("CosmeticCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CosmeticCase;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a cosmetic case — procedures, description, or notes.")
  @operationId("updateCosmeticCase")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCosmeticCase(
    @path @doc("CosmeticCase logical ID") id: UUID,
    @body body: CosmeticCase,
  ): {
    @statusCode statusCode: 200;
    @body result: CosmeticCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a cosmetic case.")
  @operationId("deleteCosmeticCase")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteCosmeticCase(
    @path @doc("CosmeticCase logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search cosmetic cases by patient, provider, status, or consultation date range.")
  @operationId("searchCosmeticCases")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCosmeticCases(
    ...CosmeticCaseSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CosmeticCase>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Transition a cosmetic case to a new status — e.g., from consultation to designApproved, or inTreatment to completed.")
  @operationId("transitionCosmeticCaseStatus")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @route("/{id}/status")
  transitionCosmeticCaseStatus(
    @path @doc("CosmeticCase logical ID") id: UUID,
    @body body: CosmeticCaseStatusTransitionRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: CosmeticCase;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Smile design management — maintain digital and physical design artefacts for cosmetic treatment cases and track patient approval.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/cosmetic-dental/smile-designs")
interface SmileDesignManagement {
  @doc("Create a new smile design record for a cosmetic case.")
  @operationId("createSmileDesign")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createSmileDesign(
    @body body: SmileDesign,
  ): {
    @statusCode statusCode: 201;
    @body result: SmileDesign;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a smile design record by its logical ID.")
  @operationId("getSmileDesign")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getSmileDesign(
    @path @doc("SmileDesign logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: SmileDesign;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a smile design record — artefact references, patient approval, or notes.")
  @operationId("updateSmileDesign")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateSmileDesign(
    @path @doc("SmileDesign logical ID") id: UUID,
    @body body: SmileDesign,
  ): {
    @statusCode statusCode: 200;
    @body result: SmileDesign;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a smile design record.")
  @operationId("deleteSmileDesign")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteSmileDesign(
    @path @doc("SmileDesign logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Whitening record management — document in-office and take-home whitening sessions with shade tracking and sensitivity monitoring.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/cosmetic-dental/whitening-records")
interface WhiteningRecordManagement {
  @doc("Create a new whitening session record.")
  @operationId("createWhiteningRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createWhiteningRecord(
    @body body: WhiteningRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: WhiteningRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a whitening record by its logical ID.")
  @operationId("getWhiteningRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getWhiteningRecord(
    @path @doc("WhiteningRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: WhiteningRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a whitening record — result shade, sensitivity score, or notes.")
  @operationId("updateWhiteningRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateWhiteningRecord(
    @path @doc("WhiteningRecord logical ID") id: UUID,
    @body body: WhiteningRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: WhiteningRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a whitening session record.")
  @operationId("deleteWhiteningRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteWhiteningRecord(
    @path @doc("WhiteningRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search whitening records by patient, case, method, performer, or session date range.")
  @operationId("searchWhiteningRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchWhiteningRecords(
    ...WhiteningRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WhiteningRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Veneer record management — track individual tooth veneer restorations from planning through final bonding.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/cosmetic-dental/veneer-records")
interface VeneerRecordManagement {
  @doc("Create a new veneer record for a tooth.")
  @operationId("createVeneerRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createVeneerRecord(
    @body body: VeneerRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: VeneerRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a veneer record by its logical ID.")
  @operationId("getVeneerRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getVeneerRecord(
    @path @doc("VeneerRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: VeneerRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a veneer record — shade, material, prep design, or status.")
  @operationId("updateVeneerRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateVeneerRecord(
    @path @doc("VeneerRecord logical ID") id: UUID,
    @body body: VeneerRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: VeneerRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a veneer record.")
  @operationId("deleteVeneerRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteVeneerRecord(
    @path @doc("VeneerRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search veneer records by patient, case, tooth number, or status.")
  @operationId("searchVeneerRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchVeneerRecords(
    ...VeneerRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<VeneerRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Before/after photo management — capture, store, and retrieve photographic documentation of cosmetic treatment progress.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/cosmetic-dental/photos")
interface BeforeAfterPhotoManagement {
  @doc("Create a new before/after photo record.")
  @operationId("createBeforeAfterPhoto")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBeforeAfterPhoto(
    @body body: BeforeAfterPhoto,
  ): {
    @statusCode statusCode: 201;
    @body result: BeforeAfterPhoto;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a before/after photo record by its logical ID.")
  @operationId("getBeforeAfterPhoto")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBeforeAfterPhoto(
    @path @doc("BeforeAfterPhoto logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BeforeAfterPhoto;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a before/after photo record — description or capture metadata.")
  @operationId("updateBeforeAfterPhoto")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBeforeAfterPhoto(
    @path @doc("BeforeAfterPhoto logical ID") id: UUID,
    @body body: BeforeAfterPhoto,
  ): {
    @statusCode statusCode: 200;
    @body result: BeforeAfterPhoto;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a before/after photo record.")
  @operationId("deleteBeforeAfterPhoto")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBeforeAfterPhoto(
    @path @doc("BeforeAfterPhoto logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search before/after photos by cosmetic case, patient, photo type, or photographer.")
  @operationId("searchBeforeAfterPhotos")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBeforeAfterPhotos(
    ...BeforeAfterPhotoSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BeforeAfterPhoto>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
