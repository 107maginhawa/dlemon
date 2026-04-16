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
 * Oral Surgery and Dental Surgery module.
 *
 * Provides models and operations for documenting tooth extractions (simple and
 * surgical), dental pathology specimen collection and lab tracking, post-operative
 * patient instructions, and healing follow-up assessments. Supports full clinical
 * traceability from surgical procedure through pathology and post-op care.
 */
namespace Healthcare.Ancillary.OralSurgeryDental;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Classification of the extraction technique used during tooth removal.")
enum ExtractionType {
  @doc("Simple (closed) extraction using forceps only — no soft tissue or bone removal required")
  simple,

  @doc("Surgical (open) extraction requiring mucoperiosteal flap elevation and/or bone removal")
  surgical,
}

@doc("Wound healing status recorded at a follow-up visit after an oral surgery procedure.")
enum HealingStatus {
  @doc("The extraction site or surgical wound is healing as expected with no complications")
  normal,

  @doc("Healing is progressing more slowly than expected (e.g., dry socket, delayed granulation)")
  delayed,

  @doc("A complication has been identified requiring additional treatment")
  complication,

  @doc("The patient has been referred to a specialist or higher level of care for complication management")
  referred,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A tooth extraction record documenting a simple or surgical tooth removal including technique, complications, socket management, and specimen collection.")
model ExtractionRecord extends HealthcareBaseEntity {
  @doc("Reference to the patient from whom the tooth was extracted")
  patient: Reference;

  @doc("Reference to the encounter during which the extraction was performed")
  encounter: Reference;

  @doc("Universal or FDI tooth number of the extracted tooth")
  toothNumber: int32;

  @doc("Primary reason for extraction — coded using ICD-10-CM or a dental code system")
  reason: CodeableConcept;

  @doc("Type of extraction technique used")
  extractionType: ExtractionType;

  @doc("Reference to the oral surgeon or dentist who performed the extraction")
  provider: Reference;

  @doc("Date and time the extraction was performed")
  performedAt: utcDateTime;

  @doc("Intra- or post-operative complications documented during or immediately after the procedure")
  complications?: CodeableConcept[];

  @doc("Whether any root tip was retained in the socket following extraction")
  rootTipRetained?: boolean;

  @doc("Whether socket preservation (ridge preservation) was performed following extraction")
  socketPreservation?: boolean;

  @doc("Bone graft or preservation material used if socket preservation was performed")
  preservationMaterial?: string;

  @doc("Whether adequate hemostasis was achieved at the completion of the procedure")
  hemostasisAchieved: boolean;

  @doc("Whether a tissue specimen was collected for histopathological analysis")
  specimenCollected?: boolean;

  @doc("Reference to the DentalPathologySpecimen record if a specimen was collected")
  specimenReference?: Reference;

  @doc("Clinical notes associated with this extraction procedure")
  note?: Annotation[];
}

@doc("A dental pathology specimen record tracking a tissue sample from collection through laboratory analysis and final pathology result.")
model DentalPathologySpecimen extends HealthcareBaseEntity {
  @doc("Reference to the patient from whom the specimen was collected")
  patient: Reference;

  @doc("Reference to the encounter during which the specimen was collected")
  encounter: Reference;

  @doc("Reference to the ExtractionRecord if this specimen was collected during tooth removal")
  extractionRecord?: Reference;

  @doc("Type of specimen collected — coded (e.g., soft tissue, bone, periapical cyst, odontogenic tumour)")
  specimenType: CodeableConcept;

  @doc("Date and time the specimen was collected from the patient")
  collectedAt: utcDateTime;

  @doc("Reference to the provider who collected the specimen")
  collectedBy: Reference;

  @doc("Whether the specimen has been sent to the pathology laboratory")
  sentToLab: boolean;

  @doc("External laboratory accession number or reference assigned by the receiving lab")
  labReference?: Reference;

  @doc("Date and time the laboratory confirmed receipt of the specimen")
  labReceivedAt?: utcDateTime;

  @doc("Pathology result narrative as reported by the laboratory pathologist")
  result?: string;

  @doc("Whether the pathology result indicates a malignant or potentially malignant condition")
  malignancyDetected?: boolean;
}

@doc("Post-operative care instructions issued to a patient following an oral surgery procedure.")
model PostOpInstruction extends HealthcareBaseEntity {
  @doc("Reference to the patient receiving these post-operative instructions")
  patient: Reference;

  @doc("Reference to the encounter during which the procedure was performed")
  encounter: Reference;

  @doc("Coded procedure for which these instructions apply")
  procedure: CodeableConcept;

  @doc("Date and time these instructions were issued to the patient")
  issueDate: utcDateTime;

  @doc("Reference to the provider or staff member who issued the instructions")
  issuedBy: Reference;

  @doc("Ordered list of post-operative care instructions provided to the patient")
  instructions: string[];

  @doc("References to Medication resources prescribed as part of post-operative care")
  medications?: Reference[];

  @doc("Recommended date for the post-operative follow-up appointment")
  followUpDate?: plainDate;

  @doc("After-hours emergency contact information provided to the patient")
  emergencyContact?: string;

  @doc("Whether the patient has signed an acknowledgment of these instructions")
  signedByPatient?: boolean;
}

@doc("A post-operative healing follow-up record documenting wound status at a scheduled or unscheduled review visit.")
model HealingFollowUp extends HealthcareBaseEntity {
  @doc("Reference to the patient being assessed at this follow-up")
  patient: Reference;

  @doc("Reference to the follow-up encounter, if a formal visit was created")
  encounter?: Reference;

  @doc("Reference to the ExtractionRecord or other procedure record this follow-up relates to")
  relatedProcedure: Reference;

  @doc("Date the follow-up was scheduled to occur")
  scheduledDate: plainDate;

  @doc("Date and time the follow-up was actually conducted")
  actualDate?: utcDateTime;

  @doc("Reference to the provider who performed the follow-up assessment")
  performer?: Reference;

  @doc("Clinical assessment of healing status at this follow-up visit")
  healingStatus: HealingStatus;

  @doc("Narrative clinical findings documented at this follow-up visit")
  findings?: string;

  @doc("Date recommended for the next follow-up visit if further monitoring is required")
  nextFollowUp?: plainDate;

  @doc("Additional clinical notes regarding this follow-up visit")
  note?: string;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for extraction records.")
model ExtractionRecordSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by provider reference ID") @query provider?: string;
  @doc("Filter by extraction type") @query extractionType?: ExtractionType;
  @doc("Filter by tooth number") @query toothNumber?: int32;
  @doc("Filter by specimen collected flag") @query specimenCollected?: boolean;
  @doc("Filter by socket preservation flag") @query socketPreservation?: boolean;
  @doc("Filter extractions performed on or after this date") @query performedFrom?: utcDateTime;
  @doc("Filter extractions performed on or before this date") @query performedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for dental pathology specimens.")
model DentalPathologySpecimenSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by extraction record reference ID") @query extractionRecord?: string;
  @doc("Filter by sent to lab status") @query sentToLab?: boolean;
  @doc("Filter by malignancy detected flag") @query malignancyDetected?: boolean;
  @doc("Filter by collection date on or after this date") @query collectedFrom?: utcDateTime;
  @doc("Filter by collection date on or before this date") @query collectedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for post-operative instructions.")
model PostOpInstructionSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by issuing provider reference ID") @query issuedBy?: string;
  @doc("Filter by patient signature status") @query signedByPatient?: boolean;
  @doc("Filter by issue date on or after this date") @query issuedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for healing follow-ups.")
model HealingFollowUpSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by related procedure reference ID") @query relatedProcedure?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter by healing status") @query healingStatus?: HealingStatus;
  @doc("Filter by scheduled date on or after this date") @query scheduledFrom?: plainDate;
  @doc("Filter by scheduled date on or before this date") @query scheduledTo?: plainDate;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Extraction record management — document tooth extractions including technique, complications, hemostasis, socket preservation, and specimen collection.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/oral-surgery/extractions")
interface ExtractionRecordManagement {
  @doc("Create a new extraction record.")
  @operationId("createExtractionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createExtractionRecord(
    @body body: ExtractionRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: ExtractionRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an extraction record by its logical ID.")
  @operationId("getExtractionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getExtractionRecord(
    @path @doc("ExtractionRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ExtractionRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an extraction record — complications, socket preservation details, hemostasis status, or specimen reference.")
  @operationId("updateExtractionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateExtractionRecord(
    @path @doc("ExtractionRecord logical ID") id: UUID,
    @body body: ExtractionRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: ExtractionRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an extraction record.")
  @operationId("deleteExtractionRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteExtractionRecord(
    @path @doc("ExtractionRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search extraction records by patient, provider, extraction type, tooth number, or date range.")
  @operationId("searchExtractionRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchExtractionRecords(
    ...ExtractionRecordSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ExtractionRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Dental pathology specimen management — track oral tissue specimens from collection through laboratory analysis and malignancy reporting.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/oral-surgery/pathology-specimens")
interface DentalPathologyManagement {
  @doc("Create a new dental pathology specimen record.")
  @operationId("createDentalPathologySpecimen")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDentalPathologySpecimen(
    @body body: DentalPathologySpecimen,
  ): {
    @statusCode statusCode: 201;
    @body result: DentalPathologySpecimen;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a dental pathology specimen record by its logical ID.")
  @operationId("getDentalPathologySpecimen")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDentalPathologySpecimen(
    @path @doc("DentalPathologySpecimen logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DentalPathologySpecimen;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a dental pathology specimen record — lab reference, result, or malignancy flag.")
  @operationId("updateDentalPathologySpecimen")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDentalPathologySpecimen(
    @path @doc("DentalPathologySpecimen logical ID") id: UUID,
    @body body: DentalPathologySpecimen,
  ): {
    @statusCode statusCode: 200;
    @body result: DentalPathologySpecimen;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a dental pathology specimen record.")
  @operationId("deleteDentalPathologySpecimen")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDentalPathologySpecimen(
    @path @doc("DentalPathologySpecimen logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search dental pathology specimens by patient, lab status, malignancy detection, or collection date range.")
  @operationId("searchDentalPathologySpecimens")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDentalPathologySpecimens(
    ...DentalPathologySpecimenSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DentalPathologySpecimen>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Post-operative instruction management — issue, track, and search discharge care instructions given to patients after oral surgery.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/oral-surgery/post-op-instructions")
interface PostOpInstructionManagement {
  @doc("Create and issue post-operative instructions for a patient.")
  @operationId("createPostOpInstruction")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPostOpInstruction(
    @body body: PostOpInstruction,
  ): {
    @statusCode statusCode: 201;
    @body result: PostOpInstruction;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a post-operative instruction set by its logical ID.")
  @operationId("getPostOpInstruction")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPostOpInstruction(
    @path @doc("PostOpInstruction logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PostOpInstruction;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a post-operative instruction record — signature status, follow-up date, or additional medications.")
  @operationId("updatePostOpInstruction")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePostOpInstruction(
    @path @doc("PostOpInstruction logical ID") id: UUID,
    @body body: PostOpInstruction,
  ): {
    @statusCode statusCode: 200;
    @body result: PostOpInstruction;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a post-operative instruction record.")
  @operationId("deletePostOpInstruction")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePostOpInstruction(
    @path @doc("PostOpInstruction logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search post-operative instructions by patient, encounter, issuing provider, or signature status.")
  @operationId("searchPostOpInstructions")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPostOpInstructions(
    ...PostOpInstructionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PostOpInstruction>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Healing follow-up management — schedule and document post-operative wound healing assessments with complication detection and escalation tracking.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/oral-surgery/healing-followups")
interface HealingFollowUpManagement {
  @doc("Create a new healing follow-up record.")
  @operationId("createHealingFollowUp")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createHealingFollowUp(
    @body body: HealingFollowUp,
  ): {
    @statusCode statusCode: 201;
    @body result: HealingFollowUp;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a healing follow-up record by its logical ID.")
  @operationId("getHealingFollowUp")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getHealingFollowUp(
    @path @doc("HealingFollowUp logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: HealingFollowUp;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a healing follow-up record — actual date, healing status, findings, or next follow-up date.")
  @operationId("updateHealingFollowUp")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateHealingFollowUp(
    @path @doc("HealingFollowUp logical ID") id: UUID,
    @body body: HealingFollowUp,
  ): {
    @statusCode statusCode: 200;
    @body result: HealingFollowUp;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a healing follow-up record.")
  @operationId("deleteHealingFollowUp")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteHealingFollowUp(
    @path @doc("HealingFollowUp logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search healing follow-ups by patient, procedure, performer, healing status, or scheduled date range.")
  @operationId("searchHealingFollowUps")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchHealingFollowUps(
    ...HealingFollowUpSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<HealingFollowUp>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
