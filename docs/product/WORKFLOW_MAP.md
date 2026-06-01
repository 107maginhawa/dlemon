<!-- oli-version: 1.1 -->
<!-- based-on: PRD v3, DOMAIN_GLOSSARY.md, ROLE_PERMISSION_MATRIX.md, MODULE_MAP.md, BUSINESS_RULES.md -->
<!-- generated: 2026-05-24 -->
<!-- skill: oli-workflow-map | depth: deep | auto: true -->

# Workflow Map — Dentalemon

> **Scope:** 10 dental domain modules + Monobase platform layer.  
> **Heuristics run:** All 9 (entity CRUD, role journey, BR trace, state trace, what-if, notification, reporting, search, lifecycle-end).  
> **WF count:** 98 workflows (44 explicit PRD, 54 inferred).  
> **Gaps detected:** 14 (see §14).  
> **Source of truth for state machines:** DOMAIN_GLOSSARY.md + code (marked [DRAFT]).

---

## §1 Executive Summary

| Metric | Value |
|--------|-------|
| Total workflows | 98 |
| Explicit (PRD) | 44 |
| Inferred | 51 |
| Cross-module flows | 16 |
| Orphan BRs | 2 (BR-013, BR-019) |
| Missing error paths | 6 |
| Missing notifications | 5 |
| SLA/SLO cataloged | 22 core workflows |

**Top 3 findings:**
1. **BR-005 auto-discard** — no enforcing workflow exists (deferred per ADR-010). Gap WFG-001.
2. **Patient merge (BR-020)** — no workflow documented anywhere; cross-module cascade unclear. Gap WFG-007.
3. **Concurrent visit conflict** — BR-001 enforced server-side but client recovery path undocumented. Gap WFG-003.

---

## §2 Explicit PRD Workflows

Workflows directly described or implied by FR/AC clauses in PRD v3:

| WF-ID | Name | PRD Ref | Module | Type |
|-------|------|---------|--------|------|
| WF-001 | User Login (email+password) | FR1 | auth | Core |
| WF-002 | User Login (passkey) | FR1 | auth | Core |
| WF-003 | Magic link login (patient) | FR1 | auth | Core |
| WF-004 | Staff invitation + first login | FR6.2 | dental-org | Core |
| WF-005 | Patient registration | FR2 | dental-patient | Core |
| WF-006 | Appointment booking | FR3 | dental-scheduling | Core |
| WF-007 | Appointment check-in → visit creation | FR3, BR-004 | dental-scheduling, dental-visit | Core |
| WF-008 | Workspace open (patient record) | FR6.1 | dental-visit | Core |
| WF-009 | Dental chart entry (condition/treatment) | FR6.1 | dental-visit | Core |
| WF-010 | Treatment mark as performed | FR6.1, BR-006 | dental-visit | Core |
| WF-011 | Clinical notes (SOAP) authoring | FR6.1 | dental-visit | Core |
| WF-012 | Complete visit | FR6.1, BR-002 | dental-visit | Core |
| WF-013 | Create invoice from visit | FR6.3, BR-009 | dental-billing | Core |
| WF-014 | Record payment | FR6.3 | dental-billing | Core |
| WF-015 | Create payment plan | FR6.3, BR-011 | dental-billing | Core |
| WF-016 | Write prescription | FR6.1, BR-017 | dental-clinical | Core |
| WF-017 | Create lab order | FR6.1, BR-018 | dental-clinical | Core |
| WF-018 | Obtain consent signature | FR6.1, BR-014 | dental-clinical | Core |
| WF-019 | Upload radiographic study | FR6.1 | dental-imaging | Core |
| WF-020 | Annotate radiograph | FR6.1 | dental-imaging | Core |
| WF-021 | Generate PMD | FR6.12, BR-021 | dental-pmd | Core |
| WF-022 | Import external PMD | FR6.12, BR-022 | dental-pmd | Core |
| WF-023 | Patient search | FR2 | dental-patient | Core |
| WF-024 | Calendar / schedule view | FR3 | dental-scheduling | Core |
| WF-025 | Configure fee schedule | FR6.3 | dental-org | Admin |
| WF-026 | Configure branch hours | FR6.2 | dental-org | Admin |
| WF-027 | Staff member management | FR6.2 | dental-org | Admin |
| WF-028 | View audit log | §8 NFR | dental-audit | Admin |
| WF-029 | Export practice reports | FR6.2 | dental-org | Reporting |
| WF-030 | Cephalometric analysis | FR6.1 v1.4 | dental-imaging | Core |
| WF-031 | Ceph landmark placement | FR6.1 v1.4 | dental-imaging | Core |
| WF-032 | Initializate dentition | FR6.1 | dental-visit | Core |
| WF-033 | Carry-over treatment display | BR-008 | dental-visit | Core |
| WF-034 | Timeline carousel navigation | FR6.1 ADR-004 | dental-visit | UI |
| WF-035 | Consent revocation | BR-014 | dental-clinical | Alternate |
| WF-036 | Lab order status progression | BR-018 | dental-clinical | Core |
| WF-037 | Medical history entry | FR6.1 | dental-clinical | Core |
| WF-038 | Clinical amendment | FR6.1 | dental-clinical | Core |
| WF-039 | File attachment upload | FR6.1 | dental-clinical | Core |
| WF-040 | Imaging finding record | v1.3 | dental-imaging | Core |
| WF-041 | Invoice void | BR-011, BR-013 | dental-billing | Alternate |
| WF-042 | Fee schedule lookup | FR6.3 | dental-billing | Core |
| WF-043 | Branch-scoped login (membership select) | FR6.2 | dental-org | Core |
| WF-044 | Patient consent at registration | BR-015 | dental-patient | Core |

