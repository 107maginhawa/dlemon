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

namespace Healthcare.Ancillary.Dental;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/**
 * Tooth numbering notation system in use.
 */
enum ToothNotationSystem {
  /** FDI World Dental Federation two-digit notation (11–48). */
  fdi,
  /** Universal Numbering System (1–32). */
  universal,
  /** Palmer Notation Method. */
  palmer,
}

/**
 * Surfaces of a tooth that can be charted.
 */
enum ToothSurface {
  mesial,
  distal,
  buccal,
  lingual,
  occlusal,
  incisal,
  facial,
  cervical,
}

/**
 * Lifecycle status of a dental treatment plan.
 */
enum TreatmentPlanStatus {
  draft,
  proposed,
  accepted,
  inProgress,
  completed,
  cancelled,
}

/**
 * Lifecycle status of a single item within a treatment plan.
 */
enum TreatmentItemStatus {
  planned,
  scheduled,
  inProgress,
  completed,
  cancelled,
}

// ---------------------------------------------------------------------------
// Supporting models – Odontogram
// ---------------------------------------------------------------------------

/**
 * A pathological or normal finding recorded for a specific tooth.
 */
model ToothCondition {
  /** CDT code or SNOMED dental concept describing the condition. */
  code: CodeableConcept;

  /** Current status of the condition (e.g. active, resolved). */
  status: string;

  /** Tooth surface(s) affected by the condition. */
  surface?: ToothSurface[];

  /** Free-text notes about the condition. */
  notes?: string;
}

/**
 * A completed restorative or prosthetic procedure recorded for a tooth.
 */
model ToothRestoration {
  /** CDT procedure code for the restoration. */
  code: CodeableConcept;

  /** Restorative material used (e.g. amalgam, composite, ceramic). */
  material: CodeableConcept;

  /** Date the restoration was placed. */
  datePerformed?: plainDate;

  /** Provider who performed the restoration. */
  provider?: Reference;

  /** Tooth surface(s) involved in the restoration. */
  surface?: ToothSurface[];
}

/**
 * Charting record for a single tooth within an odontogram.
 */
