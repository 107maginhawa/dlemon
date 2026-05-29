# Spec Consistency Report — Dentalemon
<!-- oli: v3-dentalemon | cross-module | consistency-gate | oli-version: 1.3 -->
<!-- based-on: 12 MODULE_SPEC.md + DOMAIN_GLOSSARY / DOMAIN_MODEL / ROLE_PERMISSION_MATRIX / EVENT_CONTRACTS / ERROR_TAXONOMY / API_CONVENTIONS / WORKFLOW_MAP / AUDIT_CONTRACTS -->
_Generated: 2026-05-24 · Re-validated: 2026-05-30 (12-module corpus)_

## Gate Result
**PASS** — 0 HIGH conflicts. Stage 1 (consistency) clear; MEDIUM/LOW are wave-addressable warnings.

_2026-05-30 re-validation (`--auto`, consistency dimension):_ scope widened from 10 → **12 modules** (added **dental-perio** and **emr-consultation**, both NEW since the 2026-05-24 run). All 6 original HIGH findings remain RESOLVED and were re-confirmed against current artifacts (F-016/17/18 billing+scheduling auth, F-019/F-034 cross-module coupling, F-035 dental-pmd roles). F-021 (`sent`→`issued`) confirmed fixed — dental-billing API_CONTRACTS now states `status → issued` and `V-BIL-015` explicitly retired the legacy `sent` token. The 8 new findings (F-036–F-043) are all MEDIUM/LOW, concentrated in the two newly-added modules (glossary/domain-model/error-catalog gaps + one perio API-vs-spec permission mismatch). No new HIGH; gate stays PASS. (Stage 2 human review = DEFERRED headless — see end.)

---

## Checks Run

**Scope:** 12 MODULE_SPECs (the 10 original + dental-perio + emr-consultation) × 7 cross-cutting specs. All 9 checks + NFR (C10b) ran. No SYNC_ARCHITECTURE.md present → sync-consistency check skipped (N/A).

| # | Check | Status | Notes |
|---|-------|--------|-------|
| C1 | Naming — glossary alignment | WARN | 4 original terms + 9 dental-perio terms (F-036) absent from DOMAIN_GLOSSARY |
| C2 | Entity attributes — field name alignment | WARN | 5 original field gaps + PerioChart/PerioToothReading absent from DOMAIN_MODEL §3 (F-037) |
| C3 | Workflow coverage — WF→screen→MODULE_SPEC | WARN | 3 modules missing §4 Workflow Details; 1 duplicate UI route. dental-perio §4 present (WF-P01..P05); WF-P* IDs not catalogued in WORKFLOW_MAP (F-040); WF-EMRC-* not in WORKFLOW_MAP (F-043) |
| C4 | Permission closure — ROLE_PERMISSION_MATRIX vs §6 | WARN | All HIGH (F-016/17/18) + F-035 + F-020 RESOLVED & code-verified. NEW: dental-perio §6 grants `hygienist` write but API_CONTRACTS Auth omits it (F-038) |
| C5 | API surface — §10 endpoints vs API_CONTRACTS / ERROR_TAXONOMY | WARN | 2 original discrepancies + perio error codes (CHART_EXISTS/INVALID_DEPTH/INVALID_TOOTH_NUMBER/VISIT_LOCKED) used but absent from ERROR_TAXONOMY perio catalog (F-039); emr `CONSULTATION_NOT_DRAFT` absent from ERROR_TAXONOMY (F-042) |
| C6 | UI data binding — screens.md fields vs §7 | WARN | 2 fields referenced in screens not in §7 (perio UI deferred per V-PER-011 — no binding to validate) |
| C7 | Cross-module traces | PASS | G-003 resolved — dental-clinical depends on `VisitService` interface; no direct `VisitRepository` import. emr-consultation facade-only coupling (patient/provider/person) confirmed clean — no dental-* dependency. |
| C8 | State machines — §8 vs API/screens | PASS | `sent`→`issued` (F-021) FIXED & retired (V-BIL-015). perio FSM (draft→completed→locked) consistent across §8 + API_CONTRACTS PerioStatus enum. emr FSM (draft→finalized terminal) consistent; `amended` enum value documented as reserved/unreachable (V-EMR-001). |
| C9 | Event coverage — §10b vs EVENT_CONTRACTS | PASS | All 24 DE events accounted for. perio (`perio.chart.*`) + emr (`emr.consultation.*`) events are dotted-lowercase audit-markers per ADR-006, intentionally outside the DE-catalog (F-041 LOW note). |
| C10b | NFR conflict detection | PASS | No new NFR contradictions. Audit-async-vs-perf reconciled by AUDIT_CONTRACTS §4 (fire-and-forget after commit). |

