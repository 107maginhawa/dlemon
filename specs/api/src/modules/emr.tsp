import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi";
import "../common/models.tsp";
import "../common/errors.tsp";
import "../common/pagination.tsp";
import "../common/security.tsp";
import "./patient.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

// ============================================================================
// DATA MODELS
// ============================================================================

/**
 * Vital signs data structure
 * All measurements use standard medical units (metric system)
 */
@doc("Vital signs measurements with standardized units")
model VitalsData {
  @doc("Body temperature in degrees Celsius")
  temperatureCelsius?: float32;

  @doc("Systolic blood pressure in mmHg")
  systolicBp?: int32;

  @doc("Diastolic blood pressure in mmHg")
  diastolicBp?: int32;

  @doc("Heart rate in beats per minute (bpm)")
  heartRate?: int32;

  @doc("Patient weight in kilograms (kg)")
  weightKg?: float32;

  @doc("Patient height in centimeters (cm)")
  heightCm?: float32;

  @doc("Respiratory rate in breaths per minute")
  respiratoryRate?: int32;

  @doc("Oxygen saturation as percentage (SpO2)")
  oxygenSaturation?: int32;

  @doc("Additional notes about vital signs")
  notes?: string;
}

/**
 * Symptom severity levels
 */
@doc("Severity classification for symptoms")
union SymptomSeverity {
  string,
  "mild": "mild",
  "moderate": "moderate",
  "severe": "severe",
}

/**
 * Symptoms data structure with standardized temporal and severity fields
 */
@doc("Patient symptoms information with structured data")
model SymptomsData {
  @doc("Timestamp when symptoms began (ISO 8601 format)")
  onset?: utcDateTime;

  @doc("Duration of symptoms in hours")
  durationHours?: int32;

  @doc("Severity classification: mild, moderate, or severe")
  severity?: SymptomSeverity;

  @doc("Free-text description of symptoms")
  description?: string;

  @doc("Associated symptoms (list of symptom names)")
  associated?: string[];

  @doc("Symptoms patient explicitly denies having")
  denies?: string[];
}

/**
 * Prescription data structure with standardized dosage and duration
 */
@doc("Prescription information with structured data")
model PrescriptionData {
  @doc("Prescription identifier")
  id?: string;

  @doc("Medication name (generic or brand name)")
  medication: string;

  @doc("Numeric dosage amount (e.g., 500 for '500mg')")
  dosageAmount?: float32;

  @doc("Dosage unit (e.g., 'mg', 'ml', 'tablets', 'drops')")
  dosageUnit?: string;

  @doc("Frequency description (e.g., 'twice daily', 'every 6 hours', 'as needed')")
  frequency?: string;

  @doc("Duration in days")
  durationDays?: int32;

  @doc("Additional administration instructions")
  instructions?: string;

  @doc("Additional notes about the prescription")
  notes?: string;
}

/**
 * Follow-up data structure with standardized timeframe
 */
@doc("Follow-up instructions with structured timeframe")
model FollowUpData {
  @doc("Whether follow-up is needed")
  needed: boolean;

  @doc("Timeframe for follow-up in days (e.g., 7 for '1 week', 14 for '2 weeks')")
  timeframeDays?: int32;

  @doc("Follow-up instructions")
  instructions?: string;

  @doc("Specialist referral information")
  specialistReferral?: string;
}

/**
 * Consultation note - Core documentation model for minor ailment consultations
 */
@doc("Medical consultation documentation")
model ConsultationNote extends BaseEntity {
  @doc("Patient reference")
  patient: UUID;

  @doc("Provider who conducted the consultation")
  provider: UUID;
  
  @doc("Context for idempotency (e.g., 'appointment:123', 'walkin:456')")
  @maxLength(255)
  context?: string;

  @doc("Chief complaint - reason for visit")
  @minLength(1)
  @maxLength(500)
  chiefComplaint?: string;

  @doc("Clinical assessment by provider")
  @minLength(1)
  @maxLength(2000)
  assessment?: string;

  @doc("Treatment plan")
  @minLength(1)
  @maxLength(2000)
  plan?: string;

  @doc("Vital signs measurements")
  vitals?: VitalsData;

  @doc("Symptoms details")
  symptoms?: SymptomsData;

  @doc("Prescriptions issued")
  prescriptions?: PrescriptionData[];

  @doc("Follow-up instructions")
  followUp?: FollowUpData;

  @doc("External integration data (e.g., Mapflow)")
  externalDocumentation?: Record<unknown>;

  @doc("Note status")
  status: ConsultationStatus;

  @doc("When the note was finalized")
  finalizedAt?: utcDateTime;

  @doc("Provider who finalized the consultation")
  finalizedBy?: UUID;
}