model ToothRecord {
  /**
   * Tooth identifier within the chosen notation system.
   * FDI range: 11–48; Universal range: 1–32.
   */
  toothNumber: int32;

  /** Notation system used to identify the tooth. */
  notation: ToothNotationSystem;

  /** Surfaces of the tooth being charted. */
  surfaces?: ToothSurface[];

  /** Conditions identified on this tooth. */
  conditions?: ToothCondition[];

  /** Existing restorations on this tooth. */
  restorations?: ToothRestoration[];

  /** Whether the tooth is missing. */
  missing?: boolean;

  /** Whether the tooth has been replaced by a dental implant. */
  implant?: boolean;

  /** Free-text notes about the tooth. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Resource model – Odontogram
// ---------------------------------------------------------------------------

/**
 * A complete graphical/structured charting of a patient's dentition.
 */
model Odontogram extends HealthcareBaseEntity {
  /** Patient whose dentition is being charted. */
  patient: Reference;

  /** Date and time the odontogram was captured. */
  capturedAt: utcDateTime;

  /** Practitioner who captured the odontogram. */
  capturedBy: Reference;

  /** Individual tooth records comprising the odontogram. */
  teeth: ToothRecord[];
}

// ---------------------------------------------------------------------------
// Supporting models – DentalTreatmentPlan
// ---------------------------------------------------------------------------

/**
 * A single line item within a dental treatment plan.
 */
model DentalTreatmentPlanItem {
  /** Position of this item within the ordered plan. */
  sequence: int32;

  /** Tooth number this item applies to (FDI or Universal). */
  tooth?: int32;

  /** Tooth surface(s) targeted by this procedure. */
  surface?: ToothSurface[];

  /** CDT procedure code (D0100–D9999). */
  procedure: CodeableConcept;

  /** Current lifecycle status of this plan item. */
  status: TreatmentItemStatus;

  /** Clinical priority of this item (lower numbers = higher priority). */
  priority?: int32;

  /** Estimated cost for this procedure. */
  estimatedCost?: Money;

  /** Date/time the procedure was or will be performed. */
  performedAt?: utcDateTime;

  /** Free-text notes about this plan item. */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Resource model – DentalTreatmentPlan
// ---------------------------------------------------------------------------

/**
 * A structured plan of recommended or approved dental procedures for a patient.
 */
model DentalTreatmentPlan extends HealthcareBaseEntity {
  /** Patient for whom the treatment plan is created. */
  patient: Reference;

  /** Clinical encounter associated with this plan. */
  encounter?: Reference;

  /** Provider responsible for the treatment plan. */
  provider: Reference;

  /** Current lifecycle status of the treatment plan. */
  status: TreatmentPlanStatus;

  /** High-level description of the treatment plan. */
  description?: string;

  /** Ordered list of treatment items comprising the plan. */
  items: DentalTreatmentPlanItem[];

  /** Total estimated cost of all items in the plan. */
  totalEstimate?: Money;

  /** Portion of the total estimate expected to be covered by insurance. */
  insuranceEstimate?: Money;

  /** Portion of the total estimate that is the patient's responsibility. */
  patientEstimate?: Money;

  /** Date after which the plan is no longer valid. */
  validUntil?: plainDate;

  /** Annotations about the treatment plan. */
  notes?: Annotation[];
}

// ---------------------------------------------------------------------------
// Request / response wrappers
// ---------------------------------------------------------------------------

model OdontogramCreateRequest {
  ...OmitProperties<Odontogram, "id" | "meta" | "createdAt" | "updatedAt">;
}

model OdontogramSearchParams {
  patientId?: string;
  dateFrom?: utcDateTime;
  dateTo?: utcDateTime;
  ...PaginationQuery;
}

model DentalTreatmentPlanCreateRequest {
  ...OmitProperties<DentalTreatmentPlan, "id" | "meta" | "createdAt" | "updatedAt">;
}

model DentalTreatmentPlanSearchParams {
  patientId?: string;
  status?: TreatmentPlanStatus;
  providerId?: string;
  ...PaginationQuery;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * CRUD and search operations for patient odontograms.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface OdontogramManagement {
  /**
   * Create a new odontogram for a patient.
   * @param body Odontogram creation payload.
   * @returns The newly created odontogram.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createOdontogram")
  create(@body body: OdontogramCreateRequest): {
    @statusCode statusCode: 201;
    @body odontogram: Odontogram;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve an odontogram by its unique identifier.
   * @param id The odontogram identifier.
   * @returns The requested odontogram.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getOdontogram")
  read(@path id: string): Odontogram | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing odontogram.
   * @param id The odontogram identifier.
   * @param body Updated odontogram payload.
   * @returns The updated odontogram.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateOdontogram")
  update(@path id: string, @body body: OdontogramCreateRequest): Odontogram | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete an odontogram record.
   * @param id The odontogram identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteOdontogram")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search odontograms by patient or capture date range.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching odontograms.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchOdontograms")
  search(...OdontogramSearchParams): PaginatedResponse<Odontogram> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}

/**
 * CRUD and search operations for dental treatment plans.
 */
@useAuth(bearerAuth)
@tag("Healthcare:Ancillary")
interface DentalTreatmentPlanManagement {
  /**
   * Create a new dental treatment plan.
   * @param body Treatment plan creation payload.
   * @returns The newly created dental treatment plan.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @post
  @operationId("createDentalTreatmentPlan")
  create(@body body: DentalTreatmentPlanCreateRequest): {
    @statusCode statusCode: 201;
    @body plan: DentalTreatmentPlan;
  } | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Retrieve a dental treatment plan by its unique identifier.
   * @param id The treatment plan identifier.
   * @returns The requested dental treatment plan.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("getDentalTreatmentPlan")
  read(@path id: string): DentalTreatmentPlan | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Replace an existing dental treatment plan.
   * @param id The treatment plan identifier.
   * @param body Updated treatment plan payload.
   * @returns The updated dental treatment plan.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @put
  @operationId("updateDentalTreatmentPlan")
  update(@path id: string, @body body: DentalTreatmentPlanCreateRequest): DentalTreatmentPlan | ApiBadRequestResponse | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Delete a dental treatment plan.
   * @param id The treatment plan identifier.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @delete
  @operationId("deleteDentalTreatmentPlan")
  delete(@path id: string): {
    @statusCode statusCode: 204;
  } | ApiNotFoundResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;

  /**
   * Search dental treatment plans by patient, status, or provider.
   * @param params Search and pagination parameters.
   * @returns A paginated list of matching dental treatment plans.
   */
  @extension("x-security-required-roles", #["admin", "clinician"])
  @get
  @operationId("searchDentalTreatmentPlans")
  search(...DentalTreatmentPlanSearchParams): PaginatedResponse<DentalTreatmentPlan> | ApiBadRequestResponse | ApiUnauthorizedResponse | ApiForbiddenResponse | ApiInternalServerErrorResponse;
}