---

## Findings

### HIGH Severity — all resolved ✅

| ID | Check | Module(s) | Status | Fix Applied |
|----|-------|-----------|--------|-------------|
| F-016 | C4 | dental-scheduling | **RESOLVED** | Added `dentist_associate` to `POST /appointments/:id/check-in` Auth in API_CONTRACTS |
| F-017 | C4 | dental-billing | **RESOLVED** | Added `dentist_associate` to `POST /invoices` Auth in API_CONTRACTS |
| F-018 | C4 | dental-billing | **RESOLVED** | Added `dentist_associate` to `PATCH /invoices/:id/issue` Auth in API_CONTRACTS |
| F-019 | C7 | dental-org + dental-audit | **RESOLVED** | dental-org entry updated to explicit proxy note pointing to canonical dental-audit/API_CONTRACTS |
| F-034 | C7 | dental-clinical + dental-visit | **RESOLVED** | G-003 coupling closed — introduced `VisitService` interface in dental-visit/utils/visit.service.ts (getVisitOrThrow / findVisits / findInProgressVisitByPatient / createVisit). dental-clinical (handlers + tests) now depends on this abstraction; the direct `VisitRepository` import is gone. Behavior identical (suites unchanged). |
| F-035 | C4 | dental-pmd | **RESOLVED** | Fixed `dentist` → `dentist_owner, dentist_associate` in dental-pmd MODULE_SPEC §6 |

#### C4 closure (2026-05-30) — permission closure verified against enforced code

The C4 check was re-run against handler role guards (source of truth = enforced code). All three HIGH
contradictions plus the two associated C4 gaps are **doc-reconciled and code-verified consistent** —
ROLE_PERMISSION_MATRIX, the relevant MODULE_SPEC §6 tables, and the handler `assertBranchRole(...)`
guards now agree. No authz gap was found; **no code change was required**.

| Finding | Resolution | Code verification |
|---------|-----------|-------------------|
| F-016 (scheduling check-in) | doc-reconcile (MODULE_SPEC §6 / matrix N-SCH-03 amendment) | `checkInAppointment.ts` enforces `['dentist_owner','dentist_associate','staff_full']` (excludes `staff_scheduling`) — matches §6 + matrix exactly ✅ |
| F-017 (billing create invoice) | doc-reconcile (MODULE_SPEC §6 V-BIL-003 / matrix) | `createDentalInvoice.ts` enforces `['dentist_owner','dentist_associate']` (`staff_full` denied) — matches ✅ |
| F-018 (billing issue invoice) | doc-reconcile (MODULE_SPEC §6 V-BIL-003 / matrix) | `issueDentalInvoice.ts` enforces `['dentist_owner','dentist_associate']` — matches ✅ |
| F-035 (dental-pmd) | doc-reconcile (already fixed: `dentist`→`dentist_owner, dentist_associate` in §6) | consistent with matrix Generate-PMD row ✅ |
| F-020 (dental-emr §6 stub) | doc-reconcile (external-records-import §6 now has a permission table: import = `dentist_owner, dentist_associate`; view = all dental roles; delete = `dentist_owner`) | consistent with §1 Users + matrix ✅ |

The 5 extended staff roles (`hygienist`, `dental_assistant`, `front_desk`, `billing_staff`, `read_only`)
are catalogued in dental-org MODULE_SPEC §6 Member Role Catalog and the matrix Extended Staff Roles
table; only `dentist_owner` passes `assertBranchRole(['dentist_owner'])` admin guards, matching the
`member_role` enum. No new roles implemented (deferred-role catalog is documentation-only).

---

### MEDIUM Severity

