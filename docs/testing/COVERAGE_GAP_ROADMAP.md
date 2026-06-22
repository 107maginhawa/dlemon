# Coverage Gap Roadmap

> GENERATED from `docs/testing/coverage/*.json` + `orphan-disposition.md` (regenerate with `bun /tmp/gen-roadmap.ts` or re-run after `bun run coverage:all:ci`).
> Each item is a tracked, **dispositioned** gap — not a silent omission. Address one at a time with the same approach: **RED-first TDD, one branch+PR per cluster, prove non-vacuity (mutate guard → test fails → revert), merge when the 20 required gates are green.**

## Why these were not done in the first pass

The 16-PR production-readiness program was scoped by **risk**: suspected real bugs, every P0 business rule, money-race/concurrency paths, RBAC deny-paths, erasure/consent/privacy, and the 9 required user journeys — all closed and verified. What remains below is the lower-risk long tail, deferred for concrete reasons (per category) rather than oversight. Single-clinic launch posture: RLS is posture-only; multi-tenant isolation E2E is gated on cloud-launch.

## 1. Sensitive mutating-orphan obligations (6) — HIGHEST VALUE

**What:** a write (POST/PUT/PATCH/DELETE) to a PII/clinical/billing/org surface with a shipped handler + SDK but **no FE consumer** and no ownership/cross-tenant negative test. Reachable over the wire → IDOR / cross-tenant exploitable even with no UI (this class swallowed the P0 `updatePatientContact` IDOR).
**Why deferred:** not reachable from the product UI (no FE consumer), so they cannot break a user flow; the P0s that *were* FE-reachable were all closed. Each needs a bespoke cross-tenant/ownership negative test. Ratcheted in `endpoint-sensitive-orphan.allowlist.json`.
**Fix per item:** add a cross-tenant/IDOR negative test asserting 401/403/404 for a non-owner; OR wire/remove the endpoint; OR allowlist with a reason.

- [ ] `approveAmendment` — dental-clinical — `POST /dental/visits/{visitId}/amendments/{amendmentId}/approve`
- [ ] `confirmAppointmentByToken` — dental-scheduling — `POST /dental/public/appointments/{appointmentId}/confirm/{token}`
- [ ] `deactivatePractitioner` — provider — `DELETE /providers/practitioners/{id}`
- [ ] `deactivatePractitionerRole` — provider — `DELETE /providers/practitioner-roles/{id}`
- [ ] `handleStripeWebhook` — billing — `POST /billing/webhooks/stripe`
- [ ] `requestErasure` — dental-erasure — `POST /dental/erasure-requests`

## 2. Endpoint gaps — FE-consumed but untested (45)

**What:** an operation the product UI **does** call, but with no contract/integration/journey test.
**Why deferred:** mostly reads and lower-risk writes whose happy path is implicitly exercised by journeys/FE unit tests; the gate ratchets them so no NEW untested FE-consumed op can land.
**Fix per item:** add a contract (hurl) test, or an api-unit/integration test, for the operation.

### dental-imaging (2)
- [ ] `CephMgmt_deleteCephLandmark` — `DELETE /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}`
- [ ] `CephMgmt_updateCephLandmark` — `PATCH /dental/imaging/images/{imageId}/ceph/landmarks/{landmarkCode}`

### dental-patient (18)
- [ ] `acceptTreatmentOption` — `POST /dental/patients/{patientId}/treatment-options/{optionGroupId}/accept`
- [ ] `addHouseholdMember` — `POST /dental/households/{householdId}/members`
- [ ] `createDentalAlert` — `POST /dental/patients/{patientId}/dental-alerts`
- [ ] `createHousehold` — `POST /dental/households`
- [ ] `createTask` — `POST /dental/patients/{patientId}/tasks`
- [ ] `detectDuplicatePatients` — `GET /dental/patients/duplicates`
- [ ] `listDentalAlerts` — `GET /dental/patients/{patientId}/dental-alerts`
- [ ] `listPatientInsuranceProfiles` — `GET /dental/patients/{patientId}/insurance-profiles`
- [ ] `listPatientTasks` — `GET /dental/patients/{patientId}/tasks`
- [ ] `listPatientTreatmentPlans` — `GET /dental/patients/{patientId}/treatment-plans`
- [ ] `listSyncLogs` — `GET /dental/sync-logs`
- [ ] `listTreatmentOptionGroup` — `GET /dental/patients/{patientId}/treatment-options/{optionGroupId}`
- [ ] `rejectCasePresentation` — `POST /dental/patients/{patientId}/case-presentations/{presentationId}/reject`
- [ ] `removeHouseholdMember` — `DELETE /dental/households/{householdId}/members/{patientId}`
- [ ] `updateDentalAlert` — `PATCH /dental/patients/{patientId}/dental-alerts/{alertId}`
- [ ] `updateInsuranceProfile` — `PATCH /dental/patients/{patientId}/insurance-profiles/{profileId}`
- [ ] `updatePatientCommunicationConsent` — `PATCH /dental/patients/{patientId}/communication-consent`
- [ ] `updateTask` — `PATCH /dental/patients/{patientId}/tasks/{taskId}`

