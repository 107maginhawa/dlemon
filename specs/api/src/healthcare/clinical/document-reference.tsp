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

namespace Healthcare.Clinical.DocumentReferences;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * The status of the document reference.
 */
enum DocumentReferenceStatus {
  current,
  superseded,
  enteredInError,
}

/**
 * Categorisation of the clinical note sub-type.
 */
enum ClinicalNoteType {
  /** SOAP-structured clinical note. */
  soapNote,
  /** Free-text ongoing visit documentation. */
  progressNote,
  /** Note created at the time of a hospital admission. */
  admissionNote,
  /** Summary note created at the time of patient discharge. */
  dischargeNote,
  /** Specialist consultation note. */
  consultNote,
  /** Detailed account of a surgical procedure. */
  operativeNote,
  /** Note authored by nursing staff. */
  nursingNote,
  /** Note authored by a therapy clinician (PT, OT, SLP, etc.). */
  therapyNote,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * The document and format referenced.
 */
model DocumentContent {
  /** The document or URL of the document along with critical metadata. */
  attachment: Attachment;

  /**
   * An identifier of the document encoding, structure, and template
   * that the document conforms to.  Maps to DocumentReference.content.format.
   */
  format?: string;
}

/**
 * Clinical context in which the document was produced.
 */
model DocumentContext {
  /** Encounter(s) this document relates to. */
  encounter?: Reference[];

  /** Main clinical acts documented. */
  event?: CodeableConcept[];

  /** Time of service that is being documented. */
  period?: Period;

  /** Kind of facility where patient was seen. */
  facilityType?: CodeableConcept;

  /** Additional details about where the content was created. */
  practiceSetting?: CodeableConcept;
}

/**
 * Structured content of a SOAP-format clinical note.
 */
model SoapNoteContent {
  /** Subjective: what the patient reports. */
  subjective?: string;

  /** Objective: measurable/observable data (vitals, exam findings, results). */
  objective?: string;

  /** Assessment: the clinician's diagnosis or clinical impression. */
  assessment?: string;

  /** Plan: intended management, orders, follow-up. */
  plan?: string;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * A reference to a document of any kind for any purpose.
 * Provides metadata and a URL to a stored document.
 * Mapped to FHIR R4 DocumentReference.
 */
model DocumentReference extends HealthcareBaseEntity {
  /** The status of this document reference. */
  status: DocumentReferenceStatus;

  /**
   * The status of the underlying document.
   * Values: preliminary, final, amended, entered-in-error.
   */
  docStatus?: string;

  /** Specifies the particular kind of document referenced (LOINC document type). */
  type: CodeableConcept;

  /** A categorisation for the type of document referenced. */
  category?: CodeableConcept[];

  /** Who/what the document is about. */
  subject: Reference;

  /** When the document reference was created. */
  date: utcDateTime;

  /** Author(s) of the document. */
  author: Reference[];

  /** Which person or organisation authenticates that this document is valid. */
  authenticator?: Reference;

  /** Organisation which maintains the document. */
  custodian?: Reference;

  /** Human-readable description of the source document. */
  description?: string;

  /** A set of Security-Tag codes specifying the level of privacy/security of the document. */
  securityLabel?: CodeableConcept[];

  /** The document and format referenced. At least one must exist. */
  content: DocumentContent[];

  /** Clinical context in which the document was produced. */
  context?: DocumentContext;

  /** Sub-type of clinical note. Provides a more granular classification. */
  noteType?: ClinicalNoteType;

  /** Structured SOAP note content; populated when noteType is soapNote. */
  soapSection?: SoapNoteContent;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/**
 * Query parameters for searching DocumentReference resources.
 */
model DocumentReferenceSearchParams {
  /** Filter by patient (subject) reference id. */
  patient?: string;

  /** Filter by document type code (LOINC). */
  type?: string;

  /** Filter documents created at or after this date-time. */
  dateFrom?: utcDateTime;

  /** Filter documents created at or before this date-time. */
  dateTo?: utcDateTime;

  /** Filter by category code. */
  category?: string;

  /** Filter by author reference id. */
  author?: string;

  /** Page number (1-based). */
  page?: int32;

  /** Number of results per page. */
  pageSize?: int32;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for DocumentReference resources.
 */
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface DocumentReferenceService {
  /**
   * Create a new DocumentReference (clinical note or other document).
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createDocumentReference")
  create(
    @body body: DocumentReference,
  ): {
    @statusCode statusCode: 201;
    @body documentReference: DocumentReference;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a single DocumentReference by id.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "patient:owner"])
  @get
  @operationId("getDocumentReference")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body documentReference: DocumentReference;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing DocumentReference.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateDocumentReference")
  @route("/{id}")
  update(
    @path id: string,
    @body body: DocumentReference,
  ): {
    @statusCode statusCode: 200;
    @body documentReference: DocumentReference;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a DocumentReference.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchDocumentReference")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body documentReference: DocumentReference;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a DocumentReference.
   */
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteDocumentReference")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search for DocumentReference resources using filter parameters.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchDocumentReferences")
  @route("/search")
  search(
    ...DocumentReferenceSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DocumentReference>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