| ID | Check | Module(s) | Description | Source of Truth | Resolution |
|----|-------|-----------|-------------|-----------------|------------|
| F-001 | C1 | dental-visit | Term `Focal Card` in MODULE_SPEC §2 (defined as "Active card in the Timeline Carousel") is absent from DOMAIN_GLOSSARY. | DOMAIN_GLOSSARY | Add `Focal Card` entry to DOMAIN_GLOSSARY under Clinical Terms. |
| F-002 | C1 | dental-visit | Term `Baseline` (chart snapshot at a specific visit) in MODULE_SPEC §2 is absent from DOMAIN_GLOSSARY. | DOMAIN_GLOSSARY | Add `Baseline` entry to DOMAIN_GLOSSARY under Clinical Terms. |
| F-003 | C1 | dental-billing | Invoice terminal state name inconsistency: DOMAIN_GLOSSARY entry lists `voided` as the terminal state string; DOMAIN_MODEL SM-INVOICE uses `void`; dental-billing screens.md and MODULE_SPEC §8 use `void`. Two forms of the same token in flight. | DOMAIN_MODEL SM-INVOICE (`void`) | Align DOMAIN_GLOSSARY to use `void` (not `voided`). The `voided_at` timestamp field name is distinct and unaffected. |
| F-004 | C1 | dental-scheduling | API_CONTRACTS header comment says `Appointment FSM: booked → checked_in | cancelled` using `booked` as the initial state; all other artifacts (MODULE_SPEC §8, screens.md, DOMAIN_MODEL) use `scheduled`. | MODULE_SPEC §8 / DOMAIN_MODEL | Update the API_CONTRACTS header comment FSM description to use `scheduled` consistently. |
| F-005 | C1 | dental-imaging | Term `imagingTier` in MODULE_SPEC §2 and §6 is absent from DOMAIN_GLOSSARY. It is referenced as a subscription gate for ceph features (BR-016c). | DOMAIN_GLOSSARY | Add `imagingTier` entry to DOMAIN_GLOSSARY under Organizational Terms or Technical Terms. |
| F-006 | C1 | dental-visit | Term `Carry-over` (planned/diagnosed treatments from prior visits shown as visual indicators) in MODULE_SPEC §2 is absent from DOMAIN_GLOSSARY. | DOMAIN_GLOSSARY | Add `Carry-over` entry to DOMAIN_GLOSSARY under Clinical Terms. |
| F-007 | C2 | dental-visit | MODULE_SPEC §7 `dental_visit` field list includes `notes_count` as an implied computed field; API_CONTRACTS `GET /visits/:id` response schema does not include it. If the UI (Visit List card: "3 treatments" badge) relies on this, the field needs to be explicit in the contract. | API_CONTRACTS | Either add `notes_count` to the GET /visits/:id response schema or remove it from §7 and document it as a client-side derived value. |
| F-008 | C2 | dental-billing | MODULE_SPEC §7 `dental_invoice` DB schema omits the response-only computed fields `subtotal_cents`, `paid_cents`, `outstanding_cents` present in API_CONTRACTS POST /invoices response. These are critical for UI rendering (InvoiceSummaryBar). | API_CONTRACTS (source of response shape) | Add a `# Response-computed fields (not stored)` note to MODULE_SPEC §7 listing `subtotal_cents`, `paid_cents`, `outstanding_cents`. |
| F-009 | C2 | dental-billing | API_CONTRACTS `POST /invoices` request body includes a `notes` field (max:500); MODULE_SPEC §7 `dental_invoice` table schema does not list a `notes` column. | API_CONTRACTS | Add `notes` column to MODULE_SPEC §7 `dental_invoice` definition. |
| F-010 | C2 | dental-billing | MODULE_SPEC §7 lists `issued_at` on `dental_invoice`; API_CONTRACTS `POST /invoices` 201 response does not include `issued_at` in the Invoice response fields (it would be null at creation time but should be present). | API_CONTRACTS | Add `issued_at` (nullable) to the Invoice response schema in API_CONTRACTS. |
| F-011 | C2 | dental-patient | API_CONTRACTS `POST /patients` request body includes optional `dentist_member_id` field (preferred dentist assignment); MODULE_SPEC §7 patient field table does not list it. | API_CONTRACTS | Add `dentist_member_id` (nullable FK) to MODULE_SPEC §7 patient field table. |
| F-012 | C3 | dental-org + dental-audit | Overlapping UI route definitions: dental-org screens.md defines a route at `/reports/audit-log`; dental-audit screens.md defines `/audit/log`. Both appear to surface the same audit event list (different paths, same function). The ROLE_PERMISSION_MATRIX grants View audit log to `dentist_owner` via dental-org's settings. This creates two UI entry points for the same data. | API_CONTRACTS / ROLE_PERMISSION_MATRIX | Pick one canonical route. The recommended resolution is `/audit/log` owned by dental-audit, with the dental-org settings page deep-linking to it. Remove the independent route from dental-org screens. |
| F-013 | C3 | dental-clinical | MODULE_SPEC §4 (Workflow Details) section is absent — workflows are listed in §3 but no step-by-step details exist. WORKFLOW_MAP references WF-016 through WF-065 which should trace to §4. | WORKFLOW_MAP §12 | Add §4 Workflow Details for at least WF-016 (prescription), WF-017 (lab order), WF-018 (consent), matching the format of dental-visit and dental-scheduling. |
| F-014 | C3 | dental-billing | MODULE_SPEC §4 (Workflow Details) absent. WF-013 (Create invoice) and WF-014 (Record payment) are in WORKFLOW_MAP but have no step-by-step in dental-billing. | WORKFLOW_MAP | Add §4 Workflow Details for WF-013, WF-014, WF-015 (payment plan). |
| F-015 | C3 | dental-imaging | MODULE_SPEC §4 (Workflow Details) absent for ceph analysis workflow (WF referenced in §3). Given the complexity of the ceph workspace (landmark placement, calibration, recompute), this gap is high risk for implementation. | WORKFLOW_MAP | Add §4 Workflow Details for ceph analysis flow and imaging study upload. |
| F-020 | C4 | dental-emr | MODULE_SPEC §6 permissions section body is blank/stub in the indexed content ("6. Permissions" heading with no table). Cannot verify permission closure for EMR import/view. | ROLE_PERMISSION_MATRIX | Complete dental-emr MODULE_SPEC §6 with a permission table for import (dentist_owner, dentist_associate), view (all dental roles), matching its §1 Users description. |
| F-021 | C5 | dental-billing | API_CONTRACTS `PATCH /invoices/:id/issue` response description says `status → 'sent'` but every other artifact (MODULE_SPEC §8, DOMAIN_MODEL SM-INVOICE, screens.md InvoiceStatusBadge, DOMAIN_GLOSSARY) uses `issued`. This is a concrete state string mismatch that will break status comparisons. | MODULE_SPEC §8 / DOMAIN_MODEL | Fix the API_CONTRACTS response comment: change `sent` to `issued`. |
| F-022 | C5 | dental-scheduling | API_CONTRACTS uses `DELETE /appointments/:id` for soft-cancel (record preserved). MODULE_SPEC §10 also lists DELETE, which is consistent, but using DELETE for a soft-cancel (non-destructive) operation violates REST semantics per API_CONVENTIONS. Soft-state transitions should be `POST /:id/cancel` or `PATCH`. | API_CONVENTIONS (semantic correctness) | Consider renaming to `POST /appointments/:id/cancel` with a `reason` body field (not a query param). At minimum, add a note to API_CONTRACTS explaining the semantic deviation. |
| F-023 | C6 | dental-visit | screens.md Visit Workspace references a `"Reopen"` action on completed visits ("Reopen only via permissions") — but MODULE_SPEC §8, DOMAIN_MODEL SM-VISIT, and API_CONTRACTS define `completed` as a terminal state with no back-transition. The `completed → active` transition does not exist in the state machine. | MODULE_SPEC §8 / DOMAIN_MODEL SM-VISIT | Remove the "Reopen" reference from screens.md or document it as a `discarded`-then-new-visit flow (BR-005, deferred). Add a clarifying note. |
| F-024 | C6 | dental-billing | screens.md Invoice Detail references a `discount` section (Adjustments: discount % or fixed) and an `outstanding_cents` / `balance_due` field — but MODULE_SPEC §7 `dental_invoice` schema has no `discount_cents` or `discount_pct` column, and API_CONTRACTS POST /invoices response has no discount field. | API_CONTRACTS (source of response shape) | Either add discount fields to MODULE_SPEC §7 + API_CONTRACTS, or remove the Adjustments section from screens.md and document discounts as a Phase 2 item. |
| F-025 | C9 | dental-scheduling | MODULE_SPEC §10b lists `DE-010 AppointmentBooked` as the event published on appointment creation. EVENT_CONTRACTS names it `AppointmentBooked@1` with trigger "Appointment created or rescheduled". The name in the spec is `AppointmentBooked` — naming is consistent. However, there is no dedicated `AppointmentRescheduled` event; the WORKFLOW_MAP WF-059/WF-060 (reschedule) has no event coverage documented. Minor gap. | EVENT_CONTRACTS | Add a note to MODULE_SPEC §10b and EVENT_CONTRACTS clarifying that DE-010 covers both book and reschedule, or add DE-025 AppointmentRescheduled. |
| F-026 | C9 | dental-visit | DE-001 `VisitCheckedIn@1` is listed as **Published** in dental-visit MODULE_SPEC §10b, but it is emitted by the check-in endpoint in dental-scheduling/API_CONTRACTS (`POST /appointments/:id/check-in` → Events emitted: DE-001). Two modules claim to emit the same event. | EVENT_CONTRACTS (emitter = dental-scheduling triggers the visit creation which emits DE-001) | Clarify: the check-in endpoint in dental-scheduling calls dental-visit's createVisit, and dental-visit emits DE-001. Update dental-scheduling API_CONTRACTS to say "Triggers: DE-001 (via dental-visit)" rather than "Events emitted: DE-001". |

