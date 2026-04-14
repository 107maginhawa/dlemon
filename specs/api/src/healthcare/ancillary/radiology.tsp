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

namespace Healthcare.Ancillary.Radiology;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of an imaging study.
 */
enum ImagingStudyStatus {
  registered,
  available,
  cancelled,
  enteredInError,
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Supporting models – ImagingStudy
// ---------------------------------------------------------------------------

/**
 * An individual who contributed to the performance of a series.
 */
model ImagingStudyPerformer {
  /** Role the actor played in the series (e.g. primaryPerformer). */
  function?: CodeableConcept;

  /** Reference to the practitioner, device, or organisation. */
  actor: Reference;
}

/**
 * A single SOP instance within a series.
 */
model ImagingStudyInstance {
  /** DICOM SOP Instance UID. */
  uid: string;

  /** DICOM SOP Class UID. */
  sopClass: string;

  /** Instance number within the series. */
  number?: int32;

  /** Descriptive title for the instance. */
  title?: string;
}

/**
 * A set of images produced in a single stratum of an imaging study.
 */
model ImagingStudySeries {
  /** DICOM Series Instance UID. */
  uid: string;

  /** Series number within the study. */
  number?: int32;

  /** DICOM modality of the series (e.g. CT, MR). */
  modality: CodeableConcept;

  /** Human-readable description of the series. */
  description?: string;

  /** Total number of instances in this series. */
  numberOfInstances?: int32;

  /** Network access endpoints for the series. */
  endpoint?: string[];

  /** Body site imaged (SNOMED-CT). */
  bodySite?: CodeableConcept;

  /** Laterality of the body site imaged. */
  laterality?: CodeableConcept;

  /** Date/time the series started. */
  started?: utcDateTime;

  /** Personnel who performed the series. */
  performer?: ImagingStudyPerformer[];

  /** SOP instances that are part of this series. */
  instance?: ImagingStudyInstance[];
}

// ---------------------------------------------------------------------------
// Resource model – ImagingStudy
// ---------------------------------------------------------------------------

/**
 * Representation of the content produced in a DICOM imaging study.
 * Aligns with the FHIR R4 ImagingStudy resource.
 */
model ImagingStudy extends HealthcareBaseEntity {
  /** Current availability status of the study. */
  status: ImagingStudyStatus;

  /** DICOM modalities used in the study (e.g. CT, MR, US, XR). */
  modality?: CodeableConcept[];

  /** Patient who is the subject of the study. */
  subject: Reference;

  /** Clinical encounter during which the study was requested. */
  encounter?: Reference;

  /** Date/time the study was started. */
  started?: utcDateTime;

  /** ServiceRequest(s) that initiated this study. */
  basedOn?: Reference[];

  /** Referring physician. */
  referrer?: Reference;

  /** Interpreting physicians. */
  interpreter?: Reference[];

  /** Network access endpoints for the study. */
  endpoint?: string[];

  /** Total number of series in the study. */
  numberOfSeries?: int32;

  /** Total number of instances across all series. */
  numberOfInstances?: int32;

  /** Reference to the procedure resource. */
  procedureReference?: Reference;

  /** Coded procedure(s) performed during the study. */
  procedureCode?: CodeableConcept[];

  /** Location where the study was performed. */
  location?: Reference;

  /** Coded reason(s) for the study. */
  reasonCode?: CodeableConcept[];

  /** Reference(s) describing the reason for the study. */
  reasonReference?: Reference[];

  /** Annotations about the study. */
  note?: Annotation[];

  /** Description of the study. */
  description?: string;

  /** Series comprising the study. */
  series?: ImagingStudySeries[];

  /** URL to the study in the PACS. */
  pacsUrl?: string;

  /** Reference to the associated DiagnosticReport. */
  reportReference?: Reference;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model ImagingStudyCreateRequest {
  ...OmitProperties<ImagingStudy, "id" | "meta" | "createdAt" | "updatedAt">;
}

model ImagingStudySearchParams {
  patientId?: string;
  modality?: string;
  status?: ImagingStudyStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  bodySite?: string;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for imaging studies.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ImagingStudyManagement {
  /**
   * Create a new imaging study record.
   * @param body Imaging study creation payload.
   * @returns The newly created imaging study.
   */
  @post
  @operationId("createImagingStudy")
  create(@body body: ImagingStudyCreateRequest): {
    @statusCode statusCode: 201;
    @body study: ImagingStudy;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an imaging study by its unique identifier.
   * @param id The imaging study identifier.
   * @returns The requested imaging study.
   */
  @get
  @operationId("getImagingStudy")
  read(@path id: string): ImagingStudy | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing imaging study record.
   * @param id The imaging study identifier.
   * @param body Updated imaging study payload.
   * @returns The updated imaging study.
   */
  @put
  @operationId("updateImagingStudy")
  update(@path id: string, @body body: ImagingStudyCreateRequest): ImagingStudy | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an imaging study record.
   * @param id The imaging study identifier.
   */
  @delete
  @operationId("deleteImagingStudy")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search imaging studies by patient, modality, status, date range, or body site.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching imaging studies.
   */
  @get
  @operationId("searchImagingStudies")
  search(...ImagingStudySearchParams): PaginatedResponse<ImagingStudy> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
