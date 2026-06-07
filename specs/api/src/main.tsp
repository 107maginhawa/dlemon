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
import "./modules/billing.tsp";
import "./modules/booking.tsp";
import "./modules/audit.tsp";
import "./modules/notifs.tsp";
import "./modules/comms.tsp";
import "./modules/storage.tsp";
import "./modules/email.tsp";
import "./modules/reviews.tsp";

// ============================================================================
// DENTALEMON MODULES
// ============================================================================
import "./modules/dental-org.tsp";
import "./modules/dental-patient.tsp";
import "./modules/dental-visit.tsp";
import "./modules/dental-clinical.tsp";
import "./modules/dental-pmd.tsp";
import "./modules/dental-scheduling.tsp";
import "./modules/dental-billing.tsp";
import "./modules/dental-imaging.tsp";
import "./modules/dental-perio.tsp";
import "./modules/dental-erasure.tsp";
import "./modules/dental-audit.tsp";
import "./modules/dental-legal-hold.tsp";
import "./modules/dental-patient-engagement.tsp";
import "./modules/dental-patient-finance.tsp";
import "./modules/dental-clinical-ops.tsp";
import "./modules/dental-ops-extras.tsp";
import "./modules/dental-portal.tsp";

// ============================================================================
// HEALTHCARE MODULES (redesigned for universal healthcare)
// ============================================================================

// Core — shared primitives and terminology
import "./healthcare/core/primitives.tsp";
import "./healthcare/core/terminology.tsp";

// Foundation — patients, providers, organizations, locations
import "./modules/patient.tsp";
import "./modules/provider.tsp";
import "./modules/emr.tsp";
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
import "./healthcare/clinical/hospital/wound-care.tsp";
import "./healthcare/clinical/hospital/code-blue.tsp";

// Hospital clinical specialties (wave 3)
import "./healthcare/clinical/hospital/specialty/respiratory-therapy.tsp";
import "./healthcare/clinical/hospital/specialty/cardiology.tsp";
import "./healthcare/clinical/hospital/specialty/rehab-therapy.tsp";
import "./healthcare/clinical/hospital/specialty/palliative-hospice.tsp";
import "./healthcare/clinical/hospital/specialty/post-acute-care.tsp";
import "./healthcare/clinical/hospital/specialty/neonatal.tsp";

// Clinical — ADT events
import "./healthcare/clinical/adt-events.tsp";

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

// Hospital administrative
import "./healthcare/administrative/hospital/him-roi.tsp";
import "./healthcare/administrative/hospital/cost-accounting.tsp";
import "./healthcare/administrative/hospital/gme.tsp";

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
import "./healthcare/ancillary/cosmetic-dental.tsp";
import "./healthcare/ancillary/oral-surgery-dental.tsp";

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
import "./healthcare/support/telehealth.tsp";
import "./healthcare/support/clinical-outcomes.tsp";
import "./healthcare/support/data-import.tsp";
import "./healthcare/support/workflow-automation.tsp";
import "./healthcare/support/proxy-access.tsp";
import "./healthcare/support/break-glass.tsp";
import "./healthcare/support/mandatory-reporting.tsp";
import "./healthcare/support/public-health/electronic-case-reporting.tsp";
import "./healthcare/support/public-health/immunization-registry.tsp";
import "./healthcare/support/public-health/vital-records.tsp";
import "./healthcare/support/public-health/cancer-registry.tsp";
import "./healthcare/support/public-health/surveillance.tsp";

// Compliance — program management, privacy workflows
import "./healthcare/compliance/compliance-program.tsp";
import "./healthcare/compliance/privacy-workflow.tsp";

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
import "./healthcare/operational/hospital/peer-review.tsp";
import "./healthcare/operational/hospital/emergency-preparedness.tsp";
import "./healthcare/operational/patient-portal.tsp";
import "./healthcare/operational/external-connectors.tsp";

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
import "./healthcare/analytics/reporting.tsp";

using TypeSpec.Http;
using TypeSpec.Versioning;
using TypeSpec.OpenAPI;

