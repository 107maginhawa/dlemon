# dental-patient — Proposed Fix Plan

**Module:** dental-patient · **Date:** 2026-06-09 · **Status:** plan only (no fixes implemented)
**Source audit:** this document (single-module audit against `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`).
**Prior runtime pass:** `docs/audits/workflow-verification/runs/dental-patient/REPORT.md` (marked DONE/GREEN — but it only drove the register → search → profile happy path and fixed 2 P1 CSV-export bugs; it did **not** audit the insurance/claims/alerts/contacts/tasks/sync surface or tenant isolation, which is where this audit's findings concentrate).
**Standards:** Vertical TDD (tests RED → impl GREEN), `docs/development/VERTICAL_TDD.md`. Every fix lists its required failing test first. Spec-shape changes go TypeSpec → regen → handler → SDK → FE (never hand-edit generated files).

---

> **✅ BATCH 1: G1 (P0) FIXED (2026-06-09).** The `listSyncLogs` cross-tenant read leak is closed: the handler now requires `branchId`, asserts caller access, and the repo scopes `findAll(branchIds)`. `createSyncLog` requires `branchId` (400) + authorizes unconditionally; `updateSyncLog` authorizes unconditionally (branchless row → 403). Proven by `dental-patient-sync-isolation.test.ts` (2-org: branch B sees 0 of A; B→A 403; branchless→400). All other dental-patient gaps (G2–G17) remain as written. See MASTER-GAP-MATRIX §8.

## 1. Audit Decision

**PARTIAL PASS — gated on one P0.** The *core patient lifecycle* (register, full-name search, profile, archive/restore soft-delete, treatment-plan FSM, recall FSM, consent-required-at-creation, branch-scoped list) is production-grade and well-tested. But:

- **One P0 cross-tenant read leak** (`listSyncLogs` returns every org's sync logs) blocks production until fixed.
- A **large slice of the module is backend-only** — the entire insurance + claims vertical, dental-alerts CRUD, patient-contacts CRUD, tasks CRUD, household create/edit, demographics-edit, formal treatment-plan approval, and treatment↔appointment linking all have handlers + tests but **zero FE consumers**. This creates a false sense of completeness and several dead/misleading affordances.
- **Communication consent is write-only and fire-and-forget** — captured at registration, never read back, never enforced in any send path, and its write failure is silently swallowed.

The module is not FAIL (the safe core works), but it is not a clean PASS until the P0 is closed and the insurance/claims/consent gaps get an explicit wire-or-remove decision.

**V1 readiness:** Yellow.

---

## 2. Expected vs Actual (vs Ideal Standard §3.2 / §3.6 / §3.9 / §3.12 / §3.13)

| Ideal context | Expected | Actual |
|---|---|---|
| Patient profile + search (§3.2) | Create, search, view, **edit** demographics, soft-delete | Create/search/view/archive ✅; **no demographics-edit UI** (`updateDentalPatient` unwired) |
| Guardian/contacts, medical+dental alerts (§3.2) | Capture in UI, alerts visible chairside | Medical safety-floor visible ✅ (E2E); **contacts + dental-alerts CRUD unwired** — no UI to add a minor's guardian or a dental alert |
| Consent (§3.2 / data-governance) | Capture + **enforce** per-channel comms consent | Captured write-only, fire-and-forget (`.catch(()=>{})`), never read back, never enforced |
| Treatment plans (§3.6) | Draft→presented→approved→partial→completed, approval recorded, convert-to-work | FSM + patient-accept ✅; **clinician `approveTreatmentPlan`, status-history, versions, treatment↔appointment link all unwired** |
| Claims/Insurance (§3.9) | Insurance profile, claim draft, readiness, attachments | Full backend ✅ but **entire vertical unwired on FE**; claims UI actually lives in dental-billing (two sources of truth) |
| Recall / follow-up (§3.12) | Recall scheduling + tasks | Recall ✅ (wired, FSM, due-scan); **tasks CRUD unwired** |
| Local-first sync (§3.13) | Local-ID create, sync status, branch-safe | Status badge reads `listSyncLogs` (read-only) but **that list is not tenant-scoped → P0**; writes are Tauri-only (intentional) |

---

## 3. Gaps by Severity

### P0 — blocks safe V1 (security)

| ID | Gap | Evidence | Decision needed |
|----|-----|----------|-----------------|
| **G1** | **`listSyncLogs` is not tenant/branch scoped — cross-tenant read leak.** `SyncLogRepository.findAll()` = `db.select().from(dentalSyncLogs)` with **no WHERE** (`repos/sync-log.repo.ts:12-13`); `listSyncLogs.ts:21` adds no scoping. Any authenticated user reads **every org's** sync-log rows (localId, entityType, entityId, serverId, branchId, status). The handler even audits `tenantId: user.id` (`listSyncLogs.ts:27`), a tell that real tenant scoping was never wired. Softer related gaps: `createSyncLog`/`updateSyncLog` only authorize **when `branchId` is present**, so branchless sync logs bypass `assertBranchAccess` entirely. | `repos/sync-log.repo.ts:12`, `sync/listSyncLogs.ts:21,27`, `sync/createSyncLog.ts:23`, `sync/updateSyncLog.ts:30` | None — clear bug. Fix direction: scope `findAll` to the caller's accessible branch(es)/tenant and require branch on create/update. |

### P1 — fix before production

| ID | Gap | Area | Why it matters | Evidence |
|----|-----|------|----------------|----------|
| **G2** | **Insurance + claims vertical is entirely unwired; claims has two sources of truth.** `createInsuranceProfile`/`list`/`update`, `createCoverageAuthorization`+`list`+`updateStatus`, `createClaimDraft`/`getClaimReadiness`/`updateClaimStatus`/`listPatientClaims` — **0 FE consumers**. The coverage-auth + estimate hooks (`features/billing/hooks/use-insurance-claims.ts:155-223`) are **dead code** (referenced by no component). The only working claims UI (`ClaimsWorklist`) drives the **separate billing module** (`updateInsuranceClaimStatus`/`recordClaimRemittance`). Net: insurance cannot be entered from the patient FE, so the §3.9 chain has no input, and there are two claim subsystems. | Unwired / dup source of truth | Whole §3.9 context is dead on the FE; misleading completeness | contract-spine + grep; `use-insurance-claims.ts:155-223` |
| **G3** | **Communication consent is write-only, fire-and-forget, and unenforced.** Registration PATCHes per-channel consent via **raw fetch** with `.catch(()=>{/* non-blocking */})` (`routes/_dashboard/patients.tsx:88-96`) — failure swallowed, registration still reports success. `getPatientCommunicationConsent` is **unwired** (never read back), and no FE send path consults consent before SMS/email. | Misleading success / compliance | A consent the system captures but never enforces is a data-governance/compliance risk and a false affordance | `routes/_dashboard/patients.tsx:88-96`; `getPatientCommunicationConsent` 0 consumers |
| **G4** | **Archived-write guard missing on 4 sub-resources.** The `PATIENT_ARCHIVED` 403 guard is enforced+tested for patient update/follow-up/recall (`dental-patient.test.ts:1358-1395`) but **insurance, contacts, alerts, and tasks** handlers carry neither the guard nor a negative test — a clinically-archived patient can still receive insurance/alert/task/contact writes. br-registry-acknowledged (BR-015b) but unpinned. | Record integrity | Writes to a closed/archived record bypass the intended freeze | BR-015b registry note; handler grep |
| **G5** | **Audit-trail creation is tested for only 2 actions.** Audit-log assertions exist only for `patient.archive` and `patient.export`. **No audit-creation test** for consent changes, treatment-plan approval/status transitions, or claim-status transitions — exactly the PHI-sensitive mutations AUD-BR-001/002 require. `communication-consent.test.ts`, `dental-patient-treatment-plan.test.ts`, `dental-patient-insurance.test.ts`, `approveTreatmentPlan.test.ts` contain zero `audit` references. | Test gap (audit) | Audit trail for sensitive changes is unverified — could silently regress | grep `audit` across suite |
| **G6** | **Two validator-bypass / contract-drift seams.** `dental-patient.bulk-import.test.ts:57-69` mounts `importPatients` with **zero `zValidator`** (generated import-body validator bypassed). `dental-patient.test.ts:113-115` **deliberately omits** the bulk-archive zValidator (comment: generated `BulkArchiveDentalPatientsBody` not yet updated to `{ids,reason}`) — an **active, unguarded contract drift** between the generated validator and the handler that the FE (`use-patient-actions.ts`) calls. **`[KG-ADJUSTED 2026-06-09 — severity downgraded, see §12]`** Ground truth: the **generated** `BulkArchiveDentalPatientsBody` is **already `{ ids, reason }`** (`validators.ts:2978-2981`), matches the handler (`bulkArchiveDentalPatients.ts:22-23`), and the **production** `routes.ts:1305` **does apply it**. So there is **no production contract drift and no SDK-400 risk** — the prod path validates correctly. The bypass is **test-only** (the local `buildTestApp` skips the generated validator) and the test-file comment ("until central regen updates the shape") is itself stale (regen already happened). Reclassify as **test-hygiene (P2)**, not a wired-endpoint prod hazard. | Data/API mismatch → **test hygiene** | ~~prod 400~~ test does not exercise the generated-validator seam; stale comment misleads | test file refs above; `validators.ts:2978`, `routes.ts:1305` |

### P2 — recommended before prod

| ID | Gap | Evidence |
|----|-----|----------|
| **G7** | **No patient-demographics edit journey.** `updateDentalPatient` is unwired; a registered patient's name/DOB/gender/contact cannot be corrected anywhere in the FE (only archive/restore). | `updateDentalPatient` 0 consumers |
| **G8** | **Alerts, contacts, tasks: full backend CRUD, no FE.** No UI to add a **guardian/emergency contact** (PAT-BR-002, V1-Required for minors), a **dental alert** (anxiety/anesthesia/ortho §3.2), or a **follow-up task** (§3.12). The profile shows one phone/email from the person record but no contacts list. | `createPatientContact`/`createDentalAlert`/`createTask` + lists/updates all 0 consumers |
| **G9** | **Treatment-plan completion workflow partially unreachable.** `approveTreatmentPlan` (clinician `/approval` sign-off), `listTreatmentPlanStatusHistory`, `getTreatmentPlanVersion`, and `attachTreatmentAppointment`/`detachTreatmentAppointment` are unwired — the plan's approval audit trail/versions can't be surfaced, and an accepted plan's treatments can't be linked/scheduled to appointments from the UI. (`acceptTreatmentPlan` patient-accept IS wired.) | spine + grep |
| **G10** | **Household create/edit unwired; read-only card with no link affordance.** `createHousehold`/`addHouseholdMember`/`removeHouseholdMember` 0 consumers; `household-card.tsx` permanently shows "not linked to a household" for un-seeded patients. (`removeHouseholdMember` also **hard-deletes** — the only physical row delete in the module, `household.repo.ts:89`.) | `household-card.tsx`; `household.repo.ts:89` |
| **G11** | **Statement / safety-floor / conditions / visits unwired.** `getDentalPatientStatement` (no print/statement UI), `getDentalPatientSafetyFloor`, `listPatientConditions`, `listPatientVisits` have backends but no journey (profile uses the workspace `useVisits` instead). `importPatients` bulk-import has backend+tests but no FE entry. | spine |
| **G12** | **BR logic/test gaps.** TP-BR-006 (plan total = Σ item fees) **unpinned** — only default-0/non-negative tested. TP-BR-004 draft-override-reason branch untested. CLAIM-BR-001 readiness (`getClaimReadiness.ts:32-41`) checks only cdt/icd10/active-profile/fee>0 — **provider, service date, tooth/surface absent** from logic and tests, so a "ready" claim can lack them. CLAIM-BR-004 (attachment↔claim linkage) **not implemented** (no link in `claim-draft.schema.ts`). | refs inline |

### P3 — polish / deferred

| ID | Gap |
|----|-----|
| **G13** | Two raw `fetch()` in `routes/_dashboard/patients.tsx` (`POST /dental/patients` line 66, `PATCH .../communication-consent` line 89) bypass the SDK + the no-raw-fetch rule, and create **two divergent registration paths** (Patients-route modal vs `onboarding-wizard.tsx`, which uses the SDK). Feeds G3. |
| **G14** | **List response-shape inconsistency** (not broken — most bare-array lists are contract-compliant). `listDentalPatients` uses a `{patients,total}` wrapper; `listPatientConditions`/`listPatientVisits` use `{data,pagination}`; everything else is a bare array. Harmonize for predictability. |
| **G15** | **[cross-module] `patient/deletePatient` hard-deletes with no history guard.** Base `patient` module, `DELETE /patients/:id`, real `deleteOneById` (`deletePatient.ts:54`), guarded only `isOwner = personId === user.id` (self-delete). Low reach in the dental deployment (staff aren't the patient), but violates PAT-BR-004. Confirm it's unreachable/disabled or add a history guard. |
| **G16** | **BR-020 merge doc drift.** MODULE_SPEC says merge "returns 501 by design," but there is **no endpoint at all** (a call 404s from the router). Reconcile the doc, or stub the documented 501. `detectDuplicatePatients` is the working manual path. **`[KG-ADJUSTED 2026-06-09 — finding was incorrect, see §12]`** Ground truth: `mergePatients` **IS registered** at `POST /patients/merge` (`routes.ts:2412`, base **patient** module) and returns a clean, admin-gated **501 NOT_IMPLEMENTED** (`patient/mergePatients.ts:28-35`); `unmergePatients` is registered too. So a call **does not 404** — it routes to a handler that 501s, and the MODULE_SPEC's "returns 501 by design" is **correct**. The real residual: there is no **`/dental/patients/merge`** route (merge lives in the base `patient` module, outside the dental-patient boundary). No doc fix for the 501 claim is needed; correct the gap-plan's "no endpoint/404" wording. `detectDuplicatePatients` remains the dental working path. |
| **G17** | LF-BR-003 sync status not asserted at the UI/E2E seam — `journeys/15-offline-sync-metadata.journey.spec.ts` exists but contains no pending/syncing/synced/failed badge assertions. |

---

## 4. Broken / Misleading Journeys

1. **Register → set comms consent → "success", but consent is never enforced or even saved reliably.** The consent PATCH is fire-and-forget; a failure is swallowed and the user sees success; nothing ever reads the flags back or honors them before sending. (G3)
2. **Insurance → claim chain is unreachable from the patient FE.** No UI to create an insurance profile, so the LOA flow (needs `insuranceProfileId`) has no input; the claim-draft → readiness → status → list endpoints are entirely dead; the only working claims UI is the separate billing module. "Insurance entered but not used" — in fact it can't be entered. (G2)
3. **Accepted treatment plan → schedule the work: no affordance.** `attachTreatmentAppointment`/`detach` unwired, so plan items can't be linked to appointments from the UI. (G9)
4. **Clinician formal approval of a plan is unreachable.** FE exposes patient e-sign accept but never the `/approval` clinician sign-off; approval history/versions can't be surfaced. (G9)
5. **No way to correct a patient's demographics** after registration (only archive/restore). (G7)
6. **A minor's guardian / a patient's dental alert / a follow-up task can't be added in the UI** despite full backend CRUD. (G8)
7. **Sync-status badge shows pending/failed counts the web app cannot act on** (no retry/clear; writes are Tauri-only) — informational-only, and the list it reads is the P0-leaking one. (G1/G17)

---

## 5. Unused / Unwired Implementation (backend exists, 0 FE consumers)

- **Insurance/claims (whole vertical):** createInsuranceProfile, listPatientInsuranceProfiles, updateInsuranceProfile, createCoverageAuthorization, listCoverageAuthorizations, updateCoverageAuthorizationStatus, createClaimDraft, listPatientClaims, getClaimReadiness, updateClaimStatus. Plus dead hooks in `use-insurance-claims.ts:155-223`.
- **Alerts:** createDentalAlert, listDentalAlerts, updateDentalAlert.
- **Contacts:** createPatientContact, listPatientContacts, updatePatientContact, deletePatientContact.
- **Tasks:** createTask, listPatientTasks, updateTask.
- **Treatment-plan advanced:** approveTreatmentPlan, listTreatmentPlanStatusHistory, getTreatmentPlanVersion, attachTreatmentAppointment, detachTreatmentAppointment.
- **Household writes:** createHousehold, getHousehold, addHouseholdMember, removeHouseholdMember (only `getPatientHousehold` is read).
- **Patient misc:** updateDentalPatient, getDentalPatientStatement, getDentalPatientSafetyFloor, getPatientCommunicationConsent, listPatientConditions, listPatientVisits, importPatients.
- **Sync writes:** createSyncLog, updateSyncLog (web reads only `listSyncLogs`; writes are Tauri/cadence — arguably intentional, document it).

Totals (from contract-spine cross-check): 68 dental-patient ops; ~32 with a real SDK consumer + 1 raw-fetch-only; ~35 fully unwired.

---

## 6. Recommended Fix Order (safest sequence)

1. **G1 (P0) first — close the sync-log tenant leak.** Scope `findAll` to the caller's branch(es)/tenant; require `branchId` on create/update and authorize unconditionally. Self-contained, highest risk. Prove with a cross-tenant negative test.
2. **G3 — make consent honest.** Make the registration consent write blocking (surface failure) or move it server-side into `createDentalPatient`; wire `getPatientCommunicationConsent` to display the flags; **decide enforcement** (gate notifs/comms send paths on consent) — see NEEDS CONFIRMATION.
3. **G4 — add the archived-write guard** to insurance/contacts/alerts/tasks handlers (RED negative test each).
4. **G6 — resolve the bulk-archive drift** (regen `BulkArchiveDentalPatientsBody` to `{ids,reason}`, re-enable the validator) and add a validator to bulk-import.
5. **G2 — decide insurance/claims** (wire the dental-patient vertical into a real UI, or remove the dead vertical + dead hooks and standardize on the billing-module claims). Large; gated on a product decision.
6. **G5 — backfill audit-creation tests** for consent / plan-approval / claim-status.
7. **G7 → G8 → G9 → G10 → G11 — wire the backend-only surfaces** the team decides are V1 (demographics-edit and guardian-contact first; they're the highest clinical value).
8. **G12 — BR logic/test gaps** (plan total=Σitems, claim readiness fields).
9. **G13 → G14 → G15 → G16 → G17 — polish/reconcile.**

---

## 7. Dependencies on Other Modules

| Fix | Depends on / touches | Note |
|-----|----------------------|------|
| **G1** | **shared/** branch-access helpers; pattern mirrors `dental-patient-list-branch-isolation` fix | Self-contained in sync repo/handlers; reuse the established branch-scoping helper. |
| **G2** | **dental-billing** (canonical `ClaimsWorklist` + claim ops), **dental-imaging** (claim attachments) | Must decide single source of truth for claims; if "wire," insurance-profile UI feeds both. |
| **G3** | **notifs** + **comms** (send paths must consult consent), **person** (JSONB consent fields), `docs/product/DATA_GOVERNANCE.md` | Enforcement is cross-module; the capture/honesty fix is local. |
| **G4** | none (in-module handlers) | Mirror the existing `PATIENT_ARCHIVED` guard from patient/recall/follow-up. |
| **G5** | **dental-audit** / `core/audit-logger` | Tests only; assert against the audit sink already used by archive/export. |
| **G6** | spec regen pipeline (TypeSpec → SDK) | bulk-archive shape change is generated-code; follow regen flow + re-gate contract. |
| **G7/G8/G9** | **dental-scheduling** (treatment↔appointment link), **person** (contact/demographics) | Wiring only; backends + validators already exist. |
| **G15** | base **patient** module + **Better-Auth** roles | Cross-module; out of dental-patient boundary — confirm reachability first. |

---

## 8. Tests Required Before "Fixed"

A gap is not closed until its named test goes RED-before / GREEN-after and the full gate stays green (`bun test` per-file DB clone + api-ts `bunx tsc` + `CONTRACT_ONLY=dental-patient` hurl + FE unit + lint/boundaries). Backend tests run via `scripts/test-with-db.ts` with inline `DATABASE_URL=...monobase_test` (never `bun test <path>`).

| Gap | Required tests (write failing first) |
|-----|--------------------------------------|
| **G1** | (a) **Integration**: user in branch A calls `GET /dental/sync-logs` → sees **only** branch-A logs, **0** of branch B's (currently sees all — RED). (b) **Unit**: `SyncLogRepository.findAll(scope)` filters by branch/tenant. (c) create/update with no `branchId` → 400 (or branch required); branchless bypass closed. |
| **G2 (wire)** | E2E: create insurance profile → coverage auth → claim draft → readiness flags → submit; claims list reflects it. **(remove)** FE unit: dead hooks deleted; no orphan route; claims handled only by billing module. |
| **G3** | (a) **FE unit**: registration consent write failure is **surfaced**, not swallowed. (b) **FE/Integration**: `getPatientCommunicationConsent` is read back and rendered. (c) **Integration** (if enforce): a send to a channel with consent=false is blocked. |
| **G4** | **Integration** per sub-resource: writing an insurance/contact/alert/task on an **archived** patient → 403 `PATIENT_ARCHIVED` (4 RED tests). |
| **G5** | **Integration**: consent change, `approveTreatmentPlan`, and `updateClaimStatus` each create an audit-log row with actor/action/target (assert against the audit sink). |
| **G6** | **Contract**: bulk-archive `{ids,reason}` round-trips through the **generated validator** (re-enable it); bulk-import body validated by the generated validator (reject a malformed row at the seam). |
| **G7** | FE unit + contract: edit-patient modal persists name/DOB/gender/contact via `updateDentalPatient`; owner/role guard 403. |
| **G8** | FE unit per surface: add guardian contact (minor → guardian required, PAT-BR-002), add dental alert, add/complete task; each round-trips via SDK. |
| **G9** | FE unit: clinician approval calls `approveTreatmentPlan`; status-history + version render; attach/detach appointment from an accepted plan. |
| **G10** | FE unit: create household + add/remove member from the card; (consider soft-delete for `removeHouseholdMember`). |
| **G11** | FE unit: statement view renders `getDentalPatientStatement`; bulk-import entry. |
| **G12** | **Unit**: plan total == Σ item fees (TP-BR-006); claim readiness includes provider/service-date/tooth where applicable (CLAIM-BR-001); draft-override-reason path (TP-BR-004). |
| **G13** | Lint passes with no-raw-fetch for `patients.tsx`; single registration path via SDK. |
| **G17** | E2E: offline-created record shows pending → synced badge transitions (assert the visible state). |

Regression guard: extend `apps/dentalemon/tests/smoke/dental-patient_smoke.py` (and the per-file isolation runner) so a future pass cannot re-introduce a tenant-unscoped list or a write-only "saved" affordance — assert the **downstream effect / scoping**, not just the success toast.

---

## 9. Open `[NEEDS CONFIRMATION]` Items (block the relevant fixes)

1. **[NEEDS CONFIRMATION] G2 — insurance/claims source of truth.** Is the dental-patient insurance/claims vertical the intended claims system (then wire it + an insurance-profile UI), or is the **dental-billing** `ClaimsWorklist` canonical (then remove the dental-patient claims/insurance vertical + dead hooks)? Two subsystems currently coexist; one must win.
2. **[NEEDS CONFIRMATION] G3 — consent enforcement.** Should per-channel communication consent be **enforced at send time** (gate notifs/comms), and should the registration consent write be **blocking** (vs the current fire-and-forget)? Affects compliance posture.
3. **[NEEDS CONFIRMATION] G7/G8 — V1 scope of backend-only surfaces.** Are demographics-edit, guardian/emergency contacts, dental alerts, and tasks intended for the **V1 web app** (they have backend + tests, just no FE) or deliberately deferred? Determines how much of §7 is in-scope now.
4. **[NEEDS CONFIRMATION] G15 — base `patient` self-delete.** Is `DELETE /patients/:id` reachable in the dental deployment, and should it be disabled or given a clinical/billing-history guard (PAT-BR-004)?
5. **[NEEDS CONFIRMATION] G16 — merge endpoint.** Confirm BR-020 intent: leave merge fully absent (404) and fix the doc, or ship the documented 501 stub behind `dental_patient_merge_enabled`.
6. **[NEEDS CONFIRMATION] Scope of this pass** — P0 only (G1) / P0+P1 (G1–G6) / P0+P1+P2 (G1–G12) / everything.

---

## 10. Evidence Index
- Backend inventory + mechanics: this audit, §2–§5 (handler/line citations inline).
- Verified directly: `services/api-ts/src/handlers/dental-patient/repos/sync-log.repo.ts:12`, `sync/listSyncLogs.ts:21,27`, `services/api-ts/src/handlers/patient/deletePatient.ts:49,54`.
- Contract-spine cross-check: `.understand-anything/contract-spine.json` (dental-patient operationId → FE consumer map).
- Prior runtime pass: `docs/audits/workflow-verification/runs/dental-patient/REPORT.md`.
- Ideal standard: `docs/context/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` (§3.2/3.6/3.9/3.12/3.13, §5 BR registry, §7 RBAC, §9 tests).

---

## 11. Test-Coverage Addendum (2026-06-09)

> Added after a test-coverage review pass (no fixes implemented). The module has **excellent test breadth** — every handler has a dedicated test file (~99 test files: 39 backend, ~34 FE, 3 Hurl, 20 E2E/journey, 3 smoke). The gaps below are **scenario-depth gaps on the exact security/compliance edges §3 flags**, not missing files. Claims below were verified directly against the test sources (citations inline); a generic "all handlers tested" file-presence sweep does **not** contradict these — it confirms files exist, not that these scenarios are covered.

### 11.1 Existing Tests Found (grounded inventory)

**Backend (`services/api-ts/src/handlers/dental-patient/`)** — `dental-patient.test.ts` (CRUD, archive/restore/export, follow-up notes, EF-PAT-001 archived-write block @1355-1395, **audit assertions for `patient.archive` + `patient.export` only**, **bulk-archive mounted WITHOUT zValidator @113-115**); `dental-patient.bulk-import.test.ts` (**importPatients mounted WITHOUT zValidator @57-70**); `dental-patient-sync.test.ts` (create/list/update sync logs, LF-BR-001..004, **single-org fixture — ORG_ID + one BRANCH_ID, no cross-tenant case**); `dental-patient-insurance.test.ts` (profile/claim FSM, readiness, non-member 403 @180/326 — **no archived case**); `dental-patient-coverage.test.ts`; `dental-patient-alerts.test.ts`, `-contacts.test.ts`, `-tasks.test.ts` (FSMs + non-member 403 — **no archived case**); `dental-patient-records.test.ts` (visits/conditions/safety-floor); `communication-consent.test.ts` (get/update — **no audit assertion**); `dental-patient-treatment-plan.test.ts` (plan FSM, totalEstimateCents default-0/non-negative/round-trip — **no Σ-items**); `treatment-plans/approveTreatmentPlan.test.ts` (approval binds items, CR-05 — **no audit assertion**); `treatment-plan-status-history.test.ts`; `household.test.ts`; `treatment-appointment-link.test.ts`; `duplicate-detection.test.ts`; `dental-patient-recall.test.ts`; 2 FSM property tests (`consent.fsm`, `authorization.fsm`); 9 route-registration tests (TR-DG-002, real-server 401-not-404).

**Contract (Hurl):** `specs/api/tests/contract/dental-patient.hurl` (CRUD, consent BR-015, follow-up, statement, safety-floor, import/export, **bulk-archive**); `dental-revenue-cycle.hurl` (insurance-profile → authorization → claim → remittance).

**Frontend (`apps/dentalemon/src/features/`):** registration modal, patient list/filter-tabs/folder-card, duplicate panel, household-card, profile page + follow-up notes, `use-patient-actions`/`use-patients`/`use-patient-profile`/`use-patient-billing` hooks; billing `claims-worklist`/`use-insurance-claims`; workspace `consent-sheet`/treatment-table/treatment-plan-tab/`use-treatment-plan`; scheduling recall lists; reports patient/treatment.

**E2E / smoke:** `journeys/01-new-patient-exam`, `02-periodic-recall`, `15-offline-sync-metadata`; `patient-registration`, `patient-profile`, `patient-checkin`, `returning-patient-visit`, `consent-signing`, `insurance-claims`, `recall-due-list` specs; `tests/smoke/dental-patient_smoke.py` (CP1 single-consent register, CP2 consent-guard, CP3 search+profile coherence, CP4 follow-up append-only, CP5 export regression).

### 11.2 Missing Backend Tests (unit + integration)

| Gap | Missing test | Type | Priority |
|-----|--------------|------|----------|
| **G1** | `SyncLogRepository.findAll(scope)` filters by branch/tenant | unit | **P0** |
| **G1** | Branch-B user `GET /dental/sync-logs` → 0 of Branch-A rows (**needs new 2-org fixture** — current test is single-org) | integration | **P0** |
| **G1** | `createSyncLog`/`updateSyncLog` with no `branchId` → 400 / authorized (branchless bypass closed) | integration | **P0** |
| **G4** | Insurance / contact / alert / task write on an **archived** patient → 403 `PATIENT_ARCHIVED` (4 tests; today only non-member 403 exists) | integration ×4 | **P1** |
| **G5** | `approveTreatmentPlan` writes an audit row (actor/action/target) — **characterization test, write now** | integration | **P1** |
| **G5** | `updateClaimStatus` writes an audit row — **characterization test, write now** | integration | **P1** |
| **G12** | Plan total **== Σ item fees** (TP-BR-006) | unit | **P2** |
| **G12** | `getClaimReadiness` flags missing **provider / service-date / tooth-surface** (CLAIM-BR-001) | unit | **P2** |
| **G12** | Draft/unapproved → completed requires **override reason** (TP-BR-004) | integration | **P2** |

### 11.3 Missing Frontend Tests (component / interaction)

| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G3** | Registration consent **write-failure is surfaced**, not swallowed (today `.catch(()=>{})` reports false success) | **P1** |
| **G3** | `getPatientCommunicationConsent` is read back and the flags render | **P1** |
| **G7** | Edit-demographics modal persists name/DOB/gender/contact via `updateDentalPatient` (+ role guard) | **P1** `[NEEDS CONFIRMATION]` (wire vs defer) |
| **G8** | Add guardian/emergency contact (minor → guardian required, PAT-BR-002); add dental alert; add/complete task — each round-trips via SDK | **P1** `[NEEDS CONFIRMATION]` |
| **G9** | Clinician approval calls `approveTreatmentPlan`; status-history + version render; attach/detach appointment | **P2** `[NEEDS CONFIRMATION]` |
| **G10** | Create household + add/remove member from the card | **P2** `[NEEDS CONFIRMATION]` |
| **G11** | Statement view renders `getDentalPatientStatement`; bulk-import entry | **P2** `[NEEDS CONFIRMATION]` |

> FE tests for G7–G11 are **unwritable until the wire-or-remove product decision** (these surfaces have 0 FE consumers today). This is a *decision* dependency — do not author E2E against a surface that may be removed.

### 11.4 Missing Integration / API (contract) Tests

| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G6** | Bulk-archive `{ids,reason}` round-trips through the **generated** `BulkArchiveDentalPatientsBody` validator (re-enable it; today omitted @`dental-patient.test.ts:113-115`) | **P0/P1** |
| **G6** | `importPatients` rejects a malformed row at the **generated validator** seam (today mounted with no zValidator @`bulk-import.test.ts:57-70`) | **P1** |
| **G3** | *(if enforcement confirmed)* a send to a channel with `consent=false` is blocked (cross-module: notifs/comms) | **P1** `[NEEDS CONFIRMATION]` |

### 11.5 Missing E2E Tests

| Gap | Missing test | Priority |
|-----|--------------|----------|
| **G17** | J15 asserts the visible badge transitions pending → syncing → synced (today the journey exists but has **no badge assertions**) | **P2** |
| **G2** | *(if wire)* create insurance profile → coverage auth → claim draft → readiness → submit, surfaced in the patient FE | **P1** `[NEEDS CONFIRMATION]` |
| **G7/G8** | demographics-edit journey; minor-guardian-required journey (PAT-BR-002 E2E) | **P1/P2** `[NEEDS CONFIRMATION]` |

### 11.6 Regression Tests Required Per Gap

| Gap | Regression pin |
|-----|----------------|
| **G1** | Cross-tenant negative test stays in the suite; **extend `dental-patient_smoke.py`** to assert sync-log **scoping** (a future unscoped `findAll` re-fails). |
| **G3** | Smoke asserts consent **read-back / downstream effect**, not just the success toast (false-success class cannot regress silently). |
| **G4** | The 4 archived-write 403 tests are permanent guards against re-opening a frozen record. |
| **G5** | Audit-row assertions for approve/claim-status/consent stay green (AUD-BR-001/002 cannot regress). |
| **G6** | Contract test runs the **generated** validator — bypass cannot be silently re-introduced; CI `CONTRACT_ONLY=dental-patient` gates it. |
| **G12** | TP-BR-006 / CLAIM-BR-001 / TP-BR-004 unit pins. |

### 11.7 Updated Test-First Fix Sequence (TDD)

1. **G1 (P0)** — RED: unit `findAll(scope)` + 2-org integration (Branch B sees 0 of A) + branchless-400 → fix WHERE-scope + require `branchId` → GREEN + cross-tenant pin.
2. **G6 (P0/P1, moved up)** — RED: contract `{ids,reason}` through generated validator → TypeSpec regen `BulkArchiveDentalPatientsBody`, re-enable both omitted validators → GREEN; delete bypass comments.
3. **G5 (partial, write now)** — RED: audit-row assertion for `approveTreatmentPlan` + `updateClaimStatus` → fix only if RED exposes a real missing write → GREEN.
4. **G4** — RED: 4× archived-patient → 403 → mirror `PATIENT_ARCHIVED` guard → GREEN.
5. **G3** — RED: FE consent write-failure surfaced + `getPatientCommunicationConsent` read-back (+ consent audit from G5) → blocking/server-side write + render → GREEN.
6. **G12** — RED: Σ-items / readiness-fields / override-reason → fix logic → GREEN.
7. **G2 / G7–G11** — *gated on product decision*: per-surface FE unit + E2E RED → wire via SDK → GREEN (or delete dead vertical + dead hooks `use-insurance-claims.ts:155-223` if "remove").
8. **G17 + regression smoke** — RED badge-state E2E + downstream-effect smoke → GREEN.

### 11.8 Fix-Order Adjustments (vs §6)

- **G6 moved from #4 → #2** (right after G1). The deliberately-disabled bulk-archive validator + the no-validator bulk-import mount are a **test-trust hazard on a *wired* endpoint** (`use-patient-actions.ts` calls bulk-archive via the SDK). Every downstream test runs against handler-only validation until this is fixed; regen is cheap and unblocked by any product decision, so do it before the larger items.
- **G5 split.** `approveTreatmentPlan` + `updateClaimStatus` audit tests are **characterization tests against existing handlers** — write them immediately (they pin existing audit or expose a real gap). The **consent** audit test depends on G3's consent rework, so it rides with G3.
- **G2 / G7–G11 gated on `[NEEDS CONFIRMATION]` decisions, not code order.** Their FE/E2E tests are unwritable until "wire vs remove" is decided. Flag so no one writes E2E against a possibly-removed surface.
- **Budget note:** G1's negative test needs **new 2-org fixture scaffolding** (current sync test is single-org) — count it inside the P0, not as free.

> All §1–§10 audit findings stand unchanged. No prior finding was found incorrect during the test-coverage review.

---

## 12. Knowledge Graph Validation (2026-06-09)

> KG-alignment pass: validate the saved findings against actual code relationships using the understand-anything knowledge graph + the deterministic contract-spine. **No fixes implemented.** Scope: confirm/adjust the wiring claims (FE-consumer, unwired-endpoint, cross-module) only — not a re-audit.

### 12.1 Knowledge Graph Validation Summary

**KG state:** The full `/understand` knowledge-graph (`.understand-anything/knowledge-graph.json`, baseline commit `1196799b`, 2026-06-06) was **89 commits stale** vs HEAD `e49e411d`, with many dental-patient handler/FE files changed since (case-presentation vertical, new roles, export fixes, consent/household edits). A **full regen was deliberately NOT run** — it is a ~12M-token / 60–90-min rebuild of 2,681 files for poor ROI on a single-module pass (prior recorded decision), and it is the *wrong tool* for wiring questions (the import-only graph can't see codegen-wired routes anyway).

**Instead, the authoritative wiring layer was refreshed deterministically (zero LLM):** re-ran `bun run scripts/build-contract-spine.ts`, which reconstructs `operationId → handler → SDK hook → FE consumer` from the generated artifacts (OpenAPI + registry + SDK + app source) and re-injects it into the graph. Fresh spine: **357 ops, 135 FE-consumer files; 68 dental-patient ops → 32 wired / 36 unwired-by-SDK.** This matches the saved plan's headline (`§5`: "68 ops; ~32 wired + 1 raw-fetch-only; ~35 unwired") to within the raw-fetch classification of one op — **the plan's core wiring inventory is sound.** Every confirmed/adjusted finding below was then verified directly against current source (citations inline), not against the stale node graph.

**KG/spine limitation discovered (affects how to read "wired"):** the contract-spine maps an op to *any file that calls its SDK fn*, **not** to whether that file's export is reachable from a rendered component. It therefore **over-reports** the 3 coverage-auth ops as "wired" (they're called only inside dead hook exports). Do not trust spine "wired" alone for a wire/remove decision — confirm component reach (as done for G2 below).

### 12.2 Confirmed / Adjusted Findings

| Finding | Status | KG / code-evidence summary | Action |
|---|---|---|---|
| **G1** sync-log cross-tenant read leak (P0) | **Confirmed** | `sync-log.repo.ts:11-13` `findAll()` = `db.select().from(dentalSyncLogs)` with **no WHERE**; `listSyncLogs.ts:21,27` no scoping, audits `tenantId: user.id`. Spine confirms `listSyncLogs` is a **live wired** endpoint (1 consumer: `workspace/hooks/use-sync-status.ts`) → real leak reaches the UI. `createSyncLog`/`updateSyncLog` = **0 FE consumers** (Tauri-only) → branchless-bypass fix has **zero web blast radius**. | Keep P0, fix first. |
| **G2** insurance/claims vertical unwired + dead coverage-auth hooks | **Confirmed (strengthened)** | Insurance-profile + claim ops (`createInsuranceProfile`/`list`/`update`, `createClaimDraft`/`getClaimReadiness`/`updateClaimStatus`/`listPatientClaims`) = **0 consumers** in spine. The 3 coverage-auth ops show "wired → `billing/hooks/use-insurance-claims.ts`", **but** the only component importing that file (`claims-worklist.tsx:11`) imports **only** `useInsuranceClaims`/`usePayerArAging`/`useClaimMutations` (billing-module claims). `useCoverageEstimate`/`usePatientAuthorizations`/`useAuthorizationMutations` (lines 155-223) reach **no component → confirmed dead**, exactly as the plan states. | Keep. Decision still gated (`[NEEDS CONFIRMATION]` #1). |
| **G3** consent write-only / fire-and-forget / unenforced | **Confirmed** | `getPatientCommunicationConsent` + `updatePatientCommunicationConsent` = **0 SDK consumers** in spine; `patients.tsx:89` PATCHes consent via **raw fetch** with `.catch(()=>{})` at `:94`. | Keep P1. |
| **G4** archived-write guard missing (insurance/contacts/alerts/tasks) | **Needs Confirmation** | KG/spine cannot see runtime guard presence; this is a handler-logic claim, not a wiring one. (Not re-verified in this pass — out of KG scope.) | Verify by handler read during fix. |
| **G5** audit-creation tested for only 2 actions | **Needs Confirmation** | Same — test-content claim, not wiring. KG can't adjudicate. | Verify against test sources during fix. |
| **G6** validator-bypass / "contract drift" | **Adjusted (downgraded P1→P2)** | Generated `BulkArchiveDentalPatientsBody` is **already `{ids,reason}`** (`validators.ts:2978-2981`) = handler (`bulkArchiveDentalPatients.ts:22-23`); prod `routes.ts:1305` **applies it**. **No prod drift / no SDK-400.** Bypass is **test-only** (`buildTestApp` skips it); stale comment misleads. | Reclassify test-hygiene; demote in fix order (see §12.4). |
| **G7** `updateDentalPatient` unwired (no demographics-edit) | **Confirmed** | Spine: `updateDentalPatient` = **0 consumers**. | Keep (decision-gated). |
| **G8** alerts/contacts/tasks full backend, no FE | **Confirmed** | Spine: all 10 ops (`create/list/update DentalAlert`, `create/list/update/delete PatientContact`, `create/list/update Task`) = **0 consumers**. | Keep (decision-gated). |
| **G9** treatment-plan advanced unwired | **Confirmed** | Spine: `approveTreatmentPlan`, `listTreatmentPlanStatusHistory`, `getTreatmentPlanVersion`, `attachTreatmentAppointment`, `detachTreatmentAppointment` = **0 consumers**. (`acceptTreatmentPlan` IS wired → `use-treatment-plan.ts`, as noted.) | Keep (decision-gated). |
| **G10** household writes unwired | **Confirmed** | Spine: `createHousehold`/`getHousehold`/`addHouseholdMember`/`removeHouseholdMember` = **0 consumers**; only `getPatientHousehold` wired (`use-household.ts`). | Keep. |
| **G11** statement/safety-floor/conditions/visits/import unwired | **Confirmed** | Spine: `getDentalPatientStatement`, `getDentalPatientSafetyFloor`, `listPatientConditions`, `listPatientVisits`, `importPatients` = **0 consumers**. | Keep. |
| **G13** two raw `fetch()` in `patients.tsx` | **Confirmed** | `patients.tsx:66` (POST patient) + `:89` (PATCH consent) bypass SDK. | Keep P3. |
| **G15** base `patient` self-delete hard-deletes | **Confirmed** | `patient/deletePatient.ts:54` `repo.deleteOneById(...)` hard delete, guarded only by `isOwner = personId === user.id`. Cross-module (base patient). | Keep (confirm reachability). |
| **G16** "merge: no endpoint, 404s" | **Adjusted (finding incorrect)** | `mergePatients` **IS registered** `POST /patients/merge` (`routes.ts:2412`); returns admin-gated **501 NOT_IMPLEMENTED** (`patient/mergePatients.ts:28-35`); `unmergePatients` also registered. A call **does not 404**. MODULE_SPEC's "returns 501 by design" is **correct**; only the *gap-plan wording* was wrong. Residual: no `/dental/patients/merge` (merge is base-patient module). | Correct the gap-plan wording; no doc fix needed. |

> G12 (BR logic), G14 (list-shape), G17 (E2E badge) are logic/test/E2E-content claims outside the KG's wiring scope — **not re-adjudicated here**; they stand as written.

### 12.3 New KG-Discovered Risks

Only items **not** already captured in the saved plan:

1. **Spine over-reports 3 coverage-auth ops as "wired" (false positive).** A naive future sweep that trusts `contract-spine.json` "wired" status would conclude the dental-patient coverage-auth chain is consumed when it is **dead-hook-only**. Net new risk: the wire/remove decision (G2) could be mis-made from spine data alone. *Mitigation: the spine entry's `consumers` points only to a hook file, not a component — treat hook-only consumers as "needs component-reach check," already applied above.*
2. **Module grew since the last audit baseline — a now-wired vertical the plan never inventoried:** the **case-presentation** vertical (`createCasePresentation`/`get`/`list`/`accept`/`reject`) is **wired** (`features/case-presentation/*`, `workspace/components/treatment-plans-sheet.tsx`, `lib/rbac.ts`), as are `acceptTreatmentOption`/`listTreatmentOptionGroup` (`use-treatment-options.ts`). These are **not gaps** (correctly absent from §5's unwired list), but the plan's inventory predates them — noting for completeness so a future pass doesn't "discover" them as new.
3. **No new *unwired* surface** beyond §5 was found in the fresh spine — the unwired set is stable at the 36 SDK-unwired ops, all already enumerated under G2/G3/G7–G11.

### 12.4 Cross-Module Dependencies / Blast Radius (KG-derived)

- **G1 — minimal blast radius (supports fixing first).** `listSyncLogs` has exactly **1** FE consumer (`use-sync-status.ts`); scoping its data correctly changes no contract shape. `createSyncLog`/`updateSyncLog` have **0** web consumers (Tauri/cadence only) → tightening their `branchId` requirement cannot break the web app. Self-contained in the sync repo/handlers + the shared branch-access helper. Confirms §7's "self-contained."
- **G2 — two claim subsystems confirmed cross-module.** Dental-patient insurance/claims ops are dead; the *live* claims UI (`claims-worklist.tsx`) drives the **dental-billing** ops via `useInsuranceClaims`/`useClaimMutations`. Single-source-of-truth decision spans **dental-patient ↔ dental-billing** (and imaging for attachments), as §7 states.
- **G6 — blast radius is test-only** (revised): the prod route already validates; no SDK/contract regen is actually required to close the *prod* risk (there is none). The only change is in test mounts + a stale comment.
- **G16 — cross-module (base `patient`), not dental-patient.** Merge/unmerge + self-delete (G15) live outside the dental-patient boundary; confirm reachability/role-gating in the base module, don't fix inside dental-patient.

### 12.5 Fix-Order Adjustments

- **G6 demoted (reverses §11.8's "move to #2").** §11.8 elevated G6 to right-after-G1 as a "test-trust hazard on a *wired* endpoint that can 400 in prod." KG/code ground-truth shows **no prod drift** — the generated validator is current and applied in `routes.ts`. G6 is now **test-hygiene (P2)**: re-mount the generated validator in `buildTestApp`/bulk-import test and delete the stale comment. **Do it opportunistically, not before the security/compliance items (G1 → G3 → G4 → G5).** It no longer gates downstream test trust for the *prod* contract.
- **All other ordering stands.** G1 first (confirmed P0, smallest blast radius), then G3/G4/G5 (compliance), then the decision-gated wire-or-remove block (G2/G7–G11). G16 becomes a one-line doc/wording correction, not a stub task.
- **G2 wire/remove decision must not be driven by spine "wired" status** (see §12.3 risk 1) — confirm component reach first.

> KG-validation verdict: the saved plan's **wiring inventory is accurate and its P0/compliance findings hold**. Two P3-ish findings (**G6**, **G16**) were **overstated** and are corrected above; no high-severity finding was weakened. All adjustments are evidence-cited; logic/test-content findings (G4, G5, G12, G14, G17) were outside KG scope and left intact pending direct verification at fix time.
</content>
</invoke>
