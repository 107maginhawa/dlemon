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
 * Healthcare Inventory Management module.
 *
 * Provides models and operations for tracking medical supply inventory,
 * batch/lot management, storage locations, and supply consumption records.
 * Supports full inventory lifecycle from receipt through consumption or expiry.
 */
namespace Healthcare.Operational.Inventory;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The status of an inventory batch or lot.")
enum BatchStatus {
  @doc("The batch is available for use")
  available,

  @doc("The batch is under quarantine and should not be used pending investigation")
  quarantine,

  @doc("The batch has passed its expiration date")
  expired,

  @doc("The batch has been recalled by the manufacturer or a regulatory body")
  recalled,

  @doc("All units of the batch have been consumed")
  consumed,
}

@doc("The type of a storage location.")
enum StorageLocationType {
  @doc("A central warehouse for bulk storage of supplies")
  warehouse,

  @doc("A pharmacy where medications and related supplies are stored")
  pharmacy,

  @doc("A clinical area such as a ward or outpatient department")
  clinic,

  @doc("An operating room or surgical suite")
  operatingRoom,

  @doc("A laboratory where specimens and reagents are stored")
  laboratory,

  @doc("A blood bank for storage of blood products")
  bloodBank,

  @doc("A storage location type not covered by other enumerations")
  other,
}

// ---------------------------------------------------------------------------
// Root resource — InventoryItem
// ---------------------------------------------------------------------------

/**
 * A physical item managed within the facility inventory, such as a medication,
 * medical device, or consumable supply.
 */
model InventoryItem extends HealthcareBaseEntity {
  /** The operational status of the inventory item. */
  status: InventoryItemStatus;

  /** A code that identifies the item. */
  code: CodeableConcept;

  /** The human-friendly name of the inventory item. */
  name: string;

  /** A description of the inventory item providing additional context. */
  description?: string;

  /** Category or classification of the item (e.g., medication, consumable, equipment). */
  category?: CodeableConcept[];

  /** The organisation that manufactures the item. */
  manufacturer?: Reference;

  /** The unit of measure used for the item (e.g., each, box, vial). */
  unitOfMeasure?: CodeableConcept;

  /** The current quantity on hand at the primary location. */
  currentQuantity?: Quantity;

  /** The quantity level at which a reorder should be triggered. */
  reorderLevel?: Quantity;

  /** The quantity that should be ordered when the reorder level is reached. */
  reorderQuantity?: Quantity;

  /** The storage location where this item is primarily kept. */
  storageLocation?: Reference;

  /** The unit cost of the item. */
  cost?: Money;

  /** The expiration date applicable to the current stock (for items without a specific batch). */
  expirationDate?: plainDate;

  /** The lot or batch number for the current stock (for items without a specific batch record). */
  lotNumber?: string;

  /** The serial number of this specific item instance (for serialised items). */
  serialNumber?: string;
}

// ---------------------------------------------------------------------------
// Root resource — InventoryBatch
// ---------------------------------------------------------------------------

/**
 * A specific lot or batch of an inventory item with traceability information
 * including expiration date and current quantity.
 */
model InventoryBatch extends HealthcareBaseEntity {
  /** Reference to the inventory item this batch belongs to. */
  item: Reference;

  /** The manufacturer's lot or batch number. */
  lotNumber: string;

  /** The date after which this batch should not be used. */
  expirationDate?: plainDate;

  /** The current quantity of this batch remaining in stock. */
  quantity: Quantity;

  /** The date on which this batch was manufactured. */
  manufacturingDate?: plainDate;

  /** The current status of this batch. */
  status: BatchStatus;
}

// ---------------------------------------------------------------------------
// Root resource — StorageLocation
// ---------------------------------------------------------------------------

/**
 * A physical location where inventory items are stored within the healthcare
 * facility. Locations can be nested to represent hierarchical storage
 * (e.g., building > floor > room > shelf).
 */
model StorageLocation extends HealthcareBaseEntity {
  /** The human-friendly name of this storage location. */
  name: string;

  /** The type of storage location. */
  type: StorageLocationType;

  /** A reference to a parent storage location, enabling hierarchical nesting. */
  parentLocation?: Reference;

  /** The organisation responsible for managing this storage location. */
  managingOrganization: Reference;

  /** The acceptable temperature range for items stored at this location (e.g., "2-8°C"). */
  temperatureRange?: string;

  /** Any special storage conditions required at this location (e.g., light-sensitive, flammable). */
  specialConditions?: string[];
}

// ---------------------------------------------------------------------------
// Root resource — SupplyConsumption
// ---------------------------------------------------------------------------

/**
 * Records the consumption or use of an inventory item, creating an auditable
 * trail of supply utilisation linked to patients, encounters, and practitioners.
 */