/**
 * Monobase Application API
 *
 * Generic API for SaaS application platforms. Provides identity, billing,
 * scheduling, communications, storage, and notification primitives that
 * any product can compose into its own domain workflows.
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
  description: "Central person management module serving as the foundation for all user types in the platform. Handles core PII (Personally Identifiable Information) with strict data protection. Manages identity verification, profile updates, consent preferences (marketing, data sharing, SMS, email), and serves as the single source of truth for user information across the platform ecosystem."
})
@tagMetadata("Billing", #{
  description: "Invoice-based payment processing with Stripe integration. Manages invoices, merchant accounts, payment processing, and refunds. Supports both automatic and manual payment capture flows with comprehensive authorization controls. Any person can become a merchant and receive payments through Stripe Connect."
})
@tagMetadata("Audit", #{
  description: "Enterprise-grade audit logging and compliance tracking. Records all data access, modifications, and system events with immutable audit trails. HIPAA-compliant retention and SIEM integration."
})
@tagMetadata("Notifs", #{
  description: "Multi-channel notification delivery for user engagement. Manages email, push notifications, and in-app messaging with delivery tracking."
})
@tagMetadata("Comms", #{
  description: "Real-time communication module providing chat rooms and embedded video calls. Features Messenger-style chat with immutable message history, direct booking integration, and action-based video call management with WebRTC signaling. Supports one active video call per chat room with efficient state management."
})
@tagMetadata("Storage", #{
  description: "Secure document and file management with S3 integration. Encryption at rest and in transit, presigned URLs, virus scanning."
})
@tagMetadata("Email", #{
  description: "Runtime-configurable email service with dynamic template management. Enables administrators to create and modify email templates without code deployments, with changes taking effect immediately. Features template tag-based referencing, Handlebars variable substitution, JSON Schema validation, multi-provider support (SMTP/Postmark), asynchronous job-based processing, and comprehensive queue management with retry logic and admin controls."
})
@tagMetadata("Booking", #{
  description: "Booking and scheduling system for time-based services. Hosts define booking events with flexible availability patterns, location options (in-person, virtual, or hybrid), and automated time slot generation. Supports booking lifecycle management with confirmation workflows, mutual cancellation, no-show tracking, and schedule exception handling. Features public event discovery for seamless booking experiences."
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
@tagMetadata("Healthcare:Compliance", #{
  description: "Compliance and governance. Policy management, attestations, BAA lifecycle, CAPA tracking, data retention, legal holds, privacy workflows (amendment requests, accounting of disclosures, breach assessment/notification, privacy complaints)."
})
@tagMetadata("Healthcare:PublicHealth", #{
  description: "Public health reporting and surveillance. Electronic case reporting (eCR), immunization registry integration (IIS), vital records (birth/death certificates), cancer registry abstraction, syndromic surveillance, electronic lab reporting (ELR), trauma registry."
})
@tagMetadata("Dental:Imaging", #{
  description: "Dental imaging workspace. Manages imaging studies (periapical, bitewing, panoramic, cephalometric, intraoral/extraoral photos), presigned upload URLs, and patient image listing with union adapter bridging new imaging studies and legacy dental attachments."
})
// NOTE: Observability endpoint `GET /metrics` is implemented directly in the
// API service (services/api-ts/src/handlers/metrics.ts) and is intentionally
// excluded from TypeSpec / OpenAPI codegen. It returns Prometheus text-format
// metrics, requires the `METRICS_TOKEN` bearer, and is not part of the
// versioned client SDK surface. See docs/observability/README.md.
@tagMetadata("Dental:Perio", #{
  description: "Periodontal charting. Per-visit full perio chart with 6-site probing depths (FDI notation), bleeding on probing, recession, mobility, and furcation. One chart per visit; immutable after visit locked. Summary statistics (BOP%, mean depth, deep-pocket count) computed on completion."
})
@tagMetadata("Dental:Portal", #{
  description: "Patient self-service portal (E4 Phase 1, read-only). Self-scoped reads for the authenticated patient (Better-Auth role `user`, no membership): their own appointments, invoices, and outstanding balance. Patient identity is derived server-side from the session — no client-supplied patientId — so a patient can only ever read their own data (IDOR-free by construction)."
})
namespace MonobaseAPI {

  // ========================================================================
  // DENTALEMON
  // ========================================================================

  @tag("Dental:Org")
  @route("/dental/onboarding")
  interface DentalOnboarding extends DentalOrgModule.DentalOnboarding {}

  @tag("Dental:Org")
  @route("/dental/organizations")
  interface DentalOrganizationManagement extends DentalOrgModule.DentalOrganizationManagement {}

  @tag("Dental:Org")
  @route("/dental/organizations/{orgId}/branches")
  interface DentalBranchManagement extends DentalOrgModule.DentalBranchManagement {}

  @tag("Dental:Org")
  @route("/dental/organizations/{orgId}/branches/{branchId}/members")
  interface DentalMembershipManagement extends DentalOrgModule.DentalMembershipManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalPatientMgmt extends DentalPatientModule.DentalPatientManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface DentalVisitMgmt extends DentalVisitModule.DentalVisitManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface DentalChartMgmt extends DentalVisitModule.DentalChartManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface DentalTreatmentMgmt extends DentalVisitModule.DentalTreatmentManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface VisitNotesMgmt extends DentalVisitModule.VisitNotesManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface ToothHistoryMgmt extends DentalVisitModule.ToothHistoryManagement {}

  @tag("Dental:Visit")
  @route("/dental/treatment-templates")
  interface TreatmentTemplateMgmt extends DentalVisitModule.TreatmentTemplateManagement {}

  @tag("Dental:Visit")
  @route("/dental/visits")
  interface VisitTemplateActsMgmt extends DentalVisitModule.VisitTemplateActions {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface TreatmentPlanMgmt extends DentalVisitModule.TreatmentPlanPresentation {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface PatientRecordsMgmt extends DentalVisitModule.PatientRecordsView {}

  // Dental Clinical Extras
  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface PrescriptionMgmt extends DentalClinicalModule.PrescriptionManagement {}

  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface ConsentFormMgmt extends DentalClinicalModule.ConsentFormManagement {}

  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface AttachmentMgmt extends DentalClinicalModule.AttachmentManagement {}

  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface LabOrderMgmt extends DentalClinicalModule.LabOrderManagement {}

  @tag("Dental:Clinical")
  @route("/dental/clinical")
  interface MedicalHistoryMgmt extends DentalClinicalModule.MedicalHistoryManagement {}

  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface AmendmentMgmt extends DentalClinicalModule.AmendmentManagement {}

  // P1-3: Informed refusal management
  @tag("Dental:Clinical")
  @route("/dental/visits")
  interface InformedRefusalMgmt extends DentalClinicalModule.InformedRefusalManagement {}

  // PMD
  @tag("Dental:PMD")
  @route("/dental/visits")
  interface PMDDocumentMgmt extends DentalPMDModule.PMDDocumentManagement {}

  @tag("Dental:PMD")
  @route("/dental")
  interface ImportedPMDMgmt extends DentalPMDModule.ImportedPMDManagement {}

  @tag("Dental:Org")
  @route("/dental/org")
  interface OrgContextMgmt extends DentalOrgModule.OrgContextManagement {}

  @tag("Dental:Org")
  @route("/dental/dashboard")
  interface DashboardMgmt extends DentalOrgModule.DashboardManagement {}

  @tag("Dental:Org")
  @route("/dental/org/members")
  interface FlatMemberMgmt extends DentalOrgModule.FlatMemberManagement {}

  @tag("Dental:Org")
  @route("/dental/org/permissions")
  interface PermissionMgmt extends DentalOrgModule.PermissionManagement {}

  @tag("Dental:Org")
  @route("/dental/branches")
  interface BranchConfigMgmt extends DentalOrgModule.BranchConfigManagement {}

  // Dental Scheduling
  @tag("Dental:Scheduling")
  @route("/dental/appointments")
  interface AppointmentMgmt extends DentalSchedulingModule.AppointmentManagement {}

  // P1-25: public self-service booking (unauthenticated, rate-limited).
  // Tagged Dental:Scheduling so handlers resolve under handlers/dental-scheduling/.
  @tag("Dental:Scheduling")
  @route("/dental/public")
  interface PublicBookingMgmt extends DentalSchedulingModule.PublicBookingManagement {}

  // Dental Billing
  // Dental Imaging
  @tag("Dental:Imaging")
  @route("/dental/imaging")
  interface ImagingMgmt extends DentalImagingModule.ImagingManagement {}

  @tag("Dental:Imaging")
  @route("/dental/patients")
  interface PatientImageMgmt extends DentalImagingModule.PatientImageListing {}

  @tag("Dental:Imaging")
  interface ImagingFindingsMgmt extends DentalImagingModule.ImagingFindings {}

  @tag("Dental:Imaging")
  interface CephMgmt extends DentalImagingModule.CephManagement {}

  @tag("Dental:Perio")
  @route("/dental/perio-charts")
  interface PerioChartMgmt extends DentalPerioModule.PerioChartManagement {}

  @tag("Dental:Perio")
  @route("/dental/visits")
  interface VisitPerioMgmt extends DentalPerioModule.VisitPerioChart {}

  @tag("Dental:Billing")
  @route("/dental/billing")
  interface DentalBillingMgmt extends DentalBillingModule.InvoiceManagement {}

  @tag("Dental:Billing")
  @route("/dental/billing")
  interface BillingExtrasMgmt extends DentalBillingModule.BillingExtras {}

  // P1-26: insurance / revenue-cycle (PH HMO) — claims, remittance, estimate, aging
  @tag("Dental:Billing")
  @route("/dental/billing")
  interface DentalRevenueCycleMgmt extends DentalBillingModule.RevenueCycle {}

  // Dental Erasure (right-to-erasure / V-DG-002 / WFG-006)
  @tag("Dental:Erasure")
  @route("/dental/erasure-requests")
  interface DentalErasureMgmt extends DentalErasureModule.ErasureManagement {}

  // Dental Audit viewer (append-only; read-only via API)
  @tag("Dental:Audit")
  @route("/dental/audit-events")
  interface DentalAuditMgmt extends DentalAuditModule.DentalAuditManagement {}

  // Dental Legal Hold (V-DG-002 support / WFG-006)
  @tag("Dental:LegalHold")
  @route("/dental/legal-holds")
  interface DentalLegalHoldMgmt extends DentalLegalHoldModule.LegalHoldManagement {}

  // ── TR-DG-002 manual-route migration: patient engagement ─────────────────
  @tag("Dental:Patient")
  @route("/dental/patients")
  interface PatientContactMgmt extends DentalPatientEngagementModule.PatientContactManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface RecallMgmt extends DentalPatientEngagementModule.RecallManagement {}

  // P1-24: branch-scoped recare due-list (front-desk continuing-care queue)
  @tag("Dental:Patient")
  @route("/dental/recalls")
  interface RecallDueListMgmt extends DentalPatientEngagementModule.RecallDueListManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalAlertMgmt extends DentalPatientEngagementModule.DentalAlertManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface PatientTaskMgmt extends DentalPatientEngagementModule.PatientTaskManagement {}

  // ── TR-DG-002 manual-route migration: patient finance ────────────────────
  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalTreatmentPlanHeaderMgmt extends DentalPatientFinanceModule.TreatmentPlanHeaderManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalTreatmentApptLinkMgmt extends DentalPatientFinanceModule.TreatmentAppointmentLinkManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalTreatmentOptionMgmt extends DentalPatientFinanceModule.TreatmentOptionManagement {}

  // P1-20: patient-facing case presentation + e-signature accept/reject (staff bearerAuth)
  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalCasePresentationMgmt extends DentalPatientFinanceModule.CasePresentationManagement {}

  // P1-27: household / guarantor (family file)
  @tag("Dental:Patient")
  @route("/dental/households")
  interface DentalHouseholdMgmt extends DentalPatientFinanceModule.HouseholdManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalPatientHouseholdMgmt extends DentalPatientFinanceModule.PatientHouseholdManagement {}

  @tag("Dental:Patient")
  @route("/dental/sync-logs")
  interface DentalSyncLogMgmt extends DentalPatientFinanceModule.SyncLogManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalInsuranceProfileMgmt extends DentalPatientFinanceModule.InsuranceProfileManagement {}

  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalClaimDraftMgmt extends DentalPatientFinanceModule.ClaimDraftManagement {}

  // P1-26: coverage authorization (LOA) capture
  @tag("Dental:Patient")
  @route("/dental/patients")
  interface DentalCoverageAuthMgmt extends DentalPatientFinanceModule.CoverageAuthorizationManagement {}

  // ── TR-DG-002 manual-route migration: clinical ops ───────────────────────
  @tag("Dental:Clinical")
  @route("/dental/patients")
  interface OcclusionScreeningMgmt extends DentalClinicalOpsModule.OcclusionScreeningManagement {}

  @tag("Dental:Clinical")
  @route("/dental/branches")
  interface PostopTemplateMgmt extends DentalClinicalOpsModule.PostopTemplateManagement {}

  @tag("Dental:Clinical")
  @route("/dental/branches")
  interface InventoryMgmt extends DentalClinicalOpsModule.InventoryManagement {}

  // ── TR-DG-002 manual-route migration: fee schedule + queue ───────────────
  @tag("Dental:Org")
  @route("/dental/fee-schedule")
  interface FeeScheduleMgmt extends DentalFeeScheduleModule.FeeScheduleManagement {}

  @tag("Dental:Scheduling")
  @route("/dental/appointments")
  interface QueueItemCreationMgmt extends DentalQueueModule.QueueItemCreation {}

  @tag("Dental:Scheduling")
  @route("/dental/branches")
  interface QueueBoardListingMgmt extends DentalQueueModule.QueueBoardListing {}

  @tag("Dental:Scheduling")
  @route("/dental/queue-items")
  interface QueueItemStatusMgmt extends DentalQueueModule.QueueItemStatusManagement {}

  // ── P2-15: scheduling waitlist (ASAP fill) ───────────────────────────────
  @tag("Dental:Scheduling")
  @route("/dental/branches")
  interface WaitlistEntryCreationMgmt extends DentalWaitlistModule.WaitlistEntryCreation {}

  @tag("Dental:Scheduling")
  @route("/dental/branches")
  interface WaitlistListingMgmt extends DentalWaitlistModule.WaitlistListing {}

  @tag("Dental:Scheduling")
  @route("/dental/waitlist")
  interface WaitlistPromotionMgmt extends DentalWaitlistModule.WaitlistPromotion {}

  // ── E4: patient self-service portal (read-only foundation) ───────────────
  // Self-scoped reads for the authenticated patient. Identity is derived
  // server-side from the session (NO patientId param) → IDOR-free by design.
  @tag("Dental:Portal")
  @route("/me")
  interface DentalPortalSelfReads extends DentalPortalModule.PortalSelfReads {}

  // ========================================================================
  // PLATFORM INFRASTRUCTURE
  // ========================================================================

  // Person
  @tag("Person")
  @route("/persons")
  interface PersonManagement extends PersonModule.PersonManagement {}

  // Billing
  @tag("Billing")
  @route("/billing")
  interface InvoiceManagement extends BillingModule.InvoiceManagement {}

  @tag("Billing")
  @route("/billing")
  interface PaymentProcessing extends BillingModule.PaymentProcessing {}

  @tag("Billing")
  @route("/billing")
  interface MerchantAccountManagement extends BillingModule.MerchantAccountManagement {}

  // Audit
  @tag("Audit")
  @route("/audit")
  interface AuditManagement extends AuditModule.AuditManagement {}

  // Notifs
  @tag("Notifs")
  @route("/notifs")
  interface NotificationManagement extends Notifs.NotificationManagement {}

  // Comms
  @tag("Comms")
  @route("/comms")
  interface CommsManagement extends CommsModule.CommsManagement {}

  // Storage
  @tag("Storage")
  interface StorageManagement extends StorageModule.StorageManagement {}

  // Email
  @tag("Email")
  @route("/email")
  interface EmailTemplateManagement extends EmailModule.EmailTemplateManagement {}

  @tag("Email")
  @route("/email")
  interface EmailQueueManagement extends EmailModule.EmailQueueManagement {}

  // Booking
  @tag("Booking")
  @route("/booking")
  interface BookingEventManagement extends BookingModule.BookingEventManagement {}

  @tag("Booking")
  @route("/booking")
  interface SlotDiscovery extends BookingModule.SlotDiscovery {}

  @tag("Booking")
  @route("/booking")
  interface BookingManagement extends BookingModule.BookingManagement {}

  @tag("Booking")
  @route("/booking")
  interface ScheduleExceptionManagement extends BookingModule.ScheduleExceptionManagement {}

  // Reviews
  @tag("Reviews")
  @route("/reviews")
  interface ReviewsManagement extends ReviewsModule.ReviewsManagement {}

  // ========================================================================
  // HEALTHCARE FOUNDATION
  // ========================================================================

  // Patient
  @tag("Patient")
  @route("/patients")
  interface PatientManagement extends PatientModule.PatientManagement {}

  // Provider
  @tag("Provider")
  @route("/providers")
  interface ProviderManagement extends ProviderModule.ProviderManagement {}

  @tag("Provider")
  @route("/providers")
  interface PractitionerManagement extends ProviderModule.PractitionerManagement {}

  @tag("Provider")
  @route("/providers")
  interface PractitionerRoleManagement extends ProviderModule.PractitionerRoleManagement {}

  // EMR
  @tag("EMR")
  @route("/emr")
  interface EMRManagement extends EMRModule.EMRManagement {}
}

/**
 * API versioning scheme
 */
enum Versions {
  @doc("Initial healthcare API version")
  v1: "1.0",
}
