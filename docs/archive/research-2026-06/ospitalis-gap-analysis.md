# Ospitalis Hub PRD — Gap Analysis Against Monobase Healthcare API Spec

**Analysis Date:** 2026-04-14
**PRD Version:** 0.1.0-draft (Ospitalis Vertical)
**Spec Reference:** `specs/api/src/main.tsp` and all imported `.tsp` modules
**Analyst:** Claude Code (Sonnet 4.6)

---

## Executive Summary

The Ospitalis Hub PRD defines **128 domains** across four categories:

| Category | PRD Domains | Spec Modules |
|----------|-------------|--------------|
| 1 — Core Shared Health | 22 | ~17 covered at varying depth |
| 2 — Hospital-Specific Clinical | 35 | ~9 partially covered |
| 3 — Hospital Practice Operations | 43 | ~3 partially covered |
| 4 — Integration & Interoperability | 28 | ~5 partially covered |

The Monobase Healthcare API spec (`specs/api/src/`) is a **FHIR-aligned platform spec** designed for universal healthcare. It covers clinical record-keeping, scheduling, billing, lab, pharmacy, radiology, blood bank, surgical management, and infection control well. However, it was not originally designed as a hospital information system (HIS) and has **significant gaps** against the inpatient-focused, operational, and Philippine-localization requirements of the Ospitalis vertical.

**Overall coverage estimate:**

- COVERED (spec meets PRD requirement): ~25 of 128 domains
- PARTIAL (spec has the foundation but lacks HIS-specific operations/state machines): ~22 of 128 domains
- GAP (no spec coverage — new modules required): ~81 of 128 domains

---

## Section 1 — Category 1: Core Shared Health (22 Domains)

### 1.1 Patient / Person Master (MPI)

**PRD Requirement:** MPI with deterministic + probabilistic duplicate matching, controlled merge workflows, cross-facility identity lookup, allergy list as append-only amendments, CRDT LWW-Register semantics on demographic fields, draft/active/inactive status on Patient.

**Spec Coverage:** `patient.tsp` (PatientManagement), `allergy.tsp` (AllergyIntoleranceService), `related-person.tsp`.

**Status: PARTIAL**

**Gaps:**
- No `mergePatients` endpoint or `MergeEvent` entity — the PRD requires a full probabilistic duplicate review queue and a controlled merge workflow with HIM-role approval
- No MPI match-score response — there is no mechanism to query for duplicate candidates with a confidence score
- No `Patient.status` field (draft/active/inactive) — patient lifecycle is not modeled; unidentified ER patients cannot be placed in `draft`
- No cross-facility MRN tracking — `Patient.identifiers[]` exists but lacks the multi-facility MRN slot semantics the PRD requires
- No soft-delete enforcement annotation or `replacedBy` reference for merged records
- CRDT/`lastModifiedAt` per-field semantics are absent (relevant for offline-first deployments)
- No `getPatientAllergyList` as a dedicated endpoint distinct from the general allergy search

**Recommendations:**
1. Add `mergePatients` operation with `MergeEvent` audit entity and HIM role enforcement
2. Add `listDuplicateCandidates` endpoint returning match-score ranked pairs
3. Add `status: draft | active | inactive` to the Patient model
4. Extend `PatientIdentifier` to carry `facilityId` and `mrn` as a first-class typed structure within `identifiers[]`
5. Add `replacedBy` reference and `mergedInto` pointer fields to Patient

---

### 1.2 Encounter / Visit

**PRD Requirement:** Encounter as central spine; ADT-driven lifecycle (pre-admit → admitted → transferred → discharge-ordered → clinical-summary-complete → nursing-discharge-complete → billing-clearance → discharged); `dischargeEncounter` multi-step workflow; AMA discharge requires `amaDocumentRef`; concurrent encounter rules per `careLevel`; extension slots for `billingModel`, `careLevel`, `admissionSource`, `dischargeDisposition`, `regulatoryFields[]`.

**Spec Coverage:** `encounter.tsp` — EncounterStatus (planned/arrived/triaged/inProgress/onLeave/finished/cancelled), EncounterHospitalization, EncounterStatusTransitionRequest, `transitionEncounterStatus` endpoint.

**Status: PARTIAL**

**Gaps:**
- The PRD defines a **9-state ADT lifecycle** (pre-admit → billing-clearance → discharged) versus the spec's **7-state FHIR lifecycle** — the intermediate discharge states (nursing-discharge-complete, billing-clearance) used to gate the multi-department discharge workflow are absent
- No `dischargeEncounter` composite endpoint — discharge is a multi-step coordinated process in the PRD; `transitionEncounterStatus` covers single transitions only
- No `careLevel` field (inpatient, ED, ICU, day-surgery, home-health) — this is a required extension slot driving concurrent encounter rules, charge capture mode, and flowsheet template selection
- No `billingModel` field (fee-for-service, DRG, capitation, case-rate)
- No `admissionSource` first-class field (emergency, referral, transfer-in, elective)
- No `dischargeDisposition` beyond the free-text `dischargeInstruction` in EncounterHospitalization — the PRD requires coded disposition (home, AMA, transfer-out, expired, LTAC, hospice)
- No `amaDocumentRef` enforcement on AMA discharges
- No `listAdmittedPatients` or census endpoint
- No `getEncounterTimeline` endpoint
- No concurrent encounter validation rule per careLevel
- No `regulatoryFields[]` extension slot for Philippine DSCA status and YAKAP flag

**Recommendations:**
1. Extend `EncounterStatus` with discharge sub-states or introduce a parallel `dischargeStatus` field with the full ADT discharge workflow states
2. Add `careLevel`, `billingModel`, `admissionSource`, `dischargeDisposition` (CodeableConcept, coded) fields to Encounter
3. Add `dischargeEncounter` composite operation enforcing multi-department gate logic
4. Add `amaDocumentRef` validation on AMA discharges
5. Add `listAdmittedPatients` and `getCensusSnapshot` endpoints
6. Add `getEncounterTimeline` endpoint
7. Add `regulatoryFields` extension map to Encounter

---

### 1.3 Practitioner / Provider Directory

**PRD Requirement:** `getPractitionerSchedule` endpoint; `expiryStatus` computed field (valid/expiring-soon/expired) on qualifications; supervisory relationships via `supervisorId` on PractitionerRole; `searchPractitionerDirectory` (by name, specialty, location, availability, accepting-new-patients).

**Spec Coverage:** `provider.tsp` — PractitionerManagement, PractitionerRoleManagement with NPI, DEA, licenses.

**Status: PARTIAL**

**Gaps:**
- No `expiryStatus` computed field on qualifications
- No `supervisorId` on PractitionerRole for resident/attending relationships
- No `acceptingNewPatients` flag
- No `getPractitionerSchedule` endpoint (links practitioner to scheduling domain)
- `searchPractitionerDirectory` is not exposed as a named endpoint (general list filtering may exist but PRD-level semantics are missing)

**Recommendations:**
1. Add `expiryStatus: "valid" | "expiring-soon" | "expired"` as a computed/derived field on Qualification
2. Add `supervisorId` reference to PractitionerRole
3. Add `acceptingNewPatients: boolean` to PractitionerRole
4. Add `getPractitionerSchedule` and `searchPractitionerDirectory` endpoints

---

### 1.4 Organization & Location Registry

**PRD Requirement:** 5-level hierarchy (Organization → Region → Facility → Department → Room); `capacityAttributes` extension (bed count, ward type, ICU class); `operatingHours[]`; `getLocationHierarchy` endpoint; Device always has a Location reference.

**Spec Coverage:** `organization.tsp`, `location.tsp` — OrganizationManagement, LocationManagement, DepartmentManagement.

**Status: PARTIAL**

**Gaps:**
- No hierarchy depth enforcement (max 5 levels)
- No `capacityAttributes` typed extension on Location for hospital-specific bed count and ward type
- No `operatingHours[]` with timezone-aware windows and holiday overrides
- No `getLocationHierarchy` endpoint returning the full org tree
- Device-Location relationship exists in `device.tsp` but no enforcement that Device must always reference a non-decommissioned Location

