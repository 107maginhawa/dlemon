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

/**
 * Blood Bank Management — complete blood bank information system (BBIS) support
 * covering blood product inventory, crossmatch testing, and transfusion administration
 * documentation.
 *
 * Designed to support AABB standards and ISBT 128 traceability requirements for
 * the full chain of custody from donation to transfusion.
 */
namespace Healthcare.Ancillary.BloodBank;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("ABO blood group type.")
enum BloodGroup {
  @doc("Blood group A")
  A,

  @doc("Blood group B")
  B,

  @doc("Blood group AB — universal plasma recipient")
  AB,

  @doc("Blood group O — universal red cell donor")
  O,
}

@doc("Rhesus (Rh) factor status.")
enum RhFactor {
  @doc("Rh positive (D antigen present)")
  positive,

  @doc("Rh negative (D antigen absent)")
  negative,
}

@doc("The type of blood product unit.")
enum BloodProductType {
  @doc("Whole blood — unprocessed donated blood including all components")
  wholeBlood,

  @doc("Packed red blood cells — concentrated erythrocytes for anaemia or haemorrhage")
  packedRBC,

  @doc("Platelet concentrate — for thrombocytopenia or platelet dysfunction")
  platelets,

  @doc("Fresh frozen plasma — for coagulation factor replacement")
  freshFrozenPlasma,

  @doc("Cryoprecipitate — concentrated fibrinogen, factor VIII, vWF for haemostasis")
  cryoprecipitate,

  @doc("Albumin solution — for volume expansion and hypoalbuminaemia")
  albumin,

  @doc("Intravenous immunoglobulin (IVIG) — for immunodeficiency and autoimmune indications")
  immunoglobulin,
}

@doc("Current inventory and lifecycle status of a blood product unit.")
enum BloodProductStatus {
  @doc("The unit is in stock and available for reservation or crossmatch")
  available,

  @doc("The unit is reserved for a specific patient but crossmatch has not been completed")
  reserved,

  @doc("The unit has been crossmatched against a specific patient's sample")
  crossmatched,

  @doc("The unit has been issued to the ward or operating room")
  issued,

  @doc("The unit has been successfully administered to the patient")
  transfused,

  @doc("The unit has reached its expiration date and is no longer usable")
  expired,

  @doc("The unit has been recalled due to donor deferral or infectious disease lookback")
  recalled,

  @doc("The unit has been discarded (e.g., visual inspection failure, bag damage)")
  discarded,

  @doc("The unit is under quarantine pending confirmatory testing")
  quarantine,
}

@doc("Status of a crossmatch request.")
enum CrossmatchStatus {
  @doc("The crossmatch has been ordered and is awaiting the patient blood sample")
  ordered,

  @doc("Testing is in progress in the transfusion laboratory")
  testing,

  @doc("The crossmatch is complete and the unit is compatible with the patient")
  compatible,

  @doc("The crossmatch identified incompatibility; the unit cannot be issued to this patient")
  incompatible,

  @doc("The crossmatch request was cancelled before testing was completed")
  cancelled,
}

@doc("Clinical severity classification of a transfusion reaction event.")
enum TransfusionReactionSeverity {
  @doc("No adverse reaction occurred during or after the transfusion")
  none,

  @doc("Mild reaction (e.g., urticaria, localised itching) not requiring treatment beyond antihistamine")
  mild,

  @doc("Moderate reaction (e.g., fever, rigors, hypertension) requiring medical intervention")
  moderate,

  @doc("Severe reaction (e.g., hypotension, bronchospasm, haemolysis) requiring urgent treatment")
  severe,

  @doc("Life-threatening reaction (e.g., anaphylaxis, TRALI, severe haemolysis) requiring resuscitation")
  lifeThreatening,
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

@doc("A blood product unit tracked from receipt through transfusion or disposal. Implements ISBT 128 traceability with unit number, expiry, and chain-of-custody status.")
model BloodProduct extends HealthcareBaseEntity {
  @doc("Type of blood product")
  productType: BloodProductType;

  @doc("ABO blood group of this unit")
  bloodGroup: BloodGroup;

  @doc("Rhesus factor of this unit")
  rhFactor: RhFactor;

  @doc("ISBT 128 donation identification number or other facility unit number for traceability")
  unitNumber: string;

  @doc("Date and time the unit was collected or manufactured")
  collectionDate: utcDateTime;

  @doc("Expiration date and time after which the unit must not be used")
  expirationDate: utcDateTime;

  @doc("Volume of the unit")
  volume: Quantity;

  @doc("Current inventory and lifecycle status of this unit")
  status: BloodProductStatus;

  @doc("Anonymised donor reference for lookback investigations (not a FHIR Reference — stored as an opaque string to protect donor privacy)")
  donorReference?: string;

  @doc("Reference to the blood supplier facility or collection centre (Organization resource)")
  facility?: Reference;

  @doc("Whether this unit has been irradiated to prevent transfusion-associated graft-versus-host disease (TA-GvHD)")
  irradiated?: boolean;

  @doc("Whether leucocytes have been removed by filtration to reduce febrile non-haemolytic reactions and CMV transmission risk")
  leukocyteReduced?: boolean;

  @doc("Whether this unit has been confirmed negative for cytomegalovirus (CMV)")
  cmvNegative?: boolean;

  @doc("Clinical notes about this unit (e.g., special processing instructions, discrepancy reports)")
  note?: Annotation[];
}

@doc("A crossmatch request linking a specific blood product unit to a patient for compatibility testing. Tracks the complete crossmatch workflow from order through result.")
model CrossmatchRequest extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom compatibility is being tested")
  patient: Reference;

