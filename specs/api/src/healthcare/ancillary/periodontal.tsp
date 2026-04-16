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
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

namespace Healthcare.Ancillary.Periodontal;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a periodontal examination.
 */
enum PerioExamStatus {
  /** Examination is currently being recorded. */
  inProgress,
  /** Examination has been fully recorded and reviewed. */
  completed,
  /** Examination is locked against further edits. */
  locked,
}

/**
 * Six-point site locations measured at each tooth.
 */
enum PerioSiteLocation {
  mesialBuccal,
  buccal,
  distalBuccal,
  mesialLingual,
  lingual,
  distalLingual,
}

/**
 * Classification grade for furcation involvement.
 */
enum FurcationGrade {
  /** Horizontal attachment loss less than one third of the tooth width. */
  gradeI,
  /** Horizontal attachment loss greater than one third but not encompassing the full width. */
  gradeII,
  /** Horizontal attachment loss encompassing the full width of the furcation area. */
  gradeIII,
}

/**
 * Classification grade for tooth mobility.
 */
enum MobilityGrade {
  /** No detectable mobility. */
  grade0,
  /** Slight mobility up to 1 mm horizontally. */
  gradeI,
  /** Moderate mobility greater than 1 mm horizontally. */
  gradeII,
  /** Severe mobility greater than 1 mm in any direction including vertical. */
  gradeIII,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * A single probing measurement at one of the six sites around a tooth.
 */
model PerioSite {
  /** Tooth number in the notation system used for this exam. */
  toothNumber: int32;

  /** The six-point site location being measured. */
  site: PerioSiteLocation;

  /** Pocket depth measured in millimetres. */
  pocketDepth: int32;

  /** Gingival recession measured in millimetres. */
  recession?: int32;

  /** Clinical attachment level derived from pocket depth and recession. */
  clinicalAttachmentLevel?: int32;

  /** Whether bleeding was elicited on probing at this site. */
  bleedingOnProbing: boolean;

  /** Whether suppuration (pus) was present at this site. */
  suppuration?: boolean;

  /** Whether plaque was detected at this site. */
  plaque?: boolean;
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

/**
 * A complete periodontal probing examination capturing all six sites per tooth.
 */
model PerioExam extends HealthcareBaseEntity {
  /** Patient who is the subject of this examination. */
  patient: Reference;

  /** Clinical encounter during which the examination was performed. */
  encounter?: Reference;

  /** Practitioner who performed the examination. */
  performer: Reference;

  /** Date and time the examination was conducted. */
  examDate: utcDateTime;

  /** Current lifecycle status of the examination. */
  status: PerioExamStatus;

  /** Individual site measurements across all charted teeth. */
  sites: PerioSite[];

  /** High-level clinical summary of the periodontal status. */
  summary?: string;

  /** Clinical annotations associated with the examination. */
  note?: Annotation[];
}

/**
 * A furcation involvement record for a multi-rooted tooth.
 */
model FurcationRecord extends HealthcareBaseEntity {
  /** Patient for whom the furcation record is documented. */
  patient: Reference;

  /** Periodontal exam during which the furcation was assessed. */
  perioExam?: Reference;

  /** Tooth number exhibiting furcation involvement. */
  toothNumber: int32;

  /** Furcation classification grade. */
  grade: FurcationGrade;

  /** Anatomical location of the furcation entry (e.g. buccal, mesial). */
  location?: string;
}

/**
 * A tooth mobility assessment record.
 */
model MobilityRecord extends HealthcareBaseEntity {
  /** Patient for whom the mobility is recorded. */
  patient: Reference;

  /** Periodontal exam during which the mobility was assessed. */
  perioExam?: Reference;

  /** Tooth number assessed for mobility. */
  toothNumber: int32;

  /** Mobility classification grade. */
  grade: MobilityGrade;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model PerioExamCreateRequest {
  ...OmitProperties<PerioExam, "id" | "meta" | "createdAt" | "updatedAt">;
}

model PerioExamSearchParams {
  patientId?: string;
  performerId?: string;
  status?: PerioExamStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model PerioExamCompareParams {
  examIdA: string;
  examIdB: string;
}

model FurcationRecordCreateRequest {
  ...OmitProperties<FurcationRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model FurcationRecordSearchParams {
  patientId?: string;
  perioExamId?: string;
  toothNumber?: int32;
  grade?: FurcationGrade;
  ...PaginationQuery;
}

model MobilityRecordCreateRequest {
  ...OmitProperties<MobilityRecord, "id" | "meta" | "createdAt" | "updatedAt">;
}

model MobilityRecordSearchParams {
  patientId?: string;
  perioExamId?: string;
  toothNumber?: int32;
  grade?: MobilityGrade;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD, search, completion, and cross-exam comparison operations for periodontal examinations.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface PerioExamManagement {
  /**
   * Create a new periodontal examination record.
   * @param body Periodontal examination creation payload.
   * @returns The newly created periodontal examination.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createPerioExam")
  create(@body body: PerioExamCreateRequest): {
    @statusCode statusCode: 201;
    @body exam: PerioExam;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a periodontal examination by its unique identifier.
   * @param id The periodontal examination identifier.
   * @returns The requested periodontal examination.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getPerioExam")
  read(@path id: string): PerioExam | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing periodontal examination record.
   * @param id The periodontal examination identifier.
   * @param body Updated examination payload.
   * @returns The updated periodontal examination.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updatePerioExam")
  update(@path id: string, @body body: PerioExamCreateRequest): PerioExam | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a periodontal examination record.
   * @param id The periodontal examination identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deletePerioExam")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search periodontal examinations by patient, performer, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching periodontal examinations.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchPerioExams")
  search(...PerioExamSearchParams): PaginatedResponse<PerioExam> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Mark a periodontal examination as completed, transitioning status from inProgress.
   * @param id The periodontal examination identifier.
   * @returns The completed periodontal examination.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("completePerioExam")
  @route("/{id}/complete")
  complete(@path id: string): PerioExam | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Compare two periodontal examinations to surface changes in pocket depth, recession, and attachment level.
   * @param params Identifiers of the two examinations to compare.
   * @returns A structured diff of the two examinations.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("comparePerioExams")
  @route("/compare")
  compareExams(...PerioExamCompareParams): Record<unknown> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for furcation involvement records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface FurcationManagement {
  /**
   * Create a new furcation involvement record.
   * @param body Furcation record creation payload.
   * @returns The newly created furcation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createFurcationRecord")
  create(@body body: FurcationRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: FurcationRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a furcation record by its unique identifier.
   * @param id The furcation record identifier.
   * @returns The requested furcation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getFurcationRecord")
  read(@path id: string): FurcationRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing furcation record.
   * @param id The furcation record identifier.
   * @param body Updated furcation record payload.
   * @returns The updated furcation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateFurcationRecord")
  update(@path id: string, @body body: FurcationRecordCreateRequest): FurcationRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a furcation record.
   * @param id The furcation record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteFurcationRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD operations for tooth mobility records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface MobilityManagement {
  /**
   * Create a new tooth mobility record.
   * @param body Mobility record creation payload.
   * @returns The newly created mobility record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createMobilityRecord")
  create(@body body: MobilityRecordCreateRequest): {
    @statusCode statusCode: 201;
    @body record: MobilityRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a mobility record by its unique identifier.
   * @param id The mobility record identifier.
   * @returns The requested mobility record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getMobilityRecord")
  read(@path id: string): MobilityRecord | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing mobility record.
   * @param id The mobility record identifier.
   * @param body Updated mobility record payload.
   * @returns The updated mobility record.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateMobilityRecord")
  update(@path id: string, @body body: MobilityRecordCreateRequest): MobilityRecord | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a mobility record.
   * @param id The mobility record identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteMobilityRecord")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