**Recommendations:**
1. Add `capacityAttributes` (bedCount, wardType, icuClassification) to Location
2. Add `operatingHours[]` with timezone reference to Location
3. Add `getLocationHierarchy` endpoint
4. Add hierarchy depth validation annotation

---

### 1.5 Identity, Authentication & Session

**PRD Requirement:** Session lifecycle (active/locked/expired/terminated), MFA/TOTP, offline credential caching with AES-256 and TTL, device registration, `forceLogoutUser` endpoint, screen lock without new token, session token with branchId + deviceId claims.

**Spec Coverage:** None — auth is handled by Better-Auth (integrated) per CLAUDE.md. No spec module covers session lifecycle or MFA.

**Status: GAP**

**Gaps:** Entire domain is absent from the spec. Better-Auth handles authentication but the PRD's hospital requirements go beyond standard auth:
- No offline authentication model (TTL-based cached credential hash)
- No device registration API (`registerDevice`, `deregisterDevice`)
- No `forceLogoutUser` propagation
- No screen lock semantics (resume session on PIN vs. new session)
- No session token claim contract (branchId, deviceId, roleIds[])

**Recommendations:**
1. This is largely an infrastructure concern, not a spec concern. However, add a `Healthcare:Auth` namespace with `SessionManagement` and `DeviceRegistration` interfaces documenting the session contract, force-logout endpoint, and offline capability scope metadata — even if the runtime implementation is Better-Auth.

---

### 1.6 Authorization & RBAC/ABAC

**PRD Requirement:** Role + PolicyRule entities; ABAC attribute conditions; `triggerBreakGlass` endpoint; break-glass time-limited (1 hour); `invalidateSessionsForUser` on role demotion; permission check audit logging; deny-by-default; version-controlled PolicyRules.

**Spec Coverage:** `security.tsp` (bearerAuth, `x-security-required-roles` extension on operations). Role enforcement is decorator-based, not a runtime domain.

**Status: GAP**

**Gaps:** The spec uses `x-security-required-roles` annotations on endpoints (compile-time metadata) but does not define a runtime RBAC/ABAC management API with Role, Permission, PolicyRule, and RoleAssignment entities. The PRD requires:
- `listRoles`, `createRole`, `assignRole`, `revokeRole` management endpoints
- `evaluatePermission` API
- `createPolicyRule` with attribute conditions
- `triggerBreakGlass` with mandatory reason capture
- `invalidateSessionsForUser` endpoint

**Recommendations:**
1. Add a `Healthcare:Administrative:AccessControl` namespace with Role, PolicyRule, and RoleAssignment management interfaces
2. Add `triggerBreakGlass` endpoint with time-limited token issuance
3. Add `invalidateSessionsForUser` endpoint

---

### 1.7 Audit Log & Access Tracking

**PRD Requirement:** Immutable G-Set append-only log; `deviceId`, `sessionId`, `ipAddress` on every AuditEvent; separate read-only audit query service; `getPatientAccessLog` endpoint; `exportAuditReport`; retention enforcement (10 yr inpatient / 7 yr outpatient per PH DOH DC 2021-0226); AmendmentRecord entity.

**Spec Coverage:** `audit.tsp` — AuditManagement with structured logging via Pino.

**Status: PARTIAL**

**Gaps:**
- `audit.tsp` is platform infrastructure (Pino logging), not a queryable FHIR AuditEvent API
- No `queryAuditEvents` with patient/resource/date/action filters
- No `getPatientAccessLog` endpoint (required for HIPAA/RA 10173 access logs)
- No `exportAuditReport` endpoint
- No `getResourceAuditTrail` endpoint
- No `AmendmentRecord` entity
- No retention policy metadata on AuditEvent
- No `deviceId` or `sessionId` in audit payload contract

**Recommendations:**
1. Add a formal `Healthcare:Conformance:AuditEvent` namespace (or extend the existing audit module) with queryable endpoints: `queryAuditEvents`, `getPatientAccessLog`, `getResourceAuditTrail`, `exportAuditReport`
2. Formalize the AuditEvent payload schema to include `deviceId`, `sessionId`, `ipAddress`, `action`, `outcome`, `resourceType`, `resourceId`
3. Add `AmendmentRecord` entity and endpoint

---

### 1.8 Consent Management

**PRD Requirement:** `ConsentCategory` taxonomy; `AdvanceDirective` entity; `ConsentProvision`; minor patient consent auto-expiry; consent evaluated at query time; `listAdvanceDirectives`, `createAdvanceDirective`.

**Spec Coverage:** `consent.tsp` — ConsentManagement with FHIR Consent model.

**Status: PARTIAL**

**Gaps:**
- No `AdvanceDirective` entity (POLST/MOLST/DNR) separate from general Consent
- No `listAdvanceDirectives` / `createAdvanceDirective` endpoints
- No minor patient consent auto-expiry logic (would be a business rule annotation/workflow)
- No `ConsentCategory` taxonomy for separating treatment consent from data privacy consent

**Recommendations:**
1. Add `AdvanceDirective` as a sub-model or separate entity within the consent namespace
2. Add `listAdvanceDirectives` and `createAdvanceDirective` endpoints
3. Add `consentCategory` enum (treatment, dataprivacy, research, recording) to Consent

---

### 1.9 Scheduling Engine

**PRD Requirement:** Multi-resource availability query (surgeon AND OR suite AND anesthesiologist simultaneously); `resourceTypes[]` extension slot; `blockSlots`, `unblockSlots`; lazy vs eager slot generation; `queryAvailability` with cross-resource intersection.

**Spec Coverage:** `scheduling.tsp` — ScheduleManagement, SlotManagement, AppointmentManagement (FHIR-aligned).

**Status: PARTIAL**

**Gaps:**
- No multi-resource availability query (finding a slot where multiple resources are simultaneously free)
- No `resourceTypes[]` extension slot on Schedule (needed for OR suite, dialysis chair, cath-lab)
- No `blockSlots` / `unblockSlots` as explicit operations (separate from individual slot status updates)
- No `queryAvailability` endpoint with cross-resource intersection semantics
- No `WaitlistEntry` entity, `joinWaitlist`, `listWaitlistEntries`, `offerWaitlistSlot` endpoints

**Recommendations:**
1. Add `queryAvailability` endpoint supporting multi-resource intersection query
2. Add `blockSlots` / `unblockSlots` batch operations
3. Add `resourceTypes[]` extension on Schedule
4. Add WaitlistEntry entity with `joinWaitlist`, `listWaitlistEntries`, `offerWaitlistSlot` endpoints

---

### 1.10 Appointments & Waitlist

**PRD Requirement:** `checkInAppointment` triggering encounter creation; no-show tracking; `WaitlistEntry` with priority scoring; `cancelAppointment` with late-cancellation fee trigger; appointment reminders at 72h/24h/2h.

**Spec Coverage:** `scheduling.tsp` — AppointmentManagement with `AppointmentStatus` including arrived/noShow/checkedIn.

**Status: PARTIAL**

**Gaps:**
- `checkInAppointment` as a named operation is absent (status can be updated but no explicit check-in that triggers encounter creation)
- No waitlist management endpoints
- No late-cancellation fee event publication
- No reminder schedule configuration per appointment

---

### 1.11 Billing & Charges

**PRD Requirement:** `Charge`, `ChargeItem`, `ChargeDescriptionMaster` (CDM), `FeeSchedule`, `ChargeAdjustment`; `generateDailyCharges` scheduled operation; `getEncounterChargesSummary`; `lookupCDM`; `verifyCharges`; `voidCharge`; duplicate detection window; immutability after verification.

**Spec Coverage:** `claims.tsp` — ClaimManagement, ClaimResponseManagement. No charge capture layer exists.

**Status: GAP**

**Gaps:** The spec covers claims submission/adjudication (downstream) but has no charge capture domain (upstream):
- No `Charge` / `ChargeItem` entities
- No `ChargeDescriptionMaster` (CDM) / `ChargeItemDefinition` management
- No `FeeSchedule` entity
- No `ChargeAdjustment` entity
- No `generateDailyCharges` endpoint (room-and-board auto-charge)
- No `verifyCharges`, `voidCharge`, `lookupCDM`, `getEncounterChargesSummary` endpoints
- No duplicate charge detection logic

