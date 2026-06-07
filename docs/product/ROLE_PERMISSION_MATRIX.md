<!--
oli: oli-prd-audit v1.0 | generated: 2026-05-24 | source: docs/prd/v3-dentalemon.md §6.6, ROLE_MATRIX.md, auth.ts
-->

# Role Permission Matrix — Dentalemon

> Sources: PRD §6.6, §9.3, `docs/architecture/ROLE_MATRIX.md`, `src/utils/auth.ts`. Tags: [PRD] = from PRD, [CODE] = from codebase.

---

> **⚠️ Code-tightening note (2026-05-30 compliance pass):** Handler authorization was tightened to
> match this matrix exactly, closing two prior instances of silent code drift:
> - **`staff_full` → Create invoice is now DENIED** (matrix: ❌; see Billing Write Operations). The
>   code previously permitted it.
> - **`hygienist` → Create visit and Create consent form are now DENIED** (matrix: clinical-write
>   ops are ✅ only for `dentist_owner` / `dentist_associate`). The code previously permitted
>   hygienist create-visit.
>
> If the clinical workflow genuinely requires hygienist-create-visit (e.g. hygiene-led perio
> appointments), that must be revisited as a **deliberate, documented matrix amendment** — updating
> the Clinical Write Operations table here first — **not** reintroduced as silent code drift.

> **✅ E3 amendment (2026-06-08) — hygienist-led HYGIENE visits, scoped by `visitType`.**
> Product approved hygiene-led recall/prophy/perio. The fix is **type-scoped**, not a blanket
> re-grant: dental visits now carry a `visitType` (`general` | `hygiene`, default `general`).
> A hygienist gains authority **only** on a `hygiene`-typed visit; **GENERAL (dentist-led) visit
> gates are UNCHANGED**. Specifically, for `hygiene` visits the hygienist MAY: create/own the visit
> (`createDentalVisit` with `visitType: hygiene`), be checked in (a `hygiene` appointment derives a
> hygiene visit on `checkInAppointment`), draft notes, and **sign** notes. `dentistMemberId`
> (provider-of-record) on a hygiene visit MAY be the hygienist's own membership id. On `general`
> visits the hygienist remains DENIED create/check-in/draft/sign exactly as before. The Clinical
> Write Operations table below is annotated accordingly (✅ᴴ = hygiene-typed visits only).

---

## Actors

| Actor | System Role | Context Role | Auth Method |
|-------|------------|--------------|-------------|
| Alex — Dentist-Owner | `user` | `dentist_owner` (DentalMembership) | Email+password, passkey |
| Jamie — Dentist Associate | `user` | `dentist_associate` (DentalMembership) | Email+password, passkey |
| Sam — Front Desk (Full) | `user` | `staff_full` (DentalMembership) | Email+password |
| Pat — Scheduler | `user` | `staff_scheduling` (DentalMembership) | Email+password |
| Taylor — Patient | `user` | — (no DentalMembership) | Email+password, magic link |
| Platform Admin | `admin` | — | Email+password (admin-created) |
| Referring Provider | External | API key (limited) | API key |

---

> **Note — emr-consultation (`/emr`) is platform-role-governed.** The platform consultation-notes module is
> governed by Better-Auth roles (`provider`/`patient`/`admin`, with `provider:owner`/`patient:owner`), NOT by
> the dental membership matrix below.

---

## Module Permission Matrix

### PRD-defined Role Access (FR6.2)

| Module | Dentist-Owner | Dentist Associate | Staff – Full | Staff – Scheduling |
|--------|:------------:|:-----------------:|:------------:|:------------------:|
| Dashboard | Full | Own patients only | Schedule + follow-ups (no financials) | No access |
| Clinical Workspace | Full R/W | Full R/W | View-only + process payments | No access |
| Patient Records | Full CRUD | Read + Register | Read + Register | Read only |
| Scheduling | Full | Full | Full | Full |
<!-- V-PAT-008: see "Patient Records read access" note below — list/search READ is clinic-wide. -->

> **V-PAT-008 reconciliation (Patient Records read access):** patient **list/search READ**
> (`GET /dental/patients`, `listDentalPatients.ts`) is the **clinic-wide floor** — it is granted to
> all four PRD personas **plus the extended staff roles** `dental_assistant`, `front_desk`,
> `billing_staff`, and `read_only` (9 context roles total), scoped to the caller's branch. Read
> access being broad is intentional; write/register operations remain restricted as in the tables
> below. The PRD "Read only / Read + Register" cells describe the four core personas only.
| Billing | Full | Own patients + record payments | Record payments only | No access |
| Reports | Full | No access | No access | No access |
| Staff & Roles | Full | No access | No access | No access |
| Settings | Full | No access | No access | No access |

### Default Landing Page by Role

| Role | Landing Page |
|------|-------------|
| Dentist-Owner | Dashboard |
| Dentist Associate | Dashboard (filtered to own patients) |
| Staff – Full | Patient List |
| Staff – Scheduling | Calendar |
| Patient | Patient portal (Phase 2) |

### Extended Staff Roles (G8-S3) [CODE]

The `member_role` enum (`dental-org/repos/membership.schema.ts`) defines **5 additional** context roles beyond the four PRD personas above. These were previously undocumented; the dental-org `MODULE_SPEC.md` §6 Member Role Catalog is the authoritative description. Summary:

