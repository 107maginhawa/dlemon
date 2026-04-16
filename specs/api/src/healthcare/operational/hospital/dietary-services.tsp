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
 * Dietary Services module.
 *
 * Provides models and operations for managing clinical nutrition across the
 * inpatient stay: diet orders prescribing therapeutic diets and texture
 * modifications, meal service delivery records, and nutritional risk screening
 * using validated tools. Aligned with FHIR R4 NutritionOrder and Observation.
 */
namespace Healthcare.Operational.Hospital.Dietary;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Lifecycle status of a diet order.")
enum DietOrderStatus {
  @doc("The diet order is active and meals should be prepared according to its specifications")
  active,

  @doc("The diet order is temporarily suspended (e.g., patient is NPO for a procedure)")
  onHold,

  @doc("The diet order has been completed and the patient has been discharged or transferred")
  completed,

  @doc("The diet order has been permanently cancelled and replaced by a new order")
  discontinued,
}

@doc("The type of meal being served.")
enum MealType {
  @doc("Morning meal")
  breakfast,

  @doc("Midday meal")
  lunch,

  @doc("Evening meal")
  dinner,

  @doc("Supplemental snack between main meals")
  snack,
}

@doc("Validated nutritional risk screening tool.")
enum NutritionScreeningTool {
  @doc("Malnutrition Screening Tool — a simple two-question bedside tool")
  mst,

  @doc("Malnutrition Universal Screening Tool — used in community and outpatient settings")
  must,

  @doc("Nutritional Risk Screening 2002 — recommended by ESPEN for hospital patients")
  nrs2002,

  @doc("Subjective Global Assessment — comprehensive clinical nutrition assessment")
  sga,
}

@doc("Nutritional risk level derived from a validated screening tool score.")
enum NutritionRiskLevel {
  @doc("Low risk — routine monitoring only")
  low,

  @doc("Moderate risk — observe and repeat screening, consider dietitian referral")
  moderate,

  @doc("High risk — immediate dietitian referral and intervention required")
  high,
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A clinical diet order prescribing a specific therapeutic diet, texture modification, fluid restriction, and supplementation for a hospitalised patient.")
model DietOrder extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom the diet is ordered")
  patient: Reference;

  @doc("Reference to the Encounter associated with this diet order")
  encounter: Reference;

  @doc("Reference to the Practitioner (physician or dietitian) who placed this order")
  orderedBy: Reference;

  @doc("Therapeutic diet type prescribed (SNOMED CT or local diet code — e.g., 'Diabetic', 'Renal', 'Regular', 'NPO', 'Clear Liquid')")
  dietType: CodeableConcept;

  @doc("Texture modification required (IDDSI framework coded — e.g., 'Minced and moist', 'Pureed', 'Regular')")
  texture?: CodeableConcept;

  @doc("Daily fluid restriction, if applicable (value in mL with unit)")
  fluidRestriction?: Quantity;

  @doc("Patient food allergies and intolerances to be excluded from meal preparation (SNOMED CT coded)")
  allergies?: CodeableConcept[];

  @doc("Oral nutritional supplements prescribed in addition to meals (e.g., 'Ensure Plus BID')")
  supplements?: CodeableConcept[];

  @doc("Whether the patient requires feeding assistance from nursing or dietary staff")
  feedingAssistance?: boolean;

  @doc("Special instructions for dietary staff (e.g., 'Kosher meals only', 'Extra portion protein', 'No pork products')")
  specialInstructions?: string;

  @doc("Current status of this diet order")
  status: DietOrderStatus;
}

@doc("A meal service delivery record documenting what was served to the patient and how much was consumed.")
model MealService extends HealthcareBaseEntity {
  @doc("Reference to the Patient receiving the meal")
  patient: Reference;

  @doc("Reference to the Encounter during which the meal was served")
  encounter: Reference;

  @doc("Reference to the DietOrder that governs meal preparation for this patient")
  dietOrder: Reference;

  @doc("Type of meal served")
  mealType: MealType;

  @doc("Scheduled date and time for this meal to be served")
  scheduledAt: utcDateTime;

  @doc("Actual date and time the meal tray was delivered to the patient")
  servedAt?: utcDateTime;

  @doc("Percentage of the meal the patient consumed, estimated by nursing or dietary staff (0–100)")
  @minValue(0)
  @maxValue(100)
  consumptionPercent?: int32;

  @doc("Whether the patient refused the meal outright")
  refused?: boolean;

  @doc("Reference to the staff member who recorded intake")
  intakeRecordedBy?: Reference;

  @doc("Additional notes on meal tolerance, preferences expressed, or intake concerns")
  note?: string;
}

