# AUDIT_FINDINGS.md — Dentalemon Production-Readiness Audit

**Date:** 2026-06-29  ·  **Branch:** `fix/prod-readiness-p1-blockers`  ·  **Auditor:** Claude Code (workflow-orchestrated)

> **UPDATE (fixes applied):** All 4 P1 blockers fixed TDD-style (failing test → fix → green), one atomic commit each, plus a boundary-isolation refactor. Commits: G-01 `1f36a2da`, G-03 `16f69b26`, G-04 `bcd5bff5`, G-02 `6018101a`, boundaries `ad8113b9`. Post-fix gates: backend 4854/0, FE 2844/0, typecheck/lint/boundaries/rls all green, contract 50/50. E2E re-running. See §7.

Method: codegraph-mapped all 26 backend modules + FE + contract layer + 4 cross-module flows, then ran a skeptical evidence-backed gap hunt (11 parallel read-only agents, ~1.25M tokens). All 7 acceptance gates run locally with docker infra up. P1s spot-verified against cited source lines.

---

## 1. Acceptance-criteria gate table

| # | Gate | Result | Evidence |
|---|------|--------|----------|
| 1 | `bun run test` (backend + FE) | ✅ **PASS** | BE 425 files / 4848 pass / 0 fail (99.9s); FE 2840 pass / 0 fail (36.9s). DATABASE_URL pinned to `monobase_test` (109-table template verified). |
| 2 | `bun run typecheck` | ✅ **PASS** | dentalemon + @monobase/api-ts both exit 0. |
| 3 | `bun run lint` (ratchet) | ✅ **PASS** | 341 warnings / 349 ratchet (**8 headroom**), 0 errors; font-size + fsm-token checks pass. |
| 4 | `check:boundaries` + `check:rls-posture` | ✅ **PASS** | both exit 0. |
| 5 | Contract suite (Hurl) | ✅ **PASS** | 50/50 files, 100%, exit 0 (with MinIO/Mailpit/stripe-mock up via docker-compose.deps.yml). First run showed 9 infra-absence 500s/conn-refused — NOT contract violations. |
| 6 | Journey Harness / E2E | ⚠️ **Required Harness GREEN / full suite 7 non-required red** | Post-fix `bun run test:e2e` = **307 passed / 7 failed / 9 skipped** (15.9m). **None** of the 7 are in the required Journey Harness Set A roster, and **none** are caused by the fixes (the 13 changed files touch zero scheduling/calendar/signup code; `billing-queue-morgan › Void Invoice` PASSES). Breakdown: 2 chronic (onboarding FR7.4, imaging-comparison), 3 flaky `Execution context destroyed…navigation` races (different specs each run), 2 date-fragile calendar specs (`calendar-overlap`, `cold-start-full-loop`) that failed only after the 06-29→06-30 date rollover (baseline passed them on 06-29; both are date-relative). All 4 fixed user flows pass E2E. |
| 7 | FE↔server drift (binding tests) | ✅ **PASS** | included in suites above — BUT see G-13/G-14: binding tests cover only a fraction of the surfaces that can drift. |

**Caveat on green gates:** the 6 unit/contract gates are green and the required Journey Harness is green, yet (a) the gap hunt found 4 P1 real bugs in code paths *no gate exercises* (void path, imaging multipart, erasure of a side table, cross-visit button wiring), and (b) the full E2E suite has 3 pre-existing reds the required harness doesn't run. Green required gates ≠ done.

---

## 2. Confirmed P1 blockers (spot-verified) — ALL FIXED ✅

| P1 | Fix | Commit | Test (RED→GREEN) |
|----|-----|--------|------------------|
| P1-1 (void→billing dead-end) | `releaseTreatmentsForInvoice` clears `billedInvoiceId` in the void tx | `1f36a2da` | `voidDentalInvoice.rebill.test.ts` |
| P1-2 (complete wrong visit) | `visitToComplete` helper + select open visit on complete | `6018101a` | `next-step.test.ts` (visitToComplete) |
| P1-3 (imaging multipart 404) | persist `stored_file` row in multipart branch | `16f69b26` | `createImagingStudy.multipart-storedfile.test.ts` |
| P1-4 (erasure misses PII) | `patient_contact` erasure target + facade | `bcd5bff5` | `erasure-service.test.ts` (G-04 case) |
| (cleanup) | route G-01/G-03 through facades (boundary gate) | `ad8113b9` | boundaries:error clean |

### P1-1 — Voiding an invoice never clears billedInvoiceId → permanent re-invoice dead-end (the exact billable-SoT bug class, via the void path)
- **Status:** ✅ FIXED (`1f36a2da` + facade refactor `ad8113b9`)
- **Category:** real-bug  ·  **Confidence:** high  ·  **Stop-zone:** YES
- **Verification:** ✅ VERIFIED (read voidDentalInvoice.ts:30-70 — only status flip; no billedInvoiceId reset anywhere; discardVisit.ts:57 confirms it is the billed-marker)
- **Evidence:** voidDentalInvoice.ts:38-65 only flips invoice.status to 'voided'; it never resets the billed treatments. setBilledInvoiceId (treatment.repo.ts:121, param typed invoiceId:string) is the ONLY writer of billedInvoiceId and is only ever called with a real invoice id via markTreatmentsAsBilled (visit-billing.facade.ts:69 ← createDentalInvoice.ts:147) — no code path sets it back to null (grep over services/api-ts/src confirms). Consequence: after a void, createDentalInvoice.ts:86 `alreadyBilled = billable.filter(t => t.billedInvoiceId)` still matches → throws TREATMENT_ALREADY_BILLED (422). The workspace modal RE-ENABLES 'Create Invoice & Pay' because visitInvoice excludes voided (workspace-payment-modal.tsx:283 `inv.status !== 'voided'`), so the clinician clicks an enabled CTA that 422s — and the visit also can no longer be discarded (discardVisit.ts:57 `hasBilledWork = treatments.some(t => t.billedInvoiceId != null)`). Void is user-reachable from invoice-detail.tsx. No test asserts re-invoice-after-void, which is why this escaped.
- **Area:** Charting → treatment FSM → billing → payment money path (dentalemon)