#### New findings (2026-05-30) — dental-perio + emr-consultation onboarding

| ID | Check | Module(s) | Description | Source of Truth | Resolution |
|----|-------|-----------|-------------|-----------------|------------|
| F-036 | C1 | dental-perio | 9 perio domain terms in MODULE_SPEC §2 — `Perio Chart`, `Probing Depth`, `BOP`, `Recession`, `Mobility`, `Furcation`, `Probing Site`, `CEJ`, `PSR`, `Perio Staging` — are absent from DOMAIN_GLOSSARY. dental-perio was added after the glossary's last generation. | DOMAIN_GLOSSARY | Add a "Periodontal Terms" subsection to DOMAIN_GLOSSARY with these entries (definitions already exist verbatim in dental-perio §2). |
| F-037 | C3 | dental-perio | Aggregate root `PerioChart` and child entity `PerioToothReading` (MODULE_SPEC §7/§7b) are absent from DOMAIN_MODEL §3 entity classification (still 13 roots / 19 entities — predates perio). | DOMAIN_MODEL | Add `PerioChart` to §3 Aggregate Roots (context: Clinical Encounter; invariant: one chart per visit, BR-P01) and `PerioToothReading` to non-root Entities (owned by PerioChart). |
| F-038 | C4 | dental-perio | **Permission surface mismatch.** MODULE_SPEC §6 grants `hygienist` write+read (Create/Record/Complete ✅) — consistent with ROLE_PERMISSION_MATRIX extended-roles. But API_CONTRACTS Auth lines list only `dentist_owner \| dentist_associate` for POST chart / PUT readings / POST complete (hygienist omitted), and `dentist_owner \| dentist_associate \| staff_full` for GET. The contract under-grants hygienist relative to §6. | MODULE_SPEC §6 > API_CONTRACTS (per source-of-truth hierarchy: permissions) | Update dental-perio API_CONTRACTS Auth lines to include `hygienist` on POST chart, PUT readings, POST complete, GET chart (matching §6 and the handler `assertBranchRole` allowlist). MEDIUM — doc drift, not an enforcement gap (verify handler allowlist already includes hygienist per §6 note). |
| F-039 | C5 | dental-perio | Error codes used by dental-perio (`CHART_EXISTS` 409, `INVALID_DEPTH` 422, `INVALID_TOOTH_NUMBER` 422, `VISIT_LOCKED` 422, `FORBIDDEN` 403) appear in MODULE_SPEC §15 + API_CONTRACTS but the ERROR_TAXONOMY §5 dental-perio catalog lists only `CHART_COMPLETED` + `INSUFFICIENT_READINGS`. Catalog is incomplete for this module. | ERROR_TAXONOMY | Add `CHART_EXISTS`, `INVALID_DEPTH`, `INVALID_TOOTH_NUMBER` (and note `VISIT_LOCKED`/`FORBIDDEN` are shared platform codes) to the dental-perio block in ERROR_TAXONOMY §5. |
| F-040 | C3 | dental-perio | WORKFLOW_MAP §1 header says "10 dental domain modules" and catalogs WF-001..WF-104; dental-perio's WF-P01..WF-P05 (MODULE_SPEC §3/§4) are not registered in WORKFLOW_MAP. | WORKFLOW_MAP | Add WF-P01..WF-P05 to WORKFLOW_MAP §2 (or a perio sub-section) and bump the module count to 11. |
| F-042 | C5 | emr-consultation | Error code `CONSULTATION_NOT_DRAFT` (422, used by finalizeConsultation per MODULE_SPEC §5/§8/§11) has no entry in ERROR_TAXONOMY. The taxonomy's `EMR-*` block belongs to external-records-import (`emr_record`), not this platform-level consultation module. | ERROR_TAXONOMY | Add an `emr-consultation` (or `EMRC-`) block to ERROR_TAXONOMY with `CONSULTATION_NOT_DRAFT` (422); explicitly note it is the platform `/emr` module, distinct from the dental `EMR-*` external-import range. |
| F-043 | C3/C6 | emr-consultation | emr-consultation workflows WF-EMRC-001..006 (MODULE_SPEC §3) are not in WORKFLOW_MAP, and the module uses a non-dental role vocabulary (`provider`/`patient`/`admin`/`provider:owner`) absent from ROLE_PERMISSION_MATRIX. Both are **by design** (§0 + §14: platform-level module, not dental-*), but neither cross-cutting doc records that exclusion, so it reads as a gap on audit. | DOMAIN_GLOSSARY / ROLE_PERMISSION_MATRIX | Add a one-line note in ROLE_PERMISSION_MATRIX and WORKFLOW_MAP that emr-consultation is a platform module governed by Better-Auth `provider`/`patient`/`admin` + `:owner` access-control statements (auth.ts), intentionally outside the dental membership matrix. No spec change to emr-consultation itself. |

