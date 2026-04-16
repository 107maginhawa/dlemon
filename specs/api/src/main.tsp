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
import "./healthcare/clinical/related-person.tsp";
import "./healthcare/clinical/episode-of-care.tsp";
import "./healthcare/clinical/flag.tsp";
import "./healthcare/clinical/composition.tsp";
import "./healthcare/clinical/surgical-management.tsp";
import "./healthcare/clinical/clinical-communication.tsp";

// Administrative — scheduling, bed management, insurance, claims, prior auth, credentialing
import "./healthcare/administrative/scheduling.tsp";
import "./healthcare/administrative/bed-management.tsp";
import "./healthcare/administrative/insurance.tsp";
import "./healthcare/administrative/claims.tsp";
import "./healthcare/administrative/prior-authorization.tsp";
import "./healthcare/administrative/staff-credentialing.tsp";

// Ancillary — laboratory, pharmacy, radiology, dental, medication catalog
import "./healthcare/ancillary/laboratory.tsp";
import "./healthcare/ancillary/pharmacy.tsp";
import "./healthcare/ancillary/radiology.tsp";
import "./healthcare/ancillary/dental.tsp";
import "./healthcare/ancillary/medication.tsp";
import "./healthcare/ancillary/medication-administration.tsp";
import "./healthcare/ancillary/blood-bank.tsp";

// Support — care planning, consent, CDS hooks, SDOH, provenance, signatures, questionnaires, tasks
import "./healthcare/support/care-plan.tsp";
import "./healthcare/support/consent.tsp";
import "./healthcare/support/cds.tsp";
import "./healthcare/support/sdoh.tsp";
import "./healthcare/support/provenance.tsp";
import "./healthcare/support/signature.tsp";
import "./healthcare/support/questionnaire.tsp";
import "./healthcare/support/task.tsp";
import "./healthcare/support/incident-reporting.tsp";
import "./healthcare/support/infection-control.tsp";

// Operational — inventory, devices
import "./healthcare/operational/inventory.tsp";
import "./healthcare/operational/device.tsp";

// Conformance — FHIR capability statement, operations, terminology, bulk export, subscriptions, IPS
import "./healthcare/conformance/capability-statement.tsp";
import "./healthcare/conformance/fhir-operations.tsp";
import "./healthcare/conformance/terminology-service.tsp";
import "./healthcare/conformance/bulk-export.tsp";
import "./healthcare/conformance/subscriptions.tsp";
import "./healthcare/conformance/ips.tsp";

// Analytics — de-identification, cohorts, AI metadata
import "./healthcare/analytics/de-identification.tsp";
import "./healthcare/analytics/cohort.tsp";
import "./healthcare/analytics/ai-metadata.tsp";

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
  description: "Healthcare support services. Care planning, consent, CDS Hooks, SDOH, provenance, electronic signatures, questionnaires, and task/workflow management."
})

// ============================================================================
// TAG METADATA — Healthcare Operational
// ============================================================================
@tagMetadata("Healthcare:Operational", #{
  description: "Operational resource management. Inventory tracking (items, batches, lots, expiry), medical devices (assignment, metrics, calibration), supply consumption, and storage locations."
})

// ============================================================================
// TAG METADATA — Healthcare Analytics
// ============================================================================
@tagMetadata("Healthcare:Analytics", #{
  description: "Analytics, research, and AI. De-identification profiles, cohort definitions, research data extracts, data lineage tracking, and AI output metadata with confidence scores and evidence sources."
})