@doc("A nutritional risk screening record using a validated tool to identify patients at risk of malnutrition.")
model NutritionScreening extends HealthcareBaseEntity {
  @doc("Reference to the Patient screened")
  patient: Reference;

  @doc("Reference to the Encounter during which screening was performed")
  encounter: Reference;

  @doc("Reference to the Practitioner (nurse or dietitian) who performed the screening")
  screenedBy: Reference;

  @doc("Date and time the screening was performed")
  screenedAt: utcDateTime;

  @doc("Validated screening tool used")
  tool: NutritionScreeningTool;

  @doc("Numerical score produced by the screening tool")
  score: float32;

  @doc("Risk level classification derived from the score")
  riskLevel: NutritionRiskLevel;

  @doc("Whether the patient should be referred to a registered dietitian for a full nutrition assessment and care plan")
  referToNutritionist?: boolean;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for diet orders.")
model DietOrderSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by ordering clinician reference ID") @query orderedBy?: string;
  @doc("Filter by order status") @query status?: DietOrderStatus;
  @doc("Filter by diet type code") @query dietTypeCode?: string;
  ...OffsetPaginationParams;
}

@doc("Search parameters for meal service records.")
model MealServiceSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by meal type") @query mealType?: MealType;
  @doc("Filter by whether the meal was refused") @query refused?: boolean;
  @doc("Filter meals scheduled at or after this date-time") @query scheduledFrom?: utcDateTime;
  @doc("Filter meals scheduled at or before this date-time") @query scheduledTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for nutrition screenings.")
model NutritionScreeningSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by screener reference ID") @query screenedBy?: string;
  @doc("Filter by screening tool") @query tool?: NutritionScreeningTool;
  @doc("Filter by risk level") @query riskLevel?: NutritionRiskLevel;
  @doc("Filter screenings performed at or after this date-time") @query screenedFrom?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Diet order management — prescribe and manage therapeutic diets, texture modifications, and nutritional supplementation for inpatients.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/dietary/diet-orders")
interface DietOrderManagement {
  @doc("Create a new diet order for a patient.")
  @operationId("createDietOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createDietOrder(
    @body body: DietOrder,
  ): {
    @statusCode statusCode: 201;
    @body result: DietOrder;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a diet order by its logical ID.")
  @operationId("getDietOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getDietOrder(
    @path @doc("DietOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: DietOrder;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a diet order.")
  @operationId("updateDietOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateDietOrder(
    @path @doc("DietOrder logical ID") id: UUID,
    @body body: DietOrder,
  ): {
    @statusCode statusCode: 200;
    @body result: DietOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a diet order.")
  @operationId("deleteDietOrder")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteDietOrder(
    @path @doc("DietOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search diet orders by patient, encounter, status, or diet type.")
  @operationId("searchDietOrders")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchDietOrders(
    ...DietOrderSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<DietOrder>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Meal service management — record meal delivery, consumption percentage, and patient refusals for nutritional intake tracking.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/dietary/meal-services")
interface MealServiceManagement {
  @doc("Create a meal service record.")
  @operationId("createMealService")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createMealService(
    @body body: MealService,
  ): {
    @statusCode statusCode: 201;
    @body result: MealService;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a meal service record by its logical ID.")
  @operationId("getMealService")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getMealService(
    @path @doc("MealService logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: MealService;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a meal service record — record actual service time, consumption percentage, or refusal.")
  @operationId("updateMealService")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateMealService(
    @path @doc("MealService logical ID") id: UUID,
    @body body: MealService,
  ): {
    @statusCode statusCode: 200;
    @body result: MealService;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a meal service record.")
  @operationId("deleteMealService")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteMealService(
    @path @doc("MealService logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search meal service records by patient, encounter, meal type, or scheduled date range.")
  @operationId("searchMealServices")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchMealServices(
    ...MealServiceSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<MealService>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Nutrition screening management — screen patients for malnutrition risk on admission and at regular intervals using validated tools.")
@tag("Healthcare:Operational")
@useAuth(bearerAuth)
@route("/dietary/nutrition-screenings")
interface NutritionScreeningManagement {
  @doc("Create a new nutrition screening record.")
  @operationId("createNutritionScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createNutritionScreening(
    @body body: NutritionScreening,
  ): {
    @statusCode statusCode: 201;
    @body result: NutritionScreening;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a nutrition screening record by its logical ID.")
  @operationId("getNutritionScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getNutritionScreening(
    @path @doc("NutritionScreening logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: NutritionScreening;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a nutrition screening record.")
  @operationId("updateNutritionScreening")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateNutritionScreening(
    @path @doc("NutritionScreening logical ID") id: UUID,
    @body body: NutritionScreening,
  ): {
    @statusCode statusCode: 200;
    @body result: NutritionScreening;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a nutrition screening record.")
  @operationId("deleteNutritionScreening")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteNutritionScreening(
    @path @doc("NutritionScreening logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search nutrition screenings by patient, encounter, tool, risk level, or date range.")
  @operationId("searchNutritionScreenings")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchNutritionScreenings(
    ...NutritionScreeningSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<NutritionScreening>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
