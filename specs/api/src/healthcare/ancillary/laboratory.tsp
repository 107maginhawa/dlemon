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

namespace Healthcare.Ancillary.Laboratory;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a specimen.
 */
enum SpecimenStatus {
  available,
  unavailable,
  unsatisfactory,
  enteredInError,
}

/**
 * Lifecycle status of a diagnostic report.
 */
enum DiagnosticReportStatus {
  registered,
  partial,
  preliminary,
  final,
  amended,
  corrected,
  appended,
  cancelled,
  enteredInError,
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Supporting models – Specimen
// ---------------------------------------------------------------------------

/**
 * Details about the collection event for a specimen.
 */
model SpecimenCollection {
  /** Reference to the practitioner who collected the specimen. */
  collector?: Reference;

  /** Date and time the specimen was collected. */
  collectedDateTime?: utcDateTime;

  /** Quantity of the specimen collected. */
  quantity?: Quantity;

  /** Collection method coded value (e.g. venipuncture). */
  method?: CodeableConcept;

  /** Anatomic location from which the specimen was collected. */
  bodySite?: CodeableConcept;

  /** Fasting status of the patient at time of collection. */
  fastingStatus?: CodeableConcept;
}

/**
 * Processing step applied to a specimen.
 */
model SpecimenProcessing {
  /** Free-text description of the processing step. */
  description?: string;

  /** Coded procedure used during processing. */
  procedure?: CodeableConcept;

  /** Substances added during processing. */
  additive?: Reference[];

  /** Date and time the processing step occurred. */
  timeDateTime?: utcDateTime;
}

/**
 * Container holding the specimen.
 */
model SpecimenContainer {
  /** Business identifier for the container. */
  identifier?: string;

  /** Free-text description of the container. */
  description?: string;

  /** Type of container (e.g. red-top tube). */
  type?: CodeableConcept;

  /** Total capacity of the container. */
  capacity?: Quantity;

  /** Volume or mass of specimen in the container. */
  specimenQuantity?: Quantity;
}

// ---------------------------------------------------------------------------
// Resource model – Specimen
// ---------------------------------------------------------------------------

/**
 * A biological sample collected from a patient for laboratory analysis.
 * Aligns with the FHIR R4 Specimen resource.
 */
model Specimen extends HealthcareBaseEntity {
  /** Laboratory accession number assigned to the specimen. */
  accessionIdentifier?: string;

  /** Current lifecycle status of the specimen. */
  status?: SpecimenStatus;

  /** SNOMED-coded type of specimen (e.g. venous blood). */
  type?: CodeableConcept;

  /** Patient from whom the specimen was collected. */
  subject: Reference;

  /** Date and time the specimen was received by the laboratory. */
  receivedTime?: utcDateTime;

  /** Reference to parent specimen(s) from which this was derived. */
  parent?: Reference[];

  /** ServiceRequest(s) that authorised collection of this specimen. */
  request?: Reference[];

  /** Details about the collection event. */
  collection?: SpecimenCollection;

  /** Ordered list of processing steps applied to the specimen. */
  processing?: SpecimenProcessing[];

  /** Containers holding this specimen. */
  container?: SpecimenContainer[];

  /** Coded conditions that affect interpretation (e.g. haemolysed). */
  condition?: CodeableConcept[];

  /** Free-text or structured annotations about the specimen. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Supporting models – DiagnosticReport
// ---------------------------------------------------------------------------

/**
 * A media item (image or video) included in a diagnostic report.
 */
model DiagnosticReportMedia {
  /** Comment about the media item. */
  comment?: string;

  /** Reference to the media resource. */
  link: Reference;
}

// ---------------------------------------------------------------------------
// Resource model – DiagnosticReport
// ---------------------------------------------------------------------------

/**
 * The findings and interpretation of diagnostic tests performed on patients.
 * Aligns with the FHIR R4 DiagnosticReport resource.
 */
model DiagnosticReport extends HealthcareBaseEntity {
  /** ServiceRequest(s) this report fulfils. */
  basedOn?: Reference[];

  /** Current lifecycle status of the report. */
  status: DiagnosticReportStatus;

  /** Category of the report (e.g. LAB, RAD). */
  category: CodeableConcept[];

  /** LOINC code identifying the report type. */
  code: CodeableConcept;

  /** Patient this report is about. */
  subject: Reference;

  /** Clinical encounter during which the report was requested. */
  encounter?: Reference;

  /** Clinically relevant date/time for the report. */
  effectiveDateTime?: utcDateTime;

  /** Clinically relevant period for the report. */
  effectivePeriod?: Period;

  /** Date/time the report was issued. */
  issued?: utcDateTime;

  /** Practitioners or organisations responsible for the report. */
  performer?: Reference[];

  /** Practitioners who interpreted the results. */
  resultsInterpreter?: Reference[];

  /** Specimens this report is based on. */
  specimen?: Reference[];

  /** Individual Observation results included in this report. */
  result?: Reference[];

  /** Imaging studies referenced by this report. */
  imagingStudy?: Reference[];

  /** Media (images/videos) included in the report. */
  media?: DiagnosticReportMedia[];

  /** Clinical conclusion in free text. */
  conclusion?: string;

  /** Coded clinical conclusions. */
  conclusionCode?: CodeableConcept[];

  /** Full report document(s) in one or more formats. */
  presentedForm?: Attachment[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model SpecimenCreateRequest {
  ...OmitProperties<Specimen, "id" | "meta" | "createdAt" | "updatedAt">;
}

model SpecimenSearchParams {
  patientId?: string;
  type?: string;
  status?: SpecimenStatus;
  receivedFrom?: utcDateTime;
  receivedTo?: utcDateTime;
  ...PaginationQuery;
}

model DiagnosticReportCreateRequest {
  ...OmitProperties<DiagnosticReport, "id" | "meta" | "createdAt" | "updatedAt">;
}

model DiagnosticReportSearchParams {
  patientId?: string;
  category?: string;
  code?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  status?: DiagnosticReportStatus;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for laboratory specimens.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface SpecimenManagement {
  /**
   * Create a new specimen record.
   * @param body Specimen creation payload.
   * @returns The newly created specimen.
   */
  @post
  @operationId("createSpecimen")
  create(@body body: SpecimenCreateRequest): {
    @statusCode statusCode: 201;
    @body specimen: Specimen;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a specimen by its unique identifier.
   * @param id The specimen identifier.
   * @returns The requested specimen.
   */
  @get
  @operationId("getSpecimen")
  read(@path id: string): Specimen | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing specimen record.
   * @param id The specimen identifier.
   * @param body Updated specimen payload.
   * @returns The updated specimen.
   */
  @put
  @operationId("updateSpecimen")
  update(@path id: string, @body body: SpecimenCreateRequest): Specimen | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a specimen record.
   * @param id The specimen identifier.
   */
  @delete
  @operationId("deleteSpecimen")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search specimens by patient, type, or status.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching specimens.
   */
  @get
  @operationId("searchSpecimens")
  search(...SpecimenSearchParams): PaginatedResponse<Specimen> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for diagnostic reports.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface DiagnosticReportManagement {
  /**
   * Create a new diagnostic report.
   * @param body Diagnostic report creation payload.
   * @returns The newly created diagnostic report.
   */
  @post
  @operationId("createDiagnosticReport")
  create(@body body: DiagnosticReportCreateRequest): {
    @statusCode statusCode: 201;
    @body report: DiagnosticReport;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a diagnostic report by its unique identifier.
   * @param id The diagnostic report identifier.
   * @returns The requested diagnostic report.
   */
  @get
  @operationId("getDiagnosticReport")
  read(@path id: string): DiagnosticReport | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing diagnostic report.
   * @param id The diagnostic report identifier.
   * @param body Updated diagnostic report payload.
   * @returns The updated diagnostic report.
   */
  @put
  @operationId("updateDiagnosticReport")
  update(@path id: string, @body body: DiagnosticReportCreateRequest): DiagnosticReport | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a diagnostic report.
   * @param id The diagnostic report identifier.
   */
  @delete
  @operationId("deleteDiagnosticReport")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search diagnostic reports by patient, category, code, date range, or status.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching diagnostic reports.
   */
  @get
  @operationId("searchDiagnosticReports")
  search(...DiagnosticReportSearchParams): PaginatedResponse<DiagnosticReport> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