### P1-2 — open-visit-blocker "Complete visit" button targets the WRONG visit (currentVisitId, not the open visit)
- **Status:** ✅ FIXED (`6018101a`)
- **Category:** real-bug  ·  **Confidence:** high  ·  **Stop-zone:** no
- **Verification:** ⚠️ HIGH-CONFIDENCE (agent-traced next-step.ts:91-99 + wiring; verified by reading the checklist render at $patientId.tsx:799-806 which bound visitId=currentVisitId)
- **Evidence:** next-step.ts:91-99 returns kind 'open-visit-blocker' with a PRIMARY 'Complete visit' button when an open visit exists but the user is viewing a different (historical) visit (currentIsOpen=false). workspace-context-strip.tsx:574 wires onComplete -> setChecklistOpen(true), and $patientId.tsx:799-805 renders PreCompletionChecklist with visitId={currentVisitId} — the SELECTED historical visit, not openVisit.id. So the button that says 'Finish or discard the open visit to start a new one' never completes the open visit: it runs the checklist against the historical visit and PATCHes that visit status='completed'. If the viewed visit is already 'completed' it silently re-completes (re-stamps completedAt / re-audits / re-generates PMD via updateDentalVisit.ts:116-204 because the same-status guard at :45 is skipped); if 'locked' it 422s (VISIT_IMMUTABLE updateDentalVisit.ts:40-42). Discard is wired correctly to openVisit.id ($patientId.tsx:282-289), proving the inconsistency. The one-active-visit blocker is never resolved by its own primary CTA.
- **Area:** Visit lifecycle (state machine, completion hard-gates, visit-count coherence, one-open-visit invariant)

### P1-3 — CBCT/large-DICOM multipart imaging upload can never complete (and never aborts) — /storage/multipart/{file}/complete + /abort 404 for every imaging-originated multipart upload
- **Status:** ✅ FIXED (`16f69b26` + facade refactor `ad8113b9`)
- **Category:** real-bug  ·  **Confidence:** high  ·  **Stop-zone:** no
- **Verification:** ✅ VERIFIED (createImagingStudy.ts:170-185 calls initiateMultipartUpload but creates NO stored_file row; completeMultipartUpload.ts:42 findOneById → 404)
- **Evidence:** createImagingStudy.ts:170-178 starts the S3 multipart directly via storage.initiateMultipartUpload(fileId,...) (the S3StorageProvider method, core/storage.ts:322-337) and never creates a stored_file row (no StorageFileRepository.createOne; grep of dental-imaging/repos + createImagingStudy returns nothing). But completeMultipartUpload.ts:41-48 and abortMultipartUpload.ts:40-47 both do repo.findOneById(fileId) → throw NotFoundError('File not found') when the stored_file row is absent (and then check file.status==='uploading' / file.multipartUploadId / file.owner, none of which exist). FE use-imaging-upload.ts:111-118 POSTs /storage/multipart/${fileId}/complete and 134-139 DELETEs /abort. Confirmed asymmetry: the HTTP /storage/multipart/initiate handler (initiateMultipartUpload.ts:56-69) DOES create the stored_file row, and listPatientImages.ts:162-163 explicitly notes imaging objects have no stored_file row — so single-PUT works but multipart complete always 404s, leaving the S3 object never assembled and orphaned parts accruing storage cost (abort also 404s). useMultipart triggers for any DICOM >5MB (createImagingStudy.ts:161), i.e. every real CBCT volume.
- **Area:** Clinical sub-modules: dental-imaging, dental-perio, dental-clinical, dental-pmd (standalone completeness)

