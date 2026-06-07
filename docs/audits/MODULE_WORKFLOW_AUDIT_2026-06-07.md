# Module / Workflow Alignment Audit — Dentalemon

> **Date:** 2026-06-07
> **Branch:** `feat/module-workflow-alignment`
> **Scope:** Full module inventory, workflow + business-rule alignment, cross-module flow integrity, knowledge-graph refresh, test-coverage matrix, and clinical-persona completeness.
> **Method:** Source-doc review (MODULE_MAP, DOMAIN_MODEL, WORKFLOW_MAP, ROLE_PERMISSION_MATRIX, BUSINESS_RULES, personas, IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD, MODULE_TEMPLATE) cross-checked against `services/api-ts/src/handlers/`, `specs/api/src/modules/`, and `apps/dentalemon/src/`. This was an audit **plus** alignment + gap-build effort: bugs surfaced during the audit were fixed in-session and are documented in §8.

---

## §1 Executive Summary & V1 Readiness Verdict

**Verdict: V1-ready for clinical operations.** All 28 modules are implemented end-to-end (TypeSpec → handler → route → OpenAPI path), the verified gate is green (backend tsc 0 errors; backend suite 3513 pass / 0 fail; frontend typecheck clean, 2145 pass / 0 fail; contract 43/46 with the 3 failures being pre-existing infra-only; `check:boundaries` clean; lint 0 errors), and every clinical persona now has a real backend + frontend path for its core workflow.

This audit's headline finding is that the codebase is **more complete than its own documentation implied.** The four "spec-only-looking" TypeSpec files (`dental-clinical-ops`, `dental-patient-engagement`, `dental-patient-finance`, `dental-ops-extras`) are fully implemented — their handlers live in bounded-context subfolders of `dental-clinical`/`dental-patient`/`dental-scheduling`/`dental-org` because handler-dir names are derived from the OpenAPI **tag**, not the spec filename. This convention was undocumented and caused the apparent gap; it is now codified in `MODULE_TEMPLATE.md` (§2).

The audit nonetheless surfaced **8 real bugs** — including one **cross-tenant security hole** (`updateTreatmentPlan` had no branch-access check) and two **100%-unreachable handlers** (provider `createPractitioner`/`createPractitionerRole`) — all fixed this session (§8). It also closed persona gaps by building the `treatment_coordinator` role, wiring the `dental_assistant` clinical-assist workflow, enabling hygienist-led hygiene visits, and laying a Phase-1 patient-portal read foundation (§7). A backlog of findings requiring product decisions is logged in §8.

---

## §2 Confirmed 28-Module Inventory

All 28 modules have TypeSpec definitions, handler implementations, registered routes, and OpenAPI paths. Two additional directories (`shared/`, `retention/`) are intentionally non-HTTP and carry no spec.

### Inventory

| # | Module | Layer | Handler dir | Spec file / source |
|---|--------|-------|-------------|--------------------|
| 1 | person | base | `person/` | `person.tsp` |
| 2 | billing | base | `billing/` | `billing.tsp` |
| 3 | booking | base | `booking/` | `booking.tsp` |
| 4 | audit | base | `audit/` | `audit.tsp` |
| 5 | notifs | base | `notifs/` | `notifs.tsp` |
| 6 | comms | base | `comms/` | `comms.tsp` |
| 7 | storage | base | `storage/` | `storage.tsp` |
| 8 | email | base | `email/` | `email.tsp` |
| 9 | reviews | base | `reviews/` | `reviews.tsp` |
| 10 | patient | healthcare | `patient/` | `patient.tsp` |
| 11 | provider | healthcare | `provider/` | `provider.tsp` |
| 12 | emr | healthcare | `emr/` | `emr.tsp` |
| 13 | dental-visit | dental | `dental-visit/` | `dental-visit.tsp` |
| 14 | dental-clinical | dental | `dental-clinical/` | `dental-clinical.tsp` |
| 15 | dental-imaging | dental | `dental-imaging/` | `dental-imaging.tsp` |
| 16 | dental-perio | dental | `dental-perio/` | `dental-perio.tsp` |
| 17 | dental-pmd | dental | `dental-pmd/` | `dental-pmd.tsp` |
| 18 | dental-clinical-ops | dental | *(distributed — see mapping)* | `dental-clinical-ops.tsp` |
| 19 | dental-scheduling | dental | `dental-scheduling/` | `dental-scheduling.tsp` |
| 20 | dental-patient-engagement | dental | *(distributed)* | `dental-patient-engagement.tsp` |
| 21 | dental-billing | dental | `dental-billing/` | `dental-billing.tsp` |
| 22 | dental-patient-finance | dental | *(distributed)* | `dental-patient-finance.tsp` |
| 23 | dental-ops-extras | dental | *(distributed)* | `dental-ops-extras.tsp` |
| 24 | dental-org | dental | `dental-org/` | `dental-org.tsp` |
| 25 | dental-audit | dental | `dental-audit/` | `dental-audit.tsp` |
| 26 | dental-erasure | dental | `dental-erasure/` | `dental-erasure.tsp` |
| 27 | dental-legal-hold | dental | `dental-legalhold/` | `dental-legal-hold.tsp` |
| 28 | dental-patient | dental | `dental-patient/` | `dental-patient.tsp` |