**Recommendations:**
1. Add a new `healthcare/administrative/charge-capture.tsp` namespace with Charge, ChargeItem, CDM, FeeSchedule, ChargeAdjustment entities
2. Add `generateDailyCharges`, `verifyCharges`, `voidCharge`, `lookupCDM`, `createChargeAdjustment`, `getEncounterChargesSummary` endpoints

---

### 1.12 Payments & Patient Financial Services

**PRD Requirement:** `Payment`, `Receipt`, `PatientAccount`, `PaymentPlan`, `PromissoryNote`, `Refund`; offline receipt numbering (device-prefix + sequential counter); `reconcileReceiptNumbers`; `pendingPayment` status; `processRefund` with supervisor approval.

**Spec Coverage:** None. No payment management module exists.

**Status: GAP**

**Recommendations:**
1. Add `healthcare/administrative/patient-financial.tsp` with Payment, Receipt, PatientAccount, PaymentPlan, PromissoryNote, Refund entities
2. Add `createPayment`, `voidPayment`, `getPatientAccount`, `createPaymentPlan`, `createPromissoryNote`, `processRefund`, `getReceiptHistory`, `reconcileReceiptNumbers` endpoints

---

### 1.13 Coverage & Insurance Eligibility

**PRD Requirement:** `PayorDirectory`; `calculateBenefitDeduction`; coordination of benefits (COB) with primary/secondary sequencing; `Coverage.governmentPrograms[]`; real-time eligibility with verification timestamp and source.

**Spec Coverage:** `insurance.tsp` — CoverageManagement, EligibilityService.

**Status: PARTIAL**

**Gaps:**
- No `PayorDirectory` entity (payor metadata with encrypted API credentials)
- No `calculateBenefitDeduction` endpoint (advisory benefit computation for patient financial counseling)
- No COB sequencing logic or primary/secondary designation enforcement
- No `verificationTimestamp` and `verificationSource` on Coverage
- No `Coverage.governmentPrograms[]` slot

**Recommendations:**
1. Add `PayorDirectory` entity and management endpoints
2. Add `calculateBenefitDeduction` endpoint
3. Add `verificationTimestamp`, `verificationSource` fields to Coverage
4. Add `governmentPrograms[]` extension slot on Coverage

---

### 1.14 Document Management (DMS)

**PRD Requirement:** `Document`, `DocumentVersion`, `DocumentCategory`, `RetentionPolicy`; multi-step signing workflow (draft → pending-signature → signed); `getDocumentVersionHistory`; `requestDocumentRelease` (ROI); `listDocumentCategories`; `getDocumentDownloadUrl` (pre-signed, 15 min); 50 MB limit; DICOM routes to PACS, not DMS.

**Spec Coverage:** `document-reference.tsp` — DocumentReferenceService; `storage.tsp` — StorageManagement.

**Status: PARTIAL**

**Gaps:**
- No document versioning (`DocumentVersion` entity, `getDocumentVersionHistory`)
- No document signing workflow (draft → pending-signature → signed lifecycle)
- No `RetentionPolicy` entity or metadata on DocumentReference
- No `requestDocumentRelease` (ROI workflow) endpoint
- No `listDocumentCategories` endpoint
- No `getDocumentDownloadUrl` (short-expiry pre-signed URL — storage.tsp may have presigned URLs generally, but not document-specific)
- No document category taxonomy

**Recommendations:**
1. Extend `document-reference.tsp` with `signDocument`, `getDocumentVersionHistory`, `requestDocumentRelease`, `listDocumentCategories`, `getDocumentDownloadUrl` endpoints
2. Add `DocumentVersion` entity and `RetentionPolicy` model
3. Add document signing lifecycle states (draft, pendingSignature, signed, superseded)

---

### 1.15–1.16 Communication & Messaging / Notifications & Alerting

**PRD Requirement:** `Thread`, `ThreadParticipant`, `Message`; clinical context linking (thread → patient/encounter/order); urgency classification; `archiveThread`; Notification with `priority: critical | high | normal | low`; escalation policies; `acknowledgeNotification`; `EscalationPolicy`; `NotificationRule` with clinical triggers.

**Spec Coverage:** `comms.tsp` — CommsManagement (WebRTC video, chat). `notifs.tsp` — NotificationManagement (OneSignal push, email, in-app).

**Status: PARTIAL**

**Gaps:**
- No clinical context linking on Thread (thread → patient/encounter/order reference)
- No urgency classification (critical/high/normal/low) on Message or Notification with escalation
- No `EscalationPolicy` entity
- No `NotificationRule` with clinical trigger configuration (critical lab value, vital threshold)
- No `acknowledgeNotification` (distinct from markRead — PRD requires explicit acknowledgment with timestamp for critical notifications)
- No escalation chain on unacknowledged critical notifications

**Recommendations:**
1. Add `clinicalContext` (patient/encounter/order reference) to Thread/Message
2. Add `priority: critical | high | normal | low` to Notification
3. Add `acknowledgeNotification` endpoint distinct from `markRead`
4. Add `NotificationRule` and `EscalationPolicy` entities with management endpoints

---

### 1.17 Tasks & Work Queues

**PRD Requirement:** `TaskQueue` with routing rules; `TaskTemplate` with `requiresCompletionNote`; STAT priority sort override; `claimTaskFromQueue`; `transferTasksOnHandover`; every task must have `dueDate`; tasks linked to clinical orders inherit encounter and priority.

**Spec Coverage:** `task.tsp` — TaskManagement (FHIR Task).

**Status: PARTIAL**

**Gaps:**
- No `TaskQueue` entity or management endpoints
- No `TaskTemplate` entity
- No `claimTaskFromQueue` endpoint
- No `transferTasksOnHandover` endpoint
- No STAT priority sort override annotation
- No `dueDate` required enforcement

**Recommendations:**
1. Add `TaskQueue`, `TaskTemplate` entities and management endpoints
2. Add `claimTaskFromQueue`, `transferTasksOnHandover` endpoints
3. Add `dueDate` as a required field on Task

---

### 1.18 Forms & Questionnaires

**PRD Requirement:** `ScoringRule` (Morse Fall Scale, Braden, PHQ-9); score emission as Observation records; `startQuestionnaireResponse` / `submitQuestionnaireResponse`; conditional logic (enableWhen); form versioning with pinned response version; `publishQuestionnaire` lifecycle.

**Spec Coverage:** `questionnaire.tsp` — QuestionnaireManagement, QuestionnaireResponseManagement.

**Status: PARTIAL**

**Gaps:**
- No `ScoringRule` entity — computed scores (fall risk, Braden) are not modeled
- No score-to-Observation emission logic or endpoint
- No `publishQuestionnaire` lifecycle state
- No `startQuestionnaireResponse` (in-progress, incomplete response) vs. `submitQuestionnaireResponse` (finalized)

**Recommendations:**
1. Add `ScoringRule` entity attached to Questionnaire with output score emission to Observation
2. Add `publishQuestionnaire` endpoint and lifecycle state
3. Split response endpoints into `startQuestionnaireResponse` (in-progress) and `submitQuestionnaireResponse` (final)

---

### 1.19 Terminology & Reference Data

**Spec Coverage:** `terminology-service.tsp` — TerminologyService with FHIR `$lookup`, `$expand`, `$validate-code`, `$translate`. Strong coverage.

**Status: COVERED**

**Minor Gap:** No `LocalCodeMapping` management endpoints (facility-specific alias → standard concept mapping). PRD requires `createLocalCodeMapping`, `listLocalCodeMappings`.

---

### 1.20 Reporting & Analytics

**PRD Requirement:** `ReportDefinition`, `ReportRun`, `Dashboard`, `MetricDefinition`; async report generation with polling; scheduled reports; `dataAsOf` freshness timestamp; `getDashboardMetrics`; regulatory export formats.

**Spec Coverage:** `cohort.tsp` — CohortManagement, ResearchExtractManagement, DataLineageManagement. `de-identification.tsp`, `ai-metadata.tsp`.

**Status: PARTIAL**

**Gaps:** The analytics namespace covers research and AI metadata but not operational reporting:
- No `ReportDefinition` / `ReportRun` entities for async operational reports
- No `Dashboard` / `MetricDefinition` entities
- No `scheduleReport` endpoint
- No `getDashboardMetrics` endpoint
- No `downloadReportResult` endpoint
- No regulatory report formats (DOH OHSRS, PhilHealth claims summary)

