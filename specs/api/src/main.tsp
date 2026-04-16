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

// Hospital clinical specialties
import "./healthcare/clinical/hospital/emergency-department.tsp";
import "./healthcare/clinical/hospital/nursing-assessment.tsp";
import "./healthcare/clinical/hospital/order-management.tsp";
import "./healthcare/clinical/hospital/icu-critical-care.tsp";
import "./healthcare/clinical/hospital/labor-delivery.tsp";
import "./healthcare/clinical/hospital/oncology.tsp";
import "./healthcare/clinical/hospital/dialysis.tsp";
import "./healthcare/clinical/hospital/behavioral-health.tsp";

// Administrative — scheduling, bed management, insurance, claims, prior auth, credentialing
import "./healthcare/administrative/scheduling.tsp";
import "./healthcare/administrative/bed-management.tsp";
import "./healthcare/administrative/insurance.tsp";
import "./healthcare/administrative/claims.tsp";
import "./healthcare/administrative/prior-authorization.tsp";
import "./healthcare/administrative/staff-credentialing.tsp";
import "./healthcare/administrative/charge-capture.tsp";
import "./healthcare/administrative/patient-financial.tsp";
import "./healthcare/administrative/fee-schedule.tsp";
import "./healthcare/administrative/workforce-scheduling.tsp";

// Ancillary — laboratory, pharmacy, radiology, dental, medication catalog
import "./healthcare/ancillary/laboratory.tsp";
import "./healthcare/ancillary/pharmacy.tsp";
import "./healthcare/ancillary/radiology.tsp";
import "./healthcare/ancillary/dental.tsp";
import "./healthcare/ancillary/medication.tsp";
import "./healthcare/ancillary/medication-administration.tsp";
import "./healthcare/ancillary/blood-bank.tsp";

// Dental specialty
import "./healthcare/ancillary/periodontal.tsp";
import "./healthcare/ancillary/orthodontic.tsp";
import "./healthcare/ancillary/endodontic.tsp";
import "./healthcare/ancillary/prosthodontic.tsp";
import "./healthcare/ancillary/dental-lab.tsp";
import "./healthcare/ancillary/pediatric-dental.tsp";

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
import "./healthcare/operational/recall.tsp";
import "./healthcare/operational/implant-registry.tsp";
import "./healthcare/operational/operatory.tsp";
// Hospital operations
import "./healthcare/operational/hospital/environmental-services.tsp";
import "./healthcare/operational/hospital/patient-transport.tsp";
import "./healthcare/operational/hospital/dietary-services.tsp";
import "./healthcare/operational/hospital/sterile-processing.tsp";
import "./healthcare/operational/hospital/mortuary.tsp";

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