---

## §2b Periodontal & EMR-Consultation Workflows

> Registered after the cross-cutting tables above were generated. Perio belongs to the already-counted
> `dental-perio` module (one of the 10 dental domain modules — count unchanged). emr-consultation is a
> **platform module** governed by Better-Auth roles (`provider`/`patient`/`admin`, with `provider:owner`/
> `patient:owner`), intentionally **outside** the dental membership matrix.

### Periodontal (dental-perio §3)

| WF-ID | Name | Actor | Priority |
|-------|------|-------|----------|
| WF-P01 | Create perio chart for a visit | Dentist | P1 |
| WF-P02 | Record tooth-level readings (probing, BOP, recession, mobility, furcation) | Dentist | P1 |
| WF-P03 | Complete / lock perio chart | Dentist | P1 |
| WF-P04 | View perio chart (historical) | Dentist, Staff Full | P1 |
| WF-P05 | Print perio chart (PDF export) | Dentist, Staff Full | P1 |

### EMR-Consultation (emr-consultation §3, platform module)

| WF-ID | Name |
|-------|------|
| WF-EMRC-001 | Provider creates a draft consultation note for a patient. |
| WF-EMRC-002 | Provider updates clinical fields on a draft note. |
| WF-EMRC-003 | Provider finalizes a draft note (terminal). |
| WF-EMRC-004 | ~~Provider amends a finalized note, then re-finalizes.~~ STRUCK (V-EMR-001) — no amend endpoint; finalize rejects non-draft notes. |
| WF-EMRC-005 | Patient/provider/admin reads a note, optionally expanding patient/provider/person. |
| WF-EMRC-006 | Provider lists the patients they have consulted (with consultation stats). |

---

## §3 Heuristic 1: Entity CRUD Lifecycle Trace

### Visit

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create (draft) | System (check-in), Dentist | WF-007 | BR-001 (no concurrent active) |
| Create (from workspace +) | Dentist | WF-045 [INFERRED] | BR-005 (auto-discard if empty) |
| Read (workspace) | Dentist, Staff Full | WF-008 | BR-016 (branch access) |
| Read (folder list / carousel) | Dentist, Staff Full | WF-034 | BR-016 |
| Update (add chart entry) | Dentist | WF-009 | BR-003 (immutable after completed) |
| Update (complete visit) | Dentist | WF-012 | BR-002 (linear transition) |
| Update (lock visit) | System (scheduled job) | WF-046 [INFERRED] | BR-002, BR-003 |
| Delete / Discard | System (auto-discard) | WF-047 [INFERRED] | BR-005 (not yet enforced) |
| Archive | N/A — visits are never deleted | — | ADR-009 |
| Bulk | N/A | — | — |