Plus `dental-portal/` (patient self-service `/me/*` reads, built this session — see §7) and the two non-HTTP dirs:

| Dir | Purpose | HTTP? |
|-----|---------|-------|
| `shared/` | `assertBranchAccess`, `assertBranchRole`, `assertPatientBranchAccess` guards | No — runtime middleware |
| `retention/` | Scheduled data-retention jobs (cron) | No — background jobs |

### Tag-derivation convention (the key clarification)

The generator (`scripts/generate.ts`) computes each handler dir from the operation's first OpenAPI tag, not the spec filename:

```ts
const module = (operation.tags?.[0]?.toLowerCase() || 'default').replace(/:/g, '-');
```

So tag `"Dental:LegalHold"` → dir `dental-legalhold/` even though the spec file is `dental-legal-hold.tsp` and the URL prefix is `/dental/legal-holds`. **Renaming the dir to match the spec filename would break codegen.** Handler-dir name = tag-derived name, always.

### Spec-file → handler-dir mapping (intentional non-1:1 cases)

Four TypeSpec files distribute their operations across bounded-context handler dirs of an already-bucketed module. **This is NOT drift; 1:1 correspondence is not required.**

| TypeSpec file | OpenAPI tag(s) | Handler dir(s) |
|---|---|---|
| `dental-clinical-ops.tsp` | `Dental:Clinical` | `dental-clinical/{occlusion,postop,inventory}/` |
| `dental-patient-engagement.tsp` | `Dental:Patient` | `dental-patient/{contacts,recalls,alerts,engagement}/` |
| `dental-patient-finance.tsp` | `Dental:Patient` | `dental-patient/{treatment-plans,household,case-presentation,sync,insurance}/` |
| `dental-ops-extras.tsp` | `Dental:Org` + `Dental:Scheduling` | `dental-org/` + `dental-scheduling/` |

These four were the source of the "missing modules" illusion in the stale ideal-workflow standard (finding C1, §8).

---

## §3 Per-Module Workflow & Business-Rule Review

This section summarizes; the authoritative detail lives in `WORKFLOW_MAP.md` (98 workflows), `BUSINESS_RULES.md` (BR-001…BR-047), `DOMAIN_MODEL.md`, and `MODULE_MAP.md`. Below is the alignment status per domain area and the canonical state machines.

### Workflow coverage at a glance

- **44 explicit PRD workflows** (WF-001…WF-044) + 51 inferred + perio (WF-P01–P05) + emr-consultation (WF-EMRC-001…006). All core clinical workflows (check-in→visit, chart, treatment, complete, invoice, payment, prescription, lab order, consent, imaging, ceph, perio, PMD) are implemented and tested.
- **Treatment FSM workflows** WF-048/049/050 were confirmed real (forward-only transitions enforced in `dental-visit/treatments/updateDentalTreatment.ts`, covered by FSM property + HTTP tests) — no longer inferred.
- **Orphan BRs:** BR-005 (auto-discard empty visit — deferred per ADR-010) and BR-020 (patient merge — not implemented) remain the only unenforced rules.
- **Deferred (not orphan):** BR-019 supervisor amendment approval is an intentional feature-flagged 501 stub with a deferral test.
- **Resolved since last map:** BR-013 markUncollectible (owner-only write-off) and GDPR erasure (`dental-erasure/`) are now implemented.

### Canonical state machines

