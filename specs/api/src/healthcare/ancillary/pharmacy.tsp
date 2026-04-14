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

namespace Healthcare.Ancillary.Pharmacy;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a medication dispense event.
 */
enum MedicationDispenseStatus {
  preparation,
  inProgress,
  cancelled,
  onHold,
  completed,
  enteredInError,
  stopped,
  declined,
  `unknown`: "unknown",
}

/**
 * Severity classification of a drug-drug interaction.
 */
enum InteractionSeverity {
  contraindicated,
  major,
  moderate,
  minor,
  `unknown`: "unknown",
}

// ---------------------------------------------------------------------------
// Supporting models – MedicationDispense
// ---------------------------------------------------------------------------

/**
 * An individual who performed a step in the dispense workflow.
 */
model MedicationDispensePerformer {
  /** Role the actor played (e.g. dataEnterer, finalChecker). */
  function?: CodeableConcept;

  /** Reference to the practitioner or device. */
  actor: Reference;
}

/**
 * Details about whether and why a substitution was made during dispensing.
 */
model DispenseSubstitution {
  /** Whether a substitution was made. */
  wasSubstituted: boolean;

  /** Type of substitution (e.g. therapeutic alternative). */
  type?: CodeableConcept;

  /** Reason(s) the substitution was made. */
  reason?: CodeableConcept[];

  /** Party responsible for the substitution decision. */
  responsibleParty?: Reference[];
}

// ---------------------------------------------------------------------------
// Resource model – MedicationDispense
// ---------------------------------------------------------------------------

/**
 * Indicates that a medication product is to be or has been dispensed to a patient.
 * Aligns with the FHIR R4 MedicationDispense resource.
 */
model MedicationDispense extends HealthcareBaseEntity {
  /** Current lifecycle status of the dispense event. */
  status: MedicationDispenseStatus;

  /** Reason the dispense was not completed (when applicable). */
  statusReason?: CodeableConcept;

  /** Category of the dispense (e.g. inpatient, outpatient, community). */
  category?: CodeableConcept;

  /** RxNorm or NDC coded identification of the medication. */
  medicationCode?: CodeableConcept;

  /** Reference to a Medication resource. */
  medicationReference?: Reference;

  /** Patient for whom the medication is dispensed. */
  subject: Reference;

  /** Clinical encounter associated with this dispense event. */
  encounter?: Reference;

  /** Personnel who performed steps in the dispense workflow. */
  performer?: MedicationDispensePerformer[];

  /** Location where the dispense event occurred. */
  location?: Reference;

  /** MedicationRequest(s) authorising this dispense. */
  authorizingPrescription?: Reference[];

  /** Type of dispense (e.g. trial fill, partial fill, emergency fill). */
  type?: CodeableConcept;

  /** Amount of medication dispensed. */
  quantity?: Quantity;

  /** Number of days supply dispensed. */
  daysSupply?: Quantity;

  /** Date/time the product was packaged and reviewed. */
  whenPrepared?: utcDateTime;

  /** Date/time the product was handed over to the patient. */
  whenHandedOver?: utcDateTime;

  /** Location to which the medication was shipped. */
  destination?: Reference;

  /** Person(s) who picked up the medication. */
  receiver?: Reference[];

  /** Annotations about the dispense event. */
  note?: Annotation[];

  /** Dosage instructions for the patient. */
  dosageInstruction?: Dosage[];

  /** Substitution details. */
  substitution?: DispenseSubstitution;

  /** Lot number of the dispensed medication. */
  lotNumber?: string;

  /** Expiration date of the dispensed medication. */
  expirationDate?: plainDate;

  /** Copay amount collected from the patient. */
  copayAmount?: Money;
}

// ---------------------------------------------------------------------------
// Drug interaction models (non-persisted)
// ---------------------------------------------------------------------------

/**
 * A single identified interaction between two medications.
 */
model DrugInteraction {
  /** First medication involved in the interaction. */
  drugA: CodeableConcept;

  /** Second medication involved in the interaction. */
  drugB: CodeableConcept;

  /** Severity of the interaction. */
  severity: InteractionSeverity;

  /** Description of the interaction mechanism or effect. */
  description: string;

  /** Clinical significance of the interaction. */
  clinicalSignificance: string;

  /** Recommended management strategy for the interaction. */
  managementRecommendation?: string;
}

/**
 * Request and response payload for a drug interaction check.
 * This model is not a persisted resource.
 */
model DrugInteractionCheck {
  /** Medications to check for interactions. */
  medications: CodeableConcept[];

  /** Identified interactions among the supplied medications. */
  interactions: DrugInteraction[];

  /** Date/time the check was performed. */
  checkedAt: utcDateTime;

  /** Identity of the system or user that performed the check. */
  checkedBy: string;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model MedicationDispenseCreateRequest {
  ...OmitProperties<MedicationDispense, "id" | "meta" | "createdAt" | "updatedAt">;
}

model MedicationDispenseSearchParams {
  patientId?: string;
  medication?: string;
  status?: MedicationDispenseStatus;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model DrugInteractionCheckRequest {
  /** Medications to check expressed as RxNorm or NDC codes. */
  medications: CodeableConcept[];
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for medication dispense records.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface MedicationDispenseManagement {
  /**
   * Create a new medication dispense record.
   * @param body Medication dispense creation payload.
   * @returns The newly created medication dispense record.
   */
  @post
  @operationId("createMedicationDispense")
  create(@body body: MedicationDispenseCreateRequest): {
    @statusCode statusCode: 201;
    @body dispense: MedicationDispense;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a medication dispense record by its unique identifier.
   * @param id The medication dispense identifier.
   * @returns The requested medication dispense record.
   */
  @get
  @operationId("getMedicationDispense")
  read(@path id: string): MedicationDispense | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing medication dispense record.
   * @param id The medication dispense identifier.
   * @param body Updated medication dispense payload.
   * @returns The updated medication dispense record.
   */
  @put
  @operationId("updateMedicationDispense")
  update(@path id: string, @body body: MedicationDispenseCreateRequest): MedicationDispense | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a medication dispense record.
   * @param id The medication dispense identifier.
   */
  @delete
  @operationId("deleteMedicationDispense")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search medication dispense records by patient, medication, status, or date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching medication dispense records.
   */
  @get
  @operationId("searchMedicationDispenses")
  search(...MedicationDispenseSearchParams): PaginatedResponse<MedicationDispense> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * Drug-drug interaction checking service.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface DrugInteractionService {
  /**
   * Check a list of medications for known drug-drug interactions.
   * @param body List of medications to check.
   * @returns Interaction check result including all identified interactions.
   */
  @post
  @operationId("checkDrugInteractions")
  check(@body body: DrugInteractionCheckRequest): DrugInteractionCheck | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
