import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../../../../common/models.tsp";
import "../../../../common/errors.tsp";
import "../../../../common/pagination.tsp";
import "../../../../common/security.tsp";
import "../../../core/primitives.tsp";
import "../../../core/terminology.tsp";

using TypeSpec.Http;
using TypeSpec.Rest;
using TypeSpec.OpenAPI;
using Healthcare.Core;
using Healthcare.Core.Terminology;

/**
 * Respiratory Therapy module.
 *
 * Covers the full lifecycle of respiratory care in a hospital setting:
 * orders for therapy modalities, treatment session documentation including
 * pre- and post-treatment assessments, arterial blood gas (ABG) collection
 * and results, and pulmonary function testing (PFT). Aligns with FHIR
 * ServiceRequest, Procedure, Observation, and DiagnosticReport resources.
 */
namespace Healthcare.Clinical.Hospital.Specialty.RespiratoryTherapy;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

@doc("Type of respiratory therapy ordered or performed.")
enum RespiratoryTherapyType {
  @doc("Supplemental oxygen therapy via nasal cannula, mask, or high-flow device")
  oxygenTherapy,
  @doc("Small-volume nebulizer treatment for aerosolized medication delivery")
  nebulizer,
  @doc("Chest physiotherapy — percussion, vibration, postural drainage")
  chestPhysiotherapy,
  @doc("Incentive spirometry to promote lung expansion and prevent atelectasis")
  incentiveSpirometry,
  @doc("Bilevel positive airway pressure (BiPAP) non-invasive ventilation")
  bipap,
  @doc("Continuous positive airway pressure (CPAP) non-invasive ventilation")
  cpap,
  @doc("Mechanical ventilator management for intubated patients")
  ventilatorManagement,
  @doc("Bronchoscopy assistance — RT support during bronchoscopic procedures")
  bronchoscopyAssist,
  @doc("Pulmonary function testing (spirometry, diffusion capacity, etc.)")
  pulmonaryFunctionTest,
  @doc("Arterial blood gas sampling and analysis")
  arterialBloodGas,
}

@doc("Lifecycle status of a respiratory therapy order.")
enum RespiratoryOrderStatus {
  @doc("Order is active and therapy is being delivered")
  active,
  @doc("Ordered therapy has been fully completed")
  completed,
  @doc("Order was discontinued before completion")
  discontinued,
}

@doc("Arterial access site used for ABG collection.")
enum ABGCollectionSite {
  @doc("Radial artery — most common site for ABG sampling")
  radialArtery,
  @doc("Femoral artery — used when radial access is not feasible")
  femoralArtery,
  @doc("Brachial artery — alternative peripheral site")
  brachialArtery,
  @doc("Indwelling arterial line — sample obtained from existing arterial catheter")
  arterialLine,
}

// ---------------------------------------------------------------------------
// Supporting models
// ---------------------------------------------------------------------------

@doc("Pre- or post-treatment respiratory assessment captured during a therapy session.")
model RespiratoryAssessment {
  @doc("Peripheral oxygen saturation (SpO2) as a percentage")
  spO2?: float64;

  @doc("Respiratory rate in breaths per minute")
  respiratoryRate?: int32;

  @doc("Auscultated lung sounds (e.g., clear, wheezing, crackles, diminished)")
  lungSounds?: string;

  @doc("Clinical assessment of work of breathing (e.g., none, mild, moderate, severe)")
  workOfBreathing?: string;
}

// ---------------------------------------------------------------------------
// Root models
// ---------------------------------------------------------------------------