**Visit FSM:**
```
draft ──► active ──► completed ──► locked
  └► discarded (BR-005, deferred)
```
- `draft→active` on check-in (BR-001 blocks concurrent active); `active→completed` requires ≥1 chart entry (BR-002, linear-only); `completed→locked` by scheduled job, all edits blocked (BR-003).

**Treatment FSM:**
```
diagnosed ──► planned ──► performed ──► verified
     └────────────┴────────────┴──► dismissed
```
- Forward-only (BR-006); completed/performed is immutable (BR-007); 422 on invalid transition.

**Invoice FSM:**
```
draft ──► issued ──► paid | partial ──► paid | overdue
draft/issued ──► voided (BR-011: no active plan)
issued/partial/overdue ──► uncollectible (BR-013: owner-only write-off)
```
- ≥1 line item required to create (BR-009).

**Consent FSM:** `pending → signed | revoked` (BR-014; required before treatment, owner-may-override).

**Lab order FSM:** `pending → sent → completed`; `pending|sent → cancelled` (BR-018).

**Perio FSM:** create chart for visit → record tooth-level readings (probing/BOP/recession/mobility/furcation) → complete/lock. AAP/EFP 2017 staging+grading computed on complete (see §8 perio finding re: `remainingTeeth`).

**Imaging finding FSM (SM-01):** `draft → confirmed → resolved`. **Ceph landmark FSM (SM-02):** `not_placed → placed → locked` (BR-036…047).

---

## §4 Cross-Module Flows

The 16 documented cross-module flows (WF-089…WF-104) were reviewed for handoff integrity:

| Flow | Modules | Coupling | Status |
|------|---------|----------|--------|
| Check-in → visit | dental-scheduling → dental-visit | Sync (appointmentId→visitId) | OK; partial-failure recovery still a gap (WFG-002) |
| Visit → invoice | dental-visit → dental-billing | Sync (visitId, treatmentIds) | OK; concurrent-create gap (WFG-004) |
| Imaging context from visit | dental-visit → dental-imaging | **Loose** (UUID refs only, no DB FKs) | OK — intentional |
| PMD aggregation | dental-visit + dental-clinical + dental-pmd | Sync (full clinical snapshot) | OK (BR-021 checksum) |
| Audit-on-write | all modules → dental-audit | Async (pg-boss) | OK |
| Erasure ↔ legal-hold block | dental-erasure ↔ dental-legal-hold | Sync (hold check blocks purge) | OK — erasure refuses when an active hold exists |
| Attachments / imaging storage | dental-clinical / dental-imaging → storage | Sync (S3/MinIO) | OK |
| Fee schedule on invoice | dental-billing → dental-org | Sync (branchId, cdt_code) | OK |

**Tracked coupling note (G-003):** `dental-clinical` and `dental-billing` import `dental-visit` repositories/schemas directly rather than going through a service/facade interface (notably the clinical-amendment path importing `VisitRepository`). This is a known P1/P2 architectural smell, not a correctness bug; the recommendation remains to route cross-module reads through `*.facade.ts` interfaces. `dental-imaging`'s UUID-only loose coupling is the correct pattern to converge on.

---

## §5 Knowledge-Graph Mapping Status

The domain knowledge graph was **refreshed this session** and now contains **16 domains** (added `patient-portal`). The graph now reflects this session's new vocabulary: `treatment_coordinator`, `visitType`, and `dental_assistant`.