/**
 * Consultation status enumeration
 */
@doc("Status of consultation note")
union ConsultationStatus {
  string,
  "draft": "draft",
  "finalized": "finalized", 
  "amended": "amended",
}

/**
 * Create consultation request
 */
@doc("Request to create consultation note")
model CreateConsultationRequest {
  @doc("Patient reference")
  patient: UUID;
  
  @doc("Provider who conducted the consultation")
  provider: UUID;
  
  @doc("Context for idempotency (e.g., 'appointment:123', 'walkin:456')")
  @maxLength(255)
  context?: string;

  @doc("Chief complaint")
  @minLength(1)
  @maxLength(500)
  chiefComplaint?: string;

  @doc("Clinical assessment")
  @minLength(1)
  @maxLength(2000)
  assessment?: string;

  @doc("Treatment plan")
  @minLength(1)
  @maxLength(2000)
  plan?: string;

  @doc("Vital signs measurements")
  vitals?: VitalsData;

  @doc("Symptoms details")
  symptoms?: SymptomsData;

  @doc("Prescriptions")
  prescriptions?: PrescriptionData[];

  @doc("Follow-up instructions")
  followUp?: FollowUpData;
}

/**
 * Update consultation request
 */
@doc("Request to update consultation note")
model UpdateConsultationRequest {
  @doc("Chief complaint - can be null to clear")
  @maxLength(500)
  chiefComplaint?: string | null;

  @doc("Clinical assessment - can be null to clear")
  @maxLength(2000)
  assessment?: string | null;

  @doc("Treatment plan - can be null to clear")
  @maxLength(2000)
  plan?: string | null;

  @doc("Vital signs measurements - can be null to clear")
  vitals?: VitalsData | null;

  @doc("Symptoms details - can be null to clear")
  symptoms?: SymptomsData | null;

  @doc("Prescriptions - can be null to clear")
  prescriptions?: PrescriptionData[] | null;

  @doc("Follow-up instructions - can be null to clear")
  followUp?: FollowUpData | null;

  @doc("External documentation - can be null to clear")
  externalDocumentation?: Record<unknown> | null;
}

/**
 * EMR Module for Telemedicine Minor Ailments
 * 
 * Simplified documentation system focused on quick consultations
 * for minor ailments with flexibility for future integrations.
 */
@route("/emr")
@tag("EMR")
namespace EMRModule {
  /**
   * EMR management interface
   */
  interface EMRManagement {
    @doc("Create consultation note.")
    @operationId("createConsultation")
    @post
    @route("/consultations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider"])
    createConsultation(
      @body consultation: CreateConsultationRequest
    ): ApiCreatedResponse<ConsultationNote>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("List consultations. Results are automatically filtered by role: providers see their own consultations, patients see their own consultations, admins see all.")
    @operationId("listConsultations")
    @get
    @route("/consultations")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider", "admin", "patient"])
    listConsultations(
      @doc("Filter by patient UUID")
      @query patient?: UUID,
      @doc("Filter by consultation status (draft, finalized, amended)")
      @query status?: ConsultationStatus,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<ConsultationNote>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;

    @doc("Get consultation note.")
    @operationId("getConsultation")
    @get
    @route("/consultations/{consultation}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["admin", "provider:owner", "patient:owner"])
    getConsultation(
      @path consultation: UUID
    ): ApiOkResponse<ConsultationNote>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse;

    @doc("Update consultation note.")
    @operationId("updateConsultation")
    @patch(#{implicitOptionality: true})
    @route("/consultations/{consultation}")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider:owner"])
    updateConsultation(
      @path consultation: UUID,
      @body updates: UpdateConsultationRequest
    ): ApiOkResponse<ConsultationNote>
      | ApiBadRequestResponse
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("Finalize consultation note.")
    @operationId("finalizeConsultation")
    @post
    @route("/consultations/{consultation}/finalize")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider:owner"])
    finalizeConsultation(
      @path consultation: UUID
    ): ApiOkResponse<ConsultationNote>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse
      | ApiNotFoundResponse
      | ApiConflictResponse;

    @doc("List patients who have consultations with the current authenticated provider. Results are automatically filtered to the current provider.")
    @operationId("listEMRPatients")
    @get
    @route("/patients")
    @useAuth(bearerAuth)
    @extension("x-security-required-roles", #["provider", "admin"])
    listEMRPatients(
      @doc("Expand related resources (e.g., 'person' to include person details)")
      @query expand?: string,
      ...PaginationQuery
    ): ApiOkResponse<PaginatedResponse<Patient>>
      | ApiUnauthorizedResponse
      | ApiForbiddenResponse;
  }
}
