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

namespace Healthcare.Ancillary.Medications;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a medication in the drug catalog.
 */
enum MedicationStatus {
  active,
  inactive,
  enteredInError,
}

/**
 * Lifecycle status of a formulary item.
 */
enum FormularyItemStatus {
  active,
  inactive,
  enteredInError,
}

// ---------------------------------------------------------------------------
// Supporting models – Medication
// ---------------------------------------------------------------------------

/**
 * A component ingredient of a medication product.
 */
model MedicationIngredient {
  /** Coded identification of the ingredient substance. */
  itemCodeableConcept?: CodeableConcept;

  /** Reference to a substance or medication resource for the ingredient. */
  itemReference?: Reference;

  /** Whether the ingredient is an active ingredient or an inactive ingredient. */
  isActive?: boolean;

  /** Strength of the ingredient (numerator/denominator ratio). */
  strength?: Ratio;
}

/**
 * Information about a specific batch lot of medication.
 */
model MedicationBatch {
  /** Manufacturer's lot number for the batch. */
  lotNumber?: string;

  /** Expiration date of this batch. */
  expirationDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Resource model – Medication
// ---------------------------------------------------------------------------

/**
 * This resource is primarily used for the identification and definition of a
 * medication for the purposes of prescribing, dispensing, and administering
 * a medication as well as for making statements about medication use.
 * Aligns with FHIR R4 Medication.
 */
model Medication extends HealthcareBaseEntity {
  /**
   * RxNorm or NDC coded identification of the medication.
   * The code identifies the clinical pharmaceutical product.
   */
  code: CodeableConcept;

  /** Lifecycle status of this medication record in the catalog. */
  status?: MedicationStatus;

  /** Reference to the Organization that manufactures this medication. */
  manufacturer?: Reference;

  /** Dose form (e.g. tablet, capsule, solution, injection). */
  form?: CodeableConcept;

  /** Specific amount of the drug in the packaged product (concentration or amount). */
  amount?: Ratio;

  /** Component ingredients of the medication. */
  ingredient?: MedicationIngredient[];

  /** Batch lot information for this medication product. */
  batch?: MedicationBatch;
}

// ---------------------------------------------------------------------------
// Supporting models – FormularyItem
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Resource model – FormularyItem
// ---------------------------------------------------------------------------

/**
 * An item in a formulary that represents coverage and tier information for
 * a specific medication within an insurance plan.
 */
model FormularyItem extends HealthcareBaseEntity {
  /** Reference to the Medication that is covered by this formulary entry. */
  medication: Reference;

  /** Coverage status of this formulary item. */
  status: FormularyItemStatus;

  /** Reference to the insurance Organization (insurer/payer) that maintains this formulary. */
  organization: Reference;

  /** Formulary tier classification (e.g. generic, preferred-brand, non-preferred-brand). */
  tier?: CodeableConcept;

  /** Whether prior authorization is required before dispensing. */
  priorAuthRequired?: boolean;

  /** Maximum quantity allowed per dispensing event or fill period. */
  quantityLimit?: Quantity;

  /** Whether step therapy (fail-first) requirements apply before this medication may be dispensed. */
  stepTherapyRequired?: boolean;

  /** Whether a therapeutically equivalent generic alternative is available. */
  genericAvailable?: boolean;

  /** Additional coverage or formulary notes. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

/**
 * Payload for creating a new Medication record.
 */
model MedicationCreateRequest {
  ...OmitProperties<Medication, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching Medication resources.
 */
model MedicationSearchParams {
  /** Filter by RxNorm or NDC code value. */
  code?: string;

  /** Filter by dose form code. */
  form?: string;

  /** Filter by manufacturer reference identifier. */
  manufacturer?: string;

  /** Filter by catalog status. */
  status?: MedicationStatus;

  ...PaginationQuery;
}

/**
 * Payload for creating a new FormularyItem record.
 */
model FormularyItemCreateRequest {
  ...OmitProperties<FormularyItem, "id" | "meta" | "createdAt" | "updatedAt">;
}

/**
 * Query parameters for searching FormularyItem resources.
 */
model FormularyItemSearchParams {
  /** Filter by medication reference identifier. */
  medication?: string;

  /** Filter by insurance organization reference identifier. */
  organization?: string;

  /** Filter by formulary item status. */
  status?: FormularyItemStatus;

  /** Filter by tier code. */
  tier?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for the drug catalog (Medication resources).
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface MedicationCatalogManagement {
  /**
   * Create a new medication catalog entry.
   * @param body Medication creation payload.
   * @returns The newly created medication record.
   */
  @post
  @operationId("createMedication")
  create(@body body: MedicationCreateRequest): {
    @statusCode statusCode: 201;
    @body medication: Medication;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a medication catalog entry by its unique identifier.
   * @param id The medication identifier.
   * @returns The requested medication record.
   */
  @get
  @operationId("getMedication")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body medication: Medication;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing medication catalog entry.
   * @param id The medication identifier.
   * @param body Updated medication payload.
   * @returns The updated medication record.
   */
  @put
  @operationId("updateMedication")
  @route("/{id}")
  update(@path id: string, @body body: MedicationCreateRequest): {
    @statusCode statusCode: 200;
    @body medication: Medication;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a medication catalog entry.
   * @param id The medication identifier.
   * @param body Fields to update.
   * @returns The updated medication record.
   */
  @patch
  @operationId("patchMedication")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body medication: Medication;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a medication catalog entry.
   * @param id The medication identifier.
   */
  @delete
  @operationId("deleteMedication")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search medications by code, dose form, manufacturer, or status.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching medication records.
   */
  @get
  @operationId("searchMedications")
  @route("/search")
  search(...MedicationSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<Medication>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for formulary items.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface FormularyManagement {
  /**
   * Create a new formulary item.
   * @param body Formulary item creation payload.
   * @returns The newly created formulary item.
   */
  @post
  @operationId("createFormularyItem")
  create(@body body: FormularyItemCreateRequest): {
    @statusCode statusCode: 201;
    @body formularyItem: FormularyItem;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a formulary item by its unique identifier.
   * @param id The formulary item identifier.
   * @returns The requested formulary item.
   */
  @get
  @operationId("getFormularyItem")
  @route("/{id}")
  read(@path id: string): {
    @statusCode statusCode: 200;
    @body formularyItem: FormularyItem;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing formulary item.
   * @param id The formulary item identifier.
   * @param body Updated formulary item payload.
   * @returns The updated formulary item.
   */
  @put
  @operationId("updateFormularyItem")
  @route("/{id}")
  update(@path id: string, @body body: FormularyItemCreateRequest): {
    @statusCode statusCode: 200;
    @body formularyItem: FormularyItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Partially update a formulary item.
   * @param id The formulary item identifier.
   * @param body Fields to update.
   * @returns The updated formulary item.
   */
  @patch
  @operationId("patchFormularyItem")
  @route("/{id}")
  patch(@path id: string, @body body: Record<unknown>): {
    @statusCode statusCode: 200;
    @body formularyItem: FormularyItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a formulary item.
   * @param id The formulary item identifier.
   */
  @delete
  @operationId("deleteFormularyItem")
  @route("/{id}")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search formulary items by medication, organization, status, or tier.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching formulary items.
   */
  @get
  @operationId("searchFormularyItems")
  @route("/search")
  search(...FormularyItemSearchParams): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<FormularyItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
