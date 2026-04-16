import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../common/models.tsp";
import "../../../common/errors.tsp";
import "../../../common/pagination.tsp";
import "../../../common/security.tsp";
import "../../core/primitives.tsp";
import "../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Healthcare Clinical Wound Care — structured wound assessment, treatment
 * documentation, and wound care order management for inpatient and
 * outpatient wound care programmes, including pressure injuries, surgical
 * wounds, diabetic ulcers, and burns.
 */
namespace Healthcare.Clinical.Hospital.WoundCare;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("The aetiology or classification of the wound.")
enum WoundType {
  @doc("Pressure injury caused by sustained mechanical load on skin and underlying tissue")
  pressure,

  @doc("Wound resulting from a surgical incision or procedure")
  surgical,

  @doc("Wound resulting from an accidental physical injury")
  traumatic,

  @doc("Venous insufficiency ulcer, typically on the lower leg")
  venous,

  @doc("Arterial insufficiency ulcer caused by reduced peripheral blood flow")
  arterial,

  @doc("Neuropathic or ischaemic ulcer associated with diabetes mellitus")
  diabetic,

  @doc("Thermal, chemical, electrical, or radiation burn injury")
  burn,

  @doc("Wound type not captured by the other categories")
  other,
}

@doc("The NPUAP/EPUAP pressure injury staging classification.")
enum WoundStage {
  @doc("Stage I — non-blanchable erythema of intact skin")
  stageI,

  @doc("Stage II — partial-thickness skin loss with exposed dermis")
  stageII,

  @doc("Stage III — full-thickness skin loss with visible adipose tissue")
  stageIII,

  @doc("Stage IV — full-thickness skin and tissue loss with exposed bone, tendon, or muscle")
  stageIV,

  @doc("Unstageable — full-thickness loss with base obscured by slough or eschar")
  unstageable,

  @doc("Suspected deep tissue injury — persistent non-blanchable deep red, maroon, or purple discolouration")
  deepTissue,
}

@doc("The predominant wound bed tissue type observed during assessment.")
enum WoundBedDescription {
  @doc("Granulation tissue — moist, beefy-red, granular appearance indicating healing")
  granulation,

  @doc("Slough — yellow, tan, or green moist necrotic tissue")
  slough,

  @doc("Eschar — dry, leathery, or hard black or brown devitalised tissue")
  eschar,

  @doc("Epithelialization — new epithelial tissue migrating across the wound surface")
  epithelialization,

  @doc("Mixed wound bed with more than one tissue type present")
  mixed,
}

@doc("The amount of wound exudate produced.")
enum ExudateDescription {
  @doc("No exudate visible on dressing removal")
  none,

  @doc("Scant amount — dressing is less than 25% saturated")
  scant,

  @doc("Small amount — dressing is 25–50% saturated")
  small,

  @doc("Moderate amount — dressing is 50–75% saturated")
  moderate,

  @doc("Large amount — dressing is greater than 75% saturated")
  large,
}

@doc("The clinical status of a wound care order.")
enum ClinicalOrderStatus {
  @doc("The order has been drafted and not yet activated")
  draft,

  @doc("The order is active and should be followed")
  active,

  @doc("The order has been fulfilled")
  completed,

  @doc("The order has been discontinued before completion")
  discontinued,
}

// ---------------------------------------------------------------------------
// Resource models
// ---------------------------------------------------------------------------