// ============================================================================
// TAG METADATA — Healthcare Hospital
// ============================================================================
@tagMetadata("Healthcare:Hospital", #{
  description: "Hospital-specific clinical specialties and operational services. Emergency department, nursing assessments, clinical order management, ICU/critical care, labor and delivery, oncology, dialysis, behavioral health, environmental services, patient transport, dietary services, sterile processing, and mortuary services."
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

  // ========================================================================
  // HEALTHCARE CLINICAL — Hospital Specialties
  // ========================================================================

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/ed-visits")
  interface EDVisitManagement extends Healthcare.Clinical.Hospital.EmergencyDepartment.EDVisitManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/triage")
  interface TriageManagement extends Healthcare.Clinical.Hospital.EmergencyDepartment.TriageManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/ed-board")
  interface EDBoardService extends Healthcare.Clinical.Hospital.EmergencyDepartment.EDBoardService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/nursing-assessments")
  interface NursingAssessmentManagement extends Healthcare.Clinical.Hospital.NursingAssessment.NursingAssessmentManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/fall-risk")
  interface FallRiskManagement extends Healthcare.Clinical.Hospital.NursingAssessment.FallRiskManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/pressure-injury")
  interface PressureInjuryRiskManagement extends Healthcare.Clinical.Hospital.NursingAssessment.PressureInjuryRiskManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/pain-assessments")
  interface PainAssessmentManagement extends Healthcare.Clinical.Hospital.NursingAssessment.PainAssessmentManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/orders")
  interface ClinicalOrderManagement extends Healthcare.Clinical.Hospital.OrderManagement.ClinicalOrderManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/order-sets")
  interface OrderSetManagement extends Healthcare.Clinical.Hospital.OrderManagement.OrderSetManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/order-verifications")
  interface OrderVerificationService extends Healthcare.Clinical.Hospital.OrderManagement.OrderVerificationService {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/icu-admissions")
  interface ICUAdmissionManagement extends Healthcare.Clinical.Hospital.ICU.ICUAdmissionManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/ventilators")
  interface VentilatorManagement extends Healthcare.Clinical.Hospital.ICU.VentilatorManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/flowsheets")
  interface FlowsheetManagement extends Healthcare.Clinical.Hospital.ICU.FlowsheetManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/severity-scores")
  interface SeverityScoreManagement extends Healthcare.Clinical.Hospital.ICU.SeverityScoreManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/pregnancies")
  interface PregnancyManagement extends Healthcare.Clinical.Hospital.LaborDelivery.PregnancyManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/labor-records")
  interface LaborManagement extends Healthcare.Clinical.Hospital.LaborDelivery.LaborManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/newborns")
  interface NewbornManagement extends Healthcare.Clinical.Hospital.LaborDelivery.NewbornManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/postpartum")
  interface PostpartumManagement extends Healthcare.Clinical.Hospital.LaborDelivery.PostpartumManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/cancer-diagnoses")
  interface CancerDiagnosisManagement extends Healthcare.Clinical.Hospital.Oncology.CancerDiagnosisManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/chemo-protocols")
  interface ChemotherapyProtocolManagement extends Healthcare.Clinical.Hospital.Oncology.ChemotherapyProtocolManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/chemo-cycles")
  interface ChemotherapyCycleManagement extends Healthcare.Clinical.Hospital.Oncology.ChemotherapyCycleManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/radiation-therapy")
  interface RadiationTherapyManagement extends Healthcare.Clinical.Hospital.Oncology.RadiationTherapyManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/dialysis-orders")
  interface DialysisOrderManagement extends Healthcare.Clinical.Hospital.Dialysis.DialysisOrderManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/dialysis-sessions")
  interface DialysisSessionManagement extends Healthcare.Clinical.Hospital.Dialysis.DialysisSessionManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/dialysis-access")
  interface DialysisAccessManagement extends Healthcare.Clinical.Hospital.Dialysis.DialysisAccessManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/psychiatric-assessments")
  interface PsychiatricAssessmentManagement extends Healthcare.Clinical.Hospital.BehavioralHealth.PsychiatricAssessmentManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/involuntary-holds")
  interface InvoluntaryHoldManagement extends Healthcare.Clinical.Hospital.BehavioralHealth.InvoluntaryHoldManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/behavioral-health-plans")
  interface BehavioralHealthPlanManagement extends Healthcare.Clinical.Hospital.BehavioralHealth.BehavioralHealthPlanManagement {}

  @tag("Healthcare:Clinical")
  @route("/healthcare/clinical/hospital/substance-use")
  interface SubstanceUseAssessmentManagement extends Healthcare.Clinical.Hospital.BehavioralHealth.SubstanceUseAssessmentManagement {}

  // ========================================================================
  // HEALTHCARE ADMINISTRATIVE (new: charge capture, patient financial, fee schedule, workforce)
  // ========================================================================

  @tag("Healthcare:Administrative")
  @route("/healthcare/charge-capture/items")
  interface ChargeItemManagement extends Healthcare.Administrative.ChargeCapture.ChargeItemManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/charge-capture/definitions")
  interface ChargeDefinitionManagement extends Healthcare.Administrative.ChargeCapture.ChargeDefinitionManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/patient-financial/payments")
  interface PaymentManagement extends Healthcare.Administrative.PatientFinancial.PaymentManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/patient-financial/receipts")
  interface ReceiptManagement extends Healthcare.Administrative.PatientFinancial.ReceiptManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/patient-financial/payment-plans")
  interface PaymentPlanManagement extends Healthcare.Administrative.PatientFinancial.PaymentPlanManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/patient-financial/promissory-notes")
  interface PromissoryNoteManagement extends Healthcare.Administrative.PatientFinancial.PromissoryNoteManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/fee-schedules")
  interface FeeScheduleManagement extends Healthcare.Administrative.FeeSchedule.FeeScheduleManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/fee-schedules/items")
  interface FeeScheduleItemManagement extends Healthcare.Administrative.FeeSchedule.FeeScheduleItemManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/fee-schedules/contract-rates")
  interface InsuranceContractRateManagement extends Healthcare.Administrative.FeeSchedule.InsuranceContractRateManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/fee-schedules/discounts")
  interface DiscountManagement extends Healthcare.Administrative.FeeSchedule.DiscountManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/workforce/schedules")
  interface WorkScheduleManagement extends Healthcare.Administrative.WorkforceScheduling.WorkScheduleManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/workforce/shifts")
  interface ShiftAssignmentManagement extends Healthcare.Administrative.WorkforceScheduling.ShiftAssignmentManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/workforce/time-off")
  interface TimeOffRequestManagement extends Healthcare.Administrative.WorkforceScheduling.TimeOffRequestManagement {}

  @tag("Healthcare:Administrative")
  @route("/healthcare/workforce/on-call")
  interface OnCallScheduleManagement extends Healthcare.Administrative.WorkforceScheduling.OnCallScheduleManagement {}

  // ========================================================================
  // HEALTHCARE ANCILLARY — Dental Specialties
  // ========================================================================

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/periodontal/exams")
  interface PerioExamManagement extends Healthcare.Ancillary.Periodontal.PerioExamManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/periodontal/furcations")
  interface FurcationManagement extends Healthcare.Ancillary.Periodontal.FurcationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/periodontal/mobility")
  interface MobilityManagement extends Healthcare.Ancillary.Periodontal.MobilityManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/orthodontic/cases")
  interface OrthoCaseManagement extends Healthcare.Ancillary.Orthodontic.OrthoCaseManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/orthodontic/stages")
  interface OrthoStageManagement extends Healthcare.Ancillary.Orthodontic.OrthoStageManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/orthodontic/aligners")
  interface AlignerSeriesManagement extends Healthcare.Ancillary.Orthodontic.AlignerSeriesManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/orthodontic/progress")
  interface OrthoProgressManagement extends Healthcare.Ancillary.Orthodontic.OrthoProgressManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/endodontic/records")
  interface EndoRecordManagement extends Healthcare.Ancillary.Endodontic.EndoRecordManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/endodontic/irrigations")
  interface IrrigationManagement extends Healthcare.Ancillary.Endodontic.IrrigationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/endodontic/retreatments")
  interface EndoRetreatmentManagement extends Healthcare.Ancillary.Endodontic.EndoRetreatmentManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/prosthodontic/records")
  interface ProsthoRecordManagement extends Healthcare.Ancillary.Prosthodontic.ProsthoRecordManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/prosthodontic/shades")
  interface ShadeSelectionManagement extends Healthcare.Ancillary.Prosthodontic.ShadeSelectionManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/prosthodontic/impressions")
  interface ImpressionManagement extends Healthcare.Ancillary.Prosthodontic.ImpressionManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/prosthodontic/lab-cases")
  interface LabCaseLinkManagement extends Healthcare.Ancillary.Prosthodontic.LabCaseLinkManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/lab/cases")
  interface DentalLabCaseManagement extends Healthcare.Ancillary.DentalLab.DentalLabCaseManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/lab/providers")
  interface DentalLabProviderManagement extends Healthcare.Ancillary.DentalLab.DentalLabProviderManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/lab/communications")
  interface LabCommunicationManagement extends Healthcare.Ancillary.DentalLab.LabCommunicationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/eruptions")
  interface EruptionManagement extends Healthcare.Ancillary.PediatricDental.EruptionManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/exfoliations")
  interface ExfoliationManagement extends Healthcare.Ancillary.PediatricDental.ExfoliationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/behavior")
  interface BehaviorAssessmentManagement extends Healthcare.Ancillary.PediatricDental.BehaviorAssessmentManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/fluoride")
  interface FluorideApplicationManagement extends Healthcare.Ancillary.PediatricDental.FluorideApplicationManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/sealants")
  interface SealantManagement extends Healthcare.Ancillary.PediatricDental.SealantManagement {}

  @tag("Healthcare:Ancillary")
  @route("/healthcare/dental/pediatric/space-maintainers")
  interface SpaceMaintainerManagement extends Healthcare.Ancillary.PediatricDental.SpaceMaintainerManagement {}

  // ========================================================================
  // HEALTHCARE OPERATIONAL (new: recall, implant registry, operatory, hospital ops)
  // ========================================================================

  @tag("Healthcare:Operational")
  @route("/healthcare/recall/rules")
  interface RecallRuleManagement extends Healthcare.Operational.Recall.RecallRuleManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/recall/schedules")
  interface RecallScheduleManagement extends Healthcare.Operational.Recall.RecallScheduleManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/recall/campaigns")
  interface RecallCampaignManagement extends Healthcare.Operational.Recall.RecallCampaignManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/implant-registry/implants")
  interface ImplantManagement extends Healthcare.Operational.ImplantRegistry.ImplantManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/implant-registry/osseointegration")
  interface OsseointegrationCheckManagement extends Healthcare.Operational.ImplantRegistry.OsseointegrationCheckManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/implant-registry/recalls")
  interface ImplantRecallService extends Healthcare.Operational.ImplantRegistry.ImplantRecallService {}

  @tag("Healthcare:Operational")
  @route("/healthcare/operatory/rooms")
  interface OperatoryManagement extends Healthcare.Operational.Operatory.OperatoryManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/operatory/assignments")
  interface OperatoryAssignmentManagement extends Healthcare.Operational.Operatory.OperatoryAssignmentManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/operatory/chair-blocks")
  interface ChairTimeBlockManagement extends Healthcare.Operational.Operatory.ChairTimeBlockManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/operatory/turnovers")
  interface TurnoverManagement extends Healthcare.Operational.Operatory.TurnoverManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/operatory/metrics")
  interface OperatoryMetricsService extends Healthcare.Operational.Operatory.OperatoryMetricsService {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/cleaning-tasks")
  interface CleaningTaskManagement extends Healthcare.Operational.Hospital.EVS.CleaningTaskManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/cleaning-schedules")
  interface CleaningScheduleManagement extends Healthcare.Operational.Hospital.EVS.CleaningScheduleManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/transport-requests")
  interface TransportRequestManagement extends Healthcare.Operational.Hospital.Transport.TransportRequestManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/transport-teams")
  interface TransportTeamManagement extends Healthcare.Operational.Hospital.Transport.TransportTeamManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/diet-orders")
  interface DietOrderManagement extends Healthcare.Operational.Hospital.Dietary.DietOrderManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/meal-service")
  interface MealServiceManagement extends Healthcare.Operational.Hospital.Dietary.MealServiceManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/nutrition-screening")
  interface NutritionScreeningManagement extends Healthcare.Operational.Hospital.Dietary.NutritionScreeningManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/instrument-sets")
  interface InstrumentSetManagement extends Healthcare.Operational.Hospital.SterileProcessing.InstrumentSetManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/sterilization-cycles")
  interface SterilizationCycleManagement extends Healthcare.Operational.Hospital.SterileProcessing.SterilizationCycleManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/biological-indicators")
  interface BiologicalIndicatorManagement extends Healthcare.Operational.Hospital.SterileProcessing.BiologicalIndicatorManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/sterilization-logs")
  interface SterilizationLogManagement extends Healthcare.Operational.Hospital.SterileProcessing.SterilizationLogManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/deceased-records")
  interface DeceasedRecordManagement extends Healthcare.Operational.Hospital.Mortuary.DeceasedRecordManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/body-releases")
  interface BodyReleaseManagement extends Healthcare.Operational.Hospital.Mortuary.BodyReleaseManagement {}

  @tag("Healthcare:Operational")
  @route("/healthcare/hospital-ops/mortuary-storage")
  interface MortuaryStorageManagement extends Healthcare.Operational.Hospital.Mortuary.MortuaryStorageManagement {}
}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial healthcare API version")
  v1: "1.0",
}