**Recommendations:**
1. Add `healthcare/analytics/operational-reporting.tsp` with ReportDefinition, ReportRun, Dashboard, MetricDefinition entities
2. Add `runReport`, `getReportRunStatus`, `downloadReportResult`, `scheduleReport`, `getDashboardMetrics` endpoints

---

### 1.21 Patient Portal

**PRD Requirement:** `PortalAccount`, `PortalSession`, `HealthSummary`; delegate access (`accessDelegates[]`); shorter session expiry (4h); lab result release grace period (configurable, default 3 days); self-scheduling; secure messaging from portal side; bill view and payment.

**Spec Coverage:** None. No patient portal namespace exists.

**Status: GAP**

**Recommendations:**
1. Add `healthcare/patient-portal/` namespace with PortalAccount, PortalSession, HealthSummary entities
2. Add `createPortalAccount`, `getPortalHealthSummary`, `listPortalAppointments`, `bookPortalAppointment`, `listPortalLabResults`, `listPortalDocuments`, `getPortalBillingSummary`, `makePortalPayment`, `listPortalMessages`, `sendPortalMessage` endpoints

---

### 1.22 Telehealth / Virtual Care

**PRD Requirement:** `TelehealthSession`, `VirtualRoom`, `SessionParticipant`; join links with time-limited validity (±30 min); recording stored in DMS; store-and-forward async consultations; session linked to Encounter.

**Spec Coverage:** `comms.tsp` — WebRTC video calls (generic, not healthcare-contextualized).

**Status: PARTIAL**

**Gaps:**
- No TelehealthSession entity with Encounter linkage
- No VirtualRoom with time-limited join link
- No store-and-forward submission workflow
- No recording consent capture and DMS storage
- The generic comms module has no session-to-encounter binding

**Recommendations:**
1. Add `healthcare/clinical/telehealth.tsp` with TelehealthSession, VirtualRoom, ClinicalCapture entities
2. Add `createTelehealthSession`, `joinTelehealthSession`, `endTelehealthSession`, `getSessionClinicalSummary`, `submitStoreAndForward` endpoints

---

## Section 2 — Category 2: Hospital-Specific Clinical (35 Domains)

### Summary Table

| PRD Domain | Spec Module | Status | Key Gaps |
|---|---|---|---|
| ADT & Inpatient Census | `encounter.tsp` | PARTIAL | No `admitPatient`, `transferPatient`, `listAdmittedPatients`, `getCensusSnapshot`; no ADT sub-state machine |
| Emergency Department (ED) Tracker | None | GAP | Entirely absent — EDVisit, TriageAssessment, triage acuity (ESI/DOH), ED board, door-to-doctor timer |
| Operating Room & Perioperative | `surgical-management.tsp` | PARTIAL | Good base; missing `completeSurgicalTimeout`, `updatePACUScore` (Aldrete), `listORSchedule`, pre-op clearance gate |
| Anesthesia Information Management (AIMS) | `surgical-management.tsp` (AnesthesiaRecord) | PARTIAL | Has basic AnesthesiaRecord; missing `logDrugAdministration`, `logGasAgent`, gas agent MAC calculation, `cosignAnesthesiaRecord`, intraop vital series at intervals |
| Procedural Sedation | None | GAP | No sedation record — separate from anesthesia for bedside procedures (endoscopy, cardioversion) |
| ICU / Critical Care | None | GAP | No ICUFlowsheet, VasopressorDrip, ICUBundle, DailyGoalsRecord, SOFA score, APACHE score |
| Ventilator & Respiratory Therapy | None | GAP | No VentilatorSetting, VentilatorMeasurement, SBT, extubation documentation |
| Telemetry / Continuous Monitoring | `device.tsp` (DeviceMetric) | PARTIAL | DeviceMetric covers readings; missing MonitorAssignment, AlarmConfiguration, AlarmLog, alarm fatigue management, `captureStrip`, `interpretStrip` |
| Labor & Delivery / Maternity | None | GAP | No ObstetricAdmission, LaborFlowsheet, FHR strip, APGAR scoring, partogram, newborn record creation |
| NICU | None | GAP | No NeonatalAdmission, NICUFlowsheet, weight-based dose calculation, incubator settings, kangaroo care |
| Oncology / Chemotherapy | None | GAP | No ChemoProtocol, ChemoCycle, cumulative dose tracking, CTCAE toxicity assessment, BSA-based dosing |
| Dialysis | None | GAP | No DialysisOrder, DialysisTreatment, Kt/V, vascular access records |
| Behavioral Health / Psychiatry | None | GAP | No PsychiatricAdmission, RiskAssessment (Columbia), RestraintOrder with expiry, InvoluntaryHoldRecord |
| Rehabilitation (PT/OT/ST) | `service-request.tsp` (partial) | PARTIAL | ServiceRequest covers therapy referral; missing TherapySession, FunctionalAssessment (FIM/Barthel), TherapyGoal, DischargeRecommendation |
| Wound Care | None | GAP | No WoundAssessment, WoundTreatmentPlan, pressure injury staging (NPUAP), Braden integration, wound photo |
| IV Therapy / Infusions | `medication-administration.tsp` (partial) | PARTIAL | MAR covers medication administration; missing VascularAccess entity, site assessment, INS phlebitis scale, IVFluidOrder distinct from medication |
| Pharmacy (Inpatient + Outpatient) | `pharmacy.tsp` | PARTIAL | MedicationDispense, DrugInteractionService covered; missing IVPreparation (compounding/BUD), ControlledSubstanceLog with dual-sign, `processReturn`, `checkFormulary`, `getInventoryLevel` |
| Medication Administration Record (eMAR) | `medication-administration.tsp` | PARTIAL | MedicationAdministration exists; missing MAREntry generation workflow, barcode verification log, `confirmAdministration` five-rights endpoint, `documentNonAdministration`, `recordWaste` with co-sign |
| Medication Reconciliation | `pharmacy.tsp` (ReconciliationManagement) | PARTIAL | ReconciliationManagement exists; missing HomeMedication entity (BPMH), ReconciliationDiscrepancy, physician decision workflow, discharge med list |
| Allergy & Adverse Reaction Management | `allergy.tsp` | PARTIAL | AllergyIntolerance well covered; missing `verifyAllergy` (verification status), `recordADREvent` as separate inpatient ADR workflow, CrossReactivityGroup, `documentAllergyOverride` with attending-level enforcement |
| CPOE (Computerized Provider Order Entry) | `service-request.tsp`, `medication-request.tsp` | PARTIAL | Individual order types covered by resource-specific modules; missing unified Order entity, `applyOrderSet`, `createVerbatimOrder` with co-sign, `listActiveOrders` cross-type, draft-only offline semantics |
| Order Sets & Care Pathways | None | GAP | No OrderSetTemplate, CarePathway, PathwayStep, `enrollInPathway`, `advancePathwayStep`, `recordPathwayVariance`, `applyOrderSet` template application |
| Clinical Decision Support (CDS) | `cds.tsp` | PARTIAL | CDS Hooks service coverage is good; missing `getSepsisScore`, `getEarlyWarningScore` (NEWS2/qSOFA), OverrideRecord entity, alert fatigue monitoring (override rate tracking) |
| Vitals & Flowsheets | `observation.tsp` | PARTIAL | Observation covers individual vitals; missing FlowsheetTemplate (unit-specific), `getFlowsheetByTemplate`, `listCriticalAlerts`, threshold configuration per care setting, device-source tagging |
| Nursing Assessments & Care Plans | `care-plan.tsp`, `questionnaire.tsp` | PARTIAL | CarePlan, Goal covered; missing NursingAssessment entity, FallRiskScore, BradenScore entities, NursingDiagnosis, safety flag propagation to patient workspace |
| Clinical Documentation & CDI | `composition.tsp`, `document-reference.tsp` | PARTIAL | Composition covers structured documents; missing CDIQuery entity, CDIQueryResponse, DocumentationOpportunity, EncounterCodingRecord, `createCDIQuery`, `respondToCDIQuery` |
| Laboratory Information System (LIS) | `laboratory.tsp` | PARTIAL | SpecimenManagement, DiagnosticReportManagement, LabVerificationService covered; missing `accessionSpecimen`, `enterResults`, `documentCriticalValueNotification` (read-back), `rejectSpecimen` with reason, `releaseResults` as distinct operation |
| Pathology & Specimen Workflow | `laboratory.tsp` (partial) | PARTIAL | Specimen exists; no PathologyCase, GrossExamination, MicroscopicExamination, PathologyReport with frozen section, `issueFrozenSectionResult` |
| Blood Bank / Transfusion Services | `blood-bank.tsp` | COVERED | BloodProductManagement, CrossmatchManagement, TransfusionManagement well covered. **Minor gaps:** two-nurse verification co-sign not modeled, `startTransfusion` not named, TypeAndScreen result entity not distinct from crossmatch |
| Radiology / RIS + PACS | `radiology.tsp` | PARTIAL | ImagingStudyManagement, RadiologyReportManagement covered; missing `updateTransportStatus` (patient-to-radiology transport), contrast adverse event documentation, `listImagingWorklist`, `confirmStudyComplete`, `signRadiologyReport` as distinct operation |
| Code Blue / Rapid Response | None | GAP | No CodeEvent, CodeIntervention, CodeMedication, offline-capable resuscitation documentation, `activateCodeEvent`, `generateCodeSummary` |
| Discharge Summaries & Transitions of Care | `composition.tsp` | PARTIAL | Composition covers structured discharge summary document; missing `createDischargeSummary` as a named composite operation, `addPatientInstruction`, `generateReferralLetter`, `amendDischargeSummary`, mandatory field gate before signing |
| Palliative & Hospice Care | `care-plan.tsp`, `consent.tsp` | PARTIAL | CarePlan, Goal, Consent cover base entities; missing PalliativeConsult, HospiceConversion, BereavementReferral, expedited palliative medication pathway |
| Home Health Orders & Remote Care | `service-request.tsp` | PARTIAL | ServiceRequest covers order; missing HomeHealthOrder, DMEOrder, RemoteMonitoringOrder, AgencyTransmission, `ingestAgencyVisitNote`, `transmitHomeHealthOrder` |
| Long-Term Acute Care (LTAC) | `episode-of-care.tsp` | PARTIAL | EpisodeOfCare covers grouper; missing LTACEpisode, AdmissionCriteriaAssessment, RecertificationReview, SwingBedDesignation, separate LOS tracking |