@doc("A respiratory therapy order specifying the type of therapy, frequency, and duration. Extends HealthcareBaseEntity.")
model RespiratoryOrder extends HealthcareBaseEntity {
  @doc("Reference to the Patient for whom this order was placed")
  patient: Reference;

  @doc("Reference to the Encounter in which this order was placed")
  encounter: Reference;

  @doc("Reference to the Practitioner who placed the order")
  orderedBy: Reference;

  @doc("Type of respiratory therapy ordered")
  therapyType: RespiratoryTherapyType;

  @doc("Free-text instructions for the respiratory therapist (e.g., FiO2 target, flow rate, medication)")
  instructions?: string;

  @doc("Frequency of therapy delivery (e.g., 'q4h', 'BID', 'PRN dyspnea')")
  frequency: string;

  @doc("Current lifecycle status of the order")
  status: RespiratoryOrderStatus;

  @doc("Date the order becomes effective")
  startDate: utcDateTime;

  @doc("Date the order is scheduled to end or was discontinued")
  endDate?: utcDateTime;
}

@doc("Documentation of a single respiratory therapy treatment session. Extends HealthcareBaseEntity.")
model RespiratoryTreatment extends HealthcareBaseEntity {
  @doc("Reference to the Patient who received the treatment")
  patient: Reference;

  @doc("Reference to the Encounter during which the treatment was delivered")
  encounter: Reference;

  @doc("Reference to the RespiratoryOrder that authorised this treatment, if applicable")
  order?: Reference;

  @doc("Reference to the Practitioner (respiratory therapist) who performed the treatment")
  performer: Reference;

  @doc("Date and time the treatment was performed")
  performedAt: utcDateTime;

  @doc("Type of respiratory therapy delivered")
  therapyType: RespiratoryTherapyType;

  @doc("Pre-treatment respiratory assessment")
  preTreatmentAssessment?: RespiratoryAssessment;

  @doc("Post-treatment respiratory assessment")
  postTreatmentAssessment?: RespiratoryAssessment;

  @doc("Medication administered during nebulizer or inhaled therapy (e.g., albuterol, ipratropium)")
  medicationAdministered?: CodeableConcept;

  @doc("Duration of the treatment session in minutes")
  duration?: int32;

  @doc("Oxygen flow rate delivered in litres per minute")
  oxygenFlow?: Quantity;

  @doc("Fraction of inspired oxygen (FiO2) as a decimal (0.21 = room air, 1.0 = 100%)")
  fiO2?: float64;

  @doc("Narrative description of the patient's response to the treatment")
  patientResponse?: string;

  @doc("Any adverse reactions observed during or after the treatment")
  adverseReaction?: string;

  @doc("Free-text note recorded by the respiratory therapist")
  note?: string;
}

@doc("Arterial blood gas (ABG) result for a patient. Extends HealthcareBaseEntity.")
model ABGResult extends HealthcareBaseEntity {
  @doc("Reference to the Patient from whom the sample was collected")
  patient: Reference;

  @doc("Reference to the Encounter during which the sample was obtained")
  encounter: Reference;

  @doc("Date and time the arterial sample was collected")
  collectedAt: utcDateTime;

  @doc("Reference to the Practitioner or RT who collected the sample")
  collectedBy: Reference;

  @doc("Anatomical site from which the arterial sample was obtained")
  site: ABGCollectionSite;

  @doc("Arterial pH value")
  pH: float64;

  @doc("Partial pressure of carbon dioxide (PaCO2) in mmHg")
  pCO2: Quantity;

  @doc("Partial pressure of oxygen (PaO2) in mmHg")
  pO2: Quantity;

  @doc("Bicarbonate concentration (HCO3-) in mEq/L")
  hco3: Quantity;

  @doc("Base excess in mEq/L — positive values indicate metabolic alkalosis, negative indicate metabolic acidosis")
  baseExcess?: float64;

  @doc("Oxygen saturation from co-oximetry (SaO2) as a percentage")
  sO2?: float64;

  @doc("Lactate level in mmol/L — elevated values suggest tissue hypoperfusion")
  lactate?: float64;

  @doc("Fraction of inspired oxygen (FiO2) at the time of sample collection")
  fiO2AtCollection?: float64;

  @doc("Clinical interpretation of the ABG result (e.g., 'Compensated respiratory acidosis')")
  interpretation?: string;
}