// ============================================================================
// TAG METADATA — Healthcare Conformance
// ============================================================================
@tagMetadata("Healthcare:Conformance", #{
  description: "FHIR conformance and interoperability. CapabilityStatement, FHIR operations ($match, $everything, $validate, $document), terminology services ($lookup, $expand, $validate-code, $translate), bulk data export ($export), FHIR subscriptions, and International Patient Summary (IPS) generation."
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

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/related-persons")
  interface RelatedPersonManagement extends Healthcare.Clinical.RelatedPersons.RelatedPersonManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/episodes-of-care")
  interface EpisodeOfCareManagement extends Healthcare.Clinical.EpisodesOfCare.EpisodeOfCareManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/flags")
  interface FlagManagement extends Healthcare.Clinical.Flags.FlagManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/compositions")
  interface CompositionManagement extends Healthcare.Clinical.Compositions.CompositionManagement {}

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

  @tag("Healthcare:Ancillary")
  @route("/healthcare/medications")
  interface MedicationCatalogManagement extends Healthcare.Ancillary.Medications.MedicationCatalogManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/formulary")
  interface FormularyManagement extends Healthcare.Ancillary.Medications.FormularyManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/medication-administrations")
  interface MedicationAdministrationManagement extends Healthcare.Ancillary.MedicationAdministrations.MedicationAdministrationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/pharmacy/reconciliations")
  interface ReconciliationManagement extends Healthcare.Ancillary.Pharmacy.ReconciliationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/laboratory/verifications")
  interface LabVerificationService extends Healthcare.Ancillary.Laboratory.LabVerificationService {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/radiology/reports")
  interface RadiologyReportManagement extends Healthcare.Ancillary.Radiology.RadiologyReportManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/pharmacy/adherence")
  interface AdherenceManagement extends Healthcare.Ancillary.Pharmacy.AdherenceManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/laboratory/panels")
  interface ResultPanelManagement extends Healthcare.Ancillary.Laboratory.ResultPanelManagement {}

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

  @tag("Healthcare:Support")
  @route("/healthcare/provenance")
  interface ProvenanceManagement extends Healthcare.Support.Provenance.ProvenanceManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/signatures")
  interface SignatureManagement extends Healthcare.Support.Signatures.SignatureManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/questionnaires")
  interface QuestionnaireManagement extends Healthcare.Support.Questionnaires.QuestionnaireManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/questionnaire-responses")
  interface QuestionnaireResponseManagement extends Healthcare.Support.Questionnaires.QuestionnaireResponseManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/tasks")
  interface TaskManagement extends Healthcare.Support.Tasks.TaskManagement {}

  // ========================================================================
  // HEALTHCARE OPERATIONAL
  // ========================================================================

  @tag("Healthcare:Operational")
  @route("/healthcare/inventory/items")
  interface InventoryManagement extends Healthcare.Operational.Inventory.InventoryManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/inventory/batches")
  interface BatchManagement extends Healthcare.Operational.Inventory.BatchManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/inventory/consumption")
  interface SupplyConsumptionManagement extends Healthcare.Operational.Inventory.SupplyConsumptionManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/devices")
  interface DeviceManagement extends Healthcare.Operational.Devices.DeviceManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/device-assignments")
  interface DeviceAssignmentManagement extends Healthcare.Operational.Devices.DeviceAssignmentManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/device-metrics")
  interface DeviceMetricManagement extends Healthcare.Operational.Devices.DeviceMetricManagement {}

  // ========================================================================
  // HEALTHCARE ANALYTICS
  // ========================================================================

  @tag("Healthcare:Analytics")
  @route("/healthcare/analytics/de-identification")
  interface DeIdentificationManagement extends Healthcare.Analytics.DeIdentification.DeIdentificationManagement {}

  @tag("Healthcare:Analytics")
  @route("/healthcare/analytics/cohorts")
  interface CohortManagement extends Healthcare.Analytics.Cohorts.CohortManagement {}

  @tag("Healthcare:Analytics")
  @route("/healthcare/analytics/research-extracts")
  interface ResearchExtractManagement extends Healthcare.Analytics.Cohorts.ResearchExtractManagement {}

  @tag("Healthcare:Analytics")
  @route("/healthcare/analytics/data-lineage")
  interface DataLineageManagement extends Healthcare.Analytics.Cohorts.DataLineageManagement {}

  @tag("Healthcare:Analytics")
  @route("/healthcare/analytics/ai-outputs")
  interface AIOutputManagement extends Healthcare.Analytics.AIMetadata.AIOutputManagement {}

  // ========================================================================
  // HEALTHCARE CLINICAL (new: surgical, communication)
  // ========================================================================

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/surgical-cases")
  interface SurgicalCaseManagement extends Healthcare.Clinical.Surgical.SurgicalCaseManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/operating-rooms")
  interface OperatingRoomManagement extends Healthcare.Clinical.Surgical.OperatingRoomManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/anesthesia-records")
  interface AnesthesiaRecordManagement extends Healthcare.Clinical.Surgical.AnesthesiaRecordManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/handoffs")
  interface ClinicalHandoffManagement extends Healthcare.Clinical.Communication.ClinicalHandoffManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/messages")
  interface ClinicalMessageManagement extends Healthcare.Clinical.Communication.ClinicalMessageManagement {}

  // ========================================================================
  // HEALTHCARE ADMINISTRATIVE (new: credentialing)
  // ========================================================================

  @tag("Healthcare:Administrative")
  @route("/healthcare/credentialing/records")
  interface CredentialingManagement extends Healthcare.Administrative.Credentialing.CredentialingManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/credentialing/privileges")
  interface PrivilegeManagement extends Healthcare.Administrative.Credentialing.PrivilegeManagement {}

  // ========================================================================
  // HEALTHCARE ANCILLARY (new: blood bank)
  // ========================================================================

  @tag("Healthcare:Ancillary")
  @route("/healthcare/blood-bank/products")
  interface BloodProductManagement extends Healthcare.Ancillary.BloodBank.BloodProductManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/blood-bank/crossmatch")
  interface CrossmatchManagement extends Healthcare.Ancillary.BloodBank.CrossmatchManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/blood-bank/transfusions")
  interface TransfusionManagement extends Healthcare.Ancillary.BloodBank.TransfusionManagement {}

  // ========================================================================
  // HEALTHCARE SUPPORT (new: incident, infection)
  // ========================================================================

  @tag("Healthcare:Support")
  @route("/healthcare/quality/incidents")
  interface IncidentReportManagement extends Healthcare.Support.IncidentReporting.IncidentReportManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/quality/measures")
  interface QualityMeasureManagement extends Healthcare.Support.IncidentReporting.QualityMeasureManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/infection-control/surveillance")
  interface InfectionSurveillanceManagement extends Healthcare.Support.InfectionControl.InfectionSurveillanceManagement {}

  @tag("Healthcare:Support")
  @route("/healthcare/infection-control/antibiograms")
  interface AntibiogramManagement extends Healthcare.Support.InfectionControl.AntibiogramManagement {}

  // ========================================================================
  // HEALTHCARE CONFORMANCE (FHIR)
  // ========================================================================

  @tag("Healthcare:Conformance")
  @route("/fhir")
  interface CapabilityStatementService extends Healthcare.Conformance.Capabilities.CapabilityStatementService {}

  @tag("Healthcare:Conformance")
  @route("/fhir")
  interface FHIROperationsService extends Healthcare.Conformance.Operations.FHIROperationsService {}

  @tag("Healthcare:Conformance")
  @route("/healthcare/terminology")
  interface TerminologyService extends Healthcare.Conformance.Terminology.TerminologyService {}

  @tag("Healthcare:Conformance")
  @route("/fhir")
  interface BulkExportService extends Healthcare.Conformance.BulkExport.BulkExportService {}

  @tag("Healthcare:Conformance")
  @route("/healthcare/subscriptions")
  interface SubscriptionManagement extends Healthcare.Conformance.Subscriptions.SubscriptionManagement {}

  @tag("Healthcare:Conformance")
  @route("/fhir")
  interface IPSService extends Healthcare.Conformance.IPS.IPSService {}
}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial healthcare API version")
  v1: "1.0",
}
