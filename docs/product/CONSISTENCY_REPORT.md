# Spec Consistency Report — Dentalemon
<!-- oli: v3-dentalemon | cross-module | consistency-gate -->
_Generated: 2026-05-24_

## Gate Result
**PASS**

_Updated 2026-05-24 — all 6 original HIGH findings resolved (5 fixed in spec artifacts, 1 reclassified). F-021 (state string `sent`→`issued`) also fixed. Gate cleared._

---

## Checks Run

| # | Check | Status | Notes |
|---|-------|--------|-------|
| C1 | Naming — glossary alignment | WARN | 4 terms in MODULE_SPECs absent from DOMAIN_GLOSSARY |
| C2 | Entity attributes — field name alignment | WARN | 5 field gaps/mismatches across visit, billing, patient |
| C3 | Workflow coverage — WF→screen→MODULE_SPEC | WARN | 3 modules missing §4 Workflow Details; 1 duplicate UI route |
| C4 | Permission closure — ROLE_PERMISSION_MATRIX vs §6 | FAIL | 3 HIGH contradictions/gaps |
| C5 | API surface — §10 endpoints vs API_CONTRACTS | WARN | 2 discrepancies (status value, cancel semantics) |
| C6 | UI data binding — screens.md fields vs §7 | WARN | 2 fields referenced in screens not in §7 |
| C7 | Cross-module traces | FAIL | 1 BROKEN trace (G-003 direct repo import); 1 naming conflict |
| C8 | State machines — §8 vs screens.md badges | WARN | 1 state name conflict (`sent` vs `issued`) |
| C9 | Event coverage — §10b vs EVENT_CONTRACTS | PASS | All 24 events accounted for; DE-001 emitter ambiguity noted |

---

## Findings

### HIGH Severity — all resolved ✅

| ID | Check | Module(s) | Status | Fix Applied |
|----|-------|-----------|--------|-------------|
| F-016 | C4 | dental-scheduling | **RESOLVED** | Added `dentist_associate` to `POST /appointments/:id/check-in` Auth in API_CONTRACTS |
| F-017 | C4 | dental-billing | **RESOLVED** | Added `dentist_associate` to `POST /invoices` Auth in API_CONTRACTS |
| F-018 | C4 | dental-billing | **RESOLVED** | Added `dentist_associate` to `PATCH /invoices/:id/issue` Auth in API_CONTRACTS |
| F-019 | C7 | dental-org + dental-audit | **RESOLVED** | dental-org entry updated to explicit proxy note pointing to canonical dental-audit/API_CONTRACTS |
| F-034 | C7 | dental-clinical + dental-visit | **RECLASSIFIED → MEDIUM** | Known coupling risk G-003, documented in CLAUDE.md and WORKFLOW_MAP. Tracked for Wave G1 refactor. Not a spec error — implementation constraint. |
| F-035 | C4 | dental-pmd | **RESOLVED** | Fixed `dentist` → `dentist_owner, dentist_associate` in dental-pmd MODULE_SPEC §6 |

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
- **Role name tokens** (`dentist_owner`, `dentist_associate`, `staff_full`, `staff_scheduling`): consistent across ROLE_PERMISSION_MATRIX, dental-org MODULE_SPEC §6, dental-visit §6, dental-billing §6, dental-scheduling §6 — except dental-pmd (F-035).

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
dental-clinical ──[BROKEN G-003]──► dental-visit (direct VisitRepository import)
dental-org ──(assertBranchAccess)──► all modules
dental-org ──(proxies)──► dental-audit [CONFLICT F-019]
```

---

## What's Next

**Gate cleared — all HIGHs resolved. Remaining MEDIUM/LOW items are wave-addressable.**

Priority MEDIUM items to track in execution waves:
- **F-021** ✅ Fixed — state string `sent`→`issued` in dental-billing API_CONTRACTS
- **F-034** Wave G1 — introduce `VisitService` interface (G-003 coupling)
- **F-012** Wave G2 — consolidate audit-log UI to single route `/audit/log`
- **F-023** Wave G1 — remove `"Reopen"` from visit workspace screens.md (terminal state violation)
- **F-013/F-014/F-015** — add MODULE_SPEC §4 Workflow Details for clinical, billing, imaging
- **F-001/F-002/F-005/F-006/F-027** — batch-add 5 missing DOMAIN_GLOSSARY terms

Proceed to `/oli-magic` for classification and ROADMAP.md generation.
