# Compliance Report — Dentalemon

---
oli-version: "1.1"
Audit Date: 2026-05-31
Audit Type: code-vs-spec compliance (COMPLIANCE dimension of /oli-check) — fresh per-module re-audit
Modules Audited: dental-audit, dental-billing, dental-clinical, dental-imaging, dental-org, dental-patient, dental-perio, dental-pmd, dental-scheduling, dental-visit, emr-consultation, external-records-import (future_phase — not audited)
Method: exhaustive cross-reference of DECLARED_API + BR-* + ROLE_PERMISSION_MATRIX gates + state machines against registered routes (generated/openapi/routes.ts AND manual app.ts registrations) and handler source
last-modified: 2026-05-31
last-modified-by: oli-check (compliance dimension)
---

## Verdict: **PASS** (0 P0 · 0 P1 · 5 P2 · 2 P3)

The implemented surface is highly compliant. Every security-critical business rule
(branch access, role gates, tier gates, immutability guards, state machines) checked was
enforced in code with the canonical error code. Findings are limited to **spec/route
naming drift** and **route-registration hygiene** — none are behavioral or security defects.

> **Critical method note:** an initial pass flagged several routes as `NO-AUTH` /
> "declared-but-unrouted" because only `generated/openapi/routes.ts` was parsed. Many dental
> routes (audit viewer, fee schedule, treatment-plans, recalls, contacts, claims, queue, the
> recover-pin auth shadow, and the 405-immutability guards) are registered **manually in `app.ts`**.
> After folding in `app.ts`, every apparent gap resolved. This `routes.ts` + `app.ts` split is
> itself the source of the P2/P3 hygiene findings below, and explains why the engine's
> `CODE_API_SURFACE.md` / `CODE_SPEC_TRACE.md` came back empty (they only see generated routes).

---

## Per-Module Compliance Table

| Module | Declared (spec) | Implemented | BR/Gates enforced | State machine | Health |
|--------|:---:|:---:|:---:|:---:|:---:|
| dental-org | ✅ | ✅ | ✅ assertBranchRole(dentist_owner), PIN lockout, imagingTier gate | ✅ membership invited→active→inactive | 9.5 |
| dental-billing | ✅ | ✅ | ✅ BR-009/010/011/013/014, role matrix exact, IMMUTABLE, EXCEEDS_BALANCE | ✅ SM-INVOICE | 10 |
| dental-visit | ✅ | ✅ | ✅ BR-001/003/006/007, consent-before-performed | ✅ TREATMENT_TRANSITIONS == §8 exactly | 10 |
| dental-clinical | ✅ | ✅ | ✅ BR-014/017/018, prescriber gate, consent immutable, med-history 405 | ✅ lab + consent FSM | 9.5 |
| dental-scheduling | ✅ | ✅ | ✅ cancel/check-in role exclusions, REASON_REQUIRED, FR3.7 | ✅ APPOINTMENT_TRANSITIONS | 9.5 |
| dental-perio | ✅ | ✅ | ✅ BR-P01/P05/P07, hygienist role, depth/tooth validation | ✅ draft→completed→locked | 10 |
| dental-pmd | ✅ | ✅ | ✅ BR-021/022 (405 IMPORTED_PMD_IMMUTABLE), CHECKSUM_MISMATCH | ✅ generated→signed/superseded | 9.0 |
| dental-patient | ✅ | ✅+orphans | ✅ BR-015/015b consent + archived 403, append-only notes | ✅ active↔archived | 8.5 |
| dental-imaging | ✅ | ✅ | ✅ BR-016c tier gate (≠'addon'→403), branch+role gates | ✅ SM-01 finding, SM-02 landmark | 9.5 |
| dental-audit | ✅ | ✅ | ✅ append-only (405 AUDIT_EVENT_IMMUTABLE), branch-scoped viewer | n/a (append-only) | 9.5 |
| emr-consultation | ✅ | ✅ | ✅ provider:owner / patient:owner route gates, draft→finalized | ✅ draft→finalized terminal | 10 |
| external-records-import | future_phase | (none) | n/a — unimplemented by design | n/a | n/a |

