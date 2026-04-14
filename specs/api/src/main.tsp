import "@typespec/http";
import "@typespec/versioning";
import "@typespec/openapi";

import "./common/models.tsp";
import "./common/errors.tsp";
import "./common/pagination.tsp";
import "./common/security.tsp";

// ============================================================================
// PLATFORM INFRASTRUCTURE MODULES (kept from mono-js-lf)
// ============================================================================
import "./modules/person.tsp";
import "./modules/audit.tsp";
import "./modules/notifs.tsp";
import "./modules/comms.tsp";
import "./modules/storage.tsp";
import "./modules/email.tsp";
import "./modules/reviews.tsp";

// ============================================================================
// HEALTHCARE MODULES (redesigned for universal healthcare)
// ============================================================================

// Core — shared primitives and terminology
import "./healthcare/core/primitives.tsp";
import "./healthcare/core/terminology.tsp";

// Foundation — patients, providers, organizations, locations
import "./modules/patient.tsp";
import "./modules/provider.tsp";
import "./healthcare/foundation/organization.tsp";
import "./healthcare/foundation/location.tsp";

// Clinical — encounters, conditions, orders, results, medications, procedures
import "./healthcare/clinical/encounter.tsp";
import "./healthcare/clinical/condition.tsp";
import "./healthcare/clinical/allergy.tsp";
import "./healthcare/clinical/medication-request.tsp";
import "./healthcare/clinical/observation.tsp";
import "./healthcare/clinical/procedure.tsp";
import "./healthcare/clinical/immunization.tsp";
import "./healthcare/clinical/service-request.tsp";
import "./healthcare/clinical/document-reference.tsp";
import "./healthcare/clinical/family-history.tsp";

// Administrative — scheduling, bed management, insurance, claims, prior auth
import "./healthcare/administrative/scheduling.tsp";
import "./healthcare/administrative/bed-management.tsp";
import "./healthcare/administrative/insurance.tsp";
import "./healthcare/administrative/claims.tsp";
import "./healthcare/administrative/prior-authorization.tsp";

// Ancillary — laboratory, pharmacy, radiology, dental
import "./healthcare/ancillary/laboratory.tsp";
import "./healthcare/ancillary/pharmacy.tsp";
import "./healthcare/ancillary/radiology.tsp";
import "./healthcare/ancillary/dental.tsp";

// Support — care planning, consent, CDS hooks, SDOH
import "./healthcare/support/care-plan.tsp";
import "./healthcare/support/consent.tsp";
import "./healthcare/support/cds.tsp";
import "./healthcare/support/sdoh.tsp";

using TypeSpec.Http;
using TypeSpec.Versioning;
using TypeSpec.OpenAPI;

/**
 * Monobase Healthcare Application API
 *
 * Universal healthcare API platform providing FHIR-informed endpoints for
 * clinical, administrative, ancillary, and support healthcare domains.
 * Built on enterprise-grade infrastructure with audit, notifications,
 * communications, and storage services.
 */
@server("https://api.example.com", "Production server")
@server("https://stg.api.example.com", "Staging server")
@versioned(Versions)
@service(#{
  title: "Monobase Healthcare API"
})

// ============================================================================
// TAG METADATA — Platform Infrastructure
// ============================================================================
@tagMetadata("Person", #{
  description: "Central person management module serving as the foundation for all user types. Handles core PII with strict data protection, identity verification, profile updates, and consent preferences."
})
@tagMetadata("Audit", #{
  description: "Enterprise-grade audit logging and compliance tracking. Records all data access, modifications, and system events with immutable audit trails. HIPAA-compliant retention and SIEM integration."
})
@tagMetadata("Notifs", #{
  description: "Multi-channel notification delivery for user engagement. Manages email, push notifications, and in-app messaging with delivery tracking."
})
@tagMetadata("Comms", #{
  description: "Video call and chat functionality for professional sessions. WebRTC-based video calls with integrated messaging."
})
@tagMetadata("Storage", #{
  description: "Secure document and file management with S3 integration. Encryption at rest and in transit, presigned URLs, virus scanning."
})
@tagMetadata("Email", #{
  description: "Runtime-configurable email service with dynamic template management. Multi-provider support (SMTP/Postmark)."
})
@tagMetadata("Reviews", #{
  description: "NPS review system for feedback collection across appointments, sessions, and services."
})