  @doc("Reference to the associated Encounter (admission or outpatient visit)")
  encounter?: Reference;

  @doc("Reference to the BloodProduct unit being crossmatched")
  bloodProduct: Reference;

  @doc("Reference to the Practitioner who ordered the crossmatch")
  requestedBy: Reference;

  @doc("Date and time the crossmatch was ordered")
  requestedAt: utcDateTime;

  @doc("Current status of the crossmatch testing workflow")
  status: CrossmatchStatus;

  @doc("Crossmatch test method used (e.g., immediate spin, gel technique, electronic crossmatch)")
  testMethod?: CodeableConcept;

  @doc("Crossmatch result narrative or coded result")
  result?: string;

  @doc("Date and time the crossmatch testing was completed")
  completedAt?: utcDateTime;

  @doc("Reference to the Practitioner (transfusion scientist) who completed the crossmatch")
  completedBy?: Reference;
}

@doc("A transfusion administration record documenting a single blood product transfusion event, including pre-, during-, and post-transfusion vital signs and any adverse reaction documentation.")
model TransfusionRecord extends HealthcareBaseEntity {
  @doc("Reference to the Patient who received the transfusion")
  patient: Reference;

  @doc("Reference to the Encounter during which the transfusion was administered")
  encounter: Reference;

  @doc("Reference to the BloodProduct unit that was transfused")
  bloodProduct: Reference;

  @doc("Reference to the Practitioner who ordered the transfusion")
  orderedBy: Reference;

  @doc("Reference to the Practitioner or nurse who administered the transfusion")
  administeredBy: Reference;

  @doc("Date and time when the transfusion was started")
  startTime: utcDateTime;

  @doc("Date and time when the transfusion was completed or stopped")
  endTime?: utcDateTime;

  @doc("Actual volume of product administered (may be less than the full unit volume if the transfusion was stopped)")
  volumeAdministered?: Quantity;

  @doc("Reference to the Observation resource containing pre-transfusion vital signs")
  vitalSignsBeforeTransfusion?: Reference;

  @doc("Reference to the Observation resource containing vital signs recorded during the transfusion")
  vitalSignsDuringTransfusion?: Reference;

  @doc("Reference to the Observation resource containing post-transfusion vital signs")
  vitalSignsAfterTransfusion?: Reference;

  @doc("Severity of any adverse reaction that occurred")
  reactionSeverity: TransfusionReactionSeverity;

  @doc("Coded type of transfusion reaction (e.g., febrile non-haemolytic, allergic, TRALI, haemolytic)")
  reactionType?: CodeableConcept;

  @doc("Date and time when the adverse reaction was first observed")
  reactionOnset?: utcDateTime;

  @doc("Free-text description of interventions performed in response to an adverse reaction (e.g., 'Transfusion stopped. Antihistamine 25mg IV administered.')")
  interventions?: string;

  @doc("Whether the transfusion was stopped before the full volume was administered")
  stopped: boolean;

  @doc("Reason for stopping the transfusion before completion (e.g., adverse reaction, patient refusal, technical issue)")
  stoppedReason?: string;

  @doc("Nursing and clinical notes associated with this transfusion event")
  note?: Annotation[];
}

// ---------------------------------------------------------------------------
// Search Parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for blood product inventory queries.")
model BloodProductSearchParams {
  @doc("Filter by product type")
  @query
  productType?: BloodProductType;

  @doc("Filter by blood group")
  @query
  bloodGroup?: BloodGroup;

  @doc("Filter by Rh factor")
  @query
  rhFactor?: RhFactor;

  @doc("Filter by current inventory status")
  @query
  status?: BloodProductStatus;

  @doc("Filter units expiring at or before this date-time (for near-expiry sweeps)")
  @query
  expiringBefore?: utcDateTime;

  @doc("Filter by supplier facility reference ID")
  @query
  facility?: string;

  ...OffsetPaginationParams;
}