### dental-billing (7)
- [ ] `addInsuranceClaimLine` — `POST /dental/billing/claims/{claimId}/lines`
- [ ] `applyCreditToInvoice` — `POST /dental/billing/invoices/{invoiceId}/apply-credit`
- [ ] `generateStatementBatch` — `POST /dental/billing/statements/batch`
- [ ] `getArAging` — `GET /dental/billing/collections/aging`
- [ ] `markUncollectible` — `POST /dental/billing/invoices/{invoiceId}/uncollectible`
- [ ] `refundDentalPayment` — `POST /dental/billing/payments/{paymentId}/refund`
- [ ] `updateInsuranceClaimLine` — `PATCH /dental/billing/claims/{claimId}/lines/{lineId}`

### dental-clinical (4)
- [ ] `createOcclusionScreening` — `POST /dental/patients/{patientId}/occlusion-screenings`
- [ ] `getMedicalHistoryReview` — `GET /dental/clinical/medical-history-review`
- [ ] `listOcclusionScreenings` — `GET /dental/patients/{patientId}/occlusion-screenings`
- [ ] `recordMedicalHistoryReview` — `POST /dental/clinical/medical-history-review`

### patient (1)
- [ ] `createPatient` — `POST /patients`

### dental-org (4)
- [ ] `deactivateMember` — `DELETE /dental/org/members/{memberId}`
- [ ] `getFeeSchedule` — `GET /dental/fee-schedule`
- [ ] `updateFeeScheduleEntry` — `PATCH /dental/fee-schedule/{cdt}`
- [ ] `updateMember` — `PATCH /dental/org/members/{memberId}`

### dental-visit (3)
- [ ] `discardVisit` — `POST /dental/visits/{visitId}/discard`
- [ ] `getToothHistory` — `GET /dental/visits/history/{patientId}/teeth/{toothNumber}`
- [ ] `updateTooth` — `PATCH /dental/visits/{visitId}/chart/teeth/{toothNumber}`

### dental-scheduling (4)
- [ ] `listQueueBoard` — `GET /dental/branches/{branchId}/queue-board`
- [ ] `listWaitlist` — `GET /dental/branches/{branchId}/waitlist`
- [ ] `promoteWaitlistEntry` — `POST /dental/waitlist/{entryId}/promote`
- [ ] `updateQueueItemStatus` — `PATCH /dental/queue-items/{itemId}/status`

### notifs (1)
- [ ] `markNotificationAsRead` — `POST /notifs/{notif}/read`

### dental-perio (1)
- [ ] `upsertToothReading` — `PUT /dental/perio-charts/{chartId}/readings/{toothNumber}`

## 3. Workflow gaps (44) + deferred (3)

**What:** a documented WORKFLOW_MAP workflow with no mapped E2E/journey spec.
**Why deferred:** the 9 *required* core journeys are covered; these are secondary/ancillary flows. `deferred` = explicitly gated (e.g. cloud-launch / future phase).
**Fix per item:** author a DOM-driven Playwright journey (or map an existing spec) and register it in the journey harness.

### gap
- [ ] WF-034 — Timeline carousel navigation
- [ ] WF-043 — Branch-scoped login (membership select)
- [ ] WF-046 — Update (lock visit)
- [ ] WF-047 — Delete / Discard
- [ ] WF-049 — Update (verify)
- [ ] WF-050 — Dismiss
- [ ] WF-052 — Issue
- [ ] WF-053 — Mark partial
- [ ] WF-054 — Mark overdue
- [ ] WF-056 — Update (demographics)
- [ ] WF-057 — Merge
- [ ] WF-058 — Archive / delete
- [ ] WF-059 — Cancel
- [ ] WF-060 — Reschedule
- [ ] WF-061 — Bulk (slot generation)
- [ ] WF-062 — Read
- [ ] WF-063 — Cancel
- [ ] WF-065 — Modify (before visit locked)
- [ ] WF-067 — Add images to study
- [ ] WF-068 — Read
- [ ] WF-069 — Create org
- [ ] WF-071 — Read (settings)
- [ ] WF-072 — Membership remove
- [ ] WF-080 — Appointment booked
- [ ] WF-081 — Appointment reminder (24h)
- [ ] WF-082 — Invoice sent
- [ ] WF-083 — Invoice overdue
- [ ] WF-084 — PMD ready
- [ ] WF-085 — Lab order complete
- [ ] WF-086 — Appointment utilization
- [ ] WF-087 — Imaging study list
- [ ] WF-091 — Imaging context from visit _(cross-module)_
- [ ] WF-095 — Notification on appointment _(cross-module)_
- [ ] WF-102 — Dentition init on first visit _(cross-module)_
- [ ] WF-103 — Booking slot generation (job) _(cross-module)_
- [ ] WF-104 — Email notifications _(cross-module)_
- [ ] WF-EMRC-001 — Provider creates a draft consultation note for a patient.
- [ ] WF-EMRC-002 — Provider updates clinical fields on a draft note.
- [ ] WF-EMRC-003 — Provider finalizes a draft note (terminal).
- [ ] WF-EMRC-004 — ~~Provider amends a finalized note, then re-finalizes.~~ STRUCK (V-EMR-001) — no amend endpoint; finalize rejects non-draft notes.
- [ ] WF-EMRC-005 — Patient/provider/admin reads a note, optionally expanding patient/provider/person.
- [ ] WF-EMRC-006 — Provider lists the patients they have consulted (with consultation stats).
- [ ] WF-P03 — Complete / lock perio chart
- [ ] WF-P04 — View perio chart (historical)