| Context Role | Clinical? | Closest PRD analog | Key permissions | Admin (staff/roles/fees/audit) |
|--------------|:---------:|--------------------|-----------------|:------------------------------:|
| `hygienist` | ✅ | between associate & staff_full | Clinical R/W for hygiene (perio, prophy); no billing edits | ❌ |
| `dental_assistant` | ✅ assist | staff_full + chairside | Chart updates under a dentist, imaging capture | ❌ |
| `front_desk` | ❌ | staff_full (reception subset) | Check-in, scheduling, demographics | ❌ |
| `billing_staff` | ❌ | staff_full (billing subset) | Invoices, payments, fee-schedule **read** | ❌ |
| `read_only` | ❌ | auditor/observer | Read-only on permitted records; no writes | ❌ |

> Only `dentist_owner` passes `assertBranchRole(['dentist_owner'])`. All nine roles carry Better-Auth system role `user`; capability is scoped by the context role above.

---

## Detailed Permission Statements

### Clinical Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling | hygienist |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Create/edit visit | ✅ | ✅ | ❌ | ❌ | ✅ᴴ |
| Add treatment | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update treatment status | ✅ | ✅ | ❌ | ❌ | ❌ |
| Write prescription | ✅ | ✅ (prescriberMemberId req) | ❌ | ❌ | ❌ |
| Create lab order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Draft visit notes | ✅ | ✅ | ❌ | ❌ | ✅ᴴ |
| Sign visit notes | ✅ | ✅ | ❌ | ❌ | ✅ᴴ |
| Create consent form | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload attachment | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create amendment | ✅ | ✅ | ❌ | ❌ | ❌ |

> **✅ᴴ = HYGIENE-typed visits only (E3).** The hygienist may create/own/check-in, draft, and sign
> a visit **only** when its `visitType` is `hygiene`. On `general` (dentist-led) visits these cells
> are ❌ for the hygienist — the dentist-only gates are unchanged. `dental_assistant` may also draft
> notes (under supervision, see E2) but may never sign. The backend enforces this with a conditional
> `assertBranchRole` that computes the allowed role set from the visit's `visitType`
> (`createDentalVisit`, `checkInAppointment`, `upsertVisitNotes`, `signVisitNotes`).

### Billing Write Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create invoice | ✅ | Own patients only | ❌ | ❌ |
| Issue invoice | ✅ | Own patients only | ❌ | ❌ |
| Record payment | ✅ | ✅ | ✅ | ❌ |
| Void invoice | ✅ | ❌ | ❌ | ❌ |
| Create payment plan | ✅ | Own patients only | ❌ | ❌ |

### Scheduling Write Operations

> **N-SCH-03 amendment (2026-05-30):** The PRD-level "Scheduling | Full | Full | Full | Full" row
> above is a coarse module-access grant. Two scheduling **state-change** operations are restricted
> per dental-scheduling **MODULE_SPEC §6**, which is authoritative for these endpoints. In
> particular, `staff_scheduling` is **EXCLUDED** from both cancel and check-in (it may still book,
> reschedule, and view the calendar). The handlers (`cancelAppointment.ts`, `checkInAppointment.ts`)
> implement exactly this — the broader PRD row and prior contract drafts are reconciled to MODULE_SPEC §6 here.

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Book appointment | ✅ | ✅ | ✅ | ✅ |
| Reschedule appointment | ✅ | ✅ | ✅ | ✅ |
| View calendar | ✅ | ✅ | ✅ | ✅ |
| Cancel appointment | ✅ | ❌ | ✅ | ❌ |
| Check-in (creates visit) | ✅ | ✅ | ✅ | ❌ |

> **E3 check-in note:** `checkInAppointment` derives the created visit's `visitType` from the
> appointment's service type (`hygiene` → hygiene visit; everything else → general visit). A
> **hygienist MAY check in a `hygiene` appointment** (producing a hygiene visit it is authorized to
> own) but is **DENIED** check-in of any general appointment. The owner/associate/staff_full
> check-in grants above are unchanged.

### Administrative Operations

| Operation | dentist_owner | dentist_associate | staff_full | staff_scheduling |
|-----------|:---:|:---:|:---:|:---:|
| Create/edit staff | ✅ | ❌ | ❌ | ❌ |
| Assign roles | ✅ | ❌ | ❌ | ❌ |
| View audit log | ✅ | ❌ | ❌ | ❌ |
| Configure fee schedule | ✅ | ❌ | ❌ | ❌ |
| Configure branch hours | ✅ | ❌ | ❌ | ❌ |
| Export reports | ✅ | ❌ | ❌ | ❌ |
| Generate PMD | ✅ | ✅ | ❌ | ❌ |

---

## System-Level Roles (Better-Auth)

| Role | Capability |
|------|-----------|
| `admin` | Full platform access; user impersonation; system management |
| `user` | Authenticated session; capabilities further scoped by DentalMembership role |
| `support` | [INFERRED] Read-only audit access for support team |

## Better-Auth Access Control Statements

```typescript
// From src/utils/auth.ts
patient:  ['patient:read', 'patient:update', 'patient:consent:manage',
           'communication:send/read', 'file:upload/read']
provider: ['provider:read/update', 'patient:read/search',
           'communication:send/read', 'file:upload/read/download']
admin:    ['admin:*', 'patient:*', 'provider:*', 'communication:*',
           'file:*', 'audit:read', 'system:manage', 'user:impersonate']
```

---

## Gaps & Open Questions

| Gap | Priority |
|-----|---------|
| Associate "own patients" definition not enforced at DB level — verified by membership check only | P2 |
| Patient portal permissions undefined (Phase 2 scope) | P3 |
| Referring provider (external) API key scope not specified | P2 |
| Admin role can impersonate — no break-glass audit trail specified | P1 |