// ============================================================================
// TAG METADATA — Healthcare Foundation
// ============================================================================
@tagMetadata("Patient", #{
  description: "FHIR-aligned patient demographics and registration. Manages identifiers (MRN), names, contacts, communication preferences, emergency contacts, insurance coverage linkage, and provider relationships."
})
@tagMetadata("Provider", #{
  description: "Healthcare provider management with FHIR Practitioner and PractitionerRole models. Manages NPI, DEA, state licenses, board certifications, specialties, qualifications, and practice roles across organizations and locations."
})
@tagMetadata("Healthcare:Foundation", #{
  description: "Organizations and locations. Manages healthcare facilities (hospitals, clinics, pharmacies, labs), departments, rooms, beds, and virtual locations."
})

// ============================================================================
// TAG METADATA — Healthcare Clinical
// ============================================================================
@tagMetadata("Healthcare:Clinical", #{
  description: "Core clinical domain. Encounters (outpatient, inpatient, emergency, virtual), conditions/problem lists, allergies, medications/prescriptions, observations (vitals, lab results), procedures, immunizations, orders (lab, imaging, referral), clinical documents (SOAP notes, discharge summaries), and family history. All FHIR R4-aligned with ICD-10, SNOMED CT, LOINC, CPT, RxNorm coding."
})

// ============================================================================
// TAG METADATA — Healthcare Administrative
// ============================================================================
@tagMetadata("Healthcare:Administrative", #{
  description: "Healthcare administration. Scheduling (FHIR Schedule/Slot/Appointment), bed management, insurance coverage and eligibility verification, claims submission and adjudication, and prior authorization workflows (CMS-mandated)."
})

// ============================================================================
// TAG METADATA — Healthcare Ancillary
// ============================================================================
@tagMetadata("Healthcare:Ancillary", #{
  description: "Ancillary healthcare services. Laboratory (specimens, diagnostic reports), pharmacy (medication dispensing, drug interaction checking), radiology (imaging studies, DICOM/PACS), and dental (odontogram, treatment plans, CDT codes)."
})

// ============================================================================
// TAG METADATA — Healthcare Support
// ============================================================================
@tagMetadata("Healthcare:Support", #{
  description: "Healthcare support services. Care planning (care plans, care teams, goals), consent management (FHIR Consent), clinical decision support (CDS Hooks), and social determinants of health screening and referrals (CMS-mandated SDOH)."
})

namespace MonobaseHealthcareAPI {

  // ========================================================================
  // PLATFORM INFRASTRUCTURE
  // ========================================================================

  @tag("Person")
  @route("/persons")
  interface PersonManagement extends PersonModule.PersonManagement {}

  @tag("Audit")
  @route("/audit")
  interface AuditManagement extends AuditModule.AuditManagement {}

  @tag("Notifs")
  @route("/notifs")
  interface NotificationManagement extends Notifs.NotificationManagement {}

  @tag("Comms")
  @route("/comms")
  interface CommsManagement extends CommsModule.CommsManagement {}

  @tag("Storage")
  interface StorageManagement extends StorageModule.StorageManagement {}

  @tag("Email")
  @route("/email")
  interface EmailTemplateManagement extends EmailModule.EmailTemplateManagement {}

  @tag("Email")
  @route("/email")
  interface EmailQueueManagement extends EmailModule.EmailQueueManagement {}

  @tag("Reviews")
  @route("/reviews")
  interface ReviewsManagement extends ReviewsModule.ReviewsManagement {}

  // ========================================================================
  // HEALTHCARE FOUNDATION
  // ========================================================================

  @tag("Patient")
  @route("/patients")
  interface PatientManagement extends PatientModule.PatientManagement {}

  @tag("Provider")
  @route("/providers")
  interface PractitionerManagement extends ProviderModule.PractitionerManagement {}

  @tag("Provider")
  @route("/providers")
  interface PractitionerRoleManagement extends ProviderModule.PractitionerRoleManagement {}

  @tag("Healthcare:Foundation")
  @route("/healthcare/organizations")
  interface OrganizationManagement extends Healthcare.Foundation.OrganizationManagement {}

  @tag("Healthcare:Foundation")
  @route("/healthcare/locations")
  interface LocationManagement extends Healthcare.Foundation.LocationManagement {}

  @tag("Healthcare:Foundation")
  @route("/healthcare/departments")
  interface DepartmentManagement extends Healthcare.Foundation.DepartmentManagement {}