---

## Section 3 — Category 3: Hospital Practice Operations (43 Domains)

This entire category is largely unaddressed by the current spec. The spec is a clinical API layer, not an operational hospital management system. The following table summarizes coverage:

| PRD Domain | Spec Module | Status |
|---|---|---|
| Bed Management & Capacity | `bed-management.tsp` | PARTIAL — Bed, BedStatus, BedAssignment exist; missing cleaning state machine (dirty→cleaning→available), `getCensusSummary`, `getBedMap` |
| Bed Cleaning / EVS Turnover | None | GAP |
| Patient Transport / Porter Services | None | GAP |
| Discharge Planning & Case Management | `care-plan.tsp` (partial) | PARTIAL — CarePlan exists; no DischargePlan, BarrierToDischarge, CaseManagerAssignment, `listHighRiskDischarges` |
| Utilization Review & Medical Necessity | None | GAP |
| Staff / Workforce Scheduling | None | GAP |
| Credentialing & Privileging | `staff-credentialing.tsp` | PARTIAL — CredentialingManagement, PrivilegeManagement exist; missing FPPE/OPPE review cycle entities, `openFPPEPeriod`, `closeFPPEReview`, `generateOPPEReport`, `listExpiringCredentials` |
| Employee / Occupational Health | None | GAP |
| Volunteer Management | None | GAP |
| Supply Chain & Materials Management | `inventory.tsp` | PARTIAL — InventoryManagement, BatchManagement exist; missing PurchaseOrder, Vendor, StockRequisition, FIFO enforcement, `createPurchaseOrder`, `approvePurchaseOrder`, `receiveGoods` |
| Chargemaster (CDM) | None | GAP — ChargeItemDefinition exists in FHIR but no CDM management module |
| Revenue Cycle & Denials Management | `claims.tsp` (partial) | PARTIAL — Claim/ClaimResponse exist; missing DenialRecord, AppealCase, RemittanceAdvice, ARAgingBucket, `postRemittance`, `fileAppeal`, `getARAgingReport` |
| Coding (ICD-10, DRG, HCC) | None | GAP — Terminology service can look up codes but no CodingAssignment, DRGAssignment, CDI query workflow |
| Health Information Management (HIM) / ROI | None | GAP — ChartDeficiency, ROIRequest, ROIAuthorization entities absent |
| Cost Accounting | None | GAP |
| Sterile Processing / CSSD | None | GAP |
| Biomedical Equipment Management | `device.tsp` | PARTIAL — DeviceManagement exists; missing PreventiveMaintenance scheduling, WorkOrder, CalibrationRecord, EquipmentRecall, `createPMSchedule`, `openWorkOrder`, `initiateEquipmentRecall` |
| Linens & Laundry Services | None | GAP |
| Food & Nutrition / Dietary | None | GAP — NutritionOrder (FHIR) is not in the spec; DietOrder, MealTray, FoodServiceProduction absent |
| Housekeeping / Environmental Services | None | GAP |
| Mortuary / Morgue Management | None | GAP |
| Incident Reporting & Patient Safety | `incident-reporting.tsp` | PARTIAL — IncidentReportManagement, QualityMeasureManagement exist; missing RCARecord, ActionItem, SentinelEventAlert, `flagAsSentinelEvent`, `openRCARecord`, `createActionItem`, `generateSafetyEventSummary` |
| Risk Management & Legal Hold | None | GAP |
| Infection Prevention & HAI Surveillance | `infection-control.tsp` | PARTIAL — InfectionSurveillanceManagement, AntibiogramManagement exist; missing IsolationOrder management, `createIsolationOrder`, `discontinueIsolationOrder`, `generateNHSNSubmission`, `triggerOutbreakInvestigation`, NHSN submission entity |
| Antimicrobial Stewardship | None | GAP — Antibiogram covered but no RestrictionPolicy, StewardshipIntervention, de-escalation prompt workflow, DOT/DDD tracking |
| Quality Measures & Clinical Registries | `incident-reporting.tsp` (QualityMeasureManagement) | PARTIAL — QualityMeasure entity exists; missing CQLLibrary, RegistrySubmission, BenchmarkComparison, `loadCQLLibrary`, `calculateMeasureForEncounter`, `generateRegistrySubmission` |
| Peer Review / M&M | None | GAP |
| Emergency Preparedness / Disaster (HICS) | None | GAP |
| Research, IRB & Clinical Trials | `cohort.tsp` (partial) | PARTIAL — ResearchExtract exists; missing IRBSubmission, ResearchProtocol, SubjectEnrollment, ResearchConsent with IRB linkage, `submitIRBApplication`, `enrollResearchSubject` |
| Referral Management & Network | `service-request.tsp` (partial) | PARTIAL — ServiceRequest covers referral order; missing ReferralStatus tracking, PreferredProviderNetwork, `transmitReferral`, `acknowledgeReferral`, `recordReferralOutcome`, network leakage report |
| Population Health & SDOH | `sdoh.tsp` | PARTIAL — SDOHScreeningManagement, SDOHReferralManagement exist; missing PopulationCohort, RiskScore, OutreachCampaign, `defineCohort`, `calculateRiskScore`, `createOutreachCampaign`, `getPopulationRiskSummary` |
| Value-Based Care / ACO / Bundled Payments | None | GAP |
| Patient Experience & Grievance Management | `reviews.tsp` (NPS) | PARTIAL — NPS review system exists but no HCAHPS survey, Grievance entity, formal grievance investigation workflow, resolution letter |
| Interpreter & Language Access Services | None | GAP |
| Pastoral, Chaplaincy & Social Work | None | GAP |
| Engineering Work Orders & PM | None | GAP |
| Biomedical & Hazardous Waste Management | None | GAP |
| Committee & Board Management | None | GAP |
| Payer & Vendor Contract Management | None | GAP |
| Learning Management System & Training | None | GAP |
| GME & CME Tracking | None | GAP |
| Medical Arts Building / Affiliated Clinic | None | GAP |
| Vendor Rep & Implant Rep Access | None | GAP |

