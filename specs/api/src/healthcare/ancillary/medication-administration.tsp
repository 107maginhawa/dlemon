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

namespace Healthcare.Ancillary.MedicationAdministrations;

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

/**
 * An individual who participated in the administration of a medication.
 */
model MedicationAdministrationPerformer {
  /** Role the actor played in the administration (e.g. performer, witness). */
  function?: CodeableConcept;

  /** Reference to the practitioner or device that performed the administration. */
  actor: Reference;
}

/**
 * Details of how the medication was administered.
 */
model MedicationAdministrationDosage {
  /** Free-text description of the dosage and how the medication was administered. */
  text?: string;

  /** Anatomical body site where the medication was administered (SNOMED-CT). */
  site?: CodeableConcept;

  /** Route of administration (e.g. oral, intravenous, topical). */
  route?: CodeableConcept;

  /** Method of administration (e.g. inject, infuse, swallow). */
  method?: CodeableConcept;

  /** Amount of medication administered. */
  dose?: Quantity;

  /** Dose rate expressed as a ratio of dose to time (e.g. 50 mg / hour). */
  rateRatio?: Ratio;

  /** Dose rate expressed as a simple quantity (e.g. 100 mL/hour). */
  rateQuantity?: Quantity;
}

// ---------------------------------------------------------------------------
// Root resource
// ---------------------------------------------------------------------------

/**
 * Describes the event of a patient consuming or otherwise being administered
 * a medication.  Aligns with FHIR R4 MedicationAdministration.
 */
model MedicationAdministration extends HealthcareBaseEntity {
  /** Current lifecycle status of the administration event. */
  status: MedicationAdministrationStatus;

  /** Reason(s) the administration did not take place (when status is notDone). */
  statusReason?: CodeableConcept[];

  /** Category of the administration (e.g. inpatient, outpatient, community, discharge). */
  category?: CodeableConcept;

  /** RxNorm or NDC coded identification of the medication administered. */
  medicationCode?: CodeableConcept;

  /** Reference to a Medication resource describing the drug administered. */
  medicationReference?: Reference;

  /** Reference to the patient who received the administration. */
  subject: Reference;

  /** Clinical encounter associated with this administration event. */
  encounter?: Reference;

  /**
   * Additional clinical information used in the administration
   * (e.g. height, weight, allergies, diagnoses).
   */
  supportingInformation?: Reference[];

  /** Date/time the medication was administered (for instantaneous administrations). (Mutually exclusive with effectivePeriod — exactly one must be provided) */
  effectiveDateTime?: utcDateTime;

  /** Period over which the medication was administered (for infusions/extended administrations). (Mutually exclusive with effectiveDateTime — exactly one must be provided) */
  effectivePeriod?: Period;

  /** Personnel who performed the administration. */
  performer?: MedicationAdministrationPerformer[];

  /** Coded reason(s) for administering the medication (e.g. condition, observation). */
  reasonCode?: CodeableConcept[];

  /** References to conditions or observations that indicate why the medication was administered. */
  reasonReference?: Reference[];

  /** Reference to the authorizing MedicationRequest (prescription). */
  request?: Reference;

  /** Device(s) used in administering the medication. */
  device?: Reference[];

  /** Annotations about the administration event. */
  note?: Annotation[];

  /** Details about how the medication was administered. */
  dosage?: MedicationAdministrationDosage;

  /** References to provenance resources covering changes to the administration record. */
  eventHistory?: Reference[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new MedicationAdministration record.
 */
model MedicationAdministrationCreateRequest {
  ...OmitProperties<MedicationAdministration, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching MedicationAdministration resources.
 */
model MedicationAdministrationSearchParams {
  /** Filter by patient (subject) reference identifier. */
  patientId?: string;

  /** Filter by medication code or reference identifier. */
  medication?: string;

  /** Filter by administration status. */
  status?: MedicationAdministrationStatus;

  /** Earliest effective date/time of administration. */
  dateFrom?: utcDateTime;

  /** Latest effective date/time of administration. */
  dateTo?: utcDateTime;

  /** Filter by performer reference identifier. */
  performer?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for MedicationAdministration resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface MedicationAdministrationManagement {
  /**
   * Create a new medication administration record.
   * @param body Medication administration creation payload.
   * @returns The newly created medication administration record.
   */
  @post
  @operationId("createMedicationAdministration")
  create(@body body: MedicationAdministrationCreateRequest): {
    @statusCode statusCode: 201;
    @body administration: MedicationAdministration;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a medication administration record by its unique identifier.
   * @param id The medication administration identifier.
   * @returns The requested medication administration record.
   */
  @get
  @operationId("getMedicationAdministration")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body administration: MedicationAdministration;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing medication administration record.
   * @param id The medication administration identifier.
   * @param body Updated medication administration payload.
   * @returns The updated medication administration record.
   */
  @put
  @operationId("updateMedicationAdministration")
  @route("/{id}")
  update(@path id: string, @body body: MedicationAdministrationCreateRequest): {
    @statusCode statusCode: 200;
    @body administration: MedicationAdministration;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a medication administration record.
   * @param id The medication administration identifier.
   * @param body Fields to update.
   * @returns The updated medication administration record.
   */
  @patch
  @operationId("patchMedicationAdministration")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body administration: MedicationAdministration;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a medication administration record.
   * @param id The medication administration identifier.
   */
  @delete
  @operationId("deleteMedicationAdministration")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search medication administration records by patient, medication, status, date range, or performer.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching medication administration records.
   */
  @get
  @operationId("searchMedicationAdministrations")
  @route("/search")
  search(...MedicationAdministrationSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MedicationAdministration>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
