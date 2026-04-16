/**
 * FHIR R4 Composition resource — a structured document that composes clinical resources
 * into cohesive documents such as discharge summaries, progress notes, and clinical abstracts.
 *
 * Standard LOINC document types:
 *   18842-5  Discharge summary
 *   11506-3  Progress note
 *   34133-9  Summarization of episode note
 *
 * Standard LOINC section codes:
 *   11348-0  Past medical history (PMH)
 *   8648-8   Hospital course
 *   8653-8   Discharge instructions
 *   10183-2  Discharge medications
 *   11535-2  Discharge diagnoses
 *   47519-4  Procedures
 *   30954-2  Laboratory results
 *   18776-5  Plan of treatment / follow-up
 */
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

namespace Healthcare.Clinical.Compositions;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a Composition. Aligns with FHIR CompositionStatus.")
enum CompositionStatus {
  @doc("This is a preliminary composition or document (also known as initial or interim). The content may be incomplete or unverified.")
  preliminary,

  @doc("This version of the composition is complete and verified by an appropriate person and no further work is planned. Any subsequent updates would be on a new version of the composition.")
  final,

  @doc("The composition content or the referenced resources have been modified (edited or added to) subsequent to being released as 'final' and the composition is complete and verified by an authorized person.")
  amended,

  @doc("The composition or document was originally created/issued in error, and this is an amendment that marks that the entire series should not be considered as valid.")
  enteredInError,
}

@doc("The type of attestation the authenticator offers. Aligns with FHIR CompositionAttestationMode.")
enum AttesterMode {
  @doc("The person authenticated the content in their personal capacity.")
  personal,

  @doc("The person authenticated the content in their professional capacity.")
  professional,

  @doc("The person authenticated the content and accepted legal responsibility for its content.")
  legal,

  @doc("The organization authenticated the content as consistent with their policies and procedures.")
  official,
}

@doc("The type of relationship between this document and the target document. Aligns with FHIR DocumentRelationshipType.")
enum DocumentRelationshipType {
  @doc("This document logically replaces or supersedes the target document.")
  replaces,

  @doc("This document is a transformation of the target document.")
  transforms,

  @doc("This document is a signature of the target document.")
  signs,

  @doc("This document adds additional information to the target document.")
  appends,
}

@doc("The mode of a composition section — whether it is a working list, a snapshot, or a set of changes. Aligns with FHIR ListMode.")
enum SectionMode {
  @doc("This list is the master list, maintained in an ongoing fashion with regular updates as the real world list it is tracking changes.")
  working,

  @doc("This list was prepared as a snapshot. It should not be assumed to be current.")
  snapshot,