### Treatment

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create (diagnose) | Dentist | WF-009 | BR-006 (forward-only state) |
| Read (treatment table) | Dentist, Staff Full | WF-008 | — |
| Update (plan) | Dentist | WF-048 | BR-006 |
| Update (mark performed) | Dentist | WF-010 | BR-006, BR-007 (immutable after performed) |
| Update (verify) | Dentist-Owner | WF-049 | BR-006 |
| Dismiss | Dentist | WF-050 | BR-006 |
| Archive / bulk | N/A | — | — |

> **WF-048/049/050 confirmed (was [INFERRED], TR-WF-PLAN cleared 2026-06-01):** the treatment FSM
> transitions `diagnosed→planned` (WF-048), `performed→verified` (WF-049), and `any→dismissed`
> (WF-050) are enforced in `dental-visit/treatments/updateDentalTreatment.ts` (forward-only
> transition validation → 422 on invalid per BR-006; dismiss/decline are audited terminal
> transitions) and covered by `treatment.fsm.property.test.ts`, `treatment-fsm-http.test.ts`, and
> `dental-visit.treatment-status-transitions.test.ts`. They are real workflows, not inferred.

### Invoice

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Dentist, Staff Full | WF-013 | BR-009 (≥1 line item) |
| Read (invoice detail) | Dentist, Staff Full | WF-051 [INFERRED] | — |
| Send | Dentist, Staff Full | WF-052 [INFERRED] | BR-012 (draft→sent) |
| Record payment | Staff Full | WF-014 | BR-012 |
| Mark partial | System | WF-053 [INFERRED] | BR-012, BR-015 |
| Mark overdue | System (scheduled job) | WF-054 [INFERRED] | BR-012 |
| Void | Dentist-Owner | WF-041 | BR-011 (no active plan), BR-013 |
| Mark uncollectible | Staff Full | WF-041 | BR-013 (not implemented) |

### Patient

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Staff Full, Dentist-Owner | WF-005 | BR-015 (consent required) |
| Read (search) | All dental roles | WF-023 | BR-016 |
| Read (profile) | All dental roles | WF-055 [INFERRED] | BR-016 |
| Update (demographics) | Staff Full, Dentist-Owner | WF-056 [INFERRED] | — |
| Merge | Dentist-Owner | WF-057 [INFERRED] | BR-020 (not implemented) |
| Archive / delete | Dentist-Owner | WF-058 [INFERRED] | GDPR right-to-erasure |

### Appointment

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Staff, Dentist-Owner | WF-006 | — |
| Read (calendar) | All dental roles | WF-024 | — |
| Check-in | Staff Full, Dentist | WF-007 | BR-004, BR-001 |
| Cancel | Staff, Dentist-Owner | WF-059 [INFERRED] | BR-004 (visit survives) |
| Reschedule | Staff Full, Dentist-Owner | WF-060 [INFERRED] | — |
| Bulk (slot generation) | System (pg-boss job) | WF-061 [INFERRED] | G-001 (not implemented) |

### Consent Form

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create / present | Dentist | WF-018 | BR-014 |
| Sign | Patient (in-person) | WF-018 | BR-014 → pending→signed |
| Revoke | Patient | WF-035 | pending→revoked |
| Read | Dentist, Dentist-Owner | WF-062 [INFERRED] | — |

### Lab Order

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Dentist | WF-017 | BR-018 |
| Send to lab | Dentist | WF-017 | BR-018: pending→sent |
| Mark complete | Dentist | WF-036 | BR-018: sent→completed |
| Cancel | Dentist | WF-063 [INFERRED] | BR-018: any→cancelled |

### Prescription

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Dentist (member) | WF-016 | BR-017 (prescriberMemberId required) |
| Read | Dentist, Dentist-Owner | WF-064 [INFERRED] | — |
| Modify (before visit locked) | Dentist | WF-065 [INFERRED] | BR-003 |

### PMD

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Generate | Dentist, Dentist-Owner | WF-021 | BR-021 (per-visit, completed visit required) |
| Import external | Dentist, Staff Full | WF-022 | BR-022 (read-only, no auto-merge) |
| Download | Dentist, Patient | WF-066 [INFERRED] | — |

