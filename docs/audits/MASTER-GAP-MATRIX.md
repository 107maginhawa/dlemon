# MASTER GAP MATRIX — dentalemon module gap-plans

**Compiled:** 2026-06-09 · **Branch:** `chore/workflow-verification-sweep` @ `e49e411d`
**Source:** 19 module gap-plans in `docs/audits/module-gap-plans/` (each: live `/webwright` drive and/or static FE↔BE wiring map + per-gap test plan + KG/contract-spine validation pass).
**Wiring oracle:** `.understand-anything/contract-spine.json` (regenerated 2026-06-09 12:24, operationId → handler → SDK → FE-consumer; 357 ops / 135 FE-consumer files). The full node `knowledge-graph.json` is type-import-edge stale (baseline `1196799b`, 2026-06-06) — **not regenerated** (FULL_UPDATE class, ~12M tok / poor ROI; the type drift does not touch FE→BE wiring). Every wiring claim below was ground-truthed in the source plans, not read off the stale node graph.
**Status:** consolidation. **Batch 1 IMPLEMENTED 2026-06-09** (see §8). **Batch 2 IMPLEMENTED 2026-06-09** (see §9). **Batch 3 IMPLEMENTED 2026-06-09** (see §10). **Batch 4 IMPLEMENTED 2026-06-09** (see §11 — split-brain config). Batch 5+ not started.

> **Batch 1 — Core-workflow & security blockers — DONE (2026-06-09).** dental-patient **G1** (P0 sync-log cross-tenant leak), case-presentation **G1** (P0 broken accept), **G3** (approval-path convergence), **G2** (seed) all fixed + proven (backend unit + contract against the live server + live browser drive). A latent **FE blocker (case-presentation FE-1)** was discovered and fixed during live verification: the workspace route had no `<Outlet/>`, so the nested `/case-presentation/$presentationId` route never rendered — the patient-facing view was unreachable and accept could never complete from the UI. Full present→e-sign→accept now works end-to-end live. Details in §8.

---

## 1. Executive Summary

Across 19 modules: **1 FAIL** (case-presentation — core accept workflow broken end-to-end), **18 PARTIAL PASS**. Total gaps catalogued: **2 P0, 36 P1, 47 P2, 41 P3** (≈126).

The backends are consistently strong (RBAC via `assertBranchRole`, FSMs, audit, well-tested). **Almost every gap is one of seven recurring shapes**, not isolated defects:

1. **Built-backend / zero-FE-consumer ("orphan endpoint")** — the dominant class. Whole verticals (insurance/claims, occlusion/postop/inventory, audit viewer, PMD viewer, erasure UI, legal-hold UI, retention policy UI, notif inbox, EMR, provider, bulk import) are tested + SDK-wired but unreachable in product.
2. **Dead trigger** — sheet mounted + handler passed, but no button renders (`dental-clinical` Lab Orders `onLab`; `dental-pmd` viewer `onPmd` — explicitly "the same dead-prop class").
3. **Saved-but-not-enforced config (split-brain)** — UI writes a settings blob nothing consumes (working hours, fee schedule, permission grid, notification settings, retention policies).
4. **Cross-tenant / tenancy leak** — the only true security class (`dental-patient` sync-log **P0**; erasure no-tenant-gate; EMR admin-sees-all; legal-hold by-design cross-tenant).
5. **Contract / wire-shape drift** — bare-array vs `{data,pagination}`, numeric-string vs `float64`, declared-but-absent fields, `user`-vs-`admin` role drift.
6. **Audit write-coverage / reliability gaps** — sensitive mutations unaudited or audited best-effort/non-atomic.
7. **Two sources of truth** — claims (patient vs billing), clinical notes (EMR vs visit), provider (Provider/Practitioner vs memberships), approval (two paths), audit (3 sinks).

**Genuinely blocking for V1:** the 2 P0s (`dental-patient` G1 sync-log leak; `case-presentation` G1 broken accept) and the compliance-write reliability gap (`dental-audit` P1-C). Most P1s are "honest-affordance / wire-the-built-backend" work that is low-risk but voluminous. A large fraction of P1/P2 is **gated on product `[NEEDS CONFIRMATION]` decisions** (wire-vs-remove, enforce-vs-relabel, who-can-erase, is-EMR-in-scope) — see §6; those cannot start until decided.

**Recommended first batch:** Batch 1 (the two P0s + their tightly-coupled fixes) — confirmed bugs, no product decision required. See §5.

---

## 2. Consolidated Gap Matrix

> Severity as assigned in each source plan. "Blast radius" = modules/seams touched. IDs are the source-plan IDs.
> `[NC]` = blocked on a `[NEEDS CONFIRMATION]` decision (see §6). `[xmod]` = cross-module fix.

### P0 — blocks safe V1

| Pri | Module | ID | Gap | Blast radius | Recommended fix | Required tests |
|---|---|---|---|---|---|---|
| ✅P0 | dental-patient | G1 | **FIXED 2026-06-09.** `listSyncLogs` now requires `branchId` (400 if absent), asserts caller access, and scopes via `findAll(branchIds)`; `createSyncLog` requires `branchId` (400) + authorizes unconditionally; `updateSyncLog` authorizes unconditionally (branchless row → 403). | self-contained (sync repo/handlers + shared branch-access helper); `listSyncLogs` has 1 FE consumer (`use-sync-status.ts`, already sends branchId) | scope `findAll(scope)` to caller's branch(es); require `branchId` on create/update | **DONE**: `dental-patient-sync-isolation.test.ts` (unit `findAll([])`/`findAll([A])` filter; 2-org integration: B sees 0 of A; B→A 403; list/create branchless→400). Existing sync test updated to new contract. Smoke extension deferred (P3). |
| ✅P0 | case-presentation | G1 | **FIXED 2026-06-09.** `updateTreatmentPlan` now links pending treatments at the `presented` transition (mirrors `approveTreatmentPlan`); `acceptCasePresentation` also links before resolving the consent anchor. Aggregate is non-empty, accept returns 200. **Also fixed FE-1** (no `<Outlet/>` in workspace route → CP view never rendered). | `[xmod]` dental-visit facade, dental-patient treatment-plans; FE workspace route | link pending treatments at the `presented` transition | **DONE**: `case-presentation-real-flow.test.ts` (normal flow: unlinked treatments → present → aggregate `grandTotalCents>0`/`phases>0`; accept 200). Contract `dental-treatment-coordinator.hurl` extended (create visit+treatments → present links → aggregate non-empty → accept 200, plan approved). Live browser: present→₱95,000 renders→e-sign→accept 200. Regression: 51 treatment-plan/case-pres tests green. |

### P1 — fix before production