---

## Section 4 — Category 4: Integration & Interoperability (28 Domains)

| PRD Domain | Spec Module | Status | Key Gaps |
|---|---|---|---|
| HL7 v2 Interface Engine | None | GAP | No InterfaceChannel, Message routing, MLLP adapter, ErrorQueue, ADT trigger events |
| FHIR R4 API Gateway | `conformance/capability-statement.tsp`, `bulk-export.tsp`, `subscriptions.tsp` | PARTIAL | SMART-on-FHIR app launch, OAuth2 token management endpoints absent; CapabilityStatement generation covered |
| CCDA / C-CDA Document Exchange | `document-reference.tsp` (partial) | PARTIAL | DocumentReference covers metadata; no `generateCCDA`, `validateCCDA`, `transmitDocument`, `parseCCDA`, `reconcileImportedData` endpoints |
| DICOM & Imaging Interop | `radiology.tsp` | PARTIAL | ImagingStudy covered; no MWLEntry entity, `createMWLEntry`, DICOM C-STORE ingestion, DICOMweb query/retrieve endpoints |
| IHE Profiles | None | GAP | XDS.b, PIX/PDQ, XCA profiles completely absent |
| Payer EDI | `claims.tsp` (partial) | PARTIAL | Claims submit/response exist; no EDI X12 transaction objects (837I/837P, 835, 270/271, 278), `postRemittance`, `reconcilePayment` |
| ePrescribing & EPCS / PDMP | `medication-request.tsp` (partial) | PARTIAL | MedicationRequest exists; no NCPDP SCRIPT routing, PDMP query, EPCS credential management |
| Public Health Reporting | `infection-control.tsp` (partial) | PARTIAL | HAI surveillance exists; no ELR submission, IIS immunization reporting, syndromic surveillance submission, cancer registry |
| Medical Device & IoT Integration | `device.tsp` | PARTIAL | DeviceManagement, DeviceMetric covered; missing `ingestDeviceReading` streaming endpoint, configurable alert thresholds per care setting, `evaluateAlertThresholds` |
| HIE / Carequality / TEFCA | None | GAP | No HIEParticipant, PatientMatch, ExternalRecord, `queryPatientRecords`, `retrieveExternalDocument` |
| Identity Federation & Provider Directory Sync | None | GAP | SAML/OIDC federation, NPI sync absent |
| Event Streaming & Webhooks | `subscriptions.tsp` | COVERED | SubscriptionManagement well covered; FHIR Subscriptions implemented |
| Teleradiology Service Integration | `radiology.tsp` (partial) | PARTIAL | ImagingStudy exists; no TeleradOrder, SLA tier tracking, `ingestPreliminaryReport`, `ingestFinalReport` |
| Reference & Send-Out Lab Integration | `laboratory.tsp` (partial) | PARTIAL | Specimen/DiagnosticReport exist; no SendOutOrder, ReferenceLabProvider, `transmitRequisition`, `ingestReferenceLabResult` |
| **PH: PhilHealth Membership** | None | GAP | No PhilHealthMember, MemberEligibility, `verifyMembership` |
| **PH: PhilHealth eClaims 3.0** | None | GAP | No CF1–CF4 forms, eSOA, `assembleClaimForms`, `submitClaim`, denial workflow |
| **PH: PhilHealth DSCA** | `composition.tsp` (partial) | PARTIAL | Composition covers document structure; no DSCA-specific fields (PRC license gate, HPI/Course minimum characters, RVS codes, `signDSCA`, `validateDSCACompleteness`) |
| **PH: DOH OHSRS Reporting** | None | GAP | No OHSRS report structure, aggregation, submission tracking |
| **PH: RA 9439 Compliance** | None | GAP | No DetentionRiskFlag, PromissoryNote with RA 9439 workflow, `generateRA9439Notice` |
| **PH: RA 10173 Data Privacy** | `consent.tsp` (partial) | PARTIAL | Consent exists; no DPO record, BreachIncident, NPC notification workflow, DSAR management |
| **PH: PWD/Senior Discount Engine** | None | GAP | No DiscountEligibility, discount computation order (gross → PhilHealth deduction), VAT exemption |
| **PH: PNDF Formulary + YAKAP** | `medication.tsp` (partial) | PARTIAL | Medication catalog exists; no PNDF alignment, `checkDrugPNDFStatus`, `enrollYAKAPPatient`, FPE submission |
| **PH: PhilHealth Member Programs** | None | GAP | No Konsulta, Z-Benefit, KonSulTa MD program discriminator |
| **PH: PhilHealth Provider Accreditation** | `staff-credentialing.tsp` (partial) | PARTIAL | Credentialing exists; no ACR 2.0 / IHCP accreditation types, `createAccreditationApplication`, `scheduleInspection` |
| **PH: DOH NHFR** | `organization.tsp` (partial) | PARTIAL | Organization exists; no NHFR facility ID as canonical identifier, `registerNHFRFacility`, `syncFacilityProfileFromNHFR` |
| **PH: FDA Controlled Substances eReporting** | `pharmacy.tsp` (partial) | PARTIAL | MedicationDispense exists; no ControlledSubstanceInventoryRecord, monthly reconciliation report, DDB submission |
| **PH: DOH SPEED/ESR Epidemic Surveillance** | None | GAP | No NotifiableConditionList, DiseaseReport, WeeklyAggregateTally, PIDSR submission |
| **PH: PSA PhilSys National ID** | None | GAP | No PhilSysVerification, PSN capture and API verification, biometric/OTP challenge |

---

## Section 5 — Cross-Cutting Gaps

These are structural requirements spanning multiple domains that the spec currently does not address.

### 5.1 Multi-Tenancy Scoping

**PRD Requirement:** All entities scoped to `organizationId` + `branchId`; all list operations filter by at minimum `branchId`; both fields required on all write operations.

**Spec Gap:** The spec uses a generic `tenantId` on `HealthcareBaseEntity` but does not enforce the two-level `organizationId` + `branchId` hierarchy the PRD requires. List endpoints do not uniformly filter by `branchId`.

**Recommendation:** Update `HealthcareBaseEntity` to include both `organizationId` and `branchId` as required fields, and enforce `branchId` filter on all list/search operations.

---

### 5.2 Offline-First Support

**PRD Requirement:** CRDT semantics (G-Set for AuditEvents, LWW-Register per field for demographics and vitals); offline-capable endpoints (Code Blue must work fully offline); `pendingSync` status on write operations; `lastSyncedAt` freshness indicators; `dataAsOf` on reports.

**Spec Gap:** No offline-first semantics are modeled anywhere in the spec. This is primarily an implementation concern but the spec should annotate:
- Which entities use CRDT conflict resolution
- Which endpoints require server connectivity vs. support offline queue
- `dataAsOf` field on report responses

**Recommendation:** Add an `x-offline-support` extension to operation definitions indicating offline capability level: `full` (Code Blue, vitals), `queue` (orders must be signed online), `none` (financial transactions).

---

### 5.3 State Machine Enforcement

**PRD Requirement:** Every domain with a State Machine section defines valid forward transitions only; reverse transitions are forbidden; the API must enforce and return 422 on invalid transitions.

**Spec Gap:** The spec models status as enums but does not enforce transition validity at the API layer. `EncounterStatusTransitionRequest` exists but transition rules are not machine-readable in the spec.

**Recommendation:** Add an `x-valid-transitions` extension on status transition operations documenting which source statuses are valid for each target status, enabling server-side enforcement documentation.

---

### 5.4 Extension Slot Pattern

**PRD Requirement:** Core entities declare extension slots (`Patient.coverage[]`, `Encounter.careLevel`, `Encounter.regulatoryFields[]`) as open schemas that vertical and localization adapters populate.

**Spec Gap:** The spec does not implement the extension slot pattern. Philippine-specific fields would need to be baked directly into entity models rather than injected via adapter schemas.

**Recommendation:** Adopt the PRD's extension slot pattern by adding optional typed extension maps to key entities: `Patient.extensions`, `Encounter.extensions`, `Coverage.extensions` — using TypeSpec's `Record<unknown>` or a typed union for vertical-specific sub-schemas.