### Imaging Study

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Upload study | Dentist | WF-019 | — |
| Add images to study | Dentist | WF-067 [INFERRED] | — |
| Annotate image | Dentist | WF-020 | BR-023–BR-030 |
| Record finding | Dentist | WF-040 | SM-01 |
| Run ceph analysis | Dentist | WF-030 | BR-036–BR-047 |
| Place landmark | Dentist | WF-031 | SM-02 |

### Medical History Entry

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create | Dentist, Staff Full | WF-037 | Append-only |
| Read | All dental roles | WF-068 [INFERRED] | — |
| Amend | Dentist | WF-038 | Amendment model — original immutable |

### Branch / Organization

| Op | Who | WF-ID | Key Rules |
|----|-----|-------|-----------|
| Create org | Platform Admin | WF-069 [INFERRED] | — |
| Create branch | Dentist-Owner, Admin | WF-070 [INFERRED] | — |
| Read (settings) | Dentist-Owner | WF-071 [INFERRED] | — |
| Update hours / details | Dentist-Owner | WF-026 | — |
| Membership add | Dentist-Owner | WF-004, WF-027 | BR-016 |
| Membership remove | Dentist-Owner | WF-072 [INFERRED] | — |

---

## §4 Heuristic 2: Role "Day in the Life" Journey

### Alex — Dentist-Owner

**WF-073 [INFERRED]: Dentist-Owner morning review**
1. Login (WF-001/WF-002) → branch selection (WF-043)
2. Calendar view (WF-024) → review today's appointments
3. Outstanding invoices dashboard (WF-029)
4. Check audit log (WF-028)
5. Adjust fee schedule if needed (WF-025)

**WF-074 [INFERRED]: Dentist-Owner patient visit**
1. Check-in patient (WF-007) → workspace (WF-008)
2. Chart conditions (WF-009) → diagnose treatments
3. Clinical notes (WF-011) → consent (WF-018)
4. Prescriptions (WF-016) / lab orders (WF-017)
5. Complete visit (WF-012) → generate invoice (WF-013) → generate PMD (WF-021)

### Jamie — Dentist Associate

**WF-075 [INFERRED]: Dentist Associate patient session**
1. Login → own appointment list view
2. Open patient workspace (WF-008)
3. Full clinical actions (WF-009 to WF-020) — same as owner except: no staff management, no audit, limited reports
4. Invoice creation allowed; own patients only for billing reports

### Sam — Staff Full

**WF-076 [INFERRED]: Front desk daily workflow**
1. Login → default landing: Schedule (WF-024)
2. Patient arrival → check-in (WF-007)
3. New patient registration (WF-005)
4. Record payments for completed invoices (WF-014)
5. Manage appointment book (WF-006, WF-059, WF-060)

### Pat — Scheduler

**WF-077 [INFERRED]: Scheduler-only daily workflow**
1. Login → default landing: Calendar only (WF-024)
2. Book / reschedule appointments (WF-006, WF-060)
3. No access to workspace, billing, or clinical records
4. Cannot check-in (no workspace access)

### Taylor — Patient

**WF-078 [INFERRED]: Patient portal session**
1. Login via magic link (WF-003)
2. View own PMD documents (WF-066)
3. View appointment history [INFERRED — no explicit PRD flow]
4. Revoke consent (WF-035)

### Platform Admin

**WF-079 [INFERRED]: Admin tenant provisioning**
1. Create organization + branch (WF-069, WF-070)
2. Create first Dentist-Owner account
3. Impersonate user for support
4. View system-level audit logs

---

## §5 Heuristic 3: Business Rule Enforcement Trace