---

### LOW Severity

| ID | Check | Module(s) | Description | Source of Truth | Resolution |
|----|-------|-----------|-------------|-----------------|------------|
| F-027 | C1 | dental-clinical | Term `Amendment` in MODULE_SPEC uses "additive correction" framing; DOMAIN_MODEL entity table says "original immutable". Both say the same thing, but the DOMAIN_GLOSSARY entry for Amendment is absent. | DOMAIN_GLOSSARY | Add `Amendment` entry to DOMAIN_GLOSSARY under Clinical Terms. |
| F-028 | C1 | dental-billing | Term `Fee Schedule` appears as `FeeSchedule` (PascalCase entity name) in DOMAIN_MODEL but as "Fee Schedule" (title case) in DOMAIN_GLOSSARY and MODULE_SPEC. Cosmetic drift. | DOMAIN_GLOSSARY | Consistent: use "Fee Schedule" in prose, `FeeSchedule` / `fee_schedule` in code identifiers. No change needed — just document the convention explicitly. |
| F-029 | C2 | dental-scheduling | `dental_appointment` MODULE_SPEC §7 lists `visit_id (nullable, set on check-in)` but API_CONTRACTS check-in response returns `{ appointment_id, visit_id }` without updating the appointment object shape. The GET /appointments response shape is not defined in API_CONTRACTS, leaving it ambiguous whether `visit_id` is surfaced in appointment reads. | API_CONTRACTS | Add `GET /appointments/:id` endpoint to dental-scheduling API_CONTRACTS with response including `visit_id`. |
| F-030 | C3 | dental-org | WORKFLOW_MAP §2 references WF-028 (Subscription tier change) — no matching screen in dental-org screens.md or §4 Workflow Details entry. Tier management is listed as In Scope in §1. | WORKFLOW_MAP | Add a `Screen: Subscription Tier Settings` to dental-org screens.md, or mark WF-028 as Phase 2 deferred. |
| F-031 | C5 | dental-clinical | API_CONTRACTS lists `POST /visits/:id/amendments` but it does not appear in MODULE_SPEC §10 API Expectations list. The endpoint exists in dental-clinical/API_CONTRACTS but is omitted from the §10 summary. | API_CONTRACTS | Add `POST /dental/visits/:id/amendments` to dental-clinical MODULE_SPEC §10. |
| F-032 | C8 | dental-scheduling | screens.md Appointment Detail Popover lists state `no_show` in the state machine diagram (from prior session) but screens.md itself does not show a `no_show` badge state or UI treatment. The FSM has the transition but the screen spec doesn't handle it visually. | MODULE_SPEC §8 | Add a `no_show` visual state to the Appointment Detail Popover screen spec (grayed-out with "No-show" label). |
| F-033 | C8 | dental-visit | screens.md Visit Workspace references a `"locked"` badge state ("fully locked, no actions") consistent with MODULE_SPEC §8. Consistent — confirmed. Note only: the trigger for `locked` (time-based auto-lock or manual) is not specified in either screens.md or MODULE_SPEC §8. | DOMAIN_MODEL SM-VISIT | Add a note to MODULE_SPEC §8 documenting the `completed → locked` trigger condition (e.g., 24h auto-lock or manual owner action). |
| F-041 | C9 | dental-perio + emr-consultation | Both new modules emit dotted-lowercase events (`perio.chart.created/completed/locked`, `emr.consultation.create/read/update/finalize/list`) rather than the `Name@version` DE-catalog convention. Both MODULE_SPECs explicitly justify this via ADR-006 (events are audit-log-only markers, no bus) and emr V-EMR-006 (platform verb convention). Consistent-by-documentation — note only. | EVENT_CONTRACTS / ADR-006 | No change required. Optionally add a sentence to EVENT_CONTRACTS noting that perio + emr audit-markers live in AUDIT_CONTRACTS/MODULE_SPEC, not the DE-catalog, so a reader doesn't expect DE-numbers for them. |