  // ========================================================================
  // HEALTHCARE CLINICAL
  // ========================================================================

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/encounters")
  interface EncounterService extends Healthcare.Clinical.Encounters.EncounterService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/conditions")
  interface ConditionService extends Healthcare.Clinical.Conditions.ConditionService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/allergies")
  interface AllergyIntoleranceService extends Healthcare.Clinical.Allergies.AllergyIntoleranceService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/medication-requests")
  interface MedicationRequestService extends Healthcare.Clinical.MedicationRequests.MedicationRequestService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/observations")
  interface ObservationService extends Healthcare.Clinical.Observations.ObservationService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/procedures")
  interface ProcedureService extends Healthcare.Clinical.Procedures.ProcedureService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/immunizations")
  interface ImmunizationService extends Healthcare.Clinical.Immunizations.ImmunizationService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/service-requests")
  interface ServiceRequestService extends Healthcare.Clinical.ServiceRequests.ServiceRequestService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/document-references")
  interface DocumentReferenceService extends Healthcare.Clinical.DocumentReferences.DocumentReferenceService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/family-history")
  interface FamilyMemberHistoryService extends Healthcare.Clinical.FamilyHistory.FamilyMemberHistoryService {}

  // ========================================================================
  // HEALTHCARE ADMINISTRATIVE
  // ========================================================================

  @tag("Healthcare:Administrative")
  @route("/healthcare/scheduling/schedules")
  interface ScheduleManagement extends Healthcare.Administrative.Scheduling.ScheduleManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/scheduling/slots")
  interface SlotManagement extends Healthcare.Administrative.Scheduling.SlotManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/scheduling/appointments")
  interface AppointmentManagement extends Healthcare.Administrative.Scheduling.AppointmentManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/bed-management")
  interface BedManagementService extends Healthcare.Administrative.BedManagement.BedManagementService {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/insurance/coverages")
  interface CoverageManagement extends Healthcare.Administrative.Insurance.CoverageManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/insurance/eligibility")
  interface EligibilityService extends Healthcare.Administrative.Insurance.EligibilityService {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/claims")
  interface ClaimManagement extends Healthcare.Administrative.Claims.ClaimManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/claims/responses")
  interface ClaimResponseManagement extends Healthcare.Administrative.Claims.ClaimResponseManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/prior-authorizations")
  interface PriorAuthorizationManagement extends Healthcare.Administrative.PriorAuth.PriorAuthorizationManagement {}

  // ========================================================================
  // HEALTHCARE ANCILLARY
  // ========================================================================

  @tag("Healthcare:Ancillary")
  @route("/healthcare/laboratory/specimens")
  interface SpecimenManagement extends Healthcare.Ancillary.Laboratory.SpecimenManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/laboratory/diagnostic-reports")
  interface DiagnosticReportManagement extends Healthcare.Ancillary.Laboratory.DiagnosticReportManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/pharmacy/dispenses")
  interface MedicationDispenseManagement extends Healthcare.Ancillary.Pharmacy.MedicationDispenseManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/pharmacy/interactions")
  interface DrugInteractionService extends Healthcare.Ancillary.Pharmacy.DrugInteractionService {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/radiology/imaging-studies")
  interface ImagingStudyManagement extends Healthcare.Ancillary.Radiology.ImagingStudyManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/odontograms")
  interface OdontogramManagement extends Healthcare.Ancillary.Dental.OdontogramManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/treatment-plans")
  interface DentalTreatmentPlanManagement extends Healthcare.Ancillary.Dental.DentalTreatmentPlanManagement {}

  // ========================================================================
  // HEALTHCARE SUPPORT
  // ========================================================================

  @tag("Healthcare:Support")
  @route("/healthcare/care-planning/care-plans")
  interface CarePlanManagement extends Healthcare.Support.CarePlanning.CarePlanManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/care-planning/care-teams")
  interface CareTeamManagement extends Healthcare.Support.CarePlanning.CareTeamManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/care-planning/goals")
  interface GoalManagement extends Healthcare.Support.CarePlanning.GoalManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/consents")
  interface ConsentManagement extends Healthcare.Support.ConsentManagement.ConsentManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/cds-hooks")
  interface CDSService extends Healthcare.Support.CDS.CDSService {}

  @tag("Healthcare:Support")
  @route("/healthcare/sdoh/screenings")
  interface SDOHScreeningManagement extends Healthcare.Support.SDOH.SDOHScreeningManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/sdoh/referrals")
  interface SDOHReferralManagement extends Healthcare.Support.SDOH.SDOHReferralManagement {}
}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial healthcare API version")
  v1: "1.0",
}