| BR-ID | Rule Summary | Enforcing WF | Error Path | Override? |
|-------|-------------|-------------|-----------|-----------|
| BR-001 | No concurrent active visits | WF-007 | 409 — prompt staff to complete existing visit | No |
| BR-002 | Visit transitions linear only | WF-012, WF-046 | 422 — invalid status transition | No |
| BR-003 | Visit immutable after completed | WF-009, WF-010, WF-016, WF-017 | 403 / UI readOnly flag | No |
| BR-004 | Delete appointment ≠ delete visit | WF-059 | Soft-delete appointment only | No |
| BR-005 | Auto-discard empty visit | WF-047 [INFERRED] | **ORPHAN** — not yet enforced (ADR-010) | — |
| BR-006 | Treatment transitions forward-only | WF-010, WF-048–WF-050 | 422 | No |
| BR-007 | Completed treatment immutable | WF-010 | 403 | No |
| BR-008 | Carry-over display only | WF-033 | UI indicator only | N/A |
| BR-009 | Invoice requires ≥1 line item | WF-013 | 422 | No |
| BR-010 | Tax = 0 stub | WF-013 | N/A (stub) | Phase 2 |
| BR-011 | Active plan blocks void | WF-041 | 409 — resolve plan first | No |
| BR-012 | Invoice state machine | WF-013, WF-014, WF-041, WF-052 | 422 | No |
| BR-013 | markUncollectible incomplete | WF-041 | **ORPHAN** — implementation gap | — |
| BR-014 | Consent required before treatment | WF-018, WF-010 | 422 / UI guard | Dentist-Owner can override |
| BR-015 | Marketing consent at registration | WF-005, WF-044 | UI validation | Patient can opt-out |
| BR-016 | assertBranchAccess every handler | All clinical WFs | 403 | No |
| BR-017 | prescriberMemberId required | WF-016 | 422 | No |
| BR-018 | Lab order lifecycle | WF-017, WF-036, WF-063 | 422 | No |
| BR-019 | Supervisor amendment approval | WF-038 | **DEFERRED** — feature-flagged off (`dental_clinical_amendment_approval`, MODULE_SPEC §18); endpoint is an intentional **501 NOT_IMPLEMENTED stub** with a deferral test (`approveAmendment.test.ts` asserts the 501). NOT a wire gap. | — |
| BR-020 | Patient merge | WF-057 [INFERRED] | **ORPHAN** — not implemented | — |
| BR-021 | PMD = visit snapshot, immutable | WF-021 | Checksum verification | No |
| BR-022 | Imported PMD read-only | WF-022 | 405 PUT/PATCH/DELETE | No |

**Orphan BRs (no enforcing workflow):** BR-005, BR-013, BR-019, BR-020

---

## §6 Heuristic 4: State Transition Trace [DRAFT]

### Visit State Machine

```
draft ──────────► active ──────────► completed ──────────► locked
  │                  │
  │                  └──► discarded  (BR-005 — deferred)
  │
  └──► discarded  (BR-005 — deferred)
```

| Transition | Trigger | Precondition | Side Effect |
|-----------|---------|-------------|------------|
| draft → active | Check-in (WF-007) | BR-001 (no other active) | Creates visitId |
| active → completed | Complete visit (WF-012) | At least 1 chart entry | Immutable flag set |
| completed → locked | Scheduled job (WF-046) | Time elapsed | All edits blocked |
| active → discarded | System (WF-047) | BR-005 (empty session) | Visit soft-deleted |

### Treatment State Machine

```
diagnosed ──► planned ──► performed ──► verified
     │            │            │
     └────────────┴────────────┴──► dismissed (any non-terminal)
```

| Transition | Trigger | Precondition |
|-----------|---------|-------------|
| diagnosed → planned | Dentist (WF-048) | Visit active |
| planned → performed | Dentist (WF-010) | Visit active |
| performed → verified | Dentist-Owner (WF-049) | — |
| any → dismissed | Dentist (WF-050) | Visit not locked |

### Invoice State Machine

```
draft ──► sent ──► paid
              ├──► partial ──► paid (via payment plan)
              └──► overdue
draft/sent ──► void (BR-011: no active payment plan)
              └──► uncollectible (BR-013: incomplete)
```

### Consent Form State Machine

```
pending ──► signed
        └──► revoked
```

### Lab Order State Machine

```
pending ──► sent ──► completed
        └──► cancelled
sent    ──► cancelled
```

### Imaging Finding State Machine (SM-01)

```
[from code / BR-023–035 — see BUSINESS_RULES.md §Imaging]
draft ──► confirmed ──► resolved
```

### Ceph Landmark State Machine (SM-02)

```
[from code / BR-036–047 — see BUSINESS_RULES.md §Ceph]
not_placed ──► placed ──► locked
```

---

## §7 Heuristic 5: "What If" Checklist

Applied to the 10 highest-impact core workflows:

### WF-007: Check-in → Visit creation