@doc("Pulmonary function test (PFT) result documenting spirometry and diffusion capacity measurements. Extends HealthcareBaseEntity.")
model PulmonaryFunctionTest extends HealthcareBaseEntity {
  @doc("Reference to the Patient who underwent the pulmonary function test")
  patient: Reference;

  @doc("Reference to the Encounter during which the test was performed")
  encounter: Reference;

  @doc("Date and time the PFT was performed")
  performedAt: utcDateTime;

  @doc("Reference to the Practitioner or RT who performed the test")
  performer: Reference;

  @doc("Forced vital capacity (FVC) in litres")
  fvc?: Quantity;

  @doc("Forced expiratory volume in one second (FEV1) in litres")
  fev1?: Quantity;

  @doc("FEV1/FVC ratio as a decimal (e.g., 0.70 = 70%)")
  fev1FvcRatio?: float64;

  @doc("Peak expiratory flow rate (PEFR) in litres per minute")
  peakFlow?: Quantity;

  @doc("Diffusing capacity of the lung for carbon monoxide (DLCO) in mL/min/mmHg")
  dlco?: Quantity;

  @doc("Total lung capacity (TLC) in litres")
  tlc?: Quantity;

  @doc("Clinical interpretation of the PFT results (e.g., 'Moderate obstructive pattern, bronchodilator responsive')")
  interpretation?: string;

  @doc("Reference values used for percent-predicted calculations (demographic-adjusted norms)")
  referenceValues?: Record<unknown>;
}

// ---------------------------------------------------------------------------
// Search parameters
// ---------------------------------------------------------------------------

@doc("Search parameters for respiratory therapy orders.")
model RespiratoryOrderSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by ordering provider reference ID") @query orderedBy?: string;
  @doc("Filter by therapy type") @query therapyType?: RespiratoryTherapyType;
  @doc("Filter by order status") @query status?: RespiratoryOrderStatus;
  ...OffsetPaginationParams;
}

@doc("Search parameters for respiratory treatment sessions.")
model RespiratoryTreatmentSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter by therapy type") @query therapyType?: RespiratoryTherapyType;
  @doc("Filter treatments performed at or after this date-time") @query performedFrom?: utcDateTime;
  @doc("Filter treatments performed at or before this date-time") @query performedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for ABG results.")
model ABGResultSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by collection site") @query site?: ABGCollectionSite;
  @doc("Filter samples collected at or after this date-time") @query collectedFrom?: utcDateTime;
  @doc("Filter samples collected at or before this date-time") @query collectedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

