# AHA Module/Group Gap Plan: Dental Patient

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Patient |
| Module slug | dental-patient |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-patient-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.2 (FR2.1–FR2.21) + §5.4 patient folder card + journeys J4/J36/J40 |
| Supporting PRDs/specs used | `docs/prd/BUSINESS_RULES.md` BR-015/015b/015c/020 + TP-BR-005/006; `docs/prd/ACCEPTANCE_CRITERIA.md` AC-REG-01/02, AC-PAT-001..004, AC-TXPLAN-01/02; `docs/product/modules/dental-patient/MODULE_SPEC.md` + `API_CONTRACTS.md`; `docs/product/WORKFLOW_MAP.md` WF-005/023/044, WFG-006/007 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-patient/` (~46 ops across 10 sub-domains, 42 test files); `apps/dentalemon/src/features/patients/` + workspace plan/recall surfaces + `features/case-presentation/`; `routes/_dashboard/patients.tsx`; `specs/api/tests/contract/dental-patient.hurl` |
| PRDs/specs inspected | All above; 51-item requirement checklist extracted before code comparison |
| KG used | Yes — `contract-spine.json` (2026-06-10); every zero-consumer claim grep-verified in `apps/dentalemon/src` |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — gap claims are statically conclusive (zero-consumer ops, absent components); wired surfaces live-driven in prior audits ≤3 days old |
| Playwright/E2E inspected | Yes (inspected, not run): patient-registration, recall, consent, offline-sync-metadata specs |
| Existing tests inspected | 42 backend files, `dental-patient.hurl` (41 req), ~34 FE files, E2E journeys |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; SL-fix verifications are source-spot-checks at cited lines |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| v3 PRD §6.2 | `docs/prd/v3-dentalemon.md` | PRD | Current | FR2.1–2.21: list/search/registration/profile/duplicates/merge/archive/export/status/follow-up/bulk/med-history/alerts/emergency-contact/comms-prefs/recall/anonymization/consent/statement |
| Business rules | `docs/prd/BUSINESS_RULES.md` | business rules | Current (load-bearing) | BR-015 consent gate, BR-015b archived read-only, BR-015c follow-up append-only, BR-020 merge deferred (501 by design), TP-BR-005 plan completion |
| Acceptance criteria | `docs/prd/ACCEPTANCE_CRITERIA.md` | acceptance criteria | Current | AC-REG/AC-PAT/AC-TXPLAN |
| Module spec + API contracts | `docs/product/modules/dental-patient/` | module spec | Current (reconciled 2026-06-08) | endpoints, plan FSM, permissions, deferred items P1-19/21/28, P2-8/9/10 |
| PRD §2.5 phase roadmap | `docs/prd/v3-dentalemon.md` | PRD | Current | **Households and insurance/claims declared Phase 2** — bounds the orphan-op judgment below |
| Prior module audit + gap plan + matrix | `docs/audits/modules/MODULE_dental-patient_AUDIT_2026-06-08.md`, `docs/audits/module-gap-plans/dental-patient-gap-plan.md`, `MASTER-GAP-MATRIX.md` | prior audit (pre-AHA) | **Partially superseded** | P0 sync leaks fixed (verified); G4 archived-guards row now STALE (fixed — re-verified this round §3) |

## 3. Expected vs Actual

**Expected (PRD §6.2):** the patient backbone — fast list/search, <2min registration with mandatory consent (BR-015), profile with safety floor + debt summary, duplicate detection, archive/restore guarded by active-payment-plan (EC1), follow-up notes, recall tracking, itemized statement (FR2.21), data export + GDPR anonymization, treatment-plan lifecycle with approval records. Households and insurance/claims are **Phase 2 by PRD §2.5**.

**Actual:** The backend is the platform's deepest (≈46 ops, 42 test files): registration consent gate, archived-write guards, branch isolation, plan FSM with approval/version/status-history, recall FSM, insurance vertical, household model, GDPR erasure hooks. Prior P0 cross-tenant leaks (`listPatientVisits`, `listPatientConditions`, `getClaimReadiness`) are **fixed and verified** (`listPatientVisits.ts:41-46`, `getClaimReadiness.ts:22-26`). The FE wires the core loop: list/search/profile (`use-patient-profile.ts`), registration (onboarding wizard), archive/restore/bulk-archive/export (`use-patient-actions.ts`), duplicate detection panel, recalls (sheet + scheduling due-list), treatment plans + case presentation, household read-only card, sync-status read.

Findings that change the prior picture:

1. **G4 (archived-write guards on sub-resources) is FIXED — stale matrix row.** Re-verified this round: `EF-PAT-001` guard present in `contacts/createPatientContact.ts:34-36`, `insurance/createInsuranceProfile.ts:30-32`, `alerts/createDentalAlert.ts:32-34`, `engagement/createTask.ts:31-33`, `household/addHouseholdMember.ts:35-36`, `treatment-plans/createTreatmentPlan.ts:32-34`. Do not re-fix.
2. **NEW — patients cannot be edited after registration.** `updateDentalPatient` has zero FE consumers; no `updatePatient`/`updatePerson` call and no edit component anywhere under `features/patients/`. A typo in name/DOB/phone is permanent from the product. This was buried in prior "G7 demographics" rows; it is the module's top gap (GAP-1, P1).
3. **FR2.21 itemized statement unreachable:** `getDentalPatientStatement` zero consumers (billing's collections/statement surfaces use billing endpoints; the per-patient dispute-resolution statement of FR2.21 has no UI).
4. **Two alert systems exist; one is dead.** The `dental-alerts` sub-domain (3 ops) has zero consumers AND `getDentalPatientSafetyFloor` has zero consumers — the workspace safety floor derives from `listMedicalHistory` directly. Duplicate-source-of-truth class.
5. **Insurance vertical (≈10 ops) and household writes (4 ops) are Phase-2 per PRD §2.5** → reclassified from "unwired gap" to **Possible Overbuild** (park-vs-finish product decision, same shape as billing claims GAP-7).

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR2.1/2.2 list + search | grid, <1s branch-scoped search | ✓ | patients list + search | `listDentalPatients` | — | FE tests + E2E + AC-PAT-004 pin | Implemented | No |
| FR2.3/BR-015/AC-REG registration + consent gate | consent required else 422 | ✓ | onboarding wizard + registration modal | `createDentalPatient` consent validation | person JSONB consent | backend + hurl + E2E | Implemented | No |
| FR2.3 photo capture | camera/upload at registration | Not verified this round | — | — | — | — | Unclear `[NEEDS CONFIRMATION]` | P3 check |
| FR2.4 profile + edit | demographics editable | **Read ✓ / edit MISSING** | no edit component; `updateDentalPatient` 0 consumers; no base-op fallback | handler + archived guard exist | — | backend tested | Partially Implemented | **GAP-1** |
| FR2.5 duplicate detection | fuzzy warn, non-blocking | ✓ | `duplicate-patients-panel.tsx`, `use-duplicate-patients.ts` | `detectDuplicatePatients` | — | backend tests | Implemented | No |
| FR2.6/BR-020 merge | deferred 501 | 501 stub as designed; unmerge handler fixed to 501 (EM-PAT-007) | advisory link only | `unmergePatients.ts:30-36` | flag default false | **stale base test asserts 500** | Not Required for V1 | GAP-10 (P3 test) |
| FR2.7/EC1 archive/restore | soft archive; active-plan block; restore | ✓ | `use-patient-actions.ts` | archive handlers + `hasActivePaymentPlan` guard | `archived` status | backend + FE tests | Implemented | No |
| FR2.8 export | per-patient CSV/JSON | ✓ | `use-patient-actions.ts` | `exportDentalPatients` | — | hurl | Implemented | No |
| FR2.9–2.11 status/in-session/follow-up badges | badges + filters | ✓ (prior audits) | patient cards | — | — | FE tests | Implemented | No |
| FR2.12/BR-015c follow-up notes | append-only log | ✓ | profile notes | 405 on PATCH/DELETE | — | backend pins | Implemented | No |
| FR2.13 bulk archive | multi-select + EC1 per-patient | ✓ | `use-patient-actions.ts` | `bulkArchiveDentalPatients` | — | backend | Implemented | No |
| FR2.15/AC-PAT-003 safety floor | aggregated allergy/med/condition | FE floor ✓ via med-history; **dedicated endpoint orphan** | top bar (clinical round) | `getDentalPatientSafetyFloor` 0 consumers | — | backend + EF-PAT-005 audit-read pin | Implemented (alt path) | GAP-8 (P3 dual-source) |
| FR2.16 emergency contact | fields at registration/profile | Contacts sub-domain (4 ops) 0 consumers; where is emergency contact stored? | registration form fields `[NEEDS CONFIRMATION]` | contacts handlers orphan | contact schema | backend tests | Unclear | **GAP-5** |
| FR2.17/P1-28 comms preferences | per-channel consent read/PATCH | BE ✓; FE PATCH exists but **silent-failure** | `patients.tsx:94` `.catch(() => {` swallows | `updatePatientCommunicationConsent` | person JSONB | `communication-consent.test.ts` | Partially Implemented | **GAP-4** |
| FR2.18 recall tracking | presets, due list, overdue filter | ✓ sheet + due list | `recalls-sheet.tsx`, `use-recalls.ts`, `use-recall-due-list.ts` (scheduling) | recall FSM handlers | `recall_due_at` | `dental-patient-recall.test.ts` | Implemented | patient-list "Recall Overdue" filter `[NEEDS CONFIRMATION]` (P3) |
| FR2.19 anonymization | GDPR erasure two-step | ✓ backend (data-governance round audits FE) | — | `handlers/dental-erasure/` | — | governance tests | Implemented (BE) | see data-governance plan |
| FR2.20/EC9 guardian consent + age-16 transition | guardian capture + prompt | guardian JSONB ✓; age-16 prompt not found | — | person consent JSONB | — | — | Partially Implemented `[NEEDS CONFIRMATION]` | P3 |
| FR2.21 itemized statement | printable/emailable dispute statement | ✓BE only — **no FE affordance** | grep `getDentalPatientStatement` = 0 | handler exists | — | hurl | Partially Implemented | **GAP-2** |
| Plan FSM + approval (CR-05, TP-BR-005) | draft→presented→approved→…; approval record binds items | ✓ | `use-treatment-plans.ts`, `use-treatment-plan.ts`, case-presentation | `approveTreatmentPlan.ts` | plan/version/approval/history tables | FSM + approval + option-group tests | Implemented | No |
| TP-BR-006 plan total = Σ items | validation | default-0/non-negative only | — | — | — | no unit test | Partially Implemented | GAP-12 (P3) |
| Insurance vertical (PRD §2.5 **Phase 2**) | profiles/coverage/claim-drafts/readiness | Backend complete+tested; **zero FE** | 0 consumers (≈10 ops) | insurance handlers | claim/coverage tables | `dental-patient-insurance.test.ts`, hurl | Possible Overbuild (early Phase-2) | **GAP-3** |
| Household (PRD §2.5 **Phase 2**) | family groups | Backend ✓; FE read-only card; writes 0 consumers | `use-household.ts` (read) | household handlers | household tables | backend tests | Possible Overbuild (reads shipped) | **GAP-7** |
| Dental-alerts sub-domain | (no distinct PRD anchor vs FR2.15) | 3 ops, 0 consumers; duplicates med-history floor | — | alerts handlers | alert schema | backend tests | Possible Overbuild / duplicate source | **GAP-6** |
| Bulk import | staged import | `importDentalPatients` 0 consumers | — | handler + RFC-4180 (fixed Batch 3) | — | 7 adversarial pins | Partially Implemented | cross-module: external-records-import G1 `[NEEDS PRODUCT DECISION]` |
| Offline registration idempotency | replay-safe create | **No localId on `createDentalPatient`** (SL-01 covered visit/treatment/invoice/chart only) | — | `createDentalPatient.ts` (no localId) | no unique index | — | Unclear | **GAP-9** `[NEEDS CONFIRMATION]` |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR2.4 profile editing | **GAP-1**: no patient-edit UI anywhere; `updateDentalPatient` 0 consumers, no alternate path — registration typos permanent from product | P1 | V1 REQUIRED | grep `updateDentalPatient`/`updatePatient`/`updatePerson` in patients FE = 0; no edit component | Edit-demographics form on profile (reuse registration fields); RED-first FE test |
| FR2.21 statement | **GAP-2**: per-patient itemized statement unreachable (`getDentalPatientStatement` 0 consumers) — bill-dispute workflow undeliverable | P1 | V1 REQUIRED | spine + grep | "Statement" action on profile/billing tab → printable view (shares print pattern with billing receipt fix) |
| PRD §2.5 insurance Phase-2 | **GAP-3**: insurance vertical (~10 ops: profiles, coverage auth, claim drafts, readiness, status) fully built+tested, zero FE — shipped ahead of phase | P2 | `[NEEDS PRODUCT DECISION]` (park vs finish; **same decision as billing GAP-7 claims** — decide once) | spine + grep; PRD declares Phase 2 | If park: document dormant; if finish: wire with billing claims batch `[CROSS-MODULE RISK]` |
| FR2.17 comms consent | **GAP-4**: FE PATCH swallows failures (`.catch(() => {`) — user believes prefs saved when they aren't | P2 | V1 REQUIRED | `routes/_dashboard/patients.tsx:94` | Surface error toast + retry; FE-unit RED on failed PATCH |
| FR2.16 emergency contact | **GAP-5**: contacts sub-domain (4 ops) 0 consumers; unclear where emergency contact is actually captured | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | spine + grep | Confirm registration stores emergency contact on person; then wire contacts CRUD on profile or park sub-domain |
| Alerts duplication | **GAP-6**: `dental-alerts` sub-domain orphan AND duplicates med-history-derived safety floor — two sources of truth for "alerts" | P2 | `[NEEDS PRODUCT DECISION]` | both 0 consumers; floor uses `listMedicalHistory` | Decide: park dental-alerts (likely) or define distinct purpose; do not wire both `[DO NOT OVERBUILD]` |
| PRD §2.5 household Phase-2 | **GAP-7**: household writes (create/add/remove) 0 consumers; read-only card shipped | P3 | `[NEEDS PRODUCT DECISION]` | spine + grep | Park; reads are harmless |
| FR2.15 endpoint orphan | **GAP-8**: `getDentalPatientSafetyFloor` 0 consumers while floor derives from med-history — drift-class only | P3 | V1 RECOMMENDED | grep = 0 | Consume endpoint or add equality pin (floor render == endpoint aggregate) |
| Offline registration | **GAP-9**: `createDentalPatient` lacks localId idempotency (other offline write paths got it in SL-01) — offline registration replay could duplicate patients | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` (is offline registration in scope?) | `createDentalPatient.ts` no localId; SL-01 scope excluded patient | Confirm with offline-sync group; if in scope, add localId + unique index like `dental-invoice.schema.ts:52-54` |
| Test hygiene | **GAP-10**: stale base test asserts `unmergePatients` 500; handler correctly returns 501 — known failing test | P3 | V1 RECOMMENDED `[TEST GAP]` | `patient/patient.test.ts` vs `unmergePatients.ts:30-36` | Update assertion to 501 |
| TP-BR-006 | **GAP-12**: plan total ≠ Σ items unvalidated; claim readiness missing provider/date/tooth checks | P3 | V1 RECOMMENDED | prior G12; unchanged | Validation + unit test during plan work |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Insurance vertical (~10 ops: profiles, coverage auths, claim drafts, readiness, claim status) | `dental-patient-insurance.test.ts`, hurl | PRD §2.5: insurance/claims **Phase 2** | Carrying cost; interacts with billing claims overbuild | Keep, do not expand; **single park-vs-finish decision with billing GAP-7** `[NEEDS PRODUCT DECISION]` |
| Household model (4 write ops + read) | household handlers + tests | PRD §2.5: households **Phase 2** | Low (read-only card is honest) | Keep reads; park writes `[DO NOT OVERBUILD]` |
| Dental-alerts entity (3 ops) | alerts handlers + tests | FR2.15 satisfied via med-history floor instead | Duplicate source of truth if ever wired naively | Park or repurpose deliberately (GAP-6) |
| Sync-log write ops (`createSyncLog`/`updateSyncLog` 0 FE consumers; `listSyncLogs` wired) | spine | sync engine internal | Low — engine-facing, not UI-facing | Keep; document engine-only |
| Plan status-history + CDT-year stamping (P2-8/P2-10) | endpoints + schema | MODULE_SPEC declares P2 | Low | Keep (spec-sanctioned early) |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Register walk-in (J4/WF-005) | staff | new patient | form → consent → create → optional start session | Implemented | No | E2E |
| Correct patient record | staff | typo/changed phone | open profile → edit → save | **Missing** | **GAP-1** | no edit UI |
| Archive/restore (J36/J40) | staff_full/owner | inactive patient | archive (EC1 plan-block) → restore | Implemented | No | `use-patient-actions.ts` |
| Resolve duplicate | staff | fuzzy match | panel → review → (merge deferred 501) | Implemented (within V1 scope) | No | duplicate panel |
| Recall cycle (FR2.18) | dentist→staff | visit end | set recall → due list → schedule | Implemented | No | recalls sheet + scheduling due list |
| Dispute a bill (FR2.21) | staff+patient | billing question | generate itemized statement → print/email | **Missing (BE ready)** | **GAP-2** | 0 consumers |
| Plan → present → approve | dentist+patient | treatment proposal | plan FSM → case presentation → approval record | Implemented (fixed+verified 2026-06-09) | No | case-presentation round re-checks |
| Update comms preferences | staff | patient request | PATCH channels → confirmation | Partially (silent failure) | **GAP-4** | `patients.tsx:94` |
| Insurance/claims intake | staff | insured patient | profile → coverage → claim draft | Backend only (Phase-2) | GAP-3 | 0 consumers |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Consent gate at registration | 422 without consent | Implemented | AC-REG pins | V1 REQUIRED | done |
| Duplicate warn (non-blocking) | 201 + warning | Implemented | tests | V1 REQUIRED | done |
| Demographics edit | editable post-registration | Missing | GAP-1 | V1 REQUIRED | top gap |
| Archive plan-block (EC1) | 409 w/ outstanding | Implemented | guard + tests | V1 REQUIRED | done |
| Archived read-only (BR-015b) | 403 all writes incl. sub-resources | Implemented (**G4 fixed**) | 6 guards verified §3 | V1 REQUIRED | stale matrix row — do not re-fix |
| Follow-up note append-only | 405 on edit/delete | Implemented | pins | V1 REQUIRED | done |
| Statement generation | printable artifact | Missing (BE ready) | GAP-2 | V1 REQUIRED | |
| Recall due → schedule | due list drives booking | Implemented | scheduling hook | V1 REQUIRED | done |
| Plan approval record | who/how/snapshot | Implemented | `approveTreatmentPlan.ts` | V1 REQUIRED | done |
| Comms-pref save feedback | success/error surfaced | Partially Implemented | GAP-4 | V1 REQUIRED | silent catch |
| GDPR anonymize | two-step, hold-aware | Implemented (BE) | erasure handlers | V1 REQUIRED | FE in data-governance round |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Find a patient fast | staff | search <1s | Implemented | No | V1 REQUIRED | E2E |
| Register in <2min | staff | guided form | Implemented | No | V1 REQUIRED | E2E |
| Fix a typo in patient record | staff | edit profile | Missing | GAP-1 | V1 REQUIRED | no UI |
| Hand patient an itemized statement | staff | print/email | Missing | GAP-2 | V1 REQUIRED | 0 consumers |
| Archive with money safety | staff_full | EC1 block | Implemented | No | V1 REQUIRED | tests |
| Track who to call today | staff | follow-up filter + notes | Implemented | No | V1 REQUIRED | FE tests |
| Set + work recalls | dentist/staff | presets → due list | Implemented | No | V1 REQUIRED | wired |
| Update contact/comms prefs | staff | reliable save | Partially Implemented | GAP-4 | V1 REQUIRED | silent catch |
| Manage insurance profile | staff | profile + coverage | Backend only | GAP-3 | V2 DEFERRED (per PRD §2.5) | 0 consumers |
| Group family members | staff | household management | Read-only | GAP-7 | V2 DEFERRED (per PRD §2.5) | reads wired |
| Merge duplicates | owner | full merge | 501 by design | No | V2 DEFERRED (BR-020) | stub |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 no patient edit | FE affordance | P1 | V1 REQUIRED | `updateDentalPatient` 0 consumers; no edit component; no fallback path | Data quality decays permanently; wrong phone = failed recalls/billing contact; basic EHR table-stakes | Profile edit form wired to existing tested handler |
| GAP-2 no statement UI | FE affordance | P1 | V1 REQUIRED | `getDentalPatientStatement` 0 consumers | FR2.21 dispute-resolution workflow (PH cash practice trust) undeliverable | Statement action + printable view |
| GAP-4 silent consent save | FE error handling | P2 | V1 REQUIRED | `patients.tsx:94` | Trust/compliance: staff believe prefs saved; Phase-2 reminders will act on wrong consent | Error surface + pin |
| GAP-3 insurance early-Phase-2 | scope/phase | P2 | `[NEEDS PRODUCT DECISION]` | ~10 orphan ops | Carrying cost + decision coupling with billing claims | Single claims-vertical decision |
| GAP-9 offline registration idempotency | offline/data | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` | no localId on create | Offline replay could duplicate patients (the system's central entity) | Confirm scope; mirror invoice localId pattern |
| GAP-6 dual alert systems | architecture | P2 | `[NEEDS PRODUCT DECISION]` | alerts ops + floor endpoint both orphaned | Future wiring could create two disagreeing alert sources | Park one deliberately |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Staff fixes patient's phone number | Edit on profile | No edit affordance anywhere | GAP-1 | P1 | FE-unit: edit form saves + renders update |
| Patient disputes bill → staff prints statement | Statement from profile | No affordance | GAP-2 | P1 | FE-unit render + print view |
| Staff unticks SMS consent → assumes saved | Confirmation or error | Silent failure possible | GAP-4 | P2 | FE-unit: failed PATCH → error visible |
| Offline iPad registers patient → replay on reconnect | One patient | Potential duplicate `[NEEDS CONFIRMATION]` | GAP-9 | P2 | backend replay test (if in scope) |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `updateDentalPatient` | API, 0 FE consumers | spine + grep | edit impossible | Wire (GAP-1) |
| `getDentalPatientStatement` | API, 0 FE consumers | same | statement missing | Wire (GAP-2) |
| Insurance ops ×~10 | API, 0 FE consumers | same | Phase-2 early | Park/decide (GAP-3) |
| Contacts CRUD ×4 | API, 0 FE consumers | same | FR2.16 ambiguity | Confirm then wire-or-park (GAP-5) |
| Dental-alerts ×3 + `getDentalPatientSafetyFloor` | API, 0 FE consumers | same | dual-source | Park one (GAP-6/8) |
| Household writes ×4 | API, 0 FE consumers | same | Phase-2 | Park (GAP-7) |
| `importDentalPatients` | API, 0 FE consumers | same | decision-gated | external-records-import round owns |
| `createSyncLog`/`updateSyncLog` | API, engine-facing | same | none | Document engine-only |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Cross-tenant P0 leaks fixed: derive-branch-then-assert pattern | backend | `listPatientVisits.ts:41-46`, `getClaimReadiness.ts:22-26` | — | none (verified; pinned by isolation tests) |
| Archived-write guard uniform across 10 sub-domains (EF-PAT-001) | backend | 6 spot-checks §3 | — | none (G4 stale row closed) |
| `createDentalPatient` non-idempotent (`crypto.randomUUID()`, no localId) | backend/offline | `createDentalPatient.ts:64` | P2 | GAP-9 |
| Consent stored as person JSONB single-consent model (V-PAT-004) | schema | person record | — | none |
| Plan version/approval/status-history append-only chain | schema | plan tables + tests | — | none (strong) |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Branch scoping uniform (`assertBranchRole`/`assertPatientBranchAccess`) | tenancy | `createDentalPatient.ts:47-48`, `createPatientContact.ts:32`, `createRecall.ts:29` | — | none (verified) |
| Role guards on create/archive/export (staff_scheduling 403) | write guards | `dental-patient.test.ts:978/1025/1088` | — | none |
| Safety-floor reads audit-logged (EF-PAT-005) | PHI access | safety-floor handler | — | none |
| No new findings this round; SL-08 sweep covered module | tenancy | prior sweep | — | none |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Follow-up notes append-only (405) | patient record | BR-015c pins | — | none |
| Plan approvals append-only with method/snapshot | treatment consent | approval table + tests | — | none |
| GDPR erasure preserves clinical record, anonymizes PII, blocked by legal hold | erasure | `handlers/dental-erasure/` | — | audited in data-governance round |
| Comms-consent change can silently fail in FE | consent trail | GAP-4 | P2 | fix + pin |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| ~24 wired / ~22 orphan ops; orphans cluster in exactly 4 sub-domains (insurance, household-writes, contacts, alerts) + 3 singletons (update, statement, import) | contract-spine 2026-06-10, grep-verified | Orphans are phase/decision items, not random rot; singletons are the real V1 gaps | GAP-1/2 fix; GAP-3/5/6/7 decide |
| Conflict read/resolve ops live in dental-visit (not here); patient sync surface = sync-logs only | spine | prior "patient sync conflict UI" expectations belong to dental-visit round | scope note |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Patient record correctness is the root of every other module (billing contact, recalls, PMD identity) | domain-graph patient domain | GAP-1 (no edit) degrades every downstream workflow over time | P1 |
| PH cash-practice dispute ritual needs the FR2.21 statement artifact | PRD personas | GAP-2 | P1 |
| Households/insurance are future PH-market features (HMO penetration low for SMB clinics) | PRD §2.5 | Confirms park-leaning default for GAP-3/7 | decision |

## 18. Webwright / Playwright Findings

Not used this round — gap claims are statically conclusive (zero-consumer ops, absent components, silent-catch in source); wired surfaces were live-driven in prior audits and golden-path smoke (registration/search/archive all exercised). No new evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| `dental-patient.test.ts` (+ archived-guard block :1282-1350) | backend | CRUD, consent gate, RBAC 403s, archive FSM | High |
| `dental-patient-sync.test.ts`, `dental-patient-sync-isolation.test.ts` | backend | sync scoping, cross-org isolation (SL-01 pins) | High |
| `repos/dental-chart-baseline.lww.test.ts` | backend | SL-02 clock-aware LWW | High |
| `dental-patient-treatment-plan.test.ts`, `approveTreatmentPlan.test.ts`, `status-history.test.ts`, `treatment-option-group.test.ts` | backend | plan FSM, approval, options, history | High |
| `dental-patient-insurance.test.ts` | backend | claim-draft FSM, readiness | High (backend-only reach) |
| `dental-patient-recall.test.ts`, `recall-dates.test.ts` | backend | recall FSM, due routing | High |
| `communication-consent.test.ts` | backend | per-channel consent | High |
| `list-branch-isolation.test.ts` | backend/security | cross-branch exclusion | High |
| `dental-patient.hurl` (41 req) | contract | CRUD/consent/follow-up/statement/safety-floor/import/export/bulk/insurance | High |
| FE ~34 files (registration, list, profile, household card, plans, duplicates) | frontend | wired surfaces | Medium-High |
| E2E: patient-registration, recalls, consent journeys | E2E | core loops | High |
| Base `patient/patient.test.ts` unmerge assertion | backend | **stale (asserts 500 vs 501)** | Low |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Patient edit form: renders, saves, archived-patient disabled | frontend/component | GAP-1 RED-first | Before |
| Statement render: visits/procedures/payments/balance + print view | frontend/component | GAP-2 RED-first | Before |
| Comms-consent failed PATCH → visible error | frontend/component | GAP-4 RED-first | Before |
| Safety-floor equality pin (rendered floor == endpoint aggregate) | integration | GAP-8 drift pin | Anytime |
| Patient-create offline replay (if GAP-9 in scope) | backend | duplicate prevention | Before (after decision) |
| Fix stale unmerge 500→501 assertion | backend | GAP-10 known failing test | Anytime |
| TP-BR-006 plan-total validation | backend/unit | GAP-12 | During plan work |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Claims-vertical decision spans dental-patient insurance + dental-billing claims | product decision `[CROSS-MODULE RISK]` | GAP-3 + billing GAP-7 | Two half-built halves of one revenue-cycle feature | **One decision, one batch** — do not wire either side alone |
| `patients.hasActivePaymentPlan` flag maintained by billing | cross-module | EC1 archive guard | archive correctness | flag-sync pin (already noted in billing plan §21) |
| Safety floor consumed by workspace shell from med-history (clinical module) | cross-module | top bar | GAP-6/8 source-of-truth choice affects clinical + pmd merge | decide before wiring alerts |
| Offline localId pattern owned by offline-sync group | shared/platform `[SHARED DEPENDENCY]` | SL-01 precedent | GAP-9 must reuse, not reinvent | mirror `dental-invoice.schema.ts:52-54` |
| Erasure/anonymization handlers | cross-module | data-governance round | patient PII lifecycle | audited there |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Profile edit form (demographics + contact fields) | GAP-1 | P1 | V1 REQUIRED | FE-unit RED + E2E edit-save-reload | backend untouched |
| Statement printable view from profile | GAP-2 | P1 | V1 REQUIRED | FE-unit + print stylesheet | share print pattern with billing receipt (GAP-4 there) |
| Comms-consent error surfacing | GAP-4 | P2 | V1 REQUIRED | FE-unit | small |
| Confirm emergency-contact storage; wire contacts or park | GAP-5 | P2 | V1 RECOMMENDED | depends | confirm first |
| Safety-floor equality pin | GAP-8 | P3 | V1 RECOMMENDED | integration | quick |
| unmerge 501 assertion fix | GAP-10 | P3 | V1 RECOMMENDED | backend | trivial; clears known red |
| localId on patient create | GAP-9 | P2 | V1 RECOMMENDED (post-confirmation) | backend replay test | offline-sync coordination |
| Claims-vertical decision package (park labels OR full wire plan) | GAP-3 | P2 | `[NEEDS PRODUCT DECISION]` | decision-dependent | joint with billing |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Patient merge (BR-020) + merge-cascade design (WFG-007) | V2 DEFERRED | Spec-declared 501; cascade semantics undefined |
| Household write UIs | V2 DEFERRED (PRD §2.5) | Phase-2; reads suffice |
| Insurance/claims FE completion | V2 DEFERRED unless GAP-3 decision says finish | Phase-2 per PRD |
| Automated recall reminders | V2 DEFERRED | PRD Phase-2 (notifications round notes producer side) |
| Age-16 consent-transition prompt (EC9) | V2 DEFERRED `[NEEDS CONFIRMATION]` | Edge automation; manual consent update suffices for V1 |
| FTS index work for search | DO NOT ADD (unprompted) | Search meets <1s today; optimize only on evidence `[DO NOT OVERBUILD]` |
| New alert entity expansion | DO NOT ADD | GAP-6 dual-source must be resolved first |

## 24. Audit Decision

**PARTIAL PASS.**

The backbone is genuinely strong: registration with enforced consent, archive lifecycle with money guards, follow-up/recall loops, duplicate detection, plan FSM with approval records — all wired and heavily tested (42 backend files; prior P0 cross-tenant leaks verified fixed; the prior G4 archived-guard gap is confirmed CLOSED across all sub-resources, a stale matrix row).

It is not a PASS because two PRD-required V1 capabilities are undeliverable: patients **cannot be edited after registration** (GAP-1 — no UI for `updateDentalPatient` and no alternate path), and the FR2.21 itemized statement has no affordance (GAP-2). A silent-failure consent save (GAP-4) is a trust defect. The large orphan clusters (insurance, household, alerts) are phase/decision items, not defects — but they need explicit park-vs-finish rulings to stop accruing carrying cost.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Claims vertical — park or finish? (Joint with billing GAP-7; covers patient insurance sub-domain too) | `[NEEDS PRODUCT DECISION]` | ~14 orphan ops across 2 modules | Product |
| Q2: Is offline patient registration in V1 scope? (drives GAP-9 localId) | `[NEEDS CONFIRMATION]` | duplicate-patient risk on replay | Product/Eng |
| Q3: dental-alerts entity vs med-history floor — which is the alert source of truth? | `[NEEDS PRODUCT DECISION]` | GAP-6 dual-source | Product/Eng |
| Q4: Where is FR2.16 emergency contact stored today — person fields or the orphan contacts sub-domain? | `[NEEDS CONFIRMATION]` | GAP-5 shape | Eng |
| Q5: Households — park writes until Phase 2? | `[NEEDS PRODUCT DECISION]` | GAP-7 | Product |
| Q6: Patient photo capture (FR2.3) — implemented? | `[NEEDS CONFIRMATION]` | unverified this round | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-free):** GAP-1 (patient edit — top priority), GAP-2 (statement), GAP-4 (consent error surfacing), GAP-8 (pin), GAP-10 (stale test), GAP-12 (validation).
- **Likely batch shape:** Batch A = GAP-1 (profile edit form + E2E); Batch B = GAP-2 statement (coordinate print pattern with billing receipt batch); Batch C = GAP-4 + GAP-8 + GAP-10 (small trust/pin items); GAP-12 rides any plan-touching batch.
- **Blocked until decided:** GAP-3 (Q1 — joint with billing), GAP-5 (Q4), GAP-6 (Q3), GAP-7 (Q5), GAP-9 (Q2).
- **Must NOT implement:** merge/cascade, household writes, reminder automation, FTS optimization, alert-entity expansion.
- **Tests first:** edit-form FE RED; statement FE RED; consent-failure FE RED.
- **Cross-module:** claims decision must bundle billing GAP-7 + patient GAP-3; statement print pattern shared with billing receipts; archived-guard class is CLOSED — tell organizer to drop stale G4 rows from any inherited backlog.
- **Do not re-litigate:** SL-01/02/09/12 fixes, archived-write guards, branch isolation, plan FSM/approval — all source-verified this round.

---

Next recommended step:
Module/group: Dental Patient
Module slug: dental-patient
Primary PRD/spec: docs/prd/v3-dentalemon.md §6.2 + docs/product/modules/dental-patient/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-patient-gap-plan.md