| Scenario | Behavior |
|----------|---------|
| **Timeout** | Visit remains draft; staff must manually complete or discard |
| **Cancel mid-check-in** | Draft visit created; staff discards manually (BR-005 not auto) |
| **Retry / concurrent** | BR-001: second check-in blocked; 409 returned |
| **Partial failure** | Appointment created, visit draft fails → orphan appointment. **Gap WFG-002** |
| **Offline** | Cadence CRDT handles; visit draft stored locally, synced on reconnect |

### WF-013: Create invoice

| Scenario | Behavior |
|----------|---------|
| **Timeout** | Invoice not created; idempotent retry safe |
| **Zero items** | 422 (BR-009) |
| **Concurrent create** | Two dentists for same visit → two invoices possible. **Gap WFG-004** |
| **Partial failure** | Line item added, invoice save fails → orphan line items. **Gap WFG-004** |

### WF-012: Complete visit

| Scenario | Behavior |
|----------|---------|
| **Unsigned consent** | Dentist must obtain consent first (BR-014) |
| **Undo** | Not possible after `completed` — amendment model only |
| **Concurrent** | Second `complete` call is idempotent (already completed) |

### WF-021: Generate PMD

| Scenario | Behavior |
|----------|---------|
| **Visit not completed** | 422 — must be completed first |
| **Checksum mismatch on verify** | BR-021 enforcement — reject import |
| **Timeout** | PMD generation async? — **Gap WFG-005** (SLA unclear) |

---

## §8 Heuristic 6: Notification Trace

| Trigger Event | Who Notified | Channel | WF-ID | Implemented? |
|--------------|-------------|---------|-------|-------------|
| Appointment booked | Patient | Email | WF-080 [INFERRED] | Unknown |
| Appointment reminder (24h) | Patient | Email/SMS | WF-081 [INFERRED] | Not found in code |
| Invoice sent | Patient | Email | WF-082 [INFERRED] | Unknown |
| Invoice overdue | Patient | Email | WF-083 [INFERRED] | Not found |
| Staff invitation | New staff | Email | WF-004 | Yes (Better-Auth) |
| PMD ready | Patient | Email | WF-084 [INFERRED] | Not found |
| Lab order complete | Dentist | In-app | WF-085 [INFERRED] | Not found |

**Missing notification flows:** Appointment reminder, invoice overdue, PMD ready, lab order complete all have no documented or implemented notification path. **Gaps WFG-009 to WFG-013.**

---

## §9 Heuristic 7: Reporting/Dashboard Trace

| Report/Dashboard | Who Views | Data | WF-ID | Implemented? |
|-----------------|----------|------|-------|-------------|
| Practice revenue summary | Dentist-Owner | Invoices by period | WF-029 | Partial |
| Patient visit history | Dentist, Staff | All visits for patient | WF-008 (carousel) | Yes |
| Outstanding invoices list | Staff Full, Owner | Invoice status | WF-051 | Yes |
| Treatment plan summary | Dentist | All treatments per visit | WF-008 | Yes |
| Audit log | Dentist-Owner | All system events | WF-028 | Yes |
| Appointment utilization | Dentist-Owner | Slot fill rate | WF-086 [INFERRED] | Not found |
| Prescription history | Dentist | Per-patient Rx | WF-064 | Yes |
| Imaging study list | Dentist | Per-patient studies | WF-087 [INFERRED] | Yes |
| PMD archive | Dentist, Patient | Per-patient PMDs | WF-066 | Yes |

---

## §10 Heuristic 8: Search/Filter Trace

| Entity | Search Criteria | Filters | Default Sort | WF-ID |
|--------|----------------|---------|-------------|-------|
| Patient | Name, DOB, phone | Branch, status | Created desc | WF-023 |
| Appointment | Patient name, date | Status, dentist, date range | Date asc | WF-024 |
| Invoice | Patient name, invoice # | Status, date range | Created desc | WF-051 |
| Treatment | CDT code, tooth | Status, visit | Visit date desc | WF-008 |
| Imaging study | Study type | Date range, tooth | Date desc | WF-087 |
| Audit log | Actor, event type | Date range, module | Timestamp desc | WF-028 |
| Prescription | Drug name | Status | Created desc | WF-064 |

**Missing search flows:**
- Lab orders — no documented search/filter. **Gap WFG-014.**
- Consent forms — no list view documented. **Gap WFG-014.**

---

## §11 Heuristic 9: Lifecycle End Trace