  @doc("A point-in-time list that shows what changes were made or recommended to be made to the real world list.")
  changes,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("A party who has attested the composition and the mode of attestation. Aligns with FHIR Composition.attester.")
model CompositionAttester {
  @doc("The type of attestation the authenticator offers.")
  mode: AttesterMode;

  @doc("When the composition was attested by the party.")
  time?: utcDateTime;

  @doc("Who attested the composition in the specified way (Practitioner, PractitionerRole, Patient, RelatedPerson, or Organization).")
  party?: Reference;
}

@doc("Relationships that this composition has with other document compositions such as being superseded by or appended to. Aligns with FHIR Composition.relatesTo.")
model CompositionRelatesTo {
  @doc("The type of relationship that this composition has with the target document.")
  code: DocumentRelationshipType;

  @doc("The target composition or document of this relationship.")
  target: Reference;
}

@doc("The clinical service, such as a colonoscopy or an appendectomy, being documented. Aligns with FHIR Composition.event.")
model CompositionEvent {
  @doc("This list of codes represents the main clinical acts, such as a colonoscopy or an appendectomy, being documented.")
  code?: CodeableConcept[];

  @doc("The period of time covered by the documentation; a period for which the clinical service being documented is being addressed.")
  period?: Period;

  @doc("The description and/or reference of the event(s) being documented, such as a patient's procedure.")
  detail?: Reference[];
}

@doc("A composition section — a recursive structure allowing nested document sections with entries pointing to FHIR resources. Aligns with FHIR Composition.section.")
model CompositionSection {
  @doc("The label for this particular section. This will be part of the rendered content for the document, and is often used to build a table of contents.")
  title?: string;

  @doc("A code identifying the kind of content contained within the section. The value should be consistent with the section title. Typically a LOINC section code (e.g., 11348-0 for PMH, 8648-8 for Hospital course).")
  code?: CodeableConcept;

  @doc("Identifies who is responsible for the information in this section, not necessarily who typed it in.")
  author?: Reference[];

  @doc("The actual focus of the section when it is not the subject of the composition, but instead represents something or someone associated with the subject such as (for a patient subject) a spouse, parent, fetus, or donor.")
  focus?: Reference;

  @doc("A human-readable narrative that contains the attested content of the section, used to represent the content of the resource to a human. The narrative need not encode all the structured data, but is required to contain sufficient detail to make it clinically safe for a human to just read the narrative.")
  text?: string;

  @doc("How the entry list was prepared — whether it is a working list that is suitable for being maintained in an ongoing basis, or if it represents a snapshot of a list of items from another source, or whether it is a prepared list where items may be marked as added, modified or deleted.")
  mode?: SectionMode;

  @doc("Specifies the order applied to the items in the section entries.")
  orderedBy?: CodeableConcept;

  @doc("A reference to the actual resource from which the narrative in the section is derived, scoping the section content to a list of the referenced resources.")
  entry?: Reference[];

  @doc("If the section is empty, why the list is empty. An empty section typically has some text explaining the empty reason.")
  emptyReason?: CodeableConcept;

  @doc("A nested sub-section within this section.")
  section?: CompositionSection[];
}

@doc("A structured document composed of clinical resources, such as a discharge summary, progress note, or clinical abstract. Aligns with FHIR R4 Composition.")
model Composition extends HealthcareBaseEntity {
  @doc("The workflow/clinical status of this composition. The status is a marker for the clinical standing/relevance of the document.")
  status: CompositionStatus;

  @doc("Specifies the particular kind of composition (e.g., History and Physical, Discharge Summary, Progress Note). This usually equates to the purpose of making the composition. LOINC is the preferred code system (e.g., 18842-5 for Discharge summary, 11506-3 for Progress note).")
  type: CodeableConcept;

  @doc("A categorization for the type of the composition — helps for searching and navigation. The category aligns broadly with the subject matter of the composition but is less specific than the type.")
  category?: CodeableConcept[];

  @doc("Who or what the composition is about. The composition can be about a person, (patient or healthcare practitioner), a device (e.g., a machine) or even a group of subjects (such as a document about a herd of livestock, or a set of patients that share a common exposure). For most clinical documents, this is a reference to the Patient resource.")
  subject: Reference;

  @doc("Describes the clinical encounter or type of care this documentation is associated with.")
  encounter?: Reference;

  @doc("The composition editing time, when the composition was last logically changed by the author.")
  date: utcDateTime;

  @doc("Identifies who is responsible for the information in the composition, not necessarily who typed it in.")
  author: Reference[];

  @doc("Official human-readable label for the composition.")
  title: string;

  @doc("The code specifying the level of confidentiality of the Composition. Aligns with HL7 Confidentiality code system.")
  confidentiality?: ConfidentialityClassification;

  @doc("A participant who has attested to the accuracy of the composition/document.")
  attester?: CompositionAttester[];

  @doc("Identifies the organization or group who is responsible for ongoing maintenance of and access to the composition/document information.")
  custodian?: Reference;

  @doc("Relationships that this composition has with other compositions or documents that already exist.")
  relatesTo?: CompositionRelatesTo[];

  @doc("The clinical service, such as a colonoscopy or an appendectomy, being documented.")
  event?: CompositionEvent[];

  @doc("The root of the sections that make up the composition.")
  section: CompositionSection[];
}

@doc("Request body for creating a new Composition resource.")
model CreateCompositionRequest {
  @doc("The workflow/clinical status of this composition.")
  status: CompositionStatus;

  @doc("The kind of composition (LOINC document type code).")
  type: CodeableConcept;

  @doc("Categorization of the composition.")
  category?: CodeableConcept[];

  @doc("Reference to the subject of the composition (typically a Patient).")
  subject: Reference;

  @doc("Reference to the associated Encounter.")
  encounter?: Reference;

  @doc("The composition editing date/time.")
  date: utcDateTime;

  @doc("References to the author(s) of the composition.")
  author: Reference[];

  @doc("Official human-readable label for the composition.")
  title: string;

  @doc("Confidentiality classification for access control.")
  confidentiality?: ConfidentialityClassification;

  @doc("Attesters who have vouched for the accuracy of this composition.")
  attester?: CompositionAttester[];

  @doc("Organization responsible for maintaining this composition.")
  custodian?: Reference;

  @doc("Relationships to other compositions or documents.")
  relatesTo?: CompositionRelatesTo[];

  @doc("Clinical events being documented.")
  event?: CompositionEvent[];

  @doc("The sections that make up the composition body.")
  section: CompositionSection[];
}

@doc("Request body for partially updating an existing Composition resource. All fields are optional.")
model UpdateCompositionRequest {
  @doc("Updated workflow/clinical status.")
  status?: CompositionStatus;

  @doc("Updated document type code.")
  type?: CodeableConcept;

  @doc("Updated categorization.")
  category?: CodeableConcept[];

  @doc("Updated subject reference.")
  subject?: Reference;

  @doc("Updated encounter reference.")
  encounter?: Reference;

  @doc("Updated composition editing date/time.")
  date?: utcDateTime;

  @doc("Updated author reference(s).")
  author?: Reference[];

  @doc("Updated document title.")
  title?: string;

  @doc("Updated confidentiality classification.")
  confidentiality?: ConfidentialityClassification;

  @doc("Updated attester list.")
  attester?: CompositionAttester[];

  @doc("Updated custodian reference.")
  custodian?: Reference;

  @doc("Updated relationships to other compositions or documents.")
  relatesTo?: CompositionRelatesTo[];

  @doc("Updated clinical events.")
  event?: CompositionEvent[];

  @doc("Updated sections.")
  section?: CompositionSection[];
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Query parameters accepted by the Composition search endpoint.")
model CompositionSearchParams {
  @doc("Filter by subject (patient) reference id.")
  patient?: string;

  @doc("Filter by LOINC document type code.")
  type?: string;

  @doc("Filter by associated encounter reference id.")
  encounter?: string;

  @doc("Filter by composition status.")
  status?: CompositionStatus;

  @doc("Filter compositions authored at or after this date-time (ISO 8601).")
  dateFrom?: utcDateTime;

  @doc("Filter compositions authored at or before this date-time (ISO 8601).")
  dateTo?: utcDateTime;

  @doc("Filter by author reference id.")
  author?: string;

  @doc("Filter by custodian (organization) reference id.")
  custodian?: string;

  @doc("Filter by confidentiality classification.")
  confidentiality?: ConfidentialityClassification;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for FHIR R4 Composition resources (discharge summaries, progress notes, clinical abstracts, etc.).")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface CompositionManagement {
  @doc("Create a new Composition resource representing a structured clinical document.")
  @post
  @operationId("createComposition")
  create(
    @body body: CreateCompositionRequest,
  ): {
    @statusCode statusCode: 201;
    @body composition: Composition;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single Composition by its id.")
  @get
  @operationId("getComposition")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body composition: Composition;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing Composition in its entirety.")
  @put
  @operationId("updateComposition")
  @route("/{id}")
  update(
    @path id: string,
    @body body: CreateCompositionRequest,
  ): {
    @statusCode statusCode: 200;
    @body composition: Composition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update an existing Composition, supplying only the fields to change.")
  @patch
  @operationId("patchComposition")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: UpdateCompositionRequest,
  ): {
    @statusCode statusCode: 200;
    @body composition: Composition;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a Composition by its id.")
  @delete
  @operationId("deleteComposition")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for Composition resources using filter parameters. Supports filtering by patient, type, encounter, status, date range, and author.")
  @get
  @operationId("searchCompositions")
  @route("/search")
  search(
    ...CompositionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Composition>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