### P1-4 — Erasure misses dental_patient_contact PII table (guardian/emergency-contact name, phone, email, notes never anonymized)
- **Status:** ✅ FIXED (`bcd5bff5`)
- **Category:** missing-coverage  ·  **Confidence:** high  ·  **Stop-zone:** no
- **Verification:** ✅ VERIFIED (erasure-targets.ts has person+patient targets only; no dental_patient_contact target; patient-contact.schema.ts:8-14 = name/phone/email/notes PII)
- **Evidence:** ERASURE_TARGETS registry has no patient_contact target (erasure-targets.ts:157-169); no *-erasure.facade scrubs it (grep across handlers/*/repos/*erasure* returns nothing). The table holds patient PII: dental_patient_contact.name NOT NULL, phone, email, notes (patient-contact.schema.ts:8-14), and DATA_GOVERNANCE.md:48 explicitly lists `dental_patient_contact.name/phone/email` as protected PII. patient-erasure.facade.ts only nulls the patients.emergencyContact JSONB column (patient-erasure.facade.ts:40-49), NOT the separate dental_patient_contact rows. A GDPR Art.17 erasure approval therefore leaves a patient's guardian/emergency-contact identifying data fully intact.
- **Area:** Compliance modules: dental-erasure, dental-legalhold, retention, dental-audit (GDPR/HIPAA standalone correctness)

---

## 3. Full findings (39 gaps)

Status legend: all are **DEFERRED — needs your authorization** (every fix touches a stop-zone or product decision, and the audit is read-only on `main`).

| ID | Sev | Conf | Category | Stop-zone | Title |
|----|-----|------|----------|-----------|-------|
| G-01 | P1 | high | real-bug | ⛔ | Voiding an invoice never clears billedInvoiceId → permanent re-invoice dead-end (the exact billable-SoT bug class, via the void path) |
| G-02 | P1 | high | real-bug |  | open-visit-blocker "Complete visit" button targets the WRONG visit (currentVisitId, not the open visit) |
| G-03 | P1 | high | real-bug |  | CBCT/large-DICOM multipart imaging upload can never complete (and never aborts) — /storage/multipart/{file}/complete + /abort 404 for every imaging-originated multipart upload |
| G-04 | P1 | high | missing-coverage |  | Erasure misses dental_patient_contact PII table (guardian/emergency-contact name, phone, email, notes never anonymized) |
| G-05 | P2 | high | dead-code |  | queue-board is a fully-built, server-backed surface with zero in-app navigation entry point (orphaned feature) |
| G-06 | P2 | high | real-bug |  | OpenAPI drift gate is vacuous — specs/api/dist is fully gitignored, so detect-drift always passes green |
| G-07 | P2 | high | missing-coverage |  | No CI gate regenerates or diffs the committed SDK (packages/sdk-ts/src/generated) against the spec — OpenAPI↔SDK drift unguarded |
| G-08 | P2 | high | needs-decision | ⛔ | 'Create Invoice & Pay' CTA produces a DRAFT invoice that cannot be paid — payment UI only appears after a mandatory, unlabeled 'Issue' step |
| G-09 | P2 | high | real-bug | ⛔ | PreCompletionChecklist offers 'Complete anyway' override for consent + open-treatments, which the server hard-blocks (422, no override) |
| G-10 | P2 | high | real-bug |  | Same-status visit PATCH re-runs lifecycle side effects (re-stamp completedAt/activatedAt, re-audit, re-generate PMD) |
| G-11 | P2 | high | real-bug | ⛔ | Onboarding 'Fee Schedule' step collects per-CDT prices that are never submitted — silently discarded |
| G-12 | P2 | high | real-bug | ⛔ | Appointment never reaches 'completed' — checked_in→completed path promised but unimplemented; appointment stuck after its visit completes |
| G-13 | P2 | high | real-bug | ⛔ | Revenue Report "Collected"/"Billed" totals drift from the server collections summary that drives the dashboard MoneyPanel — same labeled month, two different numbers |
| G-14 | P2 | high | missing-coverage | ⛔ | Closed-visit immutability binding test guards only 1 of ~12 independent server guards — the other 11 can drift from FE CLOSED_VISIT_STATUSES undetected |
| G-15 | P2 | high | needs-decision |  | Failed/absent-storage radiograph S3 delete is fail-open with no retry path — PII images orphaned in S3 after a terminal 'anonymized' request |
| G-16 | P2 | medium | needs-decision | ⛔ | Patient portal is entirely view-only — no actionable next step on any portal surface |
| G-17 | P2 | medium | missing-coverage | ⛔ | Draft visit has no client-reachable cancel/discard exit and blocks re-check-in |
| G-18 | P2 | medium | real-bug | ⛔ | Owner PIN not persisted across wizard resume + set non-atomically after org creation → org provisioned with no usable owner PIN |
| G-19 | P2 | medium | needs-decision | ⛔ | RLS policies for perio/imaging/patient-subtree tables are inert — their handler modules never route through withTenantTx, so isolation rests solely on app-layer assert* with no DB backstop |
| G-20 | P2 | medium | needs-decision | ⛔ | Org-scoped RLS on dental_feature_permission is unreachable — no handler ever publishes orgIds, and the only handlers touching the table bypass RLS on the db connection |
| G-21 | P3 | high | needs-decision | ⛔ | approveAmendment is a published/SDK route that unconditionally returns 501 NOT_IMPLEMENTED |
| G-22 | P3 | high | dead-code |  | patient merge/unmerge handlers are 501 stubs AND prod-disabled (double-dead surface) |
| G-23 | P3 | high | needs-decision |  | cephSuperimposition only implements cranial_base reference; other references hard-501 |
| G-24 | P3 | high | dead-code |  | routes/onboarding.tsx (person-profile flow) and the requirePerson guard are orphaned — nothing routes to them |
| G-25 | P3 | high | dead-code |  | 846 of 1454 OpenAPI schemas (58%) are orphaned Healthcare.* FHIR models referenced by zero operations, bloating the spec and generated SDK types |
| G-26 | P3 | high | dead-code |  | Stale .gitignore rule for the generated SDK targets a non-existent path (packages/sdk vs actual packages/sdk-ts) |
| G-27 | P3 | high | needs-decision |  | No deposit / pre-treatment payment path exists for all-planned visits |
| G-28 | P3 | high | missing-coverage | ⛔ | Legacy dental_audit table is not protected by the append-only DB trigger (only dental_audit_log is) |
| G-29 | P3 | medium | dead-code |  | comms module is fully prod-disabled yet ships complete handlers/repos/schema/DB tables (orphaned surface) |
| G-30 | P3 | medium | needs-decision | ⛔ | one-open-visit invariant enforced only for status='active'; multiple DRAFT visits per patient are not prevented server-side |
| G-31 | P3 | medium | missing-coverage |  | findOpenVisit/canStartNewVisit gate (active|draft) is stricter than the server createDentalVisit guard (active only); the SoT comment claims they match, and no binding test covers it |
| G-32 | P3 | medium | missing-coverage |  | No test exercises the imaging-originated multipart complete/abort path; existing storage multipart tests seed the stored_file row via the /initiate handler, masking the createImagingStudy discrepancy |
| G-33 | P3 | medium | missing-coverage | ⛔ | Central audit PHI sanitizer blocklist omits address-component and free-text keys (address/contact PHI can survive in before/after snapshots) |
| G-34 | P3 | low | dead-code |  | Base-module background jobs run in production even though their HTTP routes are disabled |
| G-35 | P3 | low | dead-code |  | Stripe-Connect billing-onboarding flow appears vestigial in dentalemon (buy-once, local-first product) |
| G-36 | P3 | low | needs-decision | ⛔ | withTenantTx in billing/visit/scheduling provides no independent cross-tenant isolation — scope is derived from the row already fetched on the bypassing connection |
| G-37 | P3 | low | missing-coverage |  | getToothHistory query is never explicitly invalidated by any treatment/finding mutation, yet the handler now includes the ACTIVE visit's in-progress work |
| G-38 | P3 | low | missing-coverage |  | Per-tooth history is silently capped at 20 entries with no FE pagination, and the slideout 'Total' footer sums only the displayed page |
| G-39 | P3 | low | needs-decision |  | Better-Auth user/session PII (email, name, ip_address, user_agent) outside erasure scope |

### Evidence detail

**G-01 [P1/real-bug] Voiding an invoice never clears billedInvoiceId → permanent re-invoice dead-end (the exact billable-SoT bug class, via the void path)**  
voidDentalInvoice.ts:38-65 only flips invoice.status to 'voided'; it never resets the billed treatments. setBilledInvoiceId (treatment.repo.ts:121, param typed invoiceId:string) is the ONLY writer of billedInvoiceId and is only ever called with a real invoice id via markTreatmentsAsBilled (visit-billing.facade.ts:69 ← createDentalInvoice.ts:147) — no code path sets it back to null (grep over services/api-ts/src confirms). Consequence: after a void, createDentalInvoice.ts:86 `alreadyBilled = billable.filter(t => t.billedInvoiceId)` still matches → throws TREATMENT_ALREADY_BILLED (422). The workspace modal RE-ENABLES 'Create Invoice & Pay' because visitInvoice excludes voided (workspace-payment-modal.tsx:283 `inv.status !== 'voided'`), so the clinician clicks an enabled CTA that 422s — and the visit also can no longer be discarded (discardVisit.ts:57 `hasBilledWork = treatments.some(t => t.billedInvoiceId != null)`). Void is user-reachable from invoice-detail.tsx. No test asserts re-invoice-after-void, which is why this escaped.

**G-02 [P1/real-bug] open-visit-blocker "Complete visit" button targets the WRONG visit (currentVisitId, not the open visit)**  
next-step.ts:91-99 returns kind 'open-visit-blocker' with a PRIMARY 'Complete visit' button when an open visit exists but the user is viewing a different (historical) visit (currentIsOpen=false). workspace-context-strip.tsx:574 wires onComplete -> setChecklistOpen(true), and $patientId.tsx:799-805 renders PreCompletionChecklist with visitId={currentVisitId} — the SELECTED historical visit, not openVisit.id. So the button that says 'Finish or discard the open visit to start a new one' never completes the open visit: it runs the checklist against the historical visit and PATCHes that visit status='completed'. If the viewed visit is already 'completed' it silently re-completes (re-stamps completedAt / re-audits / re-generates PMD via updateDentalVisit.ts:116-204 because the same-status guard at :45 is skipped); if 'locked' it 422s (VISIT_IMMUTABLE updateDentalVisit.ts:40-42). Discard is wired correctly to openVisit.id ($patientId.tsx:282-289), proving the inconsistency. The one-active-visit blocker is never resolved by its own primary CTA.

**G-03 [P1/real-bug] CBCT/large-DICOM multipart imaging upload can never complete (and never aborts) — /storage/multipart/{file}/complete + /abort 404 for every imaging-originated multipart upload**  
createImagingStudy.ts:170-178 starts the S3 multipart directly via storage.initiateMultipartUpload(fileId,...) (the S3StorageProvider method, core/storage.ts:322-337) and never creates a stored_file row (no StorageFileRepository.createOne; grep of dental-imaging/repos + createImagingStudy returns nothing). But completeMultipartUpload.ts:41-48 and abortMultipartUpload.ts:40-47 both do repo.findOneById(fileId) → throw NotFoundError('File not found') when the stored_file row is absent (and then check file.status==='uploading' / file.multipartUploadId / file.owner, none of which exist). FE use-imaging-upload.ts:111-118 POSTs /storage/multipart/${fileId}/complete and 134-139 DELETEs /abort. Confirmed asymmetry: the HTTP /storage/multipart/initiate handler (initiateMultipartUpload.ts:56-69) DOES create the stored_file row, and listPatientImages.ts:162-163 explicitly notes imaging objects have no stored_file row — so single-PUT works but multipart complete always 404s, leaving the S3 object never assembled and orphaned parts accruing storage cost (abort also 404s). useMultipart triggers for any DICOM >5MB (createImagingStudy.ts:161), i.e. every real CBCT volume.

**G-04 [P1/missing-coverage] Erasure misses dental_patient_contact PII table (guardian/emergency-contact name, phone, email, notes never anonymized)**  
ERASURE_TARGETS registry has no patient_contact target (erasure-targets.ts:157-169); no *-erasure.facade scrubs it (grep across handlers/*/repos/*erasure* returns nothing). The table holds patient PII: dental_patient_contact.name NOT NULL, phone, email, notes (patient-contact.schema.ts:8-14), and DATA_GOVERNANCE.md:48 explicitly lists `dental_patient_contact.name/phone/email` as protected PII. patient-erasure.facade.ts only nulls the patients.emergencyContact JSONB column (patient-erasure.facade.ts:40-49), NOT the separate dental_patient_contact rows. A GDPR Art.17 erasure approval therefore leaves a patient's guardian/emergency-contact identifying data fully intact.

**G-05 [P2/dead-code] queue-board is a fully-built, server-backed surface with zero in-app navigation entry point (orphaned feature)**  
routes/_workspace/queue-board.tsx + features/scheduling/components/queue-board.tsx (full Kanban FSM) + features/scheduling/hooks/use-queue-board.ts (GET /dental/branches/:branchId/queue-board) + server handler services/api-ts/src/handlers/dental-scheduling/listQueueBoard.ts all exist and are tested, but an exhaustive grep for navigate/Link/'to:' targeting 'queue-board' across apps/dentalemon/src returns only the route definition and routeTree.gen — no sidebar item (routes/_dashboard.tsx navGroups has no Queue entry), no dashboard attention-item (morning-briefing.helpers.ts routes only to '/calendar' and '/billing'), no button. Reachable only by typing the URL.

**G-06 [P2/real-bug] OpenAPI drift gate is vacuous — specs/api/dist is fully gitignored, so detect-drift always passes green**  
.github/workflows/openapi-drift.yml:38 runs `git diff --exit-code specs/api/dist/` after `bun run build` to catch TypeSpec→OpenAPI drift, but .gitignore:85 (bare `dist`) ignores ALL dist/ dirs incl. specs/api/dist; `git ls-files specs/api/dist/` returns 0 tracked files and live `git diff --exit-code specs/api/dist/` exits 0. The required `detect-drift` check (per the workflow's own header comment) is a false-green no-op: a regenerated, materially-changed openapi.json/api.d.ts produces no git diff and always reports 'up to date'. TypeSpec→OpenAPI drift is effectively unguarded.

**G-07 [P2/missing-coverage] No CI gate regenerates or diffs the committed SDK (packages/sdk-ts/src/generated) against the spec — OpenAPI↔SDK drift unguarded**  
openapi-drift.yml only rebuilds specs/api and diffs the (ignored) dist; no workflow runs `cd packages/sdk-ts && bun run generate` (`openapi-ts`) nor diffs packages/sdk-ts/src/generated (18 tracked files, last regenerated commit 49821925 2026-06-27). grep over .github/workflows finds zero refs to openapi-ts/sdk-ts generate. The committed generated SDK can silently drift from TypeSpec and nothing fails CI. (It is currently in sync — verified 380 OpenAPI ops == 380 sdk.gen ops == 380 routed server ops after namespace normalization — but only by luck, not by a guard.)

**G-08 [P2/needs-decision] 'Create Invoice & Pay' CTA produces a DRAFT invoice that cannot be paid — payment UI only appears after a mandatory, unlabeled 'Issue' step**  
workspace-payment-modal.tsx:447-453 CTA 'Create Invoice & Pay' → handleCreateInvoice (:286-297) → useCreateInvoice → createDentalInvoice, which creates status='draft' (dental-invoice.schema.ts:29 default 'draft'; createDentalInvoice.ts never issues). recordDentalPayment.ts:56-61 rejects draft with INVALID_STATUS_TRANSITION ('issue it first'), and invoice-detail.helpers.ts:53-54,78 showRecordButton/canRecord('draft')=false → the freshly-created invoice shows only an 'Issue' button (showIssueButton :70-71), no Record Payment. The user must click Issue (handleIssue invoice-detail.tsx:344) before any pay affordance exists. Payment is reachable but the CTA over-promises a one-step pay; the modal footer also labels the next action 'Record Payment' (:441) for an invoice that is still draft.

**G-09 [P2/real-bug] PreCompletionChecklist offers 'Complete anyway' override for consent + open-treatments, which the server hard-blocks (422, no override)**  
pre-completion-checklist.tsx:235-256 treats all 4 checks (incl. 'Consent form signed' and 'No incomplete treatments') as soft warnings and renders a 'Complete anyway' button when hasWarns, citing 'BR-014 allows owner override'. But updateDentalVisit.ts:151-157 unconditionally throws VISIT_HAS_OPEN_TREATMENTS and VISIT_CONSENT_REQUIRED (BusinessLogicError -> 422 per errors.ts:43-46) with NO override flag in the body. So 'Complete anyway' is a false affordance for those two: with open treatments or no signed consent the click always 422s. (SOAP-notes and lab-orders ARE genuinely overridable — the server only checks notes-row existence at :159 and never checks lab orders — so the override model is correct for 2 of 4 checks and incoherent for the other 2.)

**G-10 [P2/real-bug] Same-status visit PATCH re-runs lifecycle side effects (re-stamp completedAt/activatedAt, re-audit, re-generate PMD)**  
updateDentalVisit.ts:45 only validates a transition when `body.status && body.status !== visit.status`; when body.status === visit.status the validation is skipped, yet patch.status is still set (:62-63) and the status branches re-execute: 'active' re-runs activate()+check-in audit (:82-113), 'completed' re-runs the full completion path incl. r.complete() (re-stamps completedAt), fail-closed audit and PMD generation (:116-204), 'locked' re-locks (:207). There is no idempotency guard for a no-op same-status PATCH, so a redundant re-PATCH mutates completion timestamps and regenerates the PMD.

**G-11 [P2/real-bug] Onboarding 'Fee Schedule' step collects per-CDT prices that are never submitted — silently discarded**  
onboarding-wizard.tsx renders FeesStep (step 3) and holds `fees` state (lines 80, 286), persisted only to localStorage (saveState line 96). handleFinish (lines 133-233) calls ONLY createOnboarding, setPin, createDentalPatient — it never sends `fees` anywhere, and clears localStorage at line 226. The canonical fee store is the separate PATCH /dental/fee-schedule/{cdt} endpoint (use-fee-schedule.ts:56-62), which onboarding never calls. Net: the owner enters procedure prices during registration, they are dropped, and the fee schedule stays at the seeded 0 defaults (wizard-step-fees.tsx:5-12).

**G-12 [P2/real-bug] Appointment never reaches 'completed' — checked_in→completed path promised but unimplemented; appointment stuck after its visit completes**  
updateAppointment.ts:82-86 rejects checked_in→completed via PATCH with 'complete the visit via checkout', and checkInAppointment.ts creates+links the visit. But updateDentalVisit.ts (the visit-completion handler, patch.status==='completed' branch lines 116-205) never touches the linked appointment — no DentalAppointmentRepository call, no FSM advance. APPOINTMENT_TRANSITIONS (dental-appointment.schema.ts:96-103) allows checked_in→completed, and the only code reaching 'completed' is revertNoShow (no_show→completed). So a normally checked-in appointment whose visit is completed remains 'checked_in' permanently; the 'completed' appointment state is unreachable on the happy path and the calendar never closes the appointment.

**G-13 [P2/real-bug] Revenue Report "Collected"/"Billed" totals drift from the server collections summary that drives the dashboard MoneyPanel — same labeled month, two different numbers**  
apps/dentalemon/src/features/reports/components/revenue-report.tsx:41 computes totalCollected = invoices.reduce((s,i)=>s+i.paidCents,0) over invoices filtered by their CREATION date (lines 35-38: toDateKey(i.createdAt) within [startDate,endDate]). paidCents is the invoice's LIFETIME paid amount. The server's getCollectionsSummary (services/api-ts/src/handlers/dental-billing/getCollectionsSummary.ts:117) computes totalCollectedCents from dentalPayments.amountCents where payment.createdAt is in the period (lines 97-99) and isVoid=false — i.e. payments actually received in the window. That server number is what the dashboard MoneyPanel renders as "Collected in {month}" (use-dashboard-summary.ts:132-133 calls getCollectionsSummary period=month → money-panel.tsx:49). For any month where an invoice was created in one month but paid in another, the Revenue Report "Collected" and the MoneyPanel "Collected" disagree. Billed has a second, smaller drift: revenue-report buckets by createdAt while getCollectionsSummary buckets by issuedAt (line 73-74). No binding test guards the revenue-report totals.

**G-14 [P2/missing-coverage] Closed-visit immutability binding test guards only 1 of ~12 independent server guards — the other 11 can drift from FE CLOSED_VISIT_STATUSES undetected**  
apps/dentalemon/src/features/workspace/lib/visit-status.binding.test.ts reads ONLY services/api-ts/src/handlers/dental-visit/treatments/createDentalTreatment.ts:59 to bind FE CLOSED_VISIT_STATUSES. But the same `visit.status === 'completed' || visit.status === 'locked'` guard is hardcoded independently (no shared constant) in at least: updateDentalTreatment.ts:44, carryOverTreatments.ts:56, dental-clinical/consent/recordConsentRefusal.ts:39, consent/createConsentForm.ts:34, lab-orders/createLabOrder.ts:33, attachments/createAttachment.ts:33, prescriptions/createPrescription.ts:38, prescriptions/updatePrescription.ts:57. visit-status.ts:26-33 comment claims the FE is bound to all of these surfaces; the test proves only one, so 11 handlers could change their set and the build would stay green while the read-only FE silently disagrees.

**G-15 [P2/needs-decision] Failed/absent-storage radiograph S3 delete is fail-open with no retry path — PII images orphaned in S3 after a terminal 'anonymized' request**  
approveErasureHandler.ts:39-60 physically deletes radiograph S3 objects only AFTER anonymize commits and FAIL-OPEN: on storage error or missing storage provider it only logs a warn and still returns the 'anonymized' request. The request status is now terminal — approveErasure rejects anything not in status 'requested' (erasure-service.ts:149-151), so it can never be re-approved. No cron/job exists in dental-erasure (no registerCron/registerJob under the module) to re-attempt the pending S3 delete, despite the engine comment claiming the recomputed id set means 'a retry re-deletes' (erasure-engine.ts:75-79). Radiograph PII can thus persist in S3 indefinitely after a storage blip during erasure.

**G-16 [P2/needs-decision] Patient portal is entirely view-only — no actionable next step on any portal surface**  
routes/_portal/portal.index.tsx only redirect→/portal/appointments; features/portal/components/my-appointments-view.tsx and my-invoices-view.tsx contain no book/reschedule/cancel/pay/download/statement action — the sole <Button> in each (lines ~101 and ~110) is an error-state Retry calling refetch(). A logged-in patient sees appointments and an outstanding bill balance but can take no action, and the portal never links to the online-booking route (book.$branchId). Likely intentional Phase-1 scope but incoherent for a production patient portal showing a balance.

**G-17 [P2/missing-coverage] Draft visit has no client-reachable cancel/discard exit and blocks re-check-in**  
checkInAppointment.ts:103 creates a visit at status='draft'. VISIT_TRANSITIONS (visit.schema.ts:70-78) allows draft→['active'] ONLY — there is no draft→discarded/cancelled transition, and updateDentalVisit.ts:45-52 rejects any other target with VISIT_TRANSITION_INVALID. The active→discarded path (updateDentalVisit.ts:138) is itself flag-gated (DENTAL_VISIT_AUTO_DISCARD, default false) and only fires on a 'completed' request for an empty visit. Meanwhile checkInAppointment.ts:66-74 (findInProgressVisitByPatient includes 'draft') 409s CHECKIN_ACTIVE_VISIT while any draft exists. VisitRepository.discardEmptyDrafts (visit.repo.ts:136) deletes empty drafts but has no route/job caller in the traced graph. Net: an erroneous/abandoned check-in draft can only be escaped by activating then completing it; it otherwise blocks the patient from being checked in again.

**G-18 [P2/real-bug] Owner PIN not persisted across wizard resume + set non-atomically after org creation → org provisioned with no usable owner PIN**  
onboarding-wizard.tsx saveState (line 96) omits `pin` from the persisted WizardState (pin is a separate useState defaulting to '' at line 78). After a reload/HMR the wizard restores step/clinic/dentist fields (loadState lines 64-80) but pin resets to ''. handleNext only validates pin on the 'dentist' step (validate() lines 104-106); resuming at 'fees'/'patient' skips that guard. handleFinish then creates the org atomically (lines 142-175) and only afterwards calls setPin (lines 186-193) with the empty pin — if setPin fails/throws, the org+owner membership are already committed without a PIN. The 409 recovery path (lines 159-165) assumes a 409 means fully provisioned and drops the user to the dashboard, so an owner left without a PIN can be trapped at pin-select.

**G-19 [P2/needs-decision] RLS policies for perio/imaging/patient-subtree tables are inert — their handler modules never route through withTenantTx, so isolation rests solely on app-layer assert* with no DB backstop**  
0105_rls_p1a_tier1.sql declares tenant_isolation policies for imaging_study (:114), imaging_finding (:120), dental_perio_chart (:66), dental_household (:102), dental_coverage_authorization (:108), dental_consent/treatment/postop_template, dental_inventory_item — but `grep -rl withTenantTx` returns 0 files in handlers/dental-imaging, handlers/dental-perio, and handlers/dental-patient. Those handlers (e.g. getImagingStudy.ts, getPerioChart.ts, listPatientInsuranceProfiles.ts) run every query on the `db` connection, which is the RLS-bypassing table-owner role (tenant-tx.ts:8-9 documents the superuser bypass that only SET LOCAL ROLE app_rls inside withTenantTx removes). Net: those RLS policies can never fire on any request path; if an assert*BranchAccess call regresses there is no DB-level backstop, despite the table being labelled RLS-'activated'.

**G-20 [P2/needs-decision] Org-scoped RLS on dental_feature_permission is unreachable — no handler ever publishes orgIds, and the only handlers touching the table bypass RLS on the db connection**  
0105_rls_p1a_tier1.sql:151-153 isolates dental_feature_permission via `organization_id = ANY(app_current_orgs())`, fed by the app.current_orgs GUC. withTenantTx only sets that GUC when scope.orgIds is provided (tenant-tx.ts:83-85), but `grep -rn orgIds handlers` returns ZERO production call sites passing orgIds. getPermissionGrid.ts and updatePermissions.ts read/write the table via FeaturePermissionRepository(db)/buildPermissionGrid(db, org.id) on the RLS-bypassing connection, gated only by resolveOrgForCaller's inline owner/membership check. The org-level policy therefore never executes; and because app_current_orgs() coalesces an unset GUC to empty (0105:29), any future read routed through withTenantTx without orgIds would fail closed to zero rows.

**G-21 [P3/needs-decision] approveAmendment is a published/SDK route that unconditionally returns 501 NOT_IMPLEMENTED**  
services/api-ts/src/handlers/dental-clinical/amendments/approveAmendment.ts:26-31 throws AppError(...,'NOT_IMPLEMENTED',501) unconditionally; registered at generated/openapi/routes.ts:2109-2113 (POST /dental/visits/:visitId/amendments/:amendmentId/approve), advertised in specs/api/dist/openapi/openapi.json:23340 (operationId approveAmendment), and shipped in packages/sdk-ts/generated (approveAmendmentResponseTransformer). FE does not call it (no apps/dentalemon ref), so no broken UI flow — but the public contract+SDK advertise an endpoint that can never succeed. Documented as intentional BR-019 deferral behind feature flag dental_clinical_amendment_approval.

**G-22 [P3/dead-code] patient merge/unmerge handlers are 501 stubs AND prod-disabled (double-dead surface)**  
services/api-ts/src/handlers/patient/mergePatients.ts:27-35 and unmergePatients.ts:27-35 return 501 NOT_IMPLEMENTED; the same routes are also prod-404'd in core/disabled-routes.ts:79-80 ('POST /patients/merge','POST /patients/unmerge'). Entire patient base module is prod-disabled (disabled-routes.ts:73-80) since product uses dental-patient. Code + DB tables still ship.

**G-23 [P3/needs-decision] cephSuperimposition only implements cranial_base reference; other references hard-501**  
services/api-ts/src/handlers/dental-imaging/cephSuperimposition.ts:123-125 throws SUPERIMPOSITION_NOT_IMPLEMENTED for any registration reference other than cranial_base; registered/live imaging endpoint with a partial v1 implementation. Documented as v1 limitation.

**G-24 [P3/dead-code] routes/onboarding.tsx (person-profile flow) and the requirePerson guard are orphaned — nothing routes to them**  
lib/guards.ts:69 requirePerson redirects to '/onboarding', but grep shows requirePerson has zero usages outside guards.ts (no route imports it). The live new-clinic path is routes/_dashboard.tsx:53 → '/dental-onboarding' (features/onboarding wizard). So routes/onboarding.tsx (guarded by requireNoPerson/requireEmailVerified, uses createPerson) is only reachable by direct URL; two parallel onboarding routes exist with only one wired into the app flow.

**G-25 [P3/dead-code] 846 of 1454 OpenAPI schemas (58%) are orphaned Healthcare.* FHIR models referenced by zero operations, bloating the spec and generated SDK types**  
main.tsp imports 113 healthcare/*.tsp files (111 contain @route ops) but their operations live under `namespace Healthcare.*` (e.g. organization.tsp:140 `namespace Healthcare.Foundation`), outside the @service `namespace MonobaseAPI` (main.tsp:210/324), so they emit ZERO operations into openapi.json (no /chemo|/dialysis|/icu|/nursing paths; all 285 paths are dental/billing/booking/storage/comms/email/providers/emr/notifs/patients/persons/reviews/audit). Yet their MODELS leak in as schemas: 846 `Healthcare.*` component schemas, 0 referenced by any emitted path, flowing into the committed types.gen.ts (3361 generated types vs ~206 actually imported by FE). Orphaned contract surface; contradicts 'spec is single source of truth'.

**G-26 [P3/dead-code] Stale .gitignore rule for the generated SDK targets a non-existent path (packages/sdk vs actual packages/sdk-ts)**  
.gitignore:252 comment 'Generated SDK (regenerated from openapi.json)' + rule `packages/sdk/src/generated/` — but `packages/sdk` does not exist (only `packages/sdk-ts`). The rule matches nothing; the real generated SDK at packages/sdk-ts/src/generated is (correctly) tracked. Harmless today but the rule is dead and misleading — anyone relying on it to keep generated SDK out of git would be wrong.

**G-27 [P3/needs-decision] No deposit / pre-treatment payment path exists for all-planned visits**  
grep -rni 'deposit' over services/api-ts/src, apps/dentalemon/src and specs/api/src returns zero matches — the deposit-invoice path (PR#50) is not in main. The all-planned dead-end itself is mitigated (workspace-payment-modal.tsx:384-417 Estimate section + inline 'Mark done', payment-summary-bar.tsx:73-79 'View Estimate'), so this is a missing product capability (cannot collect a deposit on planned-only work), not a broken flow.

**G-28 [P3/missing-coverage] Legacy dental_audit table is not protected by the append-only DB trigger (only dental_audit_log is)**  
Migration 0080 installs the BEFORE UPDATE OR DELETE deny-mutate trigger ONLY on dental_audit_log (0080_audit_log_append_only.sql:24-29); no migration adds an equivalent trigger to the legacy dental_audit table, yet logAuditEvent still dual-writes to it (audit-logger.ts:199-214). A direct SQL UPDATE/DELETE on the legacy table is unguarded at the storage layer (defense-in-depth gap). Lower impact because the authoritative viewer reads dental_audit_log, not the legacy table.

**G-29 [P3/dead-code] comms module is fully prod-disabled yet ships complete handlers/repos/schema/DB tables (orphaned surface)**  
core/disabled-routes.ts:45-55 404s all /comms/* (chat-rooms, messages, video-call, ice-servers) in production; module retains 11 files incl joinVideoCall.ts (with TODO at joinVideoCall.ts:210 'Generate short-lived JWT ... for better security') and 3 repos with migrating tables. No FE surface (CLAUDE.md). Same pattern for booking/emr/provider/reviews base modules — large unreachable code+schema kept in the build.

**G-30 [P3/needs-decision] one-open-visit invariant enforced only for status='active'; multiple DRAFT visits per patient are not prevented server-side**  
The DB unique index is partial WHERE status='active' (visit.schema.ts:50-52), and both app-guards only call findActiveByPatient (createDentalVisit.ts:71-77, updateDentalVisit.ts:85-91). Meanwhile the rest of the system treats 'open' as draft|active: findInProgressByPatient (visit.repo.ts:79-90) and FE findOpenVisit (visit-status.ts:13-15). So when a patient has a draft but no active visit, createDentalVisit's findActiveByPatient returns null and a SECOND draft can be created — the 'one open visit' invariant is asymmetric. FE gates via canStartNewVisit (defense-in-depth), but the server permits the divergent state; no test covers 'second draft rejected'.

**G-31 [P3/missing-coverage] findOpenVisit/canStartNewVisit gate (active|draft) is stricter than the server createDentalVisit guard (active only); the SoT comment claims they match, and no binding test covers it**  
apps/dentalemon/src/features/workspace/lib/visit-status.ts:13-14 treats a visit as open when status==='active' OR 'draft' and canStartNewVisit (line 18-20) disables New Visit if either exists; lines 6-7 comment asserts this gates on "the same condition the backend enforces (see createDentalVisit.ts ACTIVE_VISIT_EXISTS)". The server (services/api-ts/src/handlers/dental-visit/visits/createDentalVisit.ts:71-77) blocks only on repo.findActiveByPatient — status='active' (matching the partial unique index visit.schema.ts:50-52 `where status='active'`). A patient with a checked-in DRAFT visit (no active) can create a new visit on the server but the FE disables the affordance. Benign direction (FE stricter, no 422) but a documented-but-false coherence claim with no binding test on findOpenVisit.

**G-32 [P3/missing-coverage] No test exercises the imaging-originated multipart complete/abort path; existing storage multipart tests seed the stored_file row via the /initiate handler, masking the createImagingStudy discrepancy**  
codegraph blast radius: completeMultipartUpload (services/api-ts/src/handlers/storage/completeMultipartUpload.ts:23) and initiateMultipartUpload report 'no covering tests found'; storage/multipartOwnerCheck.test.ts drives the storage handlers which create their own stored_file row, so the imaging path (createImagingStudy → provider.initiateMultipartUpload with no stored_file row) is never asserted end-to-end. imaging-*.test.ts in dental-imaging cover single-PUT/links only.

**G-33 [P3/missing-coverage] Central audit PHI sanitizer blocklist omits address-component and free-text keys (address/contact PHI can survive in before/after snapshots)**  
audit-phi-sanitizer.ts:24-46 PHI_METADATA_KEYS strips exact key 'address' but NOT the person row's actual address shape: persons.primaryAddress (jsonb) whose children are street1/street2/city/state/postalCode (person.schema.ts:31,51-56) — none of those child keys are blocklisted, so a before/after person/patient row snapshot retains the full street address. 'contactInfo' children email/phone ARE stripped, but free-text keys like description/instructions/templateName/signerName/reason are not. The sanitizer is the single PHI choke point for every append-only audit write (audit-log.repo.ts:21-38), so any handler passing such a row snapshot persists unremediable address PHI.

**G-34 [P3/dead-code] Base-module background jobs run in production even though their HTTP routes are disabled**  
app.ts:320 registerBookingJobs(jobs, app.notifs) runs unconditionally in initializeApp, but all /booking/* routes are prod-404'd (disabled-routes.ts:28-44) and booking/jobs/index.ts:61-64 throws 'not implemented' for some trigger paths. Booking slot/reminder jobs thus operate over tables the product never populates (product uses dental-scheduling). Wasteful, not crashing.

**G-35 [P3/dead-code] Stripe-Connect billing-onboarding flow appears vestigial in dentalemon (buy-once, local-first product)**  
packages/sdk-ts/src/flows/billing-onboarding.ts:93 startBillingOnboarding (merchant-account create→onboard→dashboard via getMerchantAccount/createMerchantAccount/onboardMerchantAccount/getMerchantDashboard) is the upstream-template Stripe Connect marketplace onboarding, distinct from the dental-billing invoice/payment chain that dentalemon actually uses. Its only callers are the flows/index.ts barrel and a 'BillingPage' (not confirmed to be a dentalemon route); blast radius reports 'no covering tests'. The dentalemon money path is dental-billing (createDentalInvoice/issue/recordDentalPayment), so this Connect onboarding has no live handoff into the product flows traced here.

**G-36 [P3/needs-decision] withTenantTx in billing/visit/scheduling provides no independent cross-tenant isolation — scope is derived from the row already fetched on the bypassing connection**  
listDentalPayments.ts:37 (`withTenantTx(db, { branchIds: [invoice.branchId] }, ...)`), voidDentalPayment.ts:55 ([payment.branchId]), issueDentalInvoice.ts:62/voidDentalInvoice.ts:59 ([invoice.branchId]): the resource is fetched AND authorized on `db` (RLS-bypassing) BEFORE entering withTenantTx, and the RLS scope is set to that same row's own branchId. The branch RLS policy can therefore never reject anything inside the tx (the scope always matches the row), so RLS adds no isolation beyond the prior assertBranchAccess on db. This is consistent with the documented defense-in-depth design (tenant-tx.ts:1-24), but means the 'RLS P1b activation' for these write paths is structurally a no-op gate; the real isolation is the app-layer assert*. Flagging for a decision on whether RLS is intended to be an actual independent gate here.

**G-37 [P3/missing-coverage] getToothHistory query is never explicitly invalidated by any treatment/finding mutation, yet the handler now includes the ACTIVE visit's in-progress work**  
getToothHistory.ts:42-47 deliberately includes status==='active' visits in the per-tooth timeline, but apps FE use-tooth-history.ts has no invalidation and no mutation hook invalidates it (grep '_id: getToothHistory' / 'getToothHistory' across features/workspace/hooks returns zero invalidation sites; use-mark-treatment-done.ts:48, use-save-treatment.ts:46-52, use-update-treatment.ts:28, use-findings.ts:47-62 invalidate only listDentalTreatments/Findings/treatment-plan). Freshness relies entirely on React Query default staleTime=0 remount-refetch when the slideout reopens; a prior fix (MEMORY: family invalidation [{_id:'getToothHistory'}] in 4 hooks) is not present on main.

**G-38 [P3/missing-coverage] Per-tooth history is silently capped at 20 entries with no FE pagination, and the slideout 'Total' footer sums only the displayed page**  
use-tooth-history.ts:7-8 documents the generated SDK type has query?:never so limit/offset cannot be forwarded; getToothHistory.ts:92-96 defaults limit=20 and slices. tooth-overview-step.tsx:352-362 renders a tfoot labelled 'Total' that reduces over the ≤20 rows in `history`, so a tooth with >20 charted visits shows a partial sum mislabeled as the total. Edge case (years of single-tooth history) but data-incoherent.

**G-39 [P3/needs-decision] Better-Auth user/session PII (email, name, ip_address, user_agent) outside erasure scope**  
better-auth user table holds name+email and session holds ip_address/user_agent (generated/better-auth/schema.ts:11-47); ERASURE_TARGETS (erasure-targets.ts:157-169) has no auth-user target and DATA_GOVERNANCE.md references Better-Auth only for actor_id provenance (line 284). V1 erasure is patients-only (erasure-service.ts:79-83) and no patient->auth-user creation path was found (grep for signUp/createUser in patient handlers empty), so this does not manifest today — but if a patient ever holds a portal/login account their auth-table email/name would not be erased.

### E2E full-suite failures (full `test:e2e`, not in required Harness Set A; pre-existing on main)

**G-40 [P2/real-bug] Onboarding wizard does not restore the patient step after a page refresh**
`dental-onboarding.spec.ts:311 (FR7.4 "wizard progress is preserved after page refresh")` fails: `TimeoutError waiting for getByLabel(/date of birth/i)` after reload. Corroborates the audit's onboarding-wizard gaps (G: owner-PIN not persisted; G: fee-schedule discarded) — `onboarding-wizard.tsx saveState` omits fields, so a refresh mid-wizard loses state. Likely a **real** resume bug. Verify in browser before fixing.

**G-41 [P3/needs-investigation] Imaging "Compare ▶" button visible with only 1 image selected**
`imaging-comparison.spec.ts:55 (IMG-17)` fails: `expect(getByTestId('compare-btn')).not.toBeVisible()` but it is visible with a single selection. Either a real gating bug (compare should require ≥2) or seed-count drift. Note: imaging-comparison is an E2E-only test route excluded from the prod bundle. Investigate before classifying.

**G-42 [P3/flaky] Insurance-claims worklist render assertion races a navigation**
`insurance-claims.spec.ts:176 (P1-26)` fails: `page.evaluate: Execution context was destroyed, most likely because of a navigation`. Classic test-stability race, not a product defect. Stabilize the spec (await navigation before evaluate) rather than chase a product fix.

---

## 4. Classification summary

- **By severity:** 4 P1 · 17 P2 · 21 P3  (no P0) — 42 total (39 static + 3 E2E-suite reds)
- **By category:** 11 real-bug · 10 missing-coverage · 8 dead-code · 11 needs-decision · 1 needs-investigation · 1 flaky
- **Stop-zone (auth/RLS/money/migration/test-invariant):** 17 of 42
- **Date-fragile (flagged, not chased):** billing *-reports — none surfaced as failures this run (date 2026-06-29).

**No test encodes a wrong invariant that I had to weaken** — the two FE↔server mismatches found (G: PreCompletionChecklist 'Complete anyway' vs server 422; G: Revenue Report totals vs collections summary) are FE-side drift from a *correct* server, not bad server tests.

---

## 5. Ship-readiness verdict

### 🟢 GO for the 4 P1 blockers — all fixed, TDD, no regressions. Conditional on P2 triage before a *wide* launch.

The 4 P1 blockers that made this a NO-GO are now fixed (each failing-test-first, atomic commit, facade-clean):

1. **G-01 (money, stop-zone) ✅** Void now releases its treatments (`releaseTreatmentsForInvoice`) — re-invoicing works, visit re-discardable. `voidDentalInvoice.rebill.test.ts`.
2. **G-02 ✅** "Complete visit" now targets the open visit (`visitToComplete` + select-open-on-complete). `next-step.test.ts`.
3. **G-03 ✅** Multipart imaging persists its `stored_file` row — complete/abort resolve. `createImagingStudy.multipart-storedfile.test.ts`.
4. **G-04 (compliance) ✅** Erasure scrubs `dental_patient_contact` PII (new target + facade). `erasure-service.test.ts`.

**Post-fix gate state:** backend 4854/0, FE 2844/0, typecheck/lint/boundaries(error-mode clean for my modules)/rls-posture green, contract 50/50. Required Journey Harness green. Full `test:e2e` has 7 non-required reds (2 chronic, 3 flaky nav-race, 2 date-fragile after the 06-30 rollover) — **none caused by these fixes** (changed files touch zero scheduling/calendar/signup code; `billing-queue-morgan › Void Invoice` passes).

**Remaining before a WIDE launch (not P1, your call):** the P2 cluster — especially **G-09** (PreCompletionChecklist "Complete anyway" is a false affordance vs the server's hard 422), **G-08** (draft-invoice can't be paid in one step), **G-11/G-26** (onboarding fee-schedule + owner-PIN silently discarded — also surfaces as E2E G-40), **G-12** (appointment never reaches `completed`), **G-13** (revenue report drifts from dashboard), **G-10** (same-status visit PATCH re-runs side effects). These are real but narrower than the P1 dead-ends. P3s are mostly dead-code cleanup + missing-coverage and can follow.

**Two test-infra holes worth a fast follow (cheap, high leverage):** **G-06** (OpenAPI drift gate is a false-green no-op — `specs/api/dist` is gitignored) and **G-07** (no SDK-drift gate). Both let generated-artifact drift land silently.

---

## 6. Status & next step

- **Done:** 4 P1 blockers fixed on `fix/prod-readiness-p1-blockers` (5 commits), full gate suite re-run, this report updated.
- **Not pushed / no PR yet** — say the word and I'll push the branch and open a PR.
- **Did NOT touch** `main`, any migration/schema, or any existing test invariant (the 5 new tests are additive; no asserted invariant was weakened).
- **Recommended next:** triage the P2 cluster above (I can take them in the same TDD cadence), and patch the two drift-gate holes (G-06/G-07).