| Entity | End Condition | Action | Retention | Compliance |
|--------|-------------|--------|-----------|-----------|
| Visit | Locked (completed + time) | Immutable archive | Indefinite (clinical record) | HIPAA/RA-10173 |
| Treatment | Verified or dismissed | Soft-state in visit | Indefinite | Clinical record |
| Invoice | Paid, void, uncollectible | Archived | 7 years (financial) | Local tax law |
| Patient | GDPR erasure request | PHI purge — **Gap WFG-006** | 0 after erasure | GDPR Art. 17 |
| Appointment | Cancelled, completed | Soft-delete | 1 year | Admin |
| PMD | N/A (snapshot, immutable) | Patient retains | Indefinite | Portable record |
| Consent Form | Revoked | Revoked state persists | Indefinite (audit trail) | HIPAA |
| Audit Log | N/A | Immutable append-only | 7 years minimum | HIPAA/GDPR |
| Staff Membership | Removed | Deactivated | Indefinite (audit) | — |
| Imaging Study | N/A | No delete defined | Indefinite | Clinical |

**WF-088 [INFERRED]: GDPR Patient Erasure**
- Triggered by: Patient request
- Actors: Platform Admin, Dentist-Owner
- Actions: PHI purge across patient, visit, clinical, billing records; audit log entry preserved
- Gap: No implementation in any module. **WFG-006.**

---

## §12 Cross-Module Flows

| WF-ID | Flow Name | Modules Involved | Handoff Type | Data Passed |
|-------|-----------|-----------------|-------------|-------------|
| WF-089 | Check-in flow | dental-scheduling → dental-visit | Sync API | appointmentId → visitId |
| WF-090 | Visit → Invoice creation | dental-visit → dental-billing | Sync API | visitId, treatmentIds |
| WF-091 | Imaging context from visit | dental-visit → dental-imaging | UUID ref (loose coupling) | patientId, visitId (UUID only) |
| WF-092 | PMD generation | dental-visit + dental-clinical + dental-pmd | Sync API | visitId, all clinical records |
| WF-093 | Clinical amendment approval | dental-clinical → dental-visit (supervisor) | **Broken** — direct repo import (G-003) | VisitRepository imported directly |
| WF-094 | Carry-over treatment display | dental-visit → dental-visit (prev visits) | Async query | treatmentIds with status=planned |
| WF-095 | Notification on appointment | dental-scheduling → notifs | Async (pg-boss) | appointmentId, patientPersonId |
| WF-096 | Audit trail on every write | All modules → dental-audit | Async (pg-boss) | eventType, actorId, resourceId |
| WF-097 | Fee schedule on invoice | dental-billing → dental-org | Sync API | branchId, cdt_code |
| WF-098 | Storage for attachments | dental-clinical → storage | Sync (S3/MinIO) | fileId, branchId |
| WF-099 | Storage for imaging | dental-imaging → storage | Sync (S3/MinIO) | studyId, fileId |
| WF-100 | EMR import into patient records | dental-emr → dental-patient + dental-clinical | Sync API | External record → patient records |
| WF-101 | PMD import creates records | dental-pmd → dental-patient (BR-022) | Read-only store | importedPmd record only |
| WF-102 | Dentition init on first visit | dental-visit → dental-visit (tooth entities) | Internal | patientId, dentitionType |
| WF-103 | Booking slot generation (job) | booking → dental-scheduling | Async pg-boss | branchId, hostId, schedule |
| WF-104 | Email notifications | notifs → email | Async pg-boss | recipientPersonId, template |

**Workflow Composition (subprocess patterns):**
- WF-007 ⊃ WF-089 (check-in calls scheduling→visit)
- WF-013 ⊃ WF-090 (invoice creation calls visit→billing)
- WF-021 ⊃ WF-092 (PMD calls visit+clinical+pmd)
- WF-004 ⊃ WF-104 (invitation sends email via notifs)

---

## §13 SLA/SLO Catalog