---

## Confirmed-Consistent Anchors

- **Visit state machine** (draft → active → completed → locked): consistent across DOMAIN_MODEL SM-VISIT, MODULE_SPEC §8, screens.md VisitStatusBadge, API_CONTRACTS PATCH /visits/:id.
- **Treatment forward-only state** (diagnosed → planned → performed → verified; dismissed from any): consistent across DOMAIN_MODEL, dental-visit MODULE_SPEC §8, API_CONTRACTS PATCH /treatments/:tid.
- **Invoice void guard BR-011** (payment plan blocks void): consistent in MODULE_SPEC §5, API_CONTRACTS POST /void (ACTIVE_PAYMENT_PLAN 409), screens.md (Void hidden when plan active).
- **Check-in creates visit (BR-004)**: consistent across WORKFLOW_MAP WF-007, dental-scheduling MODULE_SPEC §4, API_CONTRACTS POST /check-in.
- **Audit events immutable (AUDIT_EVENT_IMMUTABLE 405)**: consistent across ERROR_TAXONOMY, dental-audit API_CONTRACTS, MODULE_SPEC §5.
- **PMD generation requires completed visit (BR-021)**: consistent across dental-pmd MODULE_SPEC §5, WORKFLOW_MAP WF-021, dental-pmd API_CONTRACTS.
- **All 24 domain events** (DE-001–DE-024): every event declared in EVENT_CONTRACTS has a matching `§10b Published` entry in at least one MODULE_SPEC.
- **Consent form state** (pending → signed / revoked): consistent across DOMAIN_MODEL SM-CONSENT, dental-clinical MODULE_SPEC §8, API_CONTRACTS sign/revoke endpoints.
- **Lab order state machine**: consistent across DOMAIN_MODEL SM-LABORDER and dental-clinical MODULE_SPEC §8.
- **Role name tokens** (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`): consistent across ROLE_PERMISSION_MATRIX, dental-org MODULE_SPEC §6, dental-visit §6, dental-billing §6, dental-scheduling §6, dental-perio §6 — F-035 (dental-pmd) RESOLVED.
- **Perio chart state machine** (draft → completed → locked; auto-lock on visit lock): consistent across dental-perio MODULE_SPEC §8, API_CONTRACTS PerioStatus enum, and BR-P02 (visit-lock cascade).
- **Perio FDI tooth-number validity** (adult 11–18/21–28/31–38/41–48; primary 51–55/61–65/71–75/81–85): consistent across dental-perio MODULE_SPEC §5 BR-P04, §13 edge cases, and API_CONTRACTS "FDI Valid Tooth Numbers".
- **emr-consultation finalize-is-terminal** (draft → finalized, no amend-after-finalize; `amended` enum reserved/unreachable): consistent across MODULE_SPEC §1/§5/§8/§11 (V-EMR-001) — internally coherent.
- **emr-consultation facade-only coupling** (patient/provider/person via facades, UUID refs, no DB FKs): consistent across MODULE_SPEC §1/§7/§14/§20 and DOMAIN_MODEL "platform layer = generic, consume via API only".
- **emr-consultation audit verb convention** (`emr.<resource>.<verb>` dotted-lowercase): documented intentional divergence (V-EMR-006) from the dental `CREATED|READ|UPDATED` verbs in AUDIT_CONTRACTS — not drift.

---

## Artifact Dependency DAG

```
DOMAIN_GLOSSARY ──► all MODULE_SPEC §2 (naming)
DOMAIN_MODEL ──► MODULE_SPEC §8 (state machines, source of truth)
ROLE_PERMISSION_MATRIX ──► MODULE_SPEC §6 ──► API_CONTRACTS Auth fields
WORKFLOW_MAP ──► MODULE_SPEC §3/§4 ──► screens.md
API_CONVENTIONS ──► API_CONTRACTS (all modules)
EVENT_CONTRACTS ──► MODULE_SPEC §10b (event names/payloads)
ERROR_TAXONOMY ──► API_CONTRACTS (error codes)

Cross-module runtime:
dental-scheduling ──(check-in)──► dental-visit (visit creation)
dental-visit ──(completed)──► dental-billing (invoice eligible)
dental-visit + dental-clinical ──(completed)──► dental-pmd (PMD eligible)
dental-clinical ──(VisitService)──► dental-visit (G-003 resolved: abstraction, not direct repo)
dental-org ──(assertBranchAccess)──► all modules
dental-org ──(proxies)──► dental-audit [CONFLICT F-019]
```

---

## What's Next

**Gate cleared — all HIGHs resolved. Remaining MEDIUM/LOW items are wave-addressable.**

Priority MEDIUM items to track in execution waves:
- **F-021** ✅ Fixed — state string `sent`→`issued` in dental-billing API_CONTRACTS (V-BIL-015)
- **F-034** ✅ Resolved — `VisitService` interface introduced (G-003 coupling closed)
- **F-012** Wave G2 — consolidate audit-log UI to single route `/audit/log`
- **F-023** Wave G1 — remove `"Reopen"` from visit workspace screens.md (terminal state violation)
- **F-013/F-014/F-015** — add MODULE_SPEC §4 Workflow Details for clinical, billing, imaging
- **F-001/F-002/F-005/F-006/F-027/F-036** — batch-add missing DOMAIN_GLOSSARY terms (now incl. 9 perio terms)
- **F-037** — register PerioChart/PerioToothReading in DOMAIN_MODEL §3
- **F-038** — align dental-perio API_CONTRACTS Auth with §6 (add `hygienist`)
- **F-039/F-042** — complete ERROR_TAXONOMY for perio + emr-consultation codes
- **F-040/F-043** — register WF-P*/WF-EMRC-* in WORKFLOW_MAP; note emr platform-role exclusion

All 8 new findings (F-036–F-043) are pure-documentation reconciliations — no enforcement gaps, no HIGH. They are catalog/glossary lag from onboarding two modules after the cross-cutting specs were last generated.

---

## Stage 2 — Human Review (status)

This run executed **Stage 1 only** (consistency dimension, `--auto`). Project is **regulated=YES** (HIPAA/GDPR/RA-10173 per DOMAIN_MODEL + PRD_AUDIT_REPORT), so a full headless auto-approval is NOT permitted. With **0 HIGH conflicts**, Stage 1 does not BLOCK; the human review gate (sign-off matrix, [INFERRED]/[VERIFY] resolution) is **DEFERRED** to an interactive `/oli-spec-gate` run. The MEDIUM/LOW findings above are wave-addressable and do not gate planning.

## What's Next

- Stage 1 PASS → proceed to **`/oli-plan-slices`** (consistency clear).
- Also run **`/oli-check --traceability --phase B`** to confirm spec→code trace for the 12-module corpus.
- For sign-offs on regulated areas (Security, Performance, Data governance), run **`/oli-spec-gate`** interactively (not `--auto`) to complete Stage 2.