---

## Findings

### P0 — none
### P1 — none

### P2 (spec/route naming drift — functionality present, contract path differs)

- **P2-1 · dental-pmd · API path drift.** MODULE_SPEC §10 declares
  `POST /dental/pmd/generate`, `GET /dental/pmd/:patientId`, `GET /dental/pmd/:id/download`.
  Implemented (and contract-tested) surface is **visit-scoped**:
  `POST /dental/visits/:visitId/pmd`, `GET /dental/visits/:visitId/pmd`,
  `GET /dental/visits/:visitId/pmd/export`. Functionality complete; spec §10 path list is stale.
  Ref: `handlers/dental-pmd/generatePMD.ts`; `routes.ts` visits/pmd block.

- **P2-2 · dental-patient · API path drift (follow-up).** Spec §10 declares
  `POST /dental/patients/:id/follow-up`; implemented as `.../follow-up-notes`
  (`handlers/dental-patient/engagement/addFollowUpNote.ts`).

- **P2-3 · dental-patient · CR-05 approval path / synonym endpoints.** Spec §10 declares
  `POST /dental/patients/:id/treatment-plans/:planId/approval`. Implemented in `app.ts` alongside
  `/treatment-plans/:planId/accept`. Two near-synonym endpoints coexist — confirm both are intended
  or have the spec pick one. Ref: `app.ts` treatment-plans block.

- **P2-4 · dental-org · recover-pin newPin length drift.** §10 contract lists reset-pin newPin as
  "exactly 6 digits"; `pinRecovery.ts:25` accepts `^\d{4,6}$` for recover-pin newPin — recover path
  is more permissive than the reset path. Validator/spec mismatch.

- **P2-5 · dental-audit · viewer query-param convention.** Known gap (EM-AUD-013): audit viewer
  uses camelCase `branchId`/`actorId` + `limit`/`offset` vs spec snake_case + `page`. Acknowledged
  in-spec; logged for completeness. Ref: `handlers/dental-audit/getAuditEvents.ts`.

### P3 (route-registration hygiene — currently safe, brittle)

- **P3-1 · dental-org · recover-pin auth relies on registration ordering.**
  `generated/openapi/routes.ts:777` registers `POST /dental/org/members/:memberId/recover-pin` with
  **no `authMiddleware`**. `app.ts:508` registers an auth-wrapped *shadow* of the same path **before**
  `registerOpenAPIRoutes(app)` at `app.ts:523`, so the authenticated route wins at runtime (Hono
  first-match). The handler `pinRecovery.ts:70` ALSO hard-requires a session. Endpoint is therefore
  authenticated via two independent mechanisms — but the generated route remaining NO-AUTH is a
  latent trap if either is removed. Recommend codegen emit `authMiddleware` for this op.

- **P3-2 · Split route registration (`routes.ts` vs `app.ts`).** A large share of dental routes
  (audit viewer + immutability guards, fee schedule, treatment-plans, recalls, contacts, alerts,
  tasks, occlusion-screenings, postop-templates, inventory, sync-logs, queue, insurance, claims,
  consent revoke) are hand-registered in `app.ts` rather than generated. Not a behavioral defect,
  but defeats spec-trace tooling and hides routes from the OpenAPI document. Recommend migrating
  manual routes into TypeSpec where feasible.

---

## Verified-Compliant Highlights (evidence the gates actually fire)

- **Billing role matrix exact:** create invoice = `['dentist_owner','dentist_associate']`
  (`createDentalInvoice.ts:34`); void = `['dentist_owner']` (`voidDentalInvoice.ts:31`);
  payment = `+'staff_full'` (`recordDentalPayment.ts:35`). Prior "staff_full create invoice" drift is closed.