| WF-ID | Workflow | SLA Target | Type | Source |
|-------|---------|-----------|------|--------|
| WF-001 | Login | < 500ms | User-facing | [INFERRED] |
| WF-007 | Check-in | < 2s | User-facing | PRD §NFR |
| WF-008 | Workspace open | < 2s | User-facing | PRD §NFR |
| WF-009 | Chart entry | < 1s | User-facing | PRD §NFR |
| WF-010 | Mark performed | < 1s | User-facing | PRD §NFR |
| WF-012 | Complete visit | < 2s | User-facing | PRD §NFR |
| WF-013 | Create invoice | < 2s | User-facing | PRD §NFR |
| WF-014 | Record payment | < 2s | User-facing | PRD §NFR |
| WF-019 | Upload imaging study | < 10s (10MB) | User-facing | [INFERRED] |
| WF-020 | Annotate radiograph | < 1s (local) | User-facing | PRD: 60fps carousel |
| WF-021 | Generate PMD | < 5s | Background | [INFERRED] |
| WF-023 | Patient search | < 1s | User-facing | PRD §NFR |
| WF-024 | Calendar view | < 2s | User-facing | PRD §NFR |
| WF-030 | Ceph analysis | < 3s | User-facing | [INFERRED] |
| WF-046 | Visit lock job | Within 24h | Scheduled | [INFERRED] |
| WF-054 | Invoice overdue job | Within 24h | Scheduled | [INFERRED] |
| WF-080 | Appointment notification | < 30s | Async | [INFERRED] |
| WF-081 | Appointment reminder | Within 1min of schedule | Async | [INFERRED] |
| WF-096 | Audit trail write | < 5s | Background | [INFERRED] |
| WF-092 | PMD generation | < 5min | Background | [INFERRED] |
| WF-103 | Slot generation job | Within scheduled window | Scheduled | [INFERRED] |
| WF-088 | GDPR erasure | < 30 days (legal) | Admin | GDPR Art. 12 |

---

## §14 Discovered Gaps

| Gap ID | Type | Description | Impact | Linked BRs |
|--------|------|-------------|--------|-----------|
| WFG-001 | Missing workflow | BR-005 auto-discard has no enforcing workflow or implementation | MEDIUM — empty visits pollute history | BR-005 |
| WFG-002 | Missing error path | Check-in partial failure (appointment created, visit draft fails) — no recovery path | HIGH — data inconsistency | BR-004 |
| WFG-003 | Missing error path | BR-001 concurrent visit conflict — client recovery UX undefined | MEDIUM | BR-001 |
| WFG-004 | Missing error path | Concurrent invoice creation for same visit — two invoices possible | HIGH — billing integrity | BR-009, BR-012 |
| WFG-005 | SLA undefined | PMD generation SLA unspecified — sync or async unclear | MEDIUM — UX impact | BR-021 |
| WFG-006 | ~~Missing workflow~~ Implemented (V-DG-002) | GDPR patient erasure — anonymize-on-request workflow in `handlers/dental-erasure/` (Person+Patient targets, two-step audited, legal-hold blocks) + admin HTTP endpoints `/dental/erasure-requests`. Remaining: more entity targets, real LegalHold store | RESOLVED | — |
| WFG-007 | Missing workflow | Patient merge (BR-020) — no workflow, no cross-module cascade defined | HIGH — data integrity | BR-020 |
| WFG-008 | Orphan BR | BR-013 markUncollectible — incomplete implementation, no documented error path | MEDIUM — billing ops | BR-013 |
| WFG-009 | Missing notification | Appointment reminder (24h) — not implemented | LOW–MEDIUM | — |
| WFG-010 | Missing notification | Invoice overdue notification — not implemented | MEDIUM — revenue | — |
| WFG-011 | Missing notification | PMD ready notification — not implemented | LOW | — |
| WFG-012 | Missing notification | Lab order complete notification — not implemented | LOW | BR-018 |
| WFG-013 | Missing notification | Appointment booking confirmation to patient — unknown status | MEDIUM | — |
| WFG-014 | Missing search | Lab orders and consent forms have no documented list/search flow | LOW | — |

---

## §15 Routing Recommendation

**Critical gaps exist** (WFG-002, WFG-004, WFG-006, WFG-007 are HIGH impact). These should be escalated to PRD amendment:
- WFG-006 (GDPR erasure) and WFG-007 (patient merge) require PRD-level decisions.
- WFG-002 and WFG-004 require error handling spec additions.

**Many [INFERRED] workflows** (54 of 98) — review with domain expert before treating as requirements.

**Next step:** `/oli-domain-model --depth lean` to formalize entities and bounded contexts.