@doc("Search parameters for pulmonary function tests.")
model PFTSearchParams {
  @doc("Filter by patient reference ID") @query patient?: string;
  @doc("Filter by encounter reference ID") @query encounter?: string;
  @doc("Filter by performer reference ID") @query performer?: string;
  @doc("Filter tests performed at or after this date-time") @query performedFrom?: utcDateTime;
  @doc("Filter tests performed at or before this date-time") @query performedTo?: utcDateTime;
  ...OffsetPaginationParams;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

@doc("Respiratory therapy order management — place, retrieve, update, and search respiratory therapy orders.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/respiratory-therapy/orders")
interface RespiratoryOrderManagement {
  @doc("Create a new respiratory therapy order.")
  @operationId("createRespiratoryOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRespiratoryOrder(
    @body body: RespiratoryOrder,
  ): {
    @statusCode statusCode: 201;
    @body result: RespiratoryOrder;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a respiratory therapy order by its logical ID.")
  @operationId("getRespiratoryOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRespiratoryOrder(
    @path @doc("RespiratoryOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RespiratoryOrder;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a respiratory therapy order.")
  @operationId("updateRespiratoryOrder")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRespiratoryOrder(
    @path @doc("RespiratoryOrder logical ID") id: UUID,
    @body body: RespiratoryOrder,
  ): {
    @statusCode statusCode: 200;
    @body result: RespiratoryOrder;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a respiratory therapy order.")
  @operationId("deleteRespiratoryOrder")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRespiratoryOrder(
    @path @doc("RespiratoryOrder logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search respiratory therapy orders by patient, encounter, therapy type, or status.")
  @operationId("searchRespiratoryOrders")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRespiratoryOrders(
    ...RespiratoryOrderSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RespiratoryOrder>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Respiratory treatment session management — document, retrieve, update, and search individual therapy treatment sessions.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/respiratory-therapy/treatments")
interface RespiratoryTreatmentManagement {
  @doc("Document a new respiratory therapy treatment session.")
  @operationId("createRespiratoryTreatment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createRespiratoryTreatment(
    @body body: RespiratoryTreatment,
  ): {
    @statusCode statusCode: 201;
    @body result: RespiratoryTreatment;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a respiratory treatment session by its logical ID.")
  @operationId("getRespiratoryTreatment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getRespiratoryTreatment(
    @path @doc("RespiratoryTreatment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: RespiratoryTreatment;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a respiratory treatment session.")
  @operationId("updateRespiratoryTreatment")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateRespiratoryTreatment(
    @path @doc("RespiratoryTreatment logical ID") id: UUID,
    @body body: RespiratoryTreatment,
  ): {
    @statusCode statusCode: 200;
    @body result: RespiratoryTreatment;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a respiratory treatment session.")
  @operationId("deleteRespiratoryTreatment")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteRespiratoryTreatment(
    @path @doc("RespiratoryTreatment logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search respiratory treatment sessions by patient, encounter, performer, therapy type, or date range.")
  @operationId("searchRespiratoryTreatments")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchRespiratoryTreatments(
    ...RespiratoryTreatmentSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<RespiratoryTreatment>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("ABG result management — record, retrieve, update, and search arterial blood gas results.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/respiratory-therapy/abg-results")
interface ABGResultManagement {
  @doc("Record a new ABG result.")
  @operationId("createABGResult")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createABGResult(
    @body body: ABGResult,
  ): {
    @statusCode statusCode: 201;
    @body result: ABGResult;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve an ABG result by its logical ID.")
  @operationId("getABGResult")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getABGResult(
    @path @doc("ABGResult logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: ABGResult;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update an ABG result.")
  @operationId("updateABGResult")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updateABGResult(
    @path @doc("ABGResult logical ID") id: UUID,
    @body body: ABGResult,
  ): {
    @statusCode statusCode: 200;
    @body result: ABGResult;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete an ABG result.")
  @operationId("deleteABGResult")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deleteABGResult(
    @path @doc("ABGResult logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search ABG results by patient, encounter, collection site, or date range.")
  @operationId("searchABGResults")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchABGResults(
    ...ABGResultSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<ABGResult>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

@doc("Pulmonary function test management — record, retrieve, update, and search PFT results.")
@tag("Healthcare:Clinical")
@useAuth(bearerAuth)
@route("/respiratory-therapy/pfts")
interface PFTManagement {
  @doc("Record a new pulmonary function test result.")
  @operationId("createPFT")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  createPFT(
    @body body: PulmonaryFunctionTest,
  ): {
    @statusCode statusCode: 201;
    @body result: PulmonaryFunctionTest;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Retrieve a pulmonary function test by its logical ID.")
  @operationId("getPFT")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/{id}")
  getPFT(
    @path @doc("PulmonaryFunctionTest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 200;
    @body result: PulmonaryFunctionTest;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Update a pulmonary function test result.")
  @operationId("updatePFT")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @route("/{id}")
  updatePFT(
    @path @doc("PulmonaryFunctionTest logical ID") id: UUID,
    @body body: PulmonaryFunctionTest,
  ): {
    @statusCode statusCode: 200;
    @body result: PulmonaryFunctionTest;
  } | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Delete a pulmonary function test result.")
  @operationId("deletePFT")
  @extension("x-security-required-roles", #["admin"])
  @delete
  @route("/{id}")
  deletePFT(
    @path @doc("PulmonaryFunctionTest logical ID") id: UUID,
  ): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  @doc("Search pulmonary function tests by patient, encounter, performer, or date range.")
  @operationId("searchPFTs")
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @route("/search")
  searchPFTs(
    ...PFTSearchParams,
  ): {
    @statusCode statusCode: 200;
    @body result: PaginatedResponse<PulmonaryFunctionTest>;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