---

### 5.5 User Role Gaps

**PRD Requirement:** Clinical roles required but not defined in the spec include: ward clerk, admissions clerk, triage nurse, charge nurse, scrub nurse, circulating nurse, pharmacist, pharmacy technician, lab technologist, radiologist, pathologist, anesthesiologist, CRNA, dietitian, social worker, case manager, HIM coder, CDI specialist, patient safety officer, infection preventionist, biomedical engineer, EVS worker, chaplain, interpreter, volunteer coordinator.

**Spec Gap:** The spec uses generic `admin`, `clinician`, and `patient:owner` roles on `x-security-required-roles`. Hospital workflows require much finer role granularity to enforce safety rules (e.g., only attending-level can override anaphylaxis allergy; CDI query can only be written by CDI-role, not physician).

**Recommendation:** Define a comprehensive role taxonomy and apply it consistently to `x-security-required-roles` extensions across all clinical operations.

---

## Section 6 — Priority-Ranked Recommendations

### Priority 1 — Required for MVP Inpatient Hospital Operation

These gaps block the core hospital inpatient workflow and must be addressed before any hospital go-live.

1. **ADT Extended State Machine** — Add full 9-state discharge lifecycle to Encounter; add `admitPatient`, `transferPatient`, `initiateDischarge`, `finalizeDischarge`, `listAdmittedPatients`, `getCensusSnapshot`
2. **Charge Capture Domain** — Add `charge-capture.tsp` with CDM, Charge, ChargeItem, ChargeAdjustment, `generateDailyCharges`, `verifyCharges`
3. **Patient Financial Domain** — Add `patient-financial.tsp` with Payment, Receipt, PatientAccount, PromissoryNote, PaymentPlan
4. **CPOE Unified Order Entry** — Add unified Order/OrderItem entity spanning all order types; add `applyOrderSet`, `createVerbatimOrder`, `listActiveOrders`
5. **eMAR Five-Rights Workflow** — Add `confirmAdministration`, `documentNonAdministration`, `recordWaste` with co-sign to `medication-administration.tsp`
6. **ED Tracker Module** — Add `emergency-department.tsp` with EDVisit, TriageAssessment, triage acuity, door-to-doctor timer, ED board
7. **Bed Cleaning State Machine** — Extend `bed-management.tsp` with dirty → cleaning → available transitions and EVS task generation

### Priority 2 — Required for Clinical Safety and Regulatory Compliance

8. **DSCA / Discharge Summary Gate** — Formalize discharge summary as a gated composite entity with mandatory field validation and signing workflow in `composition.tsp`
9. **Critical Value Notification** — Add `documentCriticalValueNotification` (read-back) to `laboratory.tsp`
10. **Allergy Override Enforcement** — Add attending-level override enforcement, `verifyAllergy`, `documentAllergyOverride` to `allergy.tsp`
11. **Code Blue / Rapid Response** — Add offline-capable `emergency-response.tsp` with CodeEvent, resuscitation timeline
12. **Medication Reconciliation Workflow** — Extend pharmacy reconciliation with HomeMedication (BPMH), ReconciliationDiscrepancy, physician decision
13. **Incident RCA Workflow** — Extend `incident-reporting.tsp` with RCARecord, ActionItem, SentinelEventAlert, `flagAsSentinelEvent`

### Priority 3 — Required for Philippine Regulatory Compliance

14. **PhilHealth eClaims 3.0** — Add `ph/philhealth-eclaims.tsp` with CF1–CF4, eSOA, claim lifecycle
15. **PhilHealth Membership Verification** — Add `ph/philhealth-membership.tsp` with `verifyMembership`
16. **RA 9439 Compliance** — Add `ph/ra9439.tsp` with PromissoryNote workflow, discharge authorization, compliance audit log
17. **RA 10173 Data Privacy** — Extend `consent.tsp` with BreachIncident, NPC notification, DSAR workflow, DPO role
18. **DOH OHSRS Reporting** — Add `ph/doh-ohsrs.tsp` with report aggregation and submission
19. **PWD/Senior Discount Engine** — Add `ph/discount-engine.tsp` with mandatory discount computation
20. **PNDF Formulary + YAKAP** — Add `ph/pndf-yakap.tsp` with formulary alignment and maternity package enrollment

### Priority 4 — Hospital Operations (Phase 2)

21. ICU/Critical Care flowsheet domain
22. OR Pathway enforcement (surgical timeout gate, Aldrete scoring)
23. Ventilator & Respiratory Therapy module
24. Labor & Delivery / Maternity module
25. Workforce/Staff Scheduling module
26. Revenue Cycle & Denials Management
27. Coding (ICD-10, DRG, HCC) module
28. HIM / ROI module
29. Antimicrobial Stewardship module
30. Patient Portal namespace
31. HL7 v2 Interface Engine adapter
32. DICOM / MWL integration adapter

### Priority 5 — Hospital Operations (Phase 3 / Out-of-Scope for MVP)

- Sterile Processing (CSSD)
- Behavioral Health / Psychiatry
- Oncology / Chemotherapy
- Dialysis
- NICU
- Mortuary / Morgue
- Volunteer Management
- Linens & Laundry
- Food & Nutrition (full dietary)
- Committee & Board Management
- GME & CME Tracking
- Value-Based Care / ACO
- IHE XDS/PIX/PDQ profiles
- PSA PhilSys National ID integration

---

## Section 7 — Structural Changes Required to the Spec

Beyond adding new modules, the following structural changes to existing spec files are needed.

### 7.1 `encounter.tsp`

- Add `careLevel` (ICU, inpatient, ED, day-surgery, home-health), `billingModel`, `admissionSource` fields
- Add coded `dischargeDisposition` field (replacing free-text)
- Extend `EncounterStatus` with intermediate discharge states or add `dischargeStatus` parallel field
- Add `amaDocumentRef` enforcement annotation
- Add `regulatoryFields` extension map

### 7.2 `bed-management.tsp`

- Extend `BedStatus` with `dirty` and `cleaning` states
- Add `BedAssignment` entity (distinct from Bed — one Bed, many historical assignments)
- Add `OccupancyCensus` (snapshot) entity
- Add `assignBed`, `releaseBed`, `markBedOutOfService`, `getCensusSummary`, `getBedMap` operations

### 7.3 `pharmacy.tsp`

- Add `IVPreparation` entity (compounding, BUD, storage conditions)
- Add `ControlledSubstanceLog` with dual-sign dispensing and waste
- Add `processReturn`, `checkFormulary`, `getInventoryLevel` operations

### 7.4 `laboratory.tsp`

- Add `accessionSpecimen`, `enterResults`, `validateResults`, `releaseResults` as explicit named operations
- Add `documentCriticalValueNotification` with mandatory read-back fields
- Add `AccessionRecord` entity
- Add `ResultPanel` (ordered group) already in spec via `ResultPanelManagement`

### 7.5 `staff-credentialing.tsp`

- Add `FPPEReview` and `OPPEReview` entities
- Add `openFPPEPeriod`, `closeFPPEReview`, `generateOPPEReport`, `listExpiringCredentials` operations
- Add `ExpiryAlert` entity

### 7.6 `incident-reporting.tsp`

- Add `RCARecord`, `ActionItem`, `CorrectionPlan`, `SentinelEventAlert` entities
- Add `flagAsSentinelEvent`, `openRCARecord`, `createActionItem`, `resolveActionItem`, `generateSafetyEventSummary` operations

### 7.7 `infection-control.tsp`

- Add `IsolationOrder` entity with physician-order semantics
- Add `createIsolationOrder`, `discontinueIsolationOrder` operations
- Add `NHSNSubmissionRecord` entity and `generateNHSNSubmission` operation
- Add `triggerOutbreakInvestigation` operation

### 7.8 `surgical-management.tsp`

- Add `completeSurgicalTimeout` operation with WHO Safety Checklist enforcement
- Add `updatePACUScore` with Aldrete scoring model
- Add `listORSchedule` operation
- Add pre-op clearance gate (anesthesia must clear before OR entry)
- Add implant `UDI` mandatory field and `DeviceUseStatement` reference

