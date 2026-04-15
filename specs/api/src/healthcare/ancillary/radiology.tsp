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

// ---------------------------------------------------------------------------
// Supporting models – RadiologyReport
// ---------------------------------------------------------------------------

/**
 * A single finding documented within a radiology report,
 * describing an observed abnormality or normal structure.
 */
model RadiologyFinding {
  /** Coded anatomical body site described in this finding. */
  bodySite?: CodeableConcept;

  /** Narrative description of the finding. */
  description: string;

  /** Coded severity or significance of the finding. */
  severity?: CodeableConcept;

  /** Reference to a related Observation resource capturing structured measurement data. */
  relatedObservation?: Reference;
}

/**
 * A supplemental note appended to a radiology report after initial release.
 */
model RadiologyAddendum {
  /** Practitioner or organisation who authored the addendum. */
  author: Reference;

  /** Date/time the addendum was added. */
  date: utcDateTime;

  /** Narrative text of the addendum. */
  text: string;
}

// ---------------------------------------------------------------------------
// Resource model – RadiologyReport
// ---------------------------------------------------------------------------

/**
 * The structured findings and interpretation produced by a radiologist
 * for a specific imaging study.  Complements ImagingStudy and aligns with
 * FHIR R4 DiagnosticReport (category RAD).
 */
model RadiologyReport extends HealthcareBaseEntity {
  /** Current lifecycle status of the radiology report. */
  status: ImagingStudyStatus;

  /** Reference to the ImagingStudy this report is based on. */
  study: Reference;

  /** Reference to the patient who is the subject of the report. */
  subject: Reference;

  /** Clinical encounter during which the imaging study was performed. */
  encounter?: Reference;

  /** Date/time the report was issued. */
  issued: utcDateTime;

  /** Radiologist(s) or organisations responsible for producing the report. */
  performer: Reference[];

  /** Practitioner(s) who interpreted the imaging results. */
  resultsInterpreter?: Reference[];

  /** Overall clinical impression summarising the findings. */
  impression?: string;

  /** Individual findings documented in the report. */
  findings: RadiologyFinding[];

  /** Final conclusion of the report. */
  conclusion?: string;

  /** Coded conclusion(s) (e.g. RadLex, SNOMED-CT). */
  conclusionCode?: CodeableConcept[];

  /** Full report document(s) presented in one or more formats (e.g. PDF, HTML). */
  presentedForm?: Attachment[];

  /** Addenda appended to the report after initial release. */
  addendum?: RadiologyAddendum[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers – RadiologyReport
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new RadiologyReport record.
 */
model RadiologyReportCreateRequest {
  ...OmitProperties<RadiologyReport, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching RadiologyReport resources.
 */
model RadiologyReportSearchParams {
  /** Filter by patient (subject) reference identifier. */
  patientId?: string;

  /** Filter by imaging study reference identifier. */
  studyId?: string;

  /** Filter by report status. */
  status?: ImagingStudyStatus;

  /** Earliest issued date of the report. */
  dateFrom?: utcDateTime;

  /** Latest issued date of the report. */
  dateTo?: utcDateTime;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface – RadiologyReport
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for RadiologyReport resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface RadiologyReportManagement {
  /**
   * Create a new radiology report.
   * @param body Radiology report creation payload.
   * @returns The newly created radiology report.
   */
  @post
  @operationId("createRadiologyReport")
  create(@body body: RadiologyReportCreateRequest): {
    @statusCode statusCode: 201;
    @body report: RadiologyReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a radiology report by its unique identifier.
   * @param id The radiology report identifier.
   * @returns The requested radiology report.
   */
  @get
  @operationId("getRadiologyReport")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body report: RadiologyReport;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing radiology report.
   * @param id The radiology report identifier.
   * @param body Updated radiology report payload.
   * @returns The updated radiology report.
   */
  @put
  @operationId("updateRadiologyReport")
  @route("/{id}")
  update(@path id: string, @body body: RadiologyReportCreateRequest): {
    @statusCode statusCode: 200;
    @body report: RadiologyReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a radiology report.
   * @param id The radiology report identifier.
   * @param body Fields to update.
   * @returns The updated radiology report.
   */
  @patch
  @operationId("patchRadiologyReport")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body report: RadiologyReport;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a radiology report.
   * @param id The radiology report identifier.
   */
  @delete
  @operationId("deleteRadiologyReport")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search radiology reports by patient, study, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching radiology reports.
   */
  @get
  @operationId("searchRadiologyReports")
  @route("/search")
  search(...RadiologyReportSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RadiologyReport>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