- **BR-009/011/013/014:** NO_BILLABLE_TREATMENTS (`createDentalInvoice.ts:50`), ACTIVE_PAYMENT_PLAN
  409 (`voidDentalInvoice.ts:46`), markUncollectible 501 (`markUncollectible.ts:24-28`),
  CONSENT_REQUIRED (`createDentalInvoice.ts:40`).
- **Treatment FSM** (`dental-visit/repos/treatment.schema.ts:99`) matches §8 byte-for-byte incl.
  `declined` terminal (from diagnosed/planned only).
- **Imaging tier gate** (`getCephAnalysis.ts:53-61`): `imagingTier !== 'addon'` → 403
  IMAGING_TIER_REQUIRED, exactly BR-016c; assertBranchAccess at top; writes gated to dentist roles
  (`createMeasurement.ts:133`).
- **Scheduling role exclusions** (N-SCH-03 matrix): cancel = `['dentist_owner','staff_full']`,
  check-in = `['dentist_owner','dentist_associate','staff_full']` — both exclude `staff_scheduling`.
- **Immutability via 405-guards (consistent pattern):** audit events (`app.ts:216-222`),
  imported PMD (`app.ts:226-236`), medical history (`updateMedicalHistoryEntry.ts:28-32`).
  PMD checksum 422 CHECKSUM_MISMATCH (`importPMD.ts:48-54`).
- **Perio:** hygienist write access + CHART_EXISTS 409 + INSUFFICIENT_READINGS 422
  (`createPerioChart.ts:44/55`, `completePerioChart.ts:63/79`).
- **Visit BR-001:** 409 ACTIVE_VISIT_EXISTS (`createDentalVisit.ts:36-38`).
- **Clinical:** prescriber dentist gate (`createPrescription.ts:34`), lab FSM forward-only,
  consent sign immutable 422 CONSENT_FORM_SIGNED (`signConsentForm.ts:39`).
- **EMR:** route-level scoped gates `provider:owner`/`patient:owner`/`admin` match §6 exactly;
  finalize-on-non-draft → 422 CONSULTATION_NOT_DRAFT.

---

## Orphan / Under-Specced Code (spec-gap, not a code violation)

`dental-patient` ships substantial functionality only thinly covered by MODULE_SPEC §10: insurance
profiles, claims (`createClaimDraft`/`getClaimReadiness`/`updateClaimStatus`), patient contacts,
tasks, dental-alerts, occlusion-screenings, sync-logs, queue-board (`app.ts` blocks). All real,
authenticated, branch-scoped endpoints with no behavioral problem — but the spec under-declares
them. Recommend an `oli-spec-sync` pass to bring MODULE_SPEC §10 in line with the shipped surface.
Severity ≤ P2 (documentation).

---

## Module Health Scores (0–10)

| Module | Score | Note |
|--------|:---:|------|
| dental-billing | 10 | Exhaustive BR + matrix + taxonomy compliance |
| dental-visit | 10 | FSM byte-exact, all immutability guards |
| dental-perio | 10 | All BRs + role gates + validation |
| emr-consultation | 10 | Route-level scoped gates, terminal FSM |
| dental-org | 9.5 | recover-pin generated-route NO-AUTH (shadowed; P3-1) |
| dental-clinical | 9.5 | Append-only via 405-guard (spec text mildly stale) |
| dental-scheduling | 9.5 | Matrix-exact role exclusions |
| dental-imaging | 9.5 | Tier+branch+role all enforced |
| dental-audit | 9.5 | viewer param-naming gap (P2-5, acknowledged) |
| dental-pmd | 9.0 | API §10 path drift (P2-1) |
| dental-patient | 8.5 | Path drift + large under-specced surface |

**Overall: 9.5 / 10 — PASS.** No P0/P1. The codebase faithfully implements its specs; remaining
debt is spec-sync and route-registration hygiene, both non-blocking.