model SupplyConsumption extends HealthcareBaseEntity {
  /** The inventory item that was consumed. */
  item: Reference;

  /** The specific batch from which the item was consumed, if tracked. */
  batch?: Reference;

  /** The quantity of the item consumed. */
  quantity: Quantity;

  /** The patient for whom the item was consumed, if applicable. */
  patient?: Reference;

  /** The clinical encounter during which the item was consumed, if applicable. */
  encounter?: Reference;

  /** The practitioner or staff member who performed or recorded the consumption. */
  performer: Reference;

  /** The date and time at which the item was consumed. */
  consumedAt: utcDateTime;

  /** The location at which the item was consumed. */
  location?: Reference;

  /** The reason for consumption (e.g., procedure, treatment). */
  reason?: CodeableConcept;

  /** Additional free-text notes about the consumption event. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

/** Query parameters for searching InventoryItem resources. */
model InventoryItemSearchParams {
  /** Filter by item name (partial match). */
  @query name?: string;

  /** Filter by status. */
  @query status?: string;

  /** Filter by category code. */
  @query category?: string;

  /** Filter by storage location id. */
  @query storageLocation?: string;

  /** Filter by manufacturer reference id. */
  @query manufacturer?: string;

  ...PaginationQuery;
}

/** Query parameters for searching InventoryBatch resources. */
model InventoryBatchSearchParams {
  /** Filter by inventory item reference id. */
  @query item?: string;

  /** Filter by lot number (partial match). */
  @query lotNumber?: string;

  /** Filter by batch status. */
  @query status?: string;

  /** Filter by expiration date (ISO 8601; batches expiring on or before this date). */
  @query expiresOnOrBefore?: string;

  ...PaginationQuery;
}

/** Query parameters for searching SupplyConsumption resources. */
model SupplyConsumptionSearchParams {
  /** Filter by inventory item reference id. */
  @query item?: string;

  /** Filter by patient reference id. */
  @query patient?: string;

  /** Filter by encounter reference id. */
  @query encounter?: string;

  /** Filter by performer reference id. */
  @query performer?: string;

  /** Filter by location reference id. */
  @query location?: string;

  /** Filter by consumed date (ISO 8601 date; inclusive start). */
  @query consumedFrom?: string;

  /** Filter by consumed date (ISO 8601 date; inclusive end). */
  @query consumedTo?: string;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for InventoryItem resources.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface InventoryManagement {
  /** Create a new InventoryItem. */
  @post
  @operationId("createInventoryItem")
  create(
    @body body: InventoryItem,
  ): {
    @statusCode statusCode: 201;
    @body inventoryItem: InventoryItem;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single InventoryItem by id. */
  @get
  @operationId("getInventoryItem")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body inventoryItem: InventoryItem;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing InventoryItem. */
  @put
  @operationId("updateInventoryItem")
  @route("/{id}")
  update(
    @path id: string,
    @body body: InventoryItem,
  ): {
    @statusCode statusCode: 200;
    @body inventoryItem: InventoryItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update an InventoryItem. */
  @patch
  @operationId("patchInventoryItem")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body inventoryItem: InventoryItem;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete an InventoryItem by id. */
  @delete
  @operationId("deleteInventoryItem")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for InventoryItems using filter parameters. */
  @get
  @operationId("searchInventoryItems")
  @route("/search")
  search(
    ...InventoryItemSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InventoryItem>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for InventoryBatch resources.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface BatchManagement {
  /** Create a new InventoryBatch. */
  @post
  @operationId("createInventoryBatch")
  create(
    @body body: InventoryBatch,
  ): {
    @statusCode statusCode: 201;
    @body inventoryBatch: InventoryBatch;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single InventoryBatch by id. */
  @get
  @operationId("getInventoryBatch")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body inventoryBatch: InventoryBatch;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Replace an existing InventoryBatch. */
  @put
  @operationId("updateInventoryBatch")
  @route("/{id}")
  update(
    @path id: string,
    @body body: InventoryBatch,
  ): {
    @statusCode statusCode: 200;
    @body inventoryBatch: InventoryBatch;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Partially update an InventoryBatch. */
  @patch
  @operationId("patchInventoryBatch")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body inventoryBatch: InventoryBatch;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Delete an InventoryBatch by id. */
  @delete
  @operationId("deleteInventoryBatch")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for InventoryBatches using filter parameters. */
  @get
  @operationId("searchInventoryBatches")
  @route("/search")
  search(
    ...InventoryBatchSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<InventoryBatch>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * Create and search operations for SupplyConsumption records.
 * Consumption records are append-only; updates and deletions are not permitted
 * to preserve audit integrity.
 */
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
interface SupplyConsumptionManagement {
  /** Record a new SupplyConsumption event. */
  @post
  @operationId("createSupplyConsumption")
  create(
    @body body: SupplyConsumption,
  ): {
    @statusCode statusCode: 201;
    @body supplyConsumption: SupplyConsumption;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Retrieve a single SupplyConsumption record by id. */
  @get
  @operationId("getSupplyConsumption")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body supplyConsumption: SupplyConsumption;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /** Search for SupplyConsumption records using filter parameters. */
  @get
  @operationId("searchSupplyConsumptions")
  @route("/search")
  search(
    ...SupplyConsumptionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<SupplyConsumption>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