@doc("A structured wound assessment documenting the clinical characteristics of a wound at a specific point in time.")
model WoundAssessment extends HealthcareBaseEntity {
  @doc("The patient whose wound was assessed")
  patient: Reference;

  @doc("The encounter during which the assessment was performed")
  encounter: Reference;

  @doc("The clinician who performed the wound assessment")
  performer: Reference;

  @doc("The date and time the assessment was performed")
  assessedAt: utcDateTime;

  @doc("The anatomical location of the wound")
  location: CodeableConcept;

  @doc("The aetiology or classification of the wound")
  type: WoundType;

  @doc("The NPUAP/EPUAP pressure injury stage, if applicable")
  stage?: WoundStage;

  @doc("The measured length of the wound")
  length?: Quantity;

  @doc("The measured width of the wound")
  width?: Quantity;

  @doc("The measured depth of the wound")
  depth?: Quantity;

  @doc("Description of tunnelling (sinus tract) direction and length")
  @maxLength(500)
  tunneling?: string;

  @doc("Description of undermining direction, clock positions, and extent")
  @maxLength(500)
  undermining?: string;

  @doc("The predominant wound bed tissue type")
  woundBed?: WoundBedDescription;

  @doc("The amount of exudate present")
  exudate?: ExudateDescription;

  @doc("The type of exudate (serous, sanguineous, serosanguineous, purulent)")
  @maxLength(50)
  exudateType?: string;

  @doc("Description of the peri-wound skin condition (e.g., macerated, erythematous, intact)")
  @maxLength(500)
  periWoundSkin?: string;

  @doc("Whether wound odour is present on dressing removal")
  odor?: boolean;

  @doc("Patient-reported pain level at the wound site on a 0–10 scale")
  @minValue(0)
  @maxValue(10)
  painLevel?: int32;

  @doc("Reference to a wound photograph stored in the document repository")
  photographRef?: Reference;

  @doc("Additional clinical annotations")
  note?: Annotation[];
}

@doc("A record of wound treatment and dressing change performed for a specific wound.")
model WoundTreatment extends HealthcareBaseEntity {
  @doc("The patient receiving wound treatment")
  patient: Reference;

  @doc("The encounter during which the treatment was performed")
  encounter: Reference;

  @doc("Reference to the wound assessment this treatment is based on")
  woundAssessment: Reference;

  @doc("The clinician who performed the wound treatment")
  performer: Reference;

  @doc("The date and time the treatment was performed")
  performedAt: utcDateTime;

  @doc("The wound cleansing method used (e.g., normal saline irrigation, wound cleanser)")
  @maxLength(200)
  cleansingMethod?: string;

  @doc("Whether wound debridement was performed")
  debrided?: boolean;

  @doc("The type of debridement performed (sharp, autolytic, enzymatic, mechanical)")
  @maxLength(50)
  debridementType?: string;

  @doc("The primary dressing type applied to the wound")
  dressing: CodeableConcept;

  @doc("How often the dressing should be changed (e.g., every 3 days, daily)")
  @maxLength(100)
  dressingChangeFrequency?: string;

  @doc("Topical agents applied in addition to the primary dressing")
  topicalAgents?: CodeableConcept[];

  @doc("Offloading device used to relieve pressure on the wound (e.g., boot, cushion)")
  @maxLength(200)
  offloadingDevice?: string;

  @doc("Additional free-text clinical notes about the treatment")
  @maxLength(1000)
  note?: string;
}

@doc("A wound care order specifying the required dressing protocol and frequency for a patient's wound.")
model WoundCareOrder extends HealthcareBaseEntity {
  @doc("The patient for whom the wound care order is issued")
  patient: Reference;

  @doc("The encounter associated with this wound care order, if applicable")
  encounter?: Reference;

  @doc("The clinician who authored the wound care order")
  orderedBy: Reference;

  @doc("The anatomical location of the wound this order applies to")
  woundLocation: CodeableConcept;

  @doc("The type of dressing to apply")
  dressingType: CodeableConcept;

  @doc("The frequency at which wound care should be performed (e.g., daily, twice daily)")
  @maxLength(100)
  frequency: string;

  @doc("Instructions for wound cleansing prior to dressing application")
  @maxLength(500)
  cleansingInstructions?: string;

  @doc("Any special instructions for wound care delivery")
  @maxLength(1000)
  specialInstructions?: string;

  @doc("The current status of the wound care order")
  status: ClinicalOrderStatus;

  @doc("The date on which the wound care order becomes effective")
  startDate: plainDate;

  @doc("The date on which the wound care order expires or is completed, if applicable")
  endDate?: plainDate;
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

@doc("Search parameters for WoundAssessment resources.")
model WoundAssessmentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by wound type")
  @query type?: WoundType;

  @doc("Filter by wound stage")
  @query stage?: WoundStage;

  @doc("Filter by performer reference id")
  @query performer?: string;

  @doc("Filter assessments performed on or after this date-time")
  @query assessedFrom?: utcDateTime;

  @doc("Filter assessments performed on or before this date-time")
  @query assessedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for WoundTreatment resources.")
model WoundTreatmentSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by wound assessment reference id")
  @query woundAssessment?: string;

  @doc("Filter by performer reference id")
  @query performer?: string;

  @doc("Filter treatments performed on or after this date-time")
  @query performedFrom?: utcDateTime;

  @doc("Filter treatments performed on or before this date-time")
  @query performedTo?: utcDateTime;

  ...PaginationQuery;
}