- The 16 domains are an analytical grouping over the 28 implementation modules (e.g., the dental clinical-ops / patient-engagement / patient-finance / ops-extras spec files collapse into their bounded-context domains rather than appearing as standalone nodes — consistent with §2's mapping).
- The graph artifact is **gitignored** (regenerated on demand), so it is not part of this commit; this audit records its state for traceability.

---

## §6 Test-Coverage Matrix (Post-Fix)

| Layer | Before | After | Notes |
|-------|--------|-------|-------|
| Backend unit/integration | 3380 pass | **3513 pass / 0 fail** (295 files) | +133 |
| Frontend unit | ~1991 pass | **2145 pass / 0 fail** | ~+154 |
| Contract (Hurl) | — | **43 / 46 files pass** | 3 pre-existing infra failures only |
| Backend tsc | (frontend-only gate) | **0 errors** | now run explicitly |
| `check:boundaries` | clean | clean | — |
| Lint | clean | **0 errors** | — |

**New contract suites added this session (5):** `provider.hurl`, `dental-audit.hurl`, `dental-perio.hurl`, `dental-legalhold.hurl`, `dental-erasure.hurl` — closing the gap where these modules had handlers but no wire-level contract verification.

**New unit coverage:** `reviews`, `notifs`, `comms` (auth-guard + handler paths previously thin).

**The 3 contract failures are pre-existing infrastructure issues, not code regressions:**
1. Mailpit-dependent assertion (email) ×2 — requires a running Mailpit instance.
2. Billing merchant-account 500 — Stripe-Connect merchant fixture not provisioned in the contract env.

Two test-infra rules were reaffirmed (see §8 findings): contract tests must run against a **freshly restarted** API on current code (a stale long-running server masks contract drift), and the contract DB is not fully reseeded between runs (e.g. legal holds accumulate), so suites must self-isolate with run-unique identifiers.

---

## §7 Clinical-Persona Completeness Matrix

The meticulous core. Per clinical persona × workflow step, with backend-handler and frontend coverage, reflecting **this session's builds**. Legend: ✅ implemented · ⛔ intentionally denied · ⏳ deferred.

### dentist_owner
| Step | Backend | Frontend |
|------|---------|----------|
| Full clinical (chart/treat/sign/prescribe/lab/consent/imaging/perio) | ✅ | ✅ |
| Complete visit → invoice → PMD | ✅ | ✅ |
| Staff mgmt, fee schedule, audit log, reports | ✅ | ✅ |
| Invoice void / mark-uncollectible (owner-only) | ✅ | ✅ |
**Status: complete.**

### dentist_associate
| Step | Backend | Frontend |
|------|---------|----------|
| Full clinical actions (own schedule) | ✅ | ✅ |
| Invoice creation | ✅ | ✅ |
| Case presentation (present) | ✅ (this session) | ✅ |
| Staff mgmt / audit | ⛔ owner-only | ⛔ |
**Status: complete.**

### hygienist
| Step | Backend | Frontend |
|------|---------|----------|
| Create **hygiene** visit (visitType-scoped) | ✅ (this session) | ✅ (New Visit now sends visitType) |
| Check-in to a hygiene visit | ✅ | ✅ |
| Draft + **sign** hygiene-scoped visit notes | ✅ (product default — confirm, §8) | ✅ |
| Upload imaging study | ✅ (this session — doc/code reconciled) | ✅ |
| Create general/dentist-led visit | ⛔ (visitType gate) | ⛔ (no dishonest affordance) |
| Prescribe / sign general notes / CBCT finalize | ⛔ dentist-only | ⛔ |
**Status: hygiene-led workflow complete; general-clinical correctly denied.**

### dental_assistant
| Step | Backend | Frontend |
|------|---------|----------|
| Upload imaging study | ✅ (this session) | ✅ |
| Edit chart (assist) | ✅ (`upsertDentalChart`) | ✅ |
| Draft visit notes | ✅ | ✅ |
| Add file attachments | ✅ | ✅ |
| Capture chairside consent (accept/reject case presentation) | ✅ | ✅ |
| **Sign** notes / change treatment status / prescribe | ⛔ by design | ⛔ |
**Status: clinical-assist workflow wired; clinical authority correctly withheld.**

### front_desk
| Step | Backend | Frontend |
|------|---------|----------|
| Patient registration + consent | ✅ | ✅ |
| Appointment book / check-in / reschedule / cancel | ✅ | ✅ |
| Record payment | ✅ | ✅ |
| Capture chairside consent (accept/reject case presentation) | ✅ | ✅ |
| Clinical write | ⛔ non-clinical | ⛔ |
**Status: complete.**

### treatment_coordinator (NEW this session)
| Step | Backend | Frontend |
|------|---------|----------|
| Create + present case presentation | ✅ (gated: owner/associate/coordinator) | ✅ (`canPresentCase()` gates the affordance) |
| Treatment-plan "presented" transition | ✅ | ✅ |
| Accept/reject (chairside capture) | ✅ (broader chairside set) | ✅ |
| Read case presentations / treatment plans | ✅ | ✅ |
**Status: built end-to-end (TypeSpec enum → validators + SDK → DB migration 0090 → handlers → frontend role row + grid). Note: this REMOVED `staff_full`'s previously-incidental ungated access — see §8 product default.**

### billing_staff
| Step | Backend | Frontend |
|------|---------|----------|
| Read case presentations / financial reads | ✅ | ✅ |
| Invoice / payment workflows | ✅ | ✅ |
| Clinical write | ⛔ | ⛔ |
**Status: complete for billing scope.**

### patient (portal Phase 1)
| Step | Backend | Frontend |
|------|---------|----------|
| View own appointments | ✅ `GET /me/appointments` | ✅ |
| View own invoices (written-off hidden) | ✅ `GET /me/invoices` | ✅ |
| View own balance (uncollectible/voided excluded) | ✅ `GET /me/balance` | ✅ |
| Self-scope enforcement | ✅ `assertSelfPatient` primitive | — |
| Visits / treatment-plans / imaging reads | ⏳ Phase 2 | ⏳ |
| Online payment | ⏳ Phase 2 (needs payments-vendor + PHI-read-scope decision) | ⏳ |
**Status: Phase-1 read foundation shipped; `assertSelfPatient` is the documented Phase-2 extension point.**

---

## §8 Conflicts, Findings & Remediation

### A. Bugs fixed this session

| # | Bug | Impact | Fix | Commit(s) |
|---|-----|--------|-----|-----------|
| 1 | **provider module incoherently wired** — `createProvider` was a dead handler (no TypeSpec op/route → 404); `createPractitioner` + `createPractitionerRole` were 100% unreachable because their required `providerId`/`practitionerId` were Zod-stripped (absent from schema → always 404) | Provider foundation entirely non-functional | Added `createProvider` op + the missing required fields to TypeSpec; regen api-ts + SDK; dropped now-unneeded casts | `06ab2f58`, `b188302f` (+ `fd536def`) |
| 2 | **`getAuditEvents` authorized on Better-Auth SESSION role** (`user.role==='dentist_owner'`) instead of the dental_membership role — but self-service onboarding only creates a membership, never sets a session role | Audit viewer returned **403 for every self-service-onboarded clinic owner** | Replaced dead session-role check with `assertBranchRole`; moved date validation before DB lookup | `f63b7f30` |
| 3 | **`updateTreatmentPlan` had NO top-level branch-access check** (unlike all 8 sibling treatment-plan handlers) | **Cross-tenant:** any authenticated user from any org could PATCH any patient's treatment plan (notes, estimate, approve/reject/complete transitions). **SECURITY.** | Added `assertPatientBranchAccess` unconditionally after patient lookup; presented-transition keeps its presenter-role gate | `12d972cb` |
| 4 | **`createImagingStudy` doc-vs-code drift** — doc said hygienist may upload, code denied | Honest-affordance + persona gap | Reconciled: hygienist + dental_assistant allowed; CBCT finalize stays dentist-only | `f8dd3618` |
| 5 | **hygienist "New Visit" dishonest affordance** — button shown but always 403 (UI never sent `visitType`, defaulted to general/dentist-only) | Hygienists could not start a visit despite the affordance | Wired `visitType` so hygienist New Visit creates a hygiene visit | `6b7fe4d6` |
| 6 | **patient-portal uncollectible-invoice leak** — written-off (uncollectible) invoices were shown to patients as owed balance | Patients shown debt the clinic had already internally written off | Filtered `uncollectible` + `voided` out of `/me/invoices` and `/me/balance` | `0c2833f3` |
| 7 | **notifs handlers lacked an auth null-guard** (returned 500 instead of 401) | Defensive inconsistency vs reviews/comms | Added `UnauthorizedError` guard | `f8ce6b0d` |
| 8 | **`reviews.test.ts` seeded a non-existent `persons.email` column** — Drizzle silently dropped it at runtime (test passed) but backend tsc flagged TS2769 | Hidden backend type error (slipped a frontend-only CI gate — see finding below) | Moved to `contactInfo` JSONB | folded into `12d972cb` |

### B. Findings logged (NOT fixed — backlog / product decisions)

| ID | Finding | Recommendation |
|----|---------|----------------|
| **C1** | `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` is aspirational/stale vs reality — implies inventory, local-first sync, and several modules are missing, and reads the 4 multi-domain TypeSpec files as separate/unbuilt. They are implemented. (Currently untracked in `docs/context/`.) | Reconcile the doc against the confirmed inventory (§2) or mark it explicitly as a roadmap/aspiration doc; commit or remove the untracked copy. |
| Spec/impl divergence | Several list handlers historically returned bare arrays while their TypeSpec declared a `{data:[]}` wrapper, and an undecorated `ErrorResponse` polluted some 200 unions. Portal endpoints were cleaned this session; `legalhold`/`erasure` (and possibly others) still diverge. Schemathesis would flag these. | Run a focused sweep to align all list-response shapes to the `{data, pagination}` contract. |
| Erasure/legal-hold tenancy | `dental-erasure` and `dental-legal-hold` are **admin-role-only** (Better-Auth system role) with **no tenancy gate** — an admin can list/place/approve across ALL tenants. Likely intentional (platform-compliance governance). | Make it an **explicit, documented product decision**, not implicit. |
| admin/support audit access | admin/support are documented with `audit:read` capability but have no path through `getAuditEvents` (now owner-only after fix #2). | Reconcile intent — either add an admin path or update the role matrix. |
| Perio staging default | When `remainingTeeth` is omitted on complete, staging uses the charted-tooth count, so a partial chart (<20 teeth) inflates staging to **Stage IV**. Clinically questionable default. | Require/clarify `remainingTeeth`, or exclude it from the <20 complexity factor when the chart is partial. |
| Pre-existing authz scope | `acceptTreatmentPlan` + `listDentalTreatments` use `assertBranchAccess` (any active member) rather than `assertBranchRole`. | Confirm intended scope (dental_assistant/others can currently reach them). |
| Chart-handler asymmetry | `upsertDentalChart` allows hygienist but `updateTooth`/`initializeDentition` don't. | Confirm intentional. |
| **CI gate gap** | Root `bun run typecheck` runs the FRONTEND only (`--filter dentalemon`); backend type errors require `cd services/api-ts && tsc --noEmit` separately. Bug #8 slipped a frontend-only check. | **CI must run BOTH typechecks.** |
| Test-infra | (a) Contract tests must run against a freshly-restarted API on current code — a stale long-running server masks contract drift (reaffirms the repo's "tests must verify real wiring" rule). (b) The contract DB is not fully reseeded between runs (legal holds accumulate) → suites must self-isolate with run-unique identifiers. | Document in the contract-test runbook; enforce restart-before-run in CI. |

### C. Product defaults applied this session (flag for confirmation)

- **hygienist may SIGN hygiene-scoped visit notes** (co-sign configurable later) — regulatory/jurisdictional; **confirm.**
- **`dentistMemberId` (provider-of-record) on a hygiene visit may be the hygienist's own membership.**
- **treatment_coordinator case-presentation gating:** create/present → owner/associate/treatment_coordinator; accept/reject (chairside capture) → broader chairside set. This **removed `staff_full`'s previously-incidental (ungated) access** to case presentation.

### D. Deferred — patient portal Phase 2 (next milestone)

`/me/visits`, `/me/treatment-plans`, `/me/imaging` reads; and **online payments** (needs payments-vendor selection + a PHI-read-scope product decision). The `assertSelfPatient` primitive already exists as the extension point.

---

## Appendix — Change Record (this session, `feat/module-workflow-alignment`)

| Commit | Subject |
|--------|---------|
| `08c04066` | docs: handler-dir tag-derivation convention + spec→dir mapping (MODULE_TEMPLATE) |
| `fd536def` / `06ab2f58` / `b188302f` | provider: wire createProvider + required practitioner fields + contract suite |
| `f63b7f30` | dental-audit: contract suite + getAuditEvents membership-role fix |
| `d678f640` | dental-perio: contract suite |
| `f640bb10` / `1c08efb4` | dental-legalhold: contract suite |
| `81352224` | dental-erasure: contract suite |
| `0a06d36b` / `f8ce6b0d` | unit coverage (reviews/notifs/comms) + notifs auth guard |
| `12d972cb` | treatment_coordinator role + updateTreatmentPlan cross-tenant security fix |
| `f8dd3618` | dental_assistant clinical-assist workflow (imaging/chart/draft-notes/attachments) |
| `6b7fe4d6` | hygienist hygiene-led visits via visitType |
| `0c2833f3` | patient portal Phase 1 (assert-self-patient + /me/appointments + /me/invoices + balance) |

**Verified gate (final):** backend tsc 0 · backend 3513/0 (295 files) · frontend typecheck clean · frontend 2145/0 · contract 43/46 (3 pre-existing infra failures only) · `check:boundaries` clean · lint 0 errors.