### deferred (gated — confirm trigger before building)
- [ ] WF-002 — User Login (passkey)
- [ ] WF-093 — Clinical amendment approval _(cross-module)_
- [ ] WF-P05 — Print perio chart (PDF export)

## 4. FSM uncovered transition edges (48: 29 illegal, 19 legal)

**What:** a state-machine edge with no literal per-edge test. Illegal edges = transitions that MUST be rejected; legal = valid transitions without an explicit assertion.
**Why deferred:** the handlers enforce the FSM generically (`allowed=FSM[cur]; if(!allowed.includes(to)) throw`), and the high-risk machines (visit, invoice, claim) have literal per-edge tests. The rest are handler-guaranteed; literal per-edge tests were ratcheted, not all written.
**Fix per item:** add a literal `expect(isValidTransition(from,to)).toBe(false)` (illegal) / happy-path transition (legal) assertion.

### illegal edges (must-reject)
- [ ] **QueueItem** (3): cancelled→called, cancelled→in_progress, cancelled→waiting
- [ ] **TreatmentPlan** (24): approved→completed, cancelled→draft, cancelled→partially_completed, cancelled→presented, cancelled→scheduled, completed→approved, completed→draft, completed→partially_completed, completed→scheduled, draft→completed, draft→partially_completed, draft→scheduled, partially_completed→approved, partially_completed→draft, partially_completed→presented, partially_completed→rejected, presented→partially_completed, presented→scheduled, rejected→partially_completed, rejected→scheduled, scheduled→completed, scheduled→draft, scheduled→presented, scheduled→rejected
- [ ] **WaitlistEntry** (2): cancelled→active, scheduled→active

### legal edges (happy-path)
- [ ] **CephLandmark** (1): not_placed→placed
- [ ] **LabOrder** (3): delivered→cancelled, in_fabrication→cancelled, ordered→cancelled
- [ ] **QueueItem** (6): called→cancelled, called→in_progress, in_progress→cancelled, in_progress→completed, waiting→called, waiting→cancelled
- [ ] **Treatment** (1): performed→dismissed
- [ ] **TreatmentPlan** (4): approved→cancelled, partially_completed→cancelled, presented→cancelled, scheduled→cancelled
- [ ] **Visit** (2): active→discarded, completed→locked
- [ ] **WaitlistEntry** (2): active→cancelled, active→scheduled

## 5. Business-rule coverage gaps (2)

**Why deferred:** both are P2; one is positive-path-only, one is a future-phase feature.
**Fix per item:** add the missing negative path (POSITIVE_ONLY) or build+test the feature (UNTESTED future-phase).

- [ ] BR-P03 — dental-perio — **POSITIVE_ONLY** (P2)
- [ ] V-XRI-003 (FHIR/CDA/PDF EMR-import bridge is FUTURE-PHASE — not built) — external-records-import — **UNTESTED** (P2)

## 6. FE route gaps

**What:** patient-portal sub-routes never navigated by any spec.
**Why deferred:** the patient portal is a low-traffic read-only surface; the index `/portal` is now exercised, these two sub-routes are not.
**Fix per item:** add a portal journey that navigates the route and asserts self-scoped content.

- [ ] `/portal/appointments`
- [ ] `/portal/bills`

## 7. Cross-module isolation — DEFERRED TO CLOUD-LAUNCH (do not build for single-clinic)

**What:** G3 (hold-vs-erasure contention) + G4 (cross-module RLS isolation) inter-module E2E.
**Why deferred:** RLS is **posture-only** for single-clinic launch; activation (P3b + remaining modules) is the cloud-launch prerequisite. Posture-only RLS cannot assert runtime isolation, so the E2E would be vacuous until activation. G3 contention is already proven at the service layer (advisory-lock ns 1003).
- [ ] G3/G4 inter-module RLS-isolation E2E — **gated on RLS activation (cloud-launch)**
- [ ] Full RLS activation: P3b patient-subtree + remaining modules — **cloud-launch prep**