@doc("Search parameters for transfusion record queries.")
model TransfusionSearchParams {
  @doc("Filter by patient reference ID")
  @query
  patient?: string;

  @doc("Filter by encounter reference ID")
  @query
  encounter?: string;

  @doc("Filter transfusions started at or after this date-time")
  @query
  dateFrom?: utcDateTime;

  @doc("Filter transfusions started at or before this date-time")
  @query
  dateTo?: utcDateTime;

  @doc("Filter by reaction severity")
  @query
  reactionSeverity?: TransfusionReactionSeverity;

  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Blood product inventory management — tracks units from receipt through transfusion or disposal with full ISBT 128 traceability.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/blood-bank/products")
interface BloodProductManagement {
  @doc("Register a new blood product unit in the inventory. Typically called when units are received from the blood supplier or collected on-site.")
  @operationId("createBloodProduct")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createBloodProduct(
    @body body: BloodProduct,
  ): {
    @statusCode statusCode: 201;
    @body result: BloodProduct;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiConflictResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a blood product unit by its logical ID.")
  @operationId("getBloodProduct")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getBloodProduct(
    @path @doc("BloodProduct logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: BloodProduct;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a blood product unit record. Use to update status, record processing (irradiation, leukoreduction), or add notes.")
  @operationId("updateBloodProduct")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateBloodProduct(
    @path @doc("BloodProduct logical ID") id: UUID,
    @body body: BloodProduct,
  ): {
    @statusCode statusCode: 200;
    @body result: BloodProduct;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Remove a blood product unit from the inventory. Should only be used for data entry errors; for expired or discarded units, update the status field instead.")
  @operationId("deleteBloodProduct")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteBloodProduct(
    @path @doc("BloodProduct logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search blood product inventory with filters for type, blood group, Rh factor, status, and expiry date. Supports near-expiry sweeps and compatibility searches.")
  @operationId("searchBloodProducts")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchBloodProducts(
    ...BloodProductSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<BloodProduct>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Crossmatch request management — order, track, and record the results of pre-transfusion compatibility testing.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/blood-bank/crossmatches")
interface CrossmatchManagement {
  @doc("Order a crossmatch between a blood product unit and a patient sample.")
  @operationId("createCrossmatch")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createCrossmatch(
    @body body: CrossmatchRequest,
  ): {
    @statusCode statusCode: 201;
    @body result: CrossmatchRequest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a crossmatch request by its logical ID.")
  @operationId("getCrossmatch")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getCrossmatch(
    @path @doc("CrossmatchRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: CrossmatchRequest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a crossmatch request — typically to record the test result and completion details.")
  @operationId("updateCrossmatch")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateCrossmatch(
    @path @doc("CrossmatchRequest logical ID") id: UUID,
    @body body: CrossmatchRequest,
  ): {
    @statusCode statusCode: 200;
    @body result: CrossmatchRequest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Cancel a crossmatch request that is no longer needed.")
  @operationId("deleteCrossmatch")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @route("/{id}")
  deleteCrossmatch(
    @path @doc("CrossmatchRequest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search crossmatch requests by patient, blood product, or status.")
  @operationId("searchCrossmatches")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchCrossmatches(
    ...PaginationQuery,
    @doc("Filter by patient reference ID") @query patient?: string,
    @doc("Filter by blood product reference ID") @query bloodProduct?: string,
    @doc("Filter by crossmatch status") @query status?: CrossmatchStatus,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<CrossmatchRequest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Transfusion administration record management — document the complete transfusion event including vital signs and adverse reaction reporting.")
@tag("Healthcare:Ancillary")
@useAuth(bearerAuth)
@route("/blood-bank/transfusions")
interface TransfusionManagement {
  @doc("Create a new transfusion record when a blood product administration is initiated.")
  @operationId("createTransfusionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createTransfusionRecord(
    @body body: TransfusionRecord,
  ): {
    @statusCode statusCode: 201;
    @body result: TransfusionRecord;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a transfusion record by its logical ID.")
  @operationId("getTransfusionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getTransfusionRecord(
    @path @doc("TransfusionRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: TransfusionRecord;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a transfusion record — use to record end time, volume administered, vital signs references, and adverse reaction details.")
  @operationId("updateTransfusionRecord")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateTransfusionRecord(
    @path @doc("TransfusionRecord logical ID") id: UUID,
    @body body: TransfusionRecord,
  ): {
    @statusCode statusCode: 200;
    @body result: TransfusionRecord;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a transfusion record. Reserved for data entry errors only; adverse events must be retained for haemovigilance reporting.")
  @operationId("deleteTransfusionRecord")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteTransfusionRecord(
    @path @doc("TransfusionRecord logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search transfusion records by patient, encounter, date range, or reaction severity. Essential for haemovigilance reporting and adverse event surveillance.")
  @operationId("searchTransfusionRecords")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchTransfusionRecords(
    ...TransfusionSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<TransfusionRecord>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