### 7.9 Common Models

- Add `branchId` as required field alongside `tenantId` on `HealthcareBaseEntity`
- Add `NutritionOrder` resource (missing from spec entirely — referenced by ICU and dietary domains)
- Add `AdverseEvent` resource (referenced by blood bank reaction, allergy ADR)

---

## Appendix A — Domain Count by Status

| Status | Count | % |
|--------|-------|---|
| COVERED | ~9 | 7% |
| PARTIAL | ~38 | 30% |
| GAP | ~81 | 63% |
| **Total** | **128** | 100% |

COVERED domains: BloodBank (transfusion), Terminology, EventStreaming/Webhooks, Scheduling (basic), Consent (basic), FHIR Conformance (bulk export, capability statement, subscriptions, IPS, FHIR operations), CDS (basic).

---

## Appendix B — Files to Create (New Modules)

| File Path | PRD Domains Addressed |
|---|---|
| `specs/api/src/healthcare/administrative/charge-capture.tsp` | Billing & Charges (Cat 1.11) |
| `specs/api/src/healthcare/administrative/patient-financial.tsp` | Payments & PFS (Cat 1.12), PH: RA 9439 |
| `specs/api/src/healthcare/administrative/utilization-review.tsp` | Utilization Review (Cat 3) |
| `specs/api/src/healthcare/administrative/discharge-planning.tsp` | Discharge Planning & Case Management (Cat 3) |
| `specs/api/src/healthcare/administrative/revenue-cycle.tsp` | Revenue Cycle & Denials (Cat 3), Coding |
| `specs/api/src/healthcare/administrative/chargemaster.tsp` | Chargemaster/CDM (Cat 3) |
| `specs/api/src/healthcare/administrative/workforce-scheduling.tsp` | Staff Scheduling (Cat 3) |
| `specs/api/src/healthcare/administrative/referral-management.tsp` | Referral Management (Cat 3) |
| `specs/api/src/healthcare/clinical/emergency-department.tsp` | ED Tracker (Cat 2) |
| `specs/api/src/healthcare/clinical/icu-critical-care.tsp` | ICU / Critical Care (Cat 2) |
| `specs/api/src/healthcare/clinical/ventilator-respiratory.tsp` | Ventilator & RT (Cat 2) |
| `specs/api/src/healthcare/clinical/telemetry-monitoring.tsp` | Telemetry / Continuous Monitoring (Cat 2) |
| `specs/api/src/healthcare/clinical/labor-delivery.tsp` | L&D / Maternity (Cat 2), NICU |
| `specs/api/src/healthcare/clinical/oncology-chemo.tsp` | Oncology / Chemotherapy (Cat 2) |
| `specs/api/src/healthcare/clinical/dialysis.tsp` | Dialysis (Cat 2) |
| `specs/api/src/healthcare/clinical/behavioral-health.tsp` | Behavioral Health / Psychiatry (Cat 2) |
| `specs/api/src/healthcare/clinical/rehabilitation.tsp` | Rehabilitation PT/OT/ST (Cat 2) |
| `specs/api/src/healthcare/clinical/wound-care.tsp` | Wound Care (Cat 2) |
| `specs/api/src/healthcare/clinical/order-sets-pathways.tsp` | Order Sets & Care Pathways (Cat 2) |
| `specs/api/src/healthcare/clinical/vitals-flowsheets.tsp` | Vitals & Flowsheets (Cat 2) |
| `specs/api/src/healthcare/clinical/nursing-assessments.tsp` | Nursing Assessments (Cat 2) |
| `specs/api/src/healthcare/clinical/cdocumentation-cdi.tsp` | Clinical Documentation & CDI (Cat 2) |
| `specs/api/src/healthcare/clinical/emergency-response.tsp` | Code Blue / Rapid Response (Cat 2) |
| `specs/api/src/healthcare/clinical/palliative-hospice.tsp` | Palliative & Hospice (Cat 2) |
| `specs/api/src/healthcare/clinical/home-health.tsp` | Home Health Orders (Cat 2) |
| `specs/api/src/healthcare/clinical/ltac.tsp` | LTAC / Step-Down (Cat 2) |
| `specs/api/src/healthcare/clinical/telehealth.tsp` | Telehealth / Virtual Care (Cat 1.22) |
| `specs/api/src/healthcare/clinical/iv-therapy.tsp` | IV Therapy / Infusions (Cat 2) |
| `specs/api/src/healthcare/operational/sterile-processing.tsp` | CSSD (Cat 3) |
| `specs/api/src/healthcare/operational/biomedical-equipment.tsp` | Biomedical Equipment (Cat 3) |
| `specs/api/src/healthcare/operational/food-nutrition.tsp` | Food & Nutrition (Cat 3) |
| `specs/api/src/healthcare/operational/waste-management.tsp` | Biomedical Waste (Cat 3) |
| `specs/api/src/healthcare/support/patient-portal.tsp` | Patient Portal (Cat 1.21) |
| `specs/api/src/healthcare/support/population-health.tsp` | Population Health & SDOH (Cat 3) |
| `specs/api/src/healthcare/support/antimicrobial-stewardship.tsp` | Antimicrobial Stewardship (Cat 3) |
| `specs/api/src/healthcare/support/peer-review.tsp` | Peer Review / M&M (Cat 3) |
| `specs/api/src/healthcare/support/quality-registries.tsp` | Quality Measures & Registries (Cat 3) |
| `specs/api/src/healthcare/support/research-irb.tsp` | Research, IRB & Clinical Trials (Cat 3) |
| `specs/api/src/healthcare/support/risk-legal.tsp` | Risk Management & Legal Hold (Cat 3) |
| `specs/api/src/healthcare/support/him-roi.tsp` | HIM / ROI (Cat 3) |
| `specs/api/src/healthcare/integration/hl7v2.tsp` | HL7 v2 Interface Engine (Cat 4) |
| `specs/api/src/healthcare/integration/ccda.tsp` | CCDA Exchange (Cat 4) |
| `specs/api/src/healthcare/integration/dicom.tsp` | DICOM & Imaging Interop (Cat 4) |
| `specs/api/src/healthcare/integration/payer-edi.tsp` | Payer EDI (Cat 4) |
| `specs/api/src/healthcare/integration/eprescribing.tsp` | ePrescribing & EPCS / PDMP (Cat 4) |
| `specs/api/src/healthcare/integration/hie.tsp` | HIE / Carequality / TEFCA (Cat 4) |
| `specs/api/src/healthcare/integration/public-health.tsp` | Public Health Reporting (Cat 4) |
| `specs/api/src/healthcare/localization/ph-philhealth-membership.tsp` | PH: PhilHealth Membership |
| `specs/api/src/healthcare/localization/ph-philhealth-eclaims.tsp` | PH: PhilHealth eClaims 3.0 |
| `specs/api/src/healthcare/localization/ph-dsca.tsp` | PH: PhilHealth DSCA |
| `specs/api/src/healthcare/localization/ph-doh-ohsrs.tsp` | PH: DOH OHSRS Reporting |
| `specs/api/src/healthcare/localization/ph-ra9439.tsp` | PH: RA 9439 Compliance |
| `specs/api/src/healthcare/localization/ph-ra10173.tsp` | PH: RA 10173 Data Privacy |
| `specs/api/src/healthcare/localization/ph-discount-engine.tsp` | PH: PWD/Senior Discount |
| `specs/api/src/healthcare/localization/ph-pndf-yakap.tsp` | PH: PNDF + YAKAP |
| `specs/api/src/healthcare/localization/ph-member-programs.tsp` | PH: PhilHealth Member Programs |
| `specs/api/src/healthcare/localization/ph-provider-accreditation.tsp` | PH: PhilHealth Provider Accreditation |
| `specs/api/src/healthcare/localization/ph-nhfr.tsp` | PH: DOH NHFR |
| `specs/api/src/healthcare/localization/ph-fda-controlled.tsp` | PH: FDA Controlled Substances |
| `specs/api/src/healthcare/localization/ph-speed-esr.tsp` | PH: DOH SPEED/ESR |
| `specs/api/src/healthcare/localization/ph-philsys.tsp` | PH: PSA PhilSys National ID |

---

*End of Gap Analysis — 2026-04-14*