@doc("Search parameters for WoundCareOrder resources.")
model WoundCareOrderSearchParams {
  @doc("Filter by patient reference id")
  @query patient?: string;

  @doc("Filter by encounter reference id")
  @query encounter?: string;

  @doc("Filter by order status")
  @query status?: ClinicalOrderStatus;

  @doc("Filter by ordering clinician reference id")
  @query orderedBy?: string;

  @doc("Filter orders starting on or after this date")
  @query startFrom?: plainDate;

  @doc("Filter orders starting on or before this date")
  @query startTo?: plainDate;

  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("CRUD and search operations for WoundAssessment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface WoundAssessmentManagement {
  @doc("Create a new WoundAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createWoundAssessment")
  create(
    @body body: WoundAssessment,
  ): {
    @statusCode statusCode: 201;
    @body woundAssessment: WoundAssessment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single WoundAssessment by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getWoundAssessment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body woundAssessment: WoundAssessment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing WoundAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateWoundAssessment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: WoundAssessment,
  ): {
    @statusCode statusCode: 200;
    @body woundAssessment: WoundAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a WoundAssessment.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchWoundAssessment")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body woundAssessment: WoundAssessment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a WoundAssessment by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteWoundAssessment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for WoundAssessment resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchWoundAssessments")
  @route("/search")
  search(
    ...WoundAssessmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WoundAssessment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for WoundTreatment resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface WoundTreatmentManagement {
  @doc("Create a new WoundTreatment record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createWoundTreatment")
  create(
    @body body: WoundTreatment,
  ): {
    @statusCode statusCode: 201;
    @body woundTreatment: WoundTreatment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single WoundTreatment record by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getWoundTreatment")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body woundTreatment: WoundTreatment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing WoundTreatment record.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateWoundTreatment")
  @route("/{id}")
  update(
    @path id: string,
    @body body: WoundTreatment,
  ): {
    @statusCode statusCode: 200;
    @body woundTreatment: WoundTreatment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a WoundTreatment record by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteWoundTreatment")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for WoundTreatment records using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchWoundTreatments")
  @route("/search")
  search(
    ...WoundTreatmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WoundTreatment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("CRUD and search operations for WoundCareOrder resources.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
interface WoundCareOrderManagement {
  @doc("Create a new WoundCareOrder.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createWoundCareOrder")
  create(
    @body body: WoundCareOrder,
  ): {
    @statusCode statusCode: 201;
    @body woundCareOrder: WoundCareOrder;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a single WoundCareOrder by id.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getWoundCareOrder")
  @route("/{id}")
  get(
    @path id: string,
  ): {
    @statusCode statusCode: 200;
    @body woundCareOrder: WoundCareOrder;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Replace an existing WoundCareOrder.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateWoundCareOrder")
  @route("/{id}")
  update(
    @path id: string,
    @body body: WoundCareOrder,
  ): {
    @statusCode statusCode: 200;
    @body woundCareOrder: WoundCareOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Partially update a WoundCareOrder (e.g., change status or extend end date).")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @patch
  @operationId("patchWoundCareOrder")
  @route("/{id}")
  patch(
    @path id: string,
    @body body: Record<unknown>,
  ): {
    @statusCode statusCode: 200;
    @body woundCareOrder: WoundCareOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a WoundCareOrder by id.")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @operationId("deleteWoundCareOrder")
  @route("/{id}")
  delete(
    @path id: string,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search for WoundCareOrder resources using filter parameters.")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchWoundCareOrders")
  @route("/search")
  search(
    ...WoundCareOrderSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<WoundCareOrder>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
