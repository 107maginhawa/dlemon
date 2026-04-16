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
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
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
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("getMedicationDispense")
  read(@path id: string): MedicationDispense | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing medication dispense record.
   * @param id The medication dispense identifier.
   * @param body Updated medication dispense payload.
   * @returns The updated medication dispense record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @put
  @operationId("updateMedicationDispense")
  update(@path id: string, @body body: MedicationDispenseCreateRequest): MedicationDispense | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a medication dispense record.
   * @param id The medication dispense identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
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
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
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
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @post
  @operationId("checkDrugInteractions")
  check(@body body: DrugInteractionCheckRequest): DrugInteractionCheck | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

// ---------------------------------------------------------------------------
// Enumerations – Medication Reconciliation
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a medication reconciliation event.
 */
enum ReconciliationStatus {
  inProgress,
  completed,
  cancelled,
}

/**
 * The care transition that triggered the reconciliation.
 */
enum ReconciliationType {
  admission,
  discharge,
  transfer,
}

/**
 * Prior use status of a medication during a reconciliation review.
 */
enum ReconciliationMedStatus {
  active,
  discontinued,
  changed,
  noChange,
  `new`: "new",
}

/**
 * Action to be taken on a medication as a result of reconciliation.
 */
enum ReconciliationAction {
  `continue`,
  discontinue,
  modify,
  add,
  hold,
}

/**
 * The method by which medication adherence data was collected.
 */
enum AdherenceSource {
  selfReport,
  deviceMonitoring,
  pharmacyRefill,
  clinicianAssessment,
}

// ---------------------------------------------------------------------------
// Supporting models – Reconciliation
// ---------------------------------------------------------------------------

/**
 * A single medication line item reviewed during a reconciliation encounter.
 */
model ReconciliationItem {
  /** Coded identification of the medication under review. */
  medication: CodeableConcept;

  /** Use status of the medication prior to this reconciliation. */
  priorStatus: ReconciliationMedStatus;

  /** Clinical decision/action determined for this medication. */
  action: ReconciliationAction;

  /** Reference to a new or modified MedicationRequest created as a result of this action. */
  newMedicationRequest?: Reference;

  /** Rationale for the action taken. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Resource model – MedicationReconciliation
// ---------------------------------------------------------------------------

/**
 * A structured review of a patient's complete medication list at a point of
 * care transition (admission, discharge, or transfer) to identify and resolve
 * discrepancies.
 */
model MedicationReconciliation extends HealthcareBaseEntity {
  /** Current lifecycle status of the reconciliation. */
  status: ReconciliationStatus;

  /** Reference to the patient whose medications are being reconciled. */
  patient: Reference;

  /** Clinical encounter during which the reconciliation occurred. */
  encounter?: Reference;

  /** Practitioner who performed the reconciliation. */
  performer: Reference;

  /** Date/time the reconciliation was performed. */
  performedAt: utcDateTime;

  /** Type of care transition that triggered the reconciliation. */
  type: ReconciliationType;

  /** Individual medication line items reviewed and adjudicated. */
  items: ReconciliationItem[];

  /** Annotations about the reconciliation event. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Resource model – AdherenceRecord
// ---------------------------------------------------------------------------

/**
 * A measure of how consistently a patient takes their prescribed medications
 * over a defined period.
 */
model AdherenceRecord extends HealthcareBaseEntity {
  /** Reference to the patient whose adherence is recorded. */
  patient: Reference;

  /** Reference to the medication (Medication resource or MedicationRequest). */
  medication: Reference;

  /** Period over which adherence was measured. */
  period: Period;

  /**
   * Calculated adherence rate expressed as a proportion between 0.0 (completely
   * non-adherent) and 1.0 (fully adherent).
   */
  adherenceRate?: float64;

  /** Number of doses missed during the measurement period. */
  missedDoses?: int32;

  /** Total number of doses expected during the measurement period. */
  totalDoses?: int32;

  /** Method by which adherence data was collected. */
  source: AdherenceSource;

  /** Annotations about the adherence measurement. */
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers – Reconciliation
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new MedicationReconciliation record.
 */
model MedicationReconciliationCreateRequest {
  ...OmitProperties<MedicationReconciliation, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching MedicationReconciliation resources.
 */
model MedicationReconciliationSearchParams {
  /** Filter by patient reference identifier. */
  patientId?: string;

  /** Filter by encounter reference identifier. */
  encounterId?: string;

  /** Filter by reconciliation type. */
  type?: ReconciliationType;

  /** Filter by lifecycle status. */
  status?: ReconciliationStatus;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interface – Reconciliation
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for MedicationReconciliation resources.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface ReconciliationManagement {
  /**
   * Create a new medication reconciliation record.
   * @param body Medication reconciliation creation payload.
   * @returns The newly created medication reconciliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @post
  @operationId("createMedicationReconciliation")
  create(@body body: MedicationReconciliationCreateRequest): {
    @statusCode statusCode: 201;
    @body reconciliation: MedicationReconciliation;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a medication reconciliation record by its unique identifier.
   * @param id The medication reconciliation identifier.
   * @returns The requested medication reconciliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("getMedicationReconciliation")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body reconciliation: MedicationReconciliation;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing medication reconciliation record.
   * @param id The medication reconciliation identifier.
   * @param body Updated medication reconciliation payload.
   * @returns The updated medication reconciliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @put
  @operationId("updateMedicationReconciliation")
  @route("/{id}")
  update(@path id: string, @body body: MedicationReconciliationCreateRequest): {
    @statusCode statusCode: 200;
    @body reconciliation: MedicationReconciliation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a medication reconciliation record.
   * @param id The medication reconciliation identifier.
   * @param body Fields to update.
   * @returns The updated medication reconciliation record.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @patch
  @operationId("patchMedicationReconciliation")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body reconciliation: MedicationReconciliation;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a medication reconciliation record.
   * @param id The medication reconciliation identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @delete
  @operationId("deleteMedicationReconciliation")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search medication reconciliation records by patient, encounter, type, or status.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching medication reconciliation records.
   */
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @operationId("searchMedicationReconciliations")
  @route("/search")
  search(...MedicationReconciliationSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MedicationReconciliation>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
interface AdherenceManagement {
  @doc("Record a medication adherence assessment.")
  @operationId("createAdherenceRecord")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @post
  create(
    @body body: AdherenceRecord
  ): {
    @statusCode statusCode: 201;
    @body body: AdherenceRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Get an adherence record by ID.")
  @operationId("getAdherenceRecord")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @route("/{id}")
  get(
    @path id: UUID
  ): {
    @statusCode statusCode: 200;
    @body body: AdherenceRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse;

  @doc("Search adherence records.")
  @operationId("searchAdherenceRecords")
  @extension("x-security-required-roles", #["admin", "clinician", "pharmacist"])
  @get
  @route("/search")
  search(
    @query patient?: string,
    @query medication?: string,
    ...PaginationQuery
  ): {
    @statusCode statusCode: 200;
    @body body: PaginatedResponse<AdherenceRecord>;
  } | ApiUnauthorizedResponse | ApiForbiddenResponse;
}