| Pri | Module | ID | Gap | Blast radius | Recommended fix | Required tests |
|---|---|---|---|---|---|---|
| ✅P1 | case-presentation | G3 | **FIXED 2026-06-09.** `acceptCasePresentation` now links pending treatments AND writes a `TreatmentPlanApproval` record (method `signature`, approver = patient's person, consentFormId), converging it with `approveTreatmentPlan`. | `[xmod]` dental-patient treatment-plans, dental-clinical consent facade | converge accept onto the shared link+approval-record logic | **DONE**: `case-presentation-real-flow.test.ts` asserts after accept the plan has linked items **and** exactly one approval record (`method==='signature'`). |
| ✅P1 | case-presentation | G2 | **FIXED 2026-06-09.** `seed-supplement.ts` seeds 4 plans across the FSM (draft/presented/accepted/rejected) with **linked** items + an alternate option group + a draft case-presentation for the patient-facing ones. (Hit + fixed the `detUuid` collision gotcha: explicit ids on near-identical seed strings dropped items via `onConflictDoNothing` → use `defaultRandom()`.) | seed | seed plans across FSM + alternate option group | **DONE**: reseed verified — presented ₱95,000/4 items, accepted ₱24,000/2, rejected ₱42,000/1, draft ₱5,000/1. Live: "Present to patient" renders for Maria Santos. (Annotated-image seed = G4 P3, deferred.) |
| P1 | dental-clinical | G1 | Lab Orders sheet unreachable — `LabOrdersSheet` mounted + `onLab` passed but **no Lab button** in `WorkspaceTopBar`; backend FSM complete+tested. Masked by API-only false-green E2E | dental-clinical FE only (`lib/rbac.ts`, org-context) | render one `Lab orders` IconButton wired to existing `onLab` | FE-unit: button exists+fires `onLab` (RED today); **real UI E2E** opening sheet + FSM advance; relabel `lab-order-tracking.spec.ts`→`*-api` |
| P1 | dental-clinical | G3 | Consent cannot be revoked; history/refusals invisible (`revokeConsentForm`/`listConsentRefusals` 0 consumers; `listConsentForms` only a completion gate) | `[xmod]` consent-billing + case-presentation-consent facades read consent state | consent-history view + Revoke on pending forms | FE-unit revoke pending→revoked, signed→no-revoke; hurl revoke+refusals; **integration: revoke ⇏ invalidate accepted case-presentation/billed work** |
| P1 | dental-clinical | G4 | Rx list + dispense/cancel not surfaced (`listPrescriptions`/`updatePrescription` 0 consumers) | self-contained | prescriptions list + dispense/cancel actions | FE-unit list renders; dispense/cancel; invalid→422 |
| P1 | dental-clinical | G2 | Occlusion screening zero FE `[NC]` | self-contained (after G10) | wire surface or formally defer | FE-unit + contract (after list-shape G10) |
| P1 | dental-patient | G2 | Insurance+claims vertical entirely unwired; **two claim subsystems** (dead dental-patient vertical vs live dental-billing `ClaimsWorklist`); dead hooks `use-insurance-claims.ts:155-223` `[NC][xmod]` | dental-patient ↔ dental-billing ↔ imaging (attachments) | decide single source of truth → wire or delete dead vertical | E2E insurance→claim chain (if wire) / dead-hook deletion (if remove) |
| P1 | dental-patient | G3 | Communication consent write-only, fire-and-forget (`.catch(()=>{})`), never read back, never enforced `[NC][xmod]` | notifs + comms (enforce), person JSONB | make write blocking/server-side; read back; decide send-time enforcement | FE-unit failure surfaced; read-back render; integration consent=false blocks send (if enforce) |
| P1 | dental-patient | G4 | Archived-write guard missing on insurance/contacts/alerts/tasks (`PATIENT_ARCHIVED`) | in-module | mirror existing guard | 4× integration archived-write→403 (RED) |
| ✅P1 | dental-patient | G5 | **FIXED 2026-06-09 (Batch 2).** Added audit-row assertions: `approveTreatmentPlan` (writes `treatment_plan.approved` + before/after status), `updateClaimStatus` (now writes `claim.status_changed` + before/after), consent change (characterization pin on `patient.communication_consent.updated`). | `[xmod]` dental-audit (= P1-B/P2-D) | backfill audit-row assertions | **DONE** in `approveTreatmentPlan.test.ts`, `dental-patient-insurance.test.ts`, `communication-consent.test.ts` |
| P1 | dental-billing | BIL-G1 | No discount-apply UI (`applyDentalDiscount` owner-only/reason-required, 0 consumers); V1-Required §8.4 | dental-org (role) + audit | wire reason-required owner-only POST in invoice footer | FE-unit visible owner+writable, reason-required; E2E 10% discount; non-owner hidden |
| P1 | dental-billing | BIL-G2 | Insurance/HMO revenue cycle unreachable E2E — worklist renders but **no create-claim affordance**; `create/addLine/updateLine/getInsuranceClaim`+`estimateClaimCoverage` unwired `[NC][xmod]` | dental-patient insurance, dental-visit | wire create-claim (+lines, +coverage estimate, +detail) | E2E create→submit→remittance; FE-unit ≥1 line required; coverage estimate |
| ✅P1 | dental-org | G1 | **FIXED 2026-06-09 (Batch 4, §11).** FE Working Hours repointed from the settings blob to the enforced `dental_branch.working_hours` column (new `use-working-hours.ts`); FE `{open,start,end}` ↔ column `{enabled,open,close}` reconciled via `working-hours.logic.ts` (10 unit tests). Root TypeSpec drift (`DentalWorkingHoursDay` was `{open,close,isOpen}`) fixed; seed populates the column. | `[xmod]` dental-scheduling (= SCH-G3) + seed | reconcile shape FIRST, then point UI at column + seed | **DONE**: shape-conformance unit; FE save→column mutation; backend enforcement 16/0 (incl. walk-in bypass); contract GET-after-PUT; seed populated |
| ✅P1 | dental-org | G2 | **FIXED 2026-06-09 (Batch 4, §11).** Dedicated `get/updateFeeScheduleEntry` endpoints are canonical; FE rebuilt catalog-driven (new `use-fee-schedule.ts`, saves per-CDT PATCH — retired the inert blob save). `priceCents` made optional (spec→regen); `createDentalTreatment` defaults it from the fee schedule via shared `resolveFeeCents` (override ?? catalog default ?? 0) — **closes AC-ORG-002**. Global CDT catalog (never seeded → endpoints inert) now seeded on boot. | dental-visit/treatments, dental-billing | pick canonical store; drive price defaults; seed catalog | **DONE**: `resolveFeeCents` unit (5); `dental-treatment.fee-default` integration (3); `dental-visit.hurl §8a/b/c` fee→default; FE interaction (3); `fee-schedule.spec.ts` E2E |
| ✅P1 | dental-org | G3 | **FIXED 2026-06-09 (Batch 4, §11, decision #4 = REMOVE).** The unenforced Permissions tab + `permission-grid.tsx`/`.test.ts`/`use-permissions.ts` deleted; coarse `assertBranchRole` (109 files) remains the gate. Backend grid endpoints left as harmless orphans. | remove path = FE only | remove the tab | **DONE**: tab-absent; no FE route existed (tab-only) so no orphan-route guard needed |
| P1 | dental-scheduling | SCH-G1 | No appointment cancellation anywhere in FE (`cancelAppointment` DELETE reason-required, 0 consumers); cancelled styling unreachable | `[xmod]` dental-visit (BR-004 cancel ⇏ delete linked visit) | wire reason-required DELETE in calendar/modal actions menu | FE-unit cancel→reason→DELETE→cancelled; blank-reason blocked; E2E cancel→visit still reachable; RBAC-hidden |
| P1 | dental-scheduling | SCH-G3 | (= dental-org G1) working-hours enforcement seam; proof E2E lives here | `[xmod]` dental-org | single source of truth = column | shared with dental-org G1 |
| P1 | dental-visit | G1 | Carry-over has no FE trigger (`carryOverTreatments` 0 consumers); "Carried Over" subtotal only renders from seed `[NC]` | reports (listDentalTreatments/Visits readers) | wire `POST /carry-over` affordance OR remove dead UI | FE-unit carry-over populates from response; E2E; read-path regression |
| P1 | dental-perio | P1-1 | Periodontal diagnosis (Stage/Grade/Extent) computed at completion but **not persisted** → vanishes on reopen; survives only in audit metadata | self-contained perio (+ SDK regen additive) | add 3 nullable columns + 3 optional `PerioChart` fields (reuse enums) + persist in `complete()` | backend complete→GET round-trip (RED); FE reopen-from-`chart.*`; hurl post-complete GET |
| P1 | dental-imaging | IMG-P1-1 | AI "Auto-detect landmarks" upsell contradicts documented no-AI non-goal; backend is a FakeDetector behind addon `[NC]` | imaging FE + addon gate | product decision: remove or guarantee real detector | decision-dependent FE/backend test |
| ✅P1 | dental-audit | P1-C | **FIXED 2026-06-09 (Batch 2); residual closed 2026-06-10 (SL-05).** Added a per-call `failClosed` opt to `logAuditEvent` (surgical — default fire-and-forget for the other ~70 producers unchanged; NO global flip). Set `failClosed:true` on **payment**-void/discount/payment/visit-complete/role-change → an audit-sink failure now surfaces a 5xx instead of a silent committed-without-audit gap. **Correction (E-NEW-02):** Batch 2 missed the **invoice**-void path (`voidDentalInvoice.ts`) — it stayed fire-and-forget until SL-05 added `failClosed` + before/after + reason there too (`audit-write-reliability.test.ts` invoice-void cases, RED-before). | `[xmod]` all producer handlers (roll out per-handler) | move `logAuditEvent` inside tx OR fail-closed for void/discount/payment/visit-complete/role-change | **DONE**: `audit-write-reliability.test.ts` (spyOn the audit insert → payment-void AND invoice-void return 5xx, RED-before) + `updateMember.test.ts` (role-change 5xx). |
| ✅P1 | dental-audit | P1-B | **FIXED 2026-06-09 (Batch 2).** Added `logAuditEvent` to the previously-unaudited sensitive actions: `updateMember` role change (`membership.role_change`), `approveTreatmentPlan` (`treatment_plan.approved`), `acceptCasePresentation` (`case_presentation.accepted`), `signVisitNotes` (`visit_note.signed`), `createVisitNoteAddendum` (`visit_note.amended`). | `[xmod]` dental-org, dental-patient, dental-visit | add `logAuditEvent` to those handlers | **DONE**: per-handler audit-row assertions in `updateMember.test.ts`, `approveTreatmentPlan.test.ts`, `case-presentation-real-flow.test.ts`, `visit-notes-audit.test.ts`. |
| P1 | dental-audit | P1-A | No frontend audit-log viewer (`getAuditEvents` + hooks generated, 0 callers; WF-028 V1-Required) | new `features/audit/` + org-context | build owner-gated viewer (after P1-C/P1-B make trail trustworthy) | FE-unit table+filters; **E2E-AUD-001** owner filters `invoice.voided`→sees seeded event; non-owner denied; seed audit rows |
| P1 | dental-pmd | P1-3 | PMD Viewer + Import UI unreachable (dead `onPmd`, same class as Lab `onLab`) | dental-pmd FE | render PMD IconButton→`onPmd` | real-button E2E (RED until button) reaching Import |
| P1 | dental-pmd | P1-1 | Generated PMD omits mandatory Safety Floor (allergies/conditions) + demographics `[NC]` | `[xmod]` dental-clinical med-history, dental-patient | route generate through `buildCareRecordBundle` + safety/demographic slices | schema + required-section assertions |
| P1 | dental-pmd | P1-2 | PMD never digitally signed; co-located checksum misrepresented as non-repudiation | dental-org (custodian key) | implement JWS/ES256 signing; `generated→signed`; verify on import; remove misleading comments | sign/verify/tamper round-trip |
| P1 | dental-pmd | P1-4 | Imported PMDs no clinical effect (`markSafetyFloorMerged` never called) | dental-patient safety floor | run add-only safety-floor merge on import | import allergy → visible in safety floor; flag flips |
| P1 | dental-pmd | P1-5 | Per-visit PMD not a FHIR R4 Bundle (bespoke JSON) `[NC]` | reuse `buildCareRecordBundle` | make PMD a `Bundle(type=document)` | schema validation against `pmd-bundle.schema.json` |
| P1 | dental-portal | — | No patient onboarding/account-linking path — 100% of real patients get 403 `[NC][xmod]` | identity/auth + dental-patient | add invite-to-portal or self-claim+staff-link | backend: link user↔person makes `/me/*` 200; unlinked still 403; permission test |
| P1 | dental-portal | — | No patient entry point (user-role sign-in → staff onboarding, never `/portal`) | routing/guards | post-login branch: linked patient → `/portal` | route test patient→portal, staff→dashboard |
| P1 | dental-portal | — | No seed patient-portal account → undemoable/un-E2E-able | seed | seed one patient with `person.id===user.id` + appts + mixed invoices | seed-coherence assertion |
| P1 | dental-erasure | ER-P1-1 | No tenant/ownership validation — `tenantId` from body unchecked; `listErasureRequests` returns all tenants' PII; anonymize keyed only on `personId` | `[xmod]` person/patient/clinical/imaging facades | resolve subject→tenant; enforce actor membership; default list to caller's tenant; reject mismatched body tenantId | RED: cross-tenant list/approve blocked; hurl cross-tenant scenario |
| P1 | dental-erasure | ER-P1-2 | No operable workflow — zero frontend (GDPR/RA-10173 right-to-erasure undeliverable) `[NC]` | new FE | build admin/owner erasure UI | FE-unit; E2E request→approve→anonymized→audit |
| P1 | dental-erasure | ER-P1-3 | Data controller cannot act — only 3 hardcoded platform emails can erase `[NC]` | dental-org/Better-Auth roles | decide who may erase (likely `dentist_owner` per-tenant) | RBAC tests per decision |
| P1 | dental-legalhold | — | No operator UI (place/list/release only via raw API) `[NC]` | new FE | build Settings→Compliance→Legal Holds (if MVP) | FE-unit; E2E place→erasure blocked→release→proceeds |
| P1 | retention | G1 | No operator surface to view/edit retention policies (raw SQL only) despite "review per jurisdiction" requirement `[NC][xmod]` | new `dental-*` HTTP module calling lib | `GET/PATCH /dental/retention-policies` + admin settings screen | contract GET/PATCH admin-only (RED); FE-unit |
| ✅P1 | retention | G2 | **FIXED 2026-06-09 (Batch 4, §11).** `summarizeRetentionEnforcement(db, tenantId?)` (`retention-status.ts`) derives operator-visible enforcement status from the `retention.*` compliance audit events: `lastRunAt`, `lastRunMode` (`enforced`/`dry-run`/`null`), `runsObserved`, last-run `eligible`/`actioned` counts, + live `enforcementEnabled` env posture. Reads the audit log via a new boundary-clean `dental-audit/audit-query.facade.ts`. Go-live attestation documented in the README. (Admin UI = G1, deferred.) | reads audit events (via facade) | surface last-run + dry-run/live status; go-live attestation | **DONE**: `retention-status.test.ts` (5) — never-run/dry-run/enforced/env-posture/tenant-scope reflect seeded audit rows |
| P1 | emr-consultation | G1 | Entire frontend absent (WF-EMRC-001..006 unreachable); docs claim `implemented` `[NC]` | scope decision | keep+build / dormant-relabel / remove | path-dependent FE/E2E |
| P1 | emr-consultation | G2 | Dual source of clinical-note truth (`consultation_note` vs dental-visit/clinical) | dental-visit/clinical | designate canonical encounter; scope EMR to telemedicine or retire | doc/MODULE_MAP |
| P1 | emr-consultation | G3 | Admin sees ALL consultation notes, no tenant scoping (cross-clinic PHI if exposed) `[NC]` | RBAC | scope admin reads to caller's clinic | cross-tenant isolation test |
| P1 | external-records-import | G1 | Bulk patient import orphan endpoint (`POST /dental/patients/import` 0 FE consumers; FR7.2 unreachable) `[NC][xmod]` | dental-patient (owns handler) | wire owner-only import surface OR mark dormant | FE-unit + E2E + contract walker |
| P1 | external-records-import | G2 | No server-side row cap on bulk import (DoS-class, unbounded memory + long tx) `[NC]` | dental-patient handler | `MAX_IMPORT_ROWS` → 422 `IMPORT_TOO_LARGE` | cap+1 rows → 422, 0 written (RED) |
| P1 | notifs | G1 | No in-app notification UI (4 endpoints + hooks, 0 consumers; rows created, never surfaced) | app shell FE | build bell + inbox + `/notifications` route | FE-unit list(unread)+markRead+badge |
| ✅P1 | notifs | G2 | **FIXED 2026-06-09 (Batch 4, §11, decision #8 = RELABEL).** `notification-settings.tsx` relabelled as clinic DEFAULTS with a `NOTIFICATION_CONSENT_NOTICE` banner pointing to the real enforced gate — per-patient `PersonConsent` on the profile. No new cross-module send-gate (PersonConsent is the gate). | scheduling/patient/billing producers | relabel panel; surface per-patient consent | **DONE**: FE relabel + consent-notice render (Batch-4 slice 3, commit `8a1fe498`) |
| P1 | provider | G1 | Duplicate/competing source of truth (`Provider`/`Practitioner` vs canonical `dentalMemberships`) `[NC]` | EMR (only consumer of Provider facade) | deprecate (recommended) or productize | EMR authz on memberships; deprecation regression |
| P1 | provider | G2 | `createProvider` (role `user`) grants global role + **revokes caller session** — conflicts with org-membership/PIN model | auth | remove/admin-gate, drop session-revoke | handler test pinning chosen behavior |

### P2 — recommended before production

| Pri | Module | ID | Gap | Recommended fix | Required tests |
|---|---|---|---|---|---|
| P2 | dental-clinical | G5 | Amendments write-only (no list/approve; `approveAmendment` 501 BR-019) | amendment list on record; keep approval deferred | FE-unit list renders; approve hidden while flag false |
| P2 | dental-clinical | G6 | Post-op templates zero FE `[NC]` | manager under settings + attach affordance, or defer | FE-unit + contract |
| P2 | dental-clinical | G7 | Inventory/materials zero FE `[NC]` | inventory screen, or defer | FE-unit + contract |
| P2 | dental-patient | G6 | Validator-bypass test-hygiene (downgraded from P1 — no prod drift) | re-mount generated validator in tests; delete stale comment | contract via generated validator |
| P2 | dental-patient | G7 | No demographics-edit journey (`updateDentalPatient` unwired) `[NC]` | edit modal | FE-unit + contract + role guard |
| P2 | dental-patient | G8 | Alerts/contacts/tasks full backend, no FE (guardian for minors PAT-BR-002) `[NC]` | wire surfaces | FE-unit per surface |
| P2 | dental-patient | G9 | Treatment-plan approval/versions/appointment-link unwired `[NC]` | wire | FE-unit |
| P2 | dental-patient | G10 | Household create/edit unwired; `removeHouseholdMember` hard-deletes | wire card + consider soft-delete | FE-unit |
| P2 | dental-patient | G11 | Statement/safety-floor/conditions/visits/import unwired | wire statement + import entry | FE-unit |
| P2 | dental-patient | G12 | BR gaps: plan total≠Σitems (TP-BR-006); claim readiness missing provider/date/tooth (CLAIM-BR-001); TP-BR-004 | fix logic | unit pins |
| P2 | dental-billing | BIL-G3 | No payment void/refund UI (`voidDentalPayment` owner-only, 0 consumers) | void/refund on payments sub-table | FE-unit + E2E reverse + voided receipt viewable |
| P2 | dental-billing | BIL-G4 | No payment-plan create/update UI (only view wired) | Create Payment Plan (2–24 installments) | FE-unit + E2E; reject <2/>24 |
| P2 | dental-billing | BIL-G5 | No printable receipt (`getDentalPaymentReceipt` 0 consumers; V1-Required §8.4) | receipt action per payment | FE-unit + E2E printable view |
| P2 | dental-billing | BIL-G6 | Duplicate balance source of truth (client sum vs `getPatientBalance`) | consolidate or assert equality | FE-unit client sum == endpoint |
| P2 | dental-org | G4 | Staff `invited` state divergence (PRD invite flow vs direct PIN-staff) `[NC]` | doc-reconcile or build invite | contract MemberStatus enum; or invite E2E |
| P2 | dental-org | G5 | No post-creation staff edit (`updateMember` 0 consumers; license/NPI uncapturable) | staff edit modal | FE-unit edit/role/NPI; contract round-trip |
| P2 | dental-org | G6 | Consent-template management no UI; `consent-sheet` uses hardcoded const not `listConsentTemplates` | wire CRUD + picker | FE-unit + contract |
| P2 | dental-org | G7 | No multi-branch create/switcher (`getBranchesByUser`/`createBranch` 0 consumers) | branch list + create + switch | FE-unit + contract |
| P2 | dental-scheduling | SCH-G2 | No "mark no-show" (FSM supports; `updateAppointment` already wired — pure affordance) | add to G1 actions menu | FE-unit/E2E status→no_show; checked-in guard |
| P2 | dental-scheduling | SCH-G4 | Chairside queue no enqueue path (`createQueueItem` 0 consumers) | "Send to queue" from check-in/walk-in | FE-unit/E2E + branch-scope contract |
| P2 | dental-scheduling | SCH-G5 | Waitlist fully unwired (`create/list/promoteWaitlistEntry`) | "Join waitlist" + staff FIFO panel | FE-unit/E2E + FIFO contract |
| P2 | dental-scheduling | SCH-G6 | Online-booking confirmation lookup unwired (`getOnlineBooking`) | confirmation-code lookup | FE-unit lookup + not-found |
| P2 | dental-visit | G2 | Accepted treatment-plan version not viewable (`getTreatmentPlanVersion` 0 consumers) `[NC][xmod dental-patient]` | read-only version viewer | FE-unit snapshot render; extend J09 |
| P2 | dental-visit | G3 | Treatment templates built+seeded, zero FE | "Apply template" + manage screen, or defer+remove seed | FE-unit apply→treatments; E2E; read-path regression |
| ✅P2 | dental-perio | P2-1 | **FIXED 2026-06-09 (Batch 3).** `getPerioChart` + `getVisitPerioChart` now coerce `summaryBopPercent`/`summaryMeanDepth` with `numOrNull` (mirrors `listPerioChartsForPatient`), so completed-chart summaries return JSON floats matching the declared `float64` contract. | mirror `numOrNull` in `getPerioChart`/`getVisitPerioChart` | **DONE (backend + contract):** `dental-perio-coverage.test.ts` (2 RED-before tests: both single-GETs `typeof === 'number'` for a completed chart); `dental-perio.hurl` §7b (single-GET-after-complete `isFloat` on both). FE string-shape render deferred (P1 regression guard; backend coercion is the single-source fix). |
| P2 | dental-perio | P2-2 | Risk-factor inputs not persisted → Grade not explainable/correctable | persist risk factors (JSONB/columns) | backend risk-factor round-trip + grade linkage |
| P2 | dental-imaging | IMG-P2-1 | Persisted superimposition unreachable (`SuperimpositionPanel` not mounted in prod overlay) | mount panel + wire persist/list | FE + contract persist/list |
| P2 | dental-imaging | IMG-P2-2 | CBCT chain only on test-harness route (`finalizeCbctStudy` never called in prod) `[NC]` | wire finalize into real upload; prod-overlay E2E | prod-overlay E2E + contract finalize |
| P2 | dental-imaging | IMG-P2-3 | Auto-detect 403 retried 3× (long misleading spinner) | `retry:false` on 4xx + proactive gating | FE-unit retry off; immediate upsell error |
| ✅P2 | dental-audit | P2-A | **FIXED 2026-06-09 (Batch 2).** Populated sanitized before/after + `reason` on void (isVoid + voidReason), discount (totals + reason), role-change (before/after role), claim-status (before/after status), visit-complete (before/after status). Sanitization is at the repo choke point. | capture pre-state; write snapshots+reason | **DONE**: before/after+reason asserted in `audit-write-reliability.test.ts` + the P1-B per-handler tests. |
| P2 | dental-audit | P2-B | Fragmented audit sinks (3); base-module PHI-access events invisible to viewer | consolidate to one authoritative sink | PHI read appears in `getAuditEvents` |
| P2 | dental-audit | P2-C | `read_only`/auditor role cannot read log `[NC]` | widen or document owner-only | RBAC allow/deny per decision |
| P2 | dental-audit | P2-D | Producer-side audit-row test gaps (= dental-patient G5) | per-producer assertions | (shared) |
| P2 | dental-pmd | P2-6 | `exportPatientCareRecord` (FHIR continuity) no FE trigger | wire export button | FE button calls endpoint |
| P2 | dental-pmd | P2-7 | `listImportedPmds`/`getImportedPmd` no FE | imported-PMD list/detail | FE list/detail |
| P2 | dental-pmd | P2-8 | "Share PMD" delivers only checksum text; silent no-op on desktop | real file/SHL export + honest no-op | FE share artifact |
| P2 | dental-pmd | P2-9 | No multi-PMD reader (dedup/conflict/trust-tier) | reader module (staged) | reader tests |
| P2 | dental-portal | — | No E2E journey; contract has no 200/own-data; overdue trusts `status` `[NC]` | E2E + contract 200 + overdue-by-dueDate pin | (listed) |
| ✅P2 | dental-erasure | ER-P2-1 | **FIXED 2026-06-09 (Batch 3).** `listErasureRequestsHandler` now returns `{ data: rows }` (was a bare array), conforming to the already-declared `ErasureRequestList = { data }` contract. No spec change needed (impl was violating the spec). | flip hurl to `$.data[0]` (RED) → `{data:rows}` | **DONE:** `dental-erasure.hurl` all 5 list scenarios flipped `$`/`$[0]` → `$.data`/`$.data[0]` (RED-before); `erasure-routes.test.ts` asserts `body.data` envelope. ER-P3-1 role-annotation drift left out of scope (independent P3, not required to complete ER-P2-1). |
| P2 | dental-erasure | ER-P2-2 | No tenant-isolation tests | RED-first cross-tenant tests | backend + hurl |
| P2 | dental-legalhold | — | RBAC contract drift (tsp `user` vs handler `admin`); list unbounded/un-enveloped | tsp→`admin` + regen; pagination; filter tests | spec-vs-handler role guard; filter narrows |
| P2 | retention | G3 | clinical/visit/prescription retention declared but unenforceable (no target) `[NC]` | per-domain `*-retention.facade` + register | per-target eligibility + legal-hold exclusion |
| P2 | retention | G4 | No E2E of live (enforcement-ON) cron→engine→facade→DB chain | `dryRun:false` real-registry integration | assert `deletedAt` set + held row untouched |
| P2 | emr-consultation | G4 | `getConsultation` adversarial RBAC untested | cross-provider/patient read 403 tests | 2 RBAC tests |
| P2 | emr-consultation | G5 | Carrying cost of unreachable tested code | tied to G1 decision | — |
| ✅P2 | external-records-import | G3 | **FIXED 2026-06-09 (Batch 3).** `parseCSV` in `importPatients.ts` replaced with an RFC-4180-aware char-scanning tokenizer (quoted fields, escaped `""`, embedded commas/newlines). | RFC-4180 parse | **DONE:** `dental-patient.bulk-import.test.ts` — RED-before test imports `"dela Cruz, Jr."` + `"O""Brien, Sr."`; before fix the column-shift made branchId an invalid UUID → 500; after fix both lastNames round-trip intact (201). |
| P2 | external-records-import | G4 | `ui-prototype` stale namespace (`/api/dental-emr/imports`) | reconcile to `/dental/emr-import` | doc-only |
| P2 | external-records-import | G5 | Module identity fragmented; tracker "partial FE" misleads | document 3-artifact boundary; fix FE tag | doc-only |
| P2 | external-records-import | G6 | No FE/E2E/contract-walker for bulk import; `{success,...}` envelope un-asserted | add on G1 build | contract walker |
| P2 | notifs | G3 | Push no opt-in UX (`requestNotificationPermission`/click handler never called) | wire prompt + click deep-link | FE prompt + handler |
| ✅P2 | notifs | G4 | **FIXED 2026-06-09 (Batch 3) — DROPPED from TypeSpec** (smaller safe change). The `notification` table (snapshot 0091) has no `delivered_at` column, `NotificationResponse` never returned it, and no delivery path produces a delivery timestamp — the `delivered` *status* already represents delivery state. Removed `deliveredAt` from `model Notification` (notifs.tsp) + regen; also removed the dead `deliveredAt: new Date()` from `notification.repo.ts` (push path, wrote to a non-existent column under `as any`). | add column+populate or drop from tsp | **DONE:** OpenAPI/SDK `Notification` no longer declares `deliveredAt` (verified 0; the remaining `deliveredAt` is the unrelated `LabOrder` FSM field); `notifs.test.ts` asserts `'deliveredAt' in body === false`. |
| P2 | provider | G3/G4/G5/G6 | No FE; phantom RBAC roles; empty seed; handler test gaps | per chosen path (deprecate/productize) | per path |

### P3 — polish / deferred (do NOT fix unless required by a P0/P1)

| Module | ID | Gap |
|---|---|---|
| dental-clinical | G8 | Medical-history review-history not surfaced (needs new endpoint) |
| dental-clinical | G9 | Notes/Medical-History FE affordances not role-gated (backend is real gate) |
| dental-clinical | G10 | ✅ **FIXED 2026-06-09 (Batch 3).** Spec-first: the 4 list ops (`listOcclusionScreenings`, `listPostopTemplates`, `listInventoryItems`, `listInventoryAdjustments`) changed in `dental-clinical-ops.tsp` from `ApiOkResponse<T[]>` → `ApiOkResponse<PaginatedResponse<T>>` (regen routes/validators/SDK), handlers now return `{data,pagination}` via `parsePagination`/`buildPaginationMeta`. Backend tests (occlusion/postop/inventory) updated to the envelope (RED→GREEN). Zero FE consumers, so no FE change. Unblocks G2/G6/G7 wiring. |
| dental-patient | G13/G14/G15/G16/G17 | raw fetch in `patients.tsx`; list-shape inconsistency; base `patient/deletePatient` hard-delete `[NC]`; merge doc wording (corrected); J15 sync-badge assertions |
| dental-billing | BIL-G7/G8/G9 | `getCollectionsSummary` unused; AR-aging seed no aged receivables; coverage-estimate trigger (folds into BIL-G2) |
| dental-org | G8/G9/G10 | PIN self-recovery no UI; raw fetch (org-context, verify-pin ×2); audit-viewer param drift (EM-AUD-013) |
| dental-scheduling | SCH-G7/G8/G9/G10/G11/G12 | reminder token landing (flag-off); portal self-service `[NC]`; recall overdue default; PATCH-cancel reason asymmetry (P0 test-step inside G1); seed free-text visitType; backend adversarial depth |
| dental-visit | G4/G5/G6 | FE affordance≠RBAC (chart-edit/treatment — P0 *test* before fix); redundant endpoints; view toggles not persisted |
| dental-perio | P3-1/P3-2/P3-3 | Hygienist finalizes diagnosis w/o sign-off `[NC]`; Stage null on depth-only; finalization-seam test gaps |
| dental-imaging | IMG-P3-1/P3-2/P3-3 | No modality-reclassify/delete-image; benign unwired endpoints; harness routes mask reachability |
| dental-audit | P3-A/P3-B/P3-C | TRUNCATE not blocked; AUD-BR-003 denied-attempt logging; stale pg-boss comments |
| dental-pmd | P3-10/11/12 | Async gen / presigned / multipart; SHL/trust-tier; no seed library |
| dental-portal | — | Appointments list unbounded; silent balance-load failure; Phase-2 reads deferred |
| case-presentation | G4/G5 | Annotated images not openable; GET-with-write telemetry |
| dental-erasure | ER-P3-1/P3-2 | Misleading `user` role annotation; no E2E (blocked by no-UI) |
| dental-legalhold | — | `branchId` saved-but-unused; cross-tenant admin scope (by-design) `[NC]` |
| retention | G5/G6 | Misleading "policy UI" comments; KG under-models enforcement |
| emr-consultation | G6/G7 | Duplicate-context soft assertion; `amended` dead enum |
| external-records-import | G7/G8/G9 | FHIR/CDA/PDF bridge (Phase-3 by design); no dedup; KG under-models import |
| notifs | G5/G6 | Email templates unverified `[NC]`; no enqueue→cron→deliver integration test |
| provider | G7 | Terminology drift (Provider/Practitioner/membership) |

---

## 3. Cross-Module Patterns

**A. Cross-tenant / tenancy leak (the only true security class).**
`dental-patient` G1 (**P0**, reachable in UI), `dental-erasure` ER-P1-1 (list-leak + wrong-tenant anonymize), `emr-consultation` G3 (admin-sees-all), `dental-legalhold` cross-tenant (by-design/tracked). Shared remedy: resolve subject→tenant and enforce the caller's membership; default lists to the caller's scope; reuse `handlers/shared/` branch-access helpers. **Note:** the contract-spine over-reports raw-fetch and dead-hook endpoints (`dental-org` R3 verify-pin, `dental-patient` G2 coverage-auth) as "wired" — never make a wire/remove or leak decision from spine "wired" status alone; confirm component reach.

**B. Saved-but-not-enforced config (split-brain).** `dental-org` G1 working hours (= `dental-scheduling` SCH-G3) + G2 fee schedule (+R1 triple split-brain) + G3 permission grid; `notifs` G2 settings; `retention` G1/G2. Each writes a settings blob/row that no enforcement path reads, and shows a success toast. Structural remedy: **every config surface needs a downstream-effect test (booking blocked / price defaulted / send suppressed), never a toast-only test** — and FE interaction tests that assert the *mutation call*, since the current pure-helper FE tests are exactly why these shipped green.

**C. Built-backend / zero-FE-consumer (the dominant class).** Whole verticals are tested + SDK-wired but unreachable: insurance/claims (`dental-patient` G2 / `dental-billing` BIL-G2), occlusion/postop/inventory (`dental-clinical` G2/G6/G7), audit viewer (P1-A), PMD viewer/import/care-record, erasure UI, legal-hold UI, retention policy UI, notif inbox, EMR, provider, bulk import, staff-edit/consent-templates/branch-switcher (`dental-org` G5/G6/G7), queue/waitlist/cancel/no-show (`dental-scheduling`). All are **additive FE wiring onto existing RBAC-gated, audited, tested backends → low blast radius, no contract regen** — but many are gated on wire-vs-remove product decisions (§6).

**D. Dead trigger (mounted sheet, no button).** `dental-clinical` G1 (`onLab`) and `dental-pmd` P1-3 (`onPmd`) are the *same dead-prop class* in `WorkspaceTopBar` — fixable together (and the lab-orders false-green E2E must be relabeled/hardened).

**E. Contract / wire-shape drift.** Bare-array vs `{data,pagination}` (`dental-clinical` G10, `dental-erasure` ER-P2-1, `dental-patient` G14, `dental-legalhold`); numeric-string vs `float64` (`dental-perio` P2-1); declared-but-absent field (`notifs` deliveredAt G4); `{success,…}` vs `{data,meta}` (`external-records-import` G6); `user`-vs-`admin` role-annotation drift (`dental-erasure` ER-P3-1, `dental-legalhold`). Several "contract tests" assert the wrong (impl) shape, masking the drift — **fix the spec-conformant shape before wiring any new FE onto these endpoints**, or the FE inherits the drift.

**F. Audit write coverage / reliability.** `dental-audit` P1-B/P1-C/P2-A/P2-D + `dental-patient` G5 are one work-stream: sensitive mutations are unaudited or audited best-effort/non-atomic, and only 2 actions have audit-row tests. This must precede the audit viewer (P1-A) — the viewer is only as trustworthy as the trail.

**G. Tests mount components/handlers directly → false-green wiring.** `dental-clinical` G1 (API-only E2E), `case-presentation` G1 (fixture pre-links treatments), `dental-pmd` (mounts viewer directly), `dental-imaging` IMG-P3-3 (harness routes). Recurring repo theme (`feedback_test_verification`). Remedy: real-UI E2E that drives the trigger, not the mounted component/raw fetch.

**H. Two sources of truth.** Claims (patient vs billing), clinical notes (EMR vs visit), provider (Provider/Practitioner vs `dentalMemberships`), approval (`approveTreatmentPlan` vs `acceptCasePresentation`), audit (3 sinks). Each needs a "designate canonical + retire/reconcile the other" decision.

**I. Seed coherence.** `case-presentation` (no plans), `dental-billing` BIL-G8 (no aged AR), `dental-portal` (no portal patient), `provider` G5 (empty), `dental-audit` (seed audit rows), `dental-org` G1 (working_hours column), `dental-scheduling` SCH-G11 (enum-invalid visitType). Several gaps are invisible *because* the seed can't reach the surface.

---

## 4. Recommended Fix Batches

> Ordered by: security/safety → compliance-trail reliability → split-brain honesty → high-value FE wiring → durable records → identity reconciliation → governance/portal operability. Batches 1–3 need **no product decision**; later batches are largely gated on §6.

| Batch | Modules | Gaps included | Why this batch | Tests required |
|---|---|---|---|---|
| **1 — Core-workflow & security blockers (unblocked)** | dental-patient, case-presentation | dental-patient G1 (P0); case-presentation G1 (P0)+G3+G2 | The two P0s + case-presentation's tightly-coupled trio (G1 fix is unverifiable without the G2 seed; G3 stops the source-of-truth drift G1 would otherwise introduce). Confirmed bugs, no decision needed. | sync-log: unit scope + 2-org integration + branchless-400. case-pres: normal-flow present→accept 200 (RED), aggregate `phases>0`, accept-links-items + approval-record, seed-coherence, present→accept/decline E2E, **regression on treatment-completion % + invoice-from-plan** |
| **✅2 — Compliance-trail reliability (foundational)** | dental-audit, dental-patient | dental-audit P1-C → P1-B → P2-A; dental-patient G5 | **DONE 2026-06-09** (see §9). Audit writes are now durable (fail-closed on money/clinical mutations) & complete (sensitive actions audited) with before/after+reason. Per-handler rollout, no global flip. | force-audit-failure→5xx (void/role-change); per-handler audit-row assertions (member role change, plan approve/accept, note sign/amend, claim-status); before/after+reason persisted+sanitized — **all GREEN** |
| **✅3 — Wire-shape conformance (unblocks safe FE wiring)** | dental-clinical, dental-perio, dental-erasure, notifs, external-records-import | dental-clinical G10; dental-perio P2-1; dental-erasure ER-P2-1; notifs G4; external-records-import G3 | **DONE 2026-06-09** (see §10). All 5 contract shapes normalized RED-first before FE wiring. | bare-array→`{data,pagination}` (clinical occlusion/postop/inventory; erasure list); perio numeric on both single-GETs; deliveredAt dropped from tsp; RFC-4180 quoted-comma round-trip — **all GREEN** |
| **✅4 — Split-brain config enforcement** *(decisions §6 #4/#5/#6/#8)* | dental-org, dental-scheduling, notifs, retention | dental-org G1(+G1-shape)/SCH-G3; dental-org G2(+R1); dental-org G3; notifs G2; retention G2 | **DONE 2026-06-09** (see §11). The "saved-but-not-enforced" class closed with **downstream-effect** tests (no toast-only): #6→working-hours canonical `{enabled,open,close}` (FE repointed to enforced column); #5→fee schedule drives pricing (dedicated endpoints canonical, catalog seeded, treatment price defaults); #4→permission-grid tab removed; #8→notif settings relabelled + consent gate surfaced; retention G2 enforcement-status reader. | shape-conformance unit; E2E out-of-hours booking rejected + walk-in bypass; fee→treatment default (unit+integration+contract) + fee-set persists E2E; permission-grid tab-absent; notif panel relabel; retention last-run summary — **all GREEN** |
| **5a — Dead-trigger + clinical-workspace wiring** | dental-clinical, dental-pmd | dental-clinical G1+G3+G4+G9; dental-pmd P1-3 | The dead-prop class (`onLab`/`onPmd`) + consent-history/Rx-list/amendment-list (read-mostly, backend done). Relabel the lab false-green E2E. | top-bar button RED→present; real-UI E2E; consent revoke+history+blast-radius; Rx list/dispense; role-gating |
| **5b — Scheduling terminal-status & queue wiring** | dental-scheduling | SCH-G1+G10+SCH-G2+SCH-G4+SCH-G5+SCH-G6 | No cancel/no-show in the entire FE is a real ops gap; one actions-menu surface unlocks several. G10 transitions-test is a P0 step inside G1. | cancel reason-required + visit-preserved E2E; transitions reason policy (RED); no-show; enqueue branch-scoped; waitlist FIFO; confirmation lookup |
| **5c — Billing operations wiring** | dental-billing | BIL-G1+BIL-G5+BIL-G3+BIL-G4+BIL-G6 | Discount/receipt/void/payment-plan are daily billing ops; all additive onto tested owner-gated backends. | discount reason-required owner-only; receipt printable; void reverses+voided-receipt; payment-plan 2–24; balance==endpoint |
| **5d — Visit & org settings wiring** | dental-visit, dental-org | dental-visit G4+G2+G3; dental-org G5+G6+G7 | FE role-gating + version viewer + templates (visit); staff-edit + consent-templates + branch-switcher (org). Mostly low-risk; G1 carry-over + G2/G3 templates partly decision-gated. | role-gated affordances; version viewer; apply-template+read-path regression; staff edit/NPI; consent-template picker wired; branch switch |
| **6 — Durable clinical records (migrations)** | dental-perio, dental-pmd | dental-perio P1-1+P2-2; dental-pmd P1-1+P1-2+P1-4+P1-5 | Need migrations + (PMD) signing/FHIR; PMD bundle is decision-gated on "true PMD vs internal snapshot". | perio complete→GET round-trip + risk-factor persist; PMD schema/required-sections + sign/verify/tamper + import-merge |
| **7 — Source-of-truth reconciliation (decision-led)** | provider, emr-consultation, dental-patient, dental-billing | provider G1/G2; emr-consultation G1/G2/G3; dental-patient G2 / billing BIL-G2 (claims) | Each is "designate canonical + retire/reconcile the duplicate" — gated on §6 decisions; mostly docs+deprecation or one wired vertical. | EMR-authz-on-memberships; provider session-revoke removal; claims single-source E2E |
| **8 — Governance operability (decision-gated UIs)** | dental-erasure, dental-legalhold, retention | ER-P1-1/P1-2/P1-3/ER-P2-2/ER-P3-1; legalhold UI+RBAC-drift; retention G1/G3 | Compliance features that exist only as raw API. RBAC-drift (tsp `user`→`admin`) is cheap+unblocked and can be pulled forward. | tenancy gate cross-tenant tests; admin erasure/legal-hold UI + E2E; retention policy GET/PATCH admin-only |
| **9 — Portal door** | dental-portal | provisioning + entry redirect + seed + E2E + overdue | Make the read-only portal reachable by a real patient. Gated on the provisioning-scope decision. | link-200/unlinked-403; patient→portal redirect; seed patient; E2E; overdue-by-dueDate |
| **10 — Remaining P3 polish** | all | residual P3 | Only if required by a shipped P0/P1; otherwise defer. | per-gap |

---

## 5. First Fix Batch Recommendation

**Implement Batch 1 — Core-workflow & security blockers — first.**

Contents:
1. **dental-patient G1 (P0)** — scope `listSyncLogs`/`SyncLogRepository.findAll` to the caller's branch(es)/tenant; require `branchId` on create/update. *Cross-tenant PII read leak reachable from the live UI (`use-sync-status.ts`).*
2. **case-presentation G1 (P0)** — link pending treatments to the plan at the `presented` transition. *The module's core accept workflow is broken end-to-end (₱0 aggregate, accept 422).*
3. **case-presentation G3 (P1)** — converge `acceptCasePresentation` onto the same link+approval-record logic as `approveTreatmentPlan`. *Prevents the source-of-truth drift G1's fix would otherwise create.*
4. **case-presentation G2 (P1)** — seed presented/accepted/rejected plans with linked items. *Unblocks the E2E that proves #2/#3 and was the reason the P0 went undetected.*

**Why first:**
- These are the only **2 P0s** in the entire sweep, and both are **confirmed bugs requiring no product decision** — unlike most P1s, which are gated on §6.
- **Security:** G1 is an actively-reachable cross-tenant PII leak.
- **Workflow:** case-presentation is the lone **FAIL** module; its primary purpose cannot be completed.
- **Coupling:** the case-presentation three (G1/G2/G3) must move together — G1's fix is unverifiable without G2's seed, and G3 must converge the approval truth at the same time or G1 introduces drift.
- **Test-readiness:** every fix has a RED-first test already specified (cross-tenant integration; normal-flow present→accept; accept-links-items+approval-record; seed-coherence).

**Blast-radius caution:** case-presentation G1 changes *when* `treatmentPlanId` is set on treatments, which ripples to plan-completion % and invoice-from-plan — Batch 1 must include regression assertions on `listDentalTreatments`/`listDentalVisits` readers and the billing-from-plan path (per the case-presentation + dental-visit plans).

After Batch 1 lands green (full gate: `bun test` + api-ts `bunx tsc` + `CONTRACT_ONLY=...` hurl + FE unit + lint/boundaries), proceed to **Batch 2 (audit-trail reliability)** then **Batch 3 (wire-shape conformance)** — both also unblocked — before the decision-gated FE-wiring batches.

---

## 6. Items Needing Confirmation

These product/technical decisions **gate** the listed fixes. Do not act on them until resolved.

| # | Decision | Gates | Modules |
|---|---|---|---|
| 1 | **Claims single source of truth** — dental-patient insurance/claims vertical vs dental-billing `ClaimsWorklist`. Wire one + an insurance-profile UI, or delete the dead vertical + dead hooks. | dental-patient G2, dental-billing BIL-G2 | patient, billing, imaging |
| 2 | **Communication-consent enforcement** — enforce per-channel consent at send time (gate notifs/comms)? Make the registration write blocking? | dental-patient G3 | patient, notifs, comms |
| 3 | **V1 scope of backend-only patient surfaces** — demographics-edit, guardian/contacts, alerts, tasks, household, statement: wire for V1 or defer? | dental-patient G7/G8/G9/G10/G11 | patient |
| 4 | ✅ **RESOLVED 2026-06-09 → REMOVE.** Coarse role model (`assertBranchRole`) is the gate; drop the unenforced permission-grid tab + add an orphan-route guard. Reintroduce granular per-feature overrides later only if a requirement demands it. (was: enforce ~109 handlers vs remove) | dental-org G3 | org + all clinical/billing/scheduling |
| 5 | ✅ **RESOLVED 2026-06-09 → DRIVE PRICING; dedicated endpoints canonical.** Make `get/updateFeeScheduleEntry` the single fee source, retire the settings blob, default treatment/invoice prices from it (closes AC-ORG-002). | dental-org G2 (+R1) | org, visit/treatments, billing |
| 6 | ✅ **RESOLVED 2026-06-09 → backend `{enabled,open,close}`** canonical; reshape the FE save to match (no migration; enforcement column already in this shape). | dental-org G1-shape, SCH-G3 | org, scheduling |
| 7 | **Staff model** — direct PIN-staff creation (local-first) vs PRD email-invite/`invited` state. | dental-org G4 | org, Better-Auth, email, notifs |
| 8 | ✅ **RESOLVED 2026-06-09 → RELABEL.** Per-patient `PersonConsent` is the enforced gate; repurpose/relabel the branch `notificationPreferences` panel to what it actually controls and surface per-patient consent where it belongs (no new cross-module send-gate). | notifs G2 | notifs, scheduling, patient, billing |
| 9 | **Carry-over model** — `POST /carry-over` the intended cross-visit completion path, or mark-done-in-place (then remove dead "Carried Over" UI)? | dental-visit G1 | visit |
| 10 | **Treatment templates V1** — surface now (built+seeded) or defer+remove seed? | dental-visit G3 | visit, org |
| 11 | **Accepted-plan version viewer surface** — visit workspace vs patient treatment-plan sheet? | dental-visit G2 | visit, patient |
| 12 | **Perio hygienist finalize policy** — may a hygienist finalize Stage/Grade, or require dentist sign-off? (code allows hygienist; docstring says dentist-only). Persistence shape: discrete columns vs JSONB. | dental-perio P3-1, P1-1/P2-2 | perio |
| 13 | **Imaging AI auto-detect** — intentional reversal of the no-AI non-goal (keep + ship a real detector) or remove the affordance? Is the addon detector real or FakeDetector? | dental-imaging IMG-P1-1, IMG-P2-3 | imaging |
| 14 | **CBCT prod-overlay scope** — does the production upload form offer `modality='cbct'` / is the CBCT card reachable outside the harness? Is persisted superimposition V1? | dental-imaging IMG-P2-2, IMG-P2-1 | imaging |
| 15 | **PMD intent** — true canonical PMD (FHIR + signed + Safety-Floor) vs intentionally-narrowed internal visit-snapshot? Self-signed facility cert acceptable for pilot? | dental-pmd P1-1/P1-2/P1-5 | pmd, clinical, patient, org |
| 16 | **Audit read role** — owner-only (current) or widen to `read_only`/auditor? TRUNCATE carve-out acceptable? Viewer scope = full prototype vs reduced V1? | dental-audit P1-A/P2-C/P3-A | audit, org |
| 17 | **Who may erase** — clinic `dentist_owner` per-tenant (recommended) vs platform `admin` only? Co-locate Art.20 export? `branchId`/`subjectPatientId` semantics? | dental-erasure ER-P1-1/P1-3 | erasure, org, person |
| 18 | **Legal-hold admin UI in MVP?** Reaffirm cross-tenant DPO model. `branchId` audit-only vs scoping? | dental-legalhold | legalhold |
| 19 | **Retention operator UI/API in V1?** Are clinical/visit/prescription targets enforceable in V1? `RETENTION_ENFORCEMENT_ENABLED` go-live posture? | retention G1/G3/G2 | retention, clinical, scheduling |
| 20 | **EMR-consultation in product scope?** Keep+expose / dormant-relabel / remove. Global admin vs clinic-scoped admins? Canonical encounter boundary vs dental-visit? | emr-consultation G1/G2/G3 | emr, visit, clinical |
| 21 | **Bulk patient import V1 surface?** Build owner-only UI vs dormant primitive. Max row count + reject-vs-partial on oversized. Canonical owner of import UX? | external-records-import G1/G2/G5 | external-records-import, patient |
| 22 | **Provider module: deprecate vs productize** — is practitioner credentialing/directory a V1/V2 capability, or is `dentalMemberships` the only provider concept? Is `createProvider` session-revoke intentional? | provider G1/G2/G3 | provider, EMR, org |
| 23 | **Portal provisioning scope** — is patient-account linking a V1 fix or accepted Phase-1 "no door"? Overdue auto-flip job? Phase-2 PHI-read scope? | dental-portal P1 trio | portal, patient, auth |
| 24 | **Scheduling** — portal self-cancel/reschedule in V1? Recall `listDueRecalls` overdue default vs FE floor workaround? | dental-scheduling SCH-G8/G9 | scheduling, portal |

---

## 7. Execution Rules

1. **Fix one batch at a time.** Do not start a batch until the previous one is green on the full gate.
2. **Use TDD where practical.** Write the failing test first (RED), then the smallest fix (GREEN), then refactor. For config/affordance gaps, the RED test must assert a **downstream effect** (booking blocked / price defaulted / send suppressed / cross-tenant rows excluded), never a success toast or a mounted-component render alone.
3. **Add failing tests first when feasible** — every gap above names its RED test; characterization tests (existing-behavior pins) are allowed where the fix is wiring-only.
4. **Do not touch unrelated modules.** Cross-module fixes (`[xmod]`) touch only the named seams; verify the blast-radius readers named in the source plan.
5. **Do not fix P2/P3 unless required by a P0/P1 in the same batch** (e.g. dental-clinical G10 list-shape is a P3 but **must** precede G2/G6/G7; dental-scheduling G10/perio P2-1/visit G4 are P3 but are P0 *test-steps* inside their P1 fixes).
6. **Do not act on `[NEEDS CONFIRMATION]` items.** Surface the §6 decision; if undecided, skip the gated gap and proceed to unblocked work.
7. **Run relevant tests after each batch:** api-ts backend via `scripts/test-with-db.ts` (inline `DATABASE_URL=...monobase_test`, **never** `bun test <path>`); `bun run typecheck` (root = FE only — also run api-ts `bunx tsc`); **restart the dev server before `test:contract`** to avoid stale-handler drift; FE unit; `bun run check:boundaries`; lint. The 8-file MinIO/Mailpit infra baseline is expected-fail and unrelated.
8. **Update this matrix and the per-module gap plan after each batch** — mark closed gaps, record the decision taken for any resolved `[NEEDS CONFIRMATION]`, and re-run the contract-spine if FE wiring changed consumer counts.
9. **Spec-first for any shape change:** TypeSpec → `bun run build` → regen handlers/validators/SDK → FE. Never hand-edit generated files.

---

## 8. Batch 1 Implementation Log (2026-06-09)

**Scope:** dental-patient G1 (P0), case-presentation G1 (P0) + G3 (P1) + G2 (P1). No `[NEEDS CONFIRMATION]` items acted on. One latent FE blocker (case-presentation **FE-1**) found during live verification and fixed because it gates the same P0 workflow.

**Resolved `[NEEDS CONFIRMATION]` (case-presentation plan §):**
- **#1 link timing** → resolved as **link at the `presented` transition** (the matrix-recommended fix; also linked defensively at accept for robustness).
- **#3 "Present to patient" button reachability** → **confirmed live** for the seeded presented plan (Maria Santos) once G2 seeded it.

**New gap surfaced + fixed — case-presentation FE-1 (FE routing, was blocking the P0 E2E):**
`apps/dentalemon/src/routes/_workspace/$patientId.tsx` (the workspace) is the TanStack flat-routing layout **parent** of `/$patientId/case-presentation/$presentationId`, but rendered **no `<Outlet/>`**. Navigating to the CP route changed the URL but rendered nothing (the workspace stayed). The patient-facing view was unreachable and accept could never complete from the UI — the real reason the module was FAIL E2E (the original gap-plan author flagged this as unconfirmed, open question #3). Fix: `useChildMatches()` → render `<Outlet/>` when a child route is active. Regression pin added to `$patientId.test.ts`.

**Files changed (code):**
- `services/api-ts/src/handlers/dental-patient/repos/sync-log.repo.ts` — `findAll(branchIds)` scoped via `inArray`; empty scope → `[]`.
- `.../dental-patient/sync/listSyncLogs.ts` — require `branchId` (400), `assertBranchAccess`, scoped `findAll([branchId])`.
- `.../dental-patient/sync/createSyncLog.ts` — require `branchId` (400) + unconditional `assertBranchAccess`.
- `.../dental-patient/sync/updateSyncLog.ts` — unconditional auth; branchless row → 403.
- `.../dental-patient/treatment-plans/updateTreatmentPlan.ts` — link pending treatments on `presented`.
- `.../dental-patient/case-presentation/acceptCasePresentation.ts` — link pending treatments + write `TreatmentPlanApproval` (G3).
- `.../patient/repos/patient-dental-patient.facade.ts` — `getPatientForDentalPatient` also returns `personId` (additive; for the G3 approval record).
- `apps/dentalemon/src/routes/_workspace/$patientId.tsx` — `<Outlet/>` for nested routes (FE-1).
- `services/api-ts/scripts/seed-supplement.ts` — seed case-presentation plans across the FSM.

**Tests added/updated:** `dental-patient-sync-isolation.test.ts` (new, 8 tests), `case-presentation-real-flow.test.ts` (new, 3 tests), `dental-patient-sync.test.ts` (contract update), `dental-treatment-coordinator.hurl` (aggregate non-empty + accept), `$patientId.test.ts` (Outlet pins).

**Gate:** api-ts backend (sync isolation 8/0, sync 14/0, route-reg 3/0, case-pres real-flow 3/0, dental-patient dir 400/0, treatment-plan/case-pres 51/0); contract 46/46 files (719 req); api-ts `tsc` 0; root typecheck (FE+api-ts) 0; FE workspace test 11/0; lint 0 errors; `check:boundaries` clean; live browser present→accept E2E ✅.

**Known pre-existing failure (NOT a Batch-1 regression, out of scope):** `patient/patient.test.ts` → `unmergePatients … returns 500 (not implemented)` asserts 500 but the handler returns the documented **501 NOT_IMPLEMENTED** (base `patient` module; this is dental-patient **G16**, P3 test-staleness). Unmerge does not use the changed facade; the test file is not in the Batch-1 changeset. Flagged for the G16 fix, not touched here.

---

## 9. Batch 2 Implementation Log (2026-06-09)

**Scope:** dental-audit **P1-C** (write reliability), **P1-B** (write coverage), **P2-A** (AUD-BR-004 snapshots+reason); dental-patient **G5** (audit-row assertions). No `[NEEDS CONFIRMATION]` items acted on. Out of scope (untouched): P1-A audit viewer FE (Batch 8/gated), P2-C read-only role `[NC]`, P2-B sink consolidation, P3-A/B/C.

**Approach decision (P1-C — atomic vs fail-closed):** the matrix offered "in-tx OR fail-closed." Chose **fail-closed** as the smallest safe per-handler change — the billing/visit repos are constructed from `db`, so true in-tx atomicity would be a large multi-repo refactor (against "smallest safe change"). Added a per-call `failClosed` opt to `logAuditEvent` so security events stay always-fail-closed and the ~70 other producers keep their default fire-and-forget behaviour (**no global flip**). Residual (documented): a fail-closed mutation commits then 5xx, so the row persists without an audit trail and the caller sees an error (no *silent* gap — the matrix's accepted weaker guarantee vs full rollback).

**Files changed (code):**
- `core/audit-logger.ts` — new `LogAuditEventOptions { failClosed }`; `mustFailClosed = isSecurityEvent || opts.failClosed`; rethrow on authoritative `dental_audit_log` failure when set.
- `dental-billing/voidDentalPayment.ts` — `failClosed` + `eventType` + before/after + `reason` (P1-C/P2-A).
- `dental-billing/voidDentalInvoice.ts` — **MISSED in Batch 2; fixed 2026-06-10 (SL-05 / E-NEW-02)**: `failClosed` + `eventType` + before/after status + `reason` (P1-C/P2-A). The Batch-2 "void" entry covered only payment-void; the invoice-void path stayed fire-and-forget.
- `dental-billing/applyDentalDiscount.ts` — `failClosed` + before/after totals + `reason` (P1-C/P2-A).
- `dental-billing/recordDentalPayment.ts` — `failClosed` on `payment.record` (P1-C).
- `dental-visit/visits/updateDentalVisit.ts` — `failClosed` + before/after status on `visit.complete` (P1-C/P2-A).
- `dental-org/updateMember.ts` — **new** `membership.role_change` audit (P1-B) + `failClosed` + before/after role (P1-C/P2-A); only on actual role change.
- `dental-patient/treatment-plans/approveTreatmentPlan.ts` — **new** `treatment_plan.approved` audit + before/after status (P1-B/G5).
- `dental-patient/case-presentation/acceptCasePresentation.ts` — **new** `case_presentation.accepted` audit + before/after plan status (P1-B).
- `dental-visit/notes/signVisitNotes.ts` — **new** `visit_note.signed` audit (P1-B).
- `dental-visit/notes/createVisitNoteAddendum.ts` — **new** `visit_note.amended` audit + `reason` (P1-B/P2-A).
- `dental-patient/insurance/updateClaimStatus.ts` — **new** `claim.status_changed` audit + before/after status (P1-B/G5).

**Tests added/updated (all RED-before / GREEN-after):**
- `dental-billing/audit-write-reliability.test.ts` (**new**, 2): spyOn `AuditLogRepository.insert` → void returns 5xx (P1-C); void persists before/after+reason (P2-A).
- `dental-org/updateMember.test.ts` (+3): role-change writes `membership.role_change` with before/after; non-role edit writes no role row; role-change 5xx when sink down.
- `dental-patient/treatment-plans/approveTreatmentPlan.test.ts` (+1): `treatment_plan.approved` row.
- `dental-patient/dental-patient-insurance.test.ts` (+1): `claim.status_changed` row before/after.
- `dental-visit/notes/visit-notes-audit.test.ts` (**new**, 2): sign + addendum audit rows.
- `dental-patient/case-presentation-real-flow.test.ts` (+1): accept audit row.
- `dental-patient/communication-consent.test.ts` (+1): consent-change audit characterization pin.

**Gate:** api-ts `bunx tsc` 0; root typecheck (FE+api-ts) 0; `check:boundaries` clean; lint 0 errors (1 pre-existing `pinHash` warning); affected suites all green (audit 14/0 + 9/0, membership-audit-regression 2/0, dental-billing payments/discount/edge/revenue 5/84/28/1, dental-visit 68/6/4, dental-patient 72/0, case-presentation 16/0, + all 6 new/extended Batch-2 files). **No wire-shape change → contract suite unaffected (no TypeSpec/response edits).** Backend tests via `scripts/test-with-db.ts` per-file clones (directory-arg mode shares one clone → false cross-suite failures; run files individually).

**Note:** `visit.complete` is not a standalone handler — it is the `completed` status transition inside `updateDentalVisit.ts` (the gap-plan's "visit-complete"). It was already audited; Batch 2 made it fail-closed + added before/after.

---

## 10. Batch 3 Implementation Log (2026-06-09)

**Scope:** dental-clinical **G10** (list-shape), dental-perio **P2-1** (numeric coercion), dental-erasure **ER-P2-1** (list envelope), notifs **G4** (`deliveredAt` drift), external-records-import **G3** (CSV parser). All backend / wire-shape, RED-first. No `[NEEDS CONFIRMATION]` items acted on. **Out of scope (untouched):** ER-P3-1 role-annotation drift (independent P3, not required to complete ER-P2-1); all other P2/P3.

**Resolved decision (notifs G4 — add-column vs drop):** chose **drop `deliveredAt` from TypeSpec**. Verified the `notification` table (snapshot 0091) has no `delivered_at` column, `NotificationResponse` never returned it, and no delivery path produces a delivery timestamp (the `delivered` *status* already represents delivery). Dropping is one TypeSpec line + regen with zero migration / zero runtime logic / zero data backfill / zero FE consumers to break; adding a column would require inventing a "delivered" timestamp that no channel (OneSignal/SMTP fire-and-forget) actually confirms.

**Files changed (code):**
- `specs/api/src/modules/dental-clinical-ops.tsp` — 4 list ops `ApiOkResponse<T[]>` → `ApiOkResponse<PaginatedResponse<T>>` (occlusion / postop / inventory items + adjustments).
- `specs/api/src/modules/notifs.tsp` — removed `deliveredAt` from `model Notification`.
- `.../dental-clinical/occlusion/listOcclusionScreenings.ts`, `.../postop/listPostopTemplates.ts`, `.../inventory/listInventoryItems.ts`, `.../inventory/listInventoryAdjustments.ts` — `{ data, pagination }` via `parsePagination`/`buildPaginationMeta`.
- `.../dental-perio/getPerioChart.ts`, `.../getVisitPerioChart.ts` — coerce `summaryBopPercent`/`summaryMeanDepth` with `numOrNull`.
- `.../dental-erasure/listErasureRequestsHandler.ts` — return `{ data: rows }`.
- `.../dental-patient/identity/importPatients.ts` — RFC-4180 `parseCsvRows` tokenizer replacing `line.split(',')`.
- `.../notifs/repos/notification.repo.ts` — removed dead `deliveredAt: new Date()` (push path; wrote a non-existent column).
- **Regenerated (not hand-edited):** `services/api-ts/src/generated/openapi/validators.ts`, `packages/sdk-ts/src/generated/{types,transformers}.gen.ts` (via `specs/api bun run build` → `api-ts bun run generate` → `sdk-ts bun run generate`). `specs/api/dist/openapi/*` is gitignored (CI rebuilds).

**Tests added/updated (all RED-before / GREEN-after):**
- `dental-perio-coverage.test.ts` (+2): both single-GETs return numeric `summaryBopPercent`/`summaryMeanDepth` for a completed chart (RED: `"string"`).
- `dental-perio.hurl` §7b: single-GET-after-complete on chartId + visitId, `summaryBopPercent`/`summaryMeanDepth` `isFloat`.
- `dental-erasure.hurl`: all 5 list scenarios flipped `$`/`$[0]` → `$.data`/`$.data[0]`; `erasure-routes.test.ts` asserts `body.data` envelope.
- `dental-patient.bulk-import.test.ts` (+1): quoted embedded-comma + escaped-quote round-trip (RED: 500 from corrupted branchId).
- `notifs.test.ts` (+1 assert): `getNotification` response has no `deliveredAt`.
- `dental-clinical-occlusion/postop/inventory.test.ts`: list assertions (incl. `.find`/`.every`/empty-list) updated to `{ data, pagination }`.

**Gate:** api-ts `bunx tsc` 0; root typecheck (FE + api-ts) 0; sdk-ts `tsc` 0; `check:boundaries` clean; lint 0 errors (pre-existing unused-import warnings only); affected suites green (perio-coverage 40/0, perio-history 6/0, erasure routes 7/0 + reg 5/0 + service 6/0, bulk-import 18/0, notifs 16/0 + markRead 3/0, clinical occlusion 6/0 / postop 6/0 / inventory 23/0); **full contract suite 46/46 files, 747 requests, 100%** (server restarted before run — fresh handlers). Backend tests via `scripts/test-with-db.ts` per-file clones.

---

## 11. Batch 4 Implementation Log (2026-06-09)

**Scope:** the "saved-but-not-enforced config (split-brain)" class — dental-org **G1**(+G1-shape)/dental-scheduling **SCH-G3** (working hours), dental-org **G2**(+R1) (fee schedule), dental-org **G3** (permission grid), notifs **G2** (notif settings), retention **G2** (enforcement observability). All four product decisions resolved up front (§6 #4/#5/#6/#8); each fix landed with a **downstream-effect** test (no toast-only). Shipped as 5 commits on `chore/workflow-verification-sweep` (pushed per-slice). **Out of scope (untouched):** dental-org G4–G10, retention G1/G3 (operator-UI / extra targets, gated on §6 #19), notifs G1/G3.

**Resolved decisions applied (§6):** #6 working-hours = backend `{enabled,open,close}` canonical (reshape FE save; no migration). #5 fee schedule = DRIVE pricing, dedicated `get/updateFeeScheduleEntry` canonical, retire blob, default treatment/invoice prices. #4 permission grid = REMOVE the unenforced tab (coarse `assertBranchRole` is the gate). #8 notif settings = RELABEL (per-patient `PersonConsent` is the enforced gate).

**Slice 1 — working hours (G1/G1-shape/SCH-G3)** — commit `c12d1246`:
- FE Working Hours repointed from `useUpdateBranchSettings` (settings blob) to the dedicated enforced `PUT/GET /dental/branches/:id/working-hours` via new `use-working-hours.ts`; new pure `working-hours.logic.ts` (`toCanonical`/`fromCanonical`, editor `{open,start,end}` ↔ enforced `{enabled,open,close}`, 10 unit tests). Root TypeSpec drift fixed (`DentalWorkingHoursDay` was `{open,close,isOpen}` map-direct → reconciled to the handler envelope `{branchId,workingHours:{day:{enabled,open?,close?}}}`, regen). Seed populates the column (`seed-demo.ts`). Backend enforcement already 16/0 (incl. walk-in bypass); added `dental-org.hurl` GET-after-PUT.

**Slice 2 — permission grid (G3, REMOVE)** — commit `c1de7890`:
- Removed the Permissions tab from `settings.tsx` + deleted `permission-grid.tsx`/`.test.ts`/`use-permissions.ts`. No FE route existed (tab-only) → no orphan-route guard needed. Backend `getPermissionGrid`/`updatePermissions` left as harmless orphans.

**Slice 3 — notif settings (G2, RELABEL)** — commit `8a1fe498`:
- `notification-settings.tsx` relabelled as clinic DEFAULTS + `NOTIFICATION_CONSENT_NOTICE` banner pointing to the real per-patient `PersonConsent` gate. No new cross-module send-gate.

**Slice 4 — fee schedule drives pricing (G2/R1, DRIVE)** — commit `dd0df211`:
- Canonical store: FE Fee Schedule panel rebuilt catalog-driven (new `use-fee-schedule.ts`), saving per-CDT via the dedicated `PATCH /dental/fee-schedule/:cdt`; retired the inert `settings.feeSchedule` blob save.
- Pricing default: `priceCents` made **optional** on `CreateDentalTreatmentRequest` (TypeSpec → regen); `createDentalTreatment` defaults it from the fee schedule via shared `resolveFeeCents` (per-branch override ?? global catalog default ?? 0) + new `org-billing.facade.getBranchFeeOverrides`. **Closes AC-ORG-002.**
- Catalog seed: `dental_procedure_code` was never seeded (so the dedicated endpoints were inert — GET empty / PATCH 404) → `seed-procedure-catalog.ts` (24 codes) seeded idempotently on boot in `app.ts` (alongside email templates).
- Found+fixed a real component bug: the query `select` returned a fresh array each render, so the seeding effect clobbered in-progress edits → now seeds only missing codes.
- Tests: `fee-resolution.test.ts` (5 unit), `dental-treatment.fee-default.test.ts` (3 integration: override/default/explicit-wins), `dental-visit.hurl §8a/8b/8c` (set fee → price-less treatment defaults → dismiss so it doesn't block completion), `fee-schedule.test.tsx` (3 FE interaction: catalog prefill + Save PATCHes the dedicated endpoint for the changed row only), `fee-schedule.spec.ts` (E2E set-in-UI → persists via canonical store). Stale `dental-treatment.test.ts` "400 when priceCents missing" updated to the new optional-defaulting contract.

**Slice 5 — retention enforcement observability (G2)** — commit `<this>`:
- `summarizeRetentionEnforcement(db, tenantId?)` (`retention-status.ts`) derives operator-visible status from the `retention.*` compliance audit events: `lastRunAt`, `lastRunMode` (`enforced`/`dry-run`/`null`=never-run), `runsObserved`, last-run `eligible`/`actioned` counts, + live `enforcementEnabled` env posture. Reads the append-only audit log via a new boundary-clean `dental-audit/audit-query.facade.ts` (`findAuditEventsByActions`) — no cross-module repo import. README documents the go-live attestation flow (dry-run → review → confirm dry-run summary → enable → confirm enforced summary).
- Module-wide config-surface smoke upgrade: `dental-org_smoke.py` gains **CP5** — owner sets a run-unique D1110 fee → Save → reload → re-auth → assert the price **persists** (proves the canonical store round-trip, not a blob no-op), encoding the principle "config surfaces assert a downstream effect, never a success toast."
- Tests: `retention-status.test.ts` (5: never-run / dry-run-latest / enforced-latest / env-posture / tenant-scope reflect seeded audit rows).

**Gate (cumulative, all slices GREEN):** api-ts `bunx tsc` 0; root typecheck (FE+api-ts) 0; sdk-ts `tsc` 0; `check:boundaries` clean; lint 0 errors; FE unit 2133/0; **full contract suite 46/46 files (761 req)**; chromium E2E `fee-schedule.spec.ts` 1/1; backend Batch-4 suites green (working-hours enforcement 16/0, fee-resolution 5/0, fee-default 3/0, dental-treatment 39/0, fee-schedule cluster, retention-status 5/0 + engine 10/0 + jobs 3/0). Backend tests via `scripts/test-with-db.ts` per-file clones; server restarted before contract run (catalog seeds on boot).

---

*Compiled from 19 module gap-plans. Batches 1–4 implemented 2026-06-09; Batch 5+ not started.*
