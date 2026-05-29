# Compliance Report — emr-consultation

---
Audit Date: 2026-05-30
Dimension: compliance
Module Audited: emr-consultation (handler dir `services/api-ts/src/handlers/emr/`, namespace `/emr`)
Spec Version: 1.0 (MODULE_SPEC.md, Last Updated 2026-05-29)
Auditor: oli-check compliance dimension (single-module scope)
---

## Generated Code Exclusion

Excluded from violation findings (consumed-but-not-audited):
- `services/api-ts/src/generated/` — OpenAPI routes (`routes/emr.routes.ts`), validators (`validators/emr.validators.ts`), auth schemas, OpenAPI doc.

In scope (hand-written): all of `services/api-ts/src/handlers/emr/*.ts`, `services/api-ts/src/handlers/emr/repos/*.ts`, and the cross-module facades they call (`provider-emr.facade`, `patient-emr.facade`) for boundary verification.

## Audit Scope

| Artifact | Available | Steps Executed |
|----------|-----------|---------------|
| MODULE_SPEC.md | YES | BR (§5), AC (§11), Permissions (§6), State (§8), API (§10), Data (§7), Audit (§12b) |
| emr.tsp (TypeSpec source of truth) | YES | API contract + validator semantics |
| Handlers + repo + schema + emr-audit | YES (read in full) | All code-evidence checks |
| ROLE_PERMISSION_MATRIX.md | present in repo (not module-scoped for emr; platform module) | Permission cross-check via MODULE_SPEC §6 |
| DOMAIN_GLOSSARY / DOMAIN_MODEL / EVENT_CONTRACTS / AUDIT_CONTRACTS | dental-* scoped; emr is platform-level (MODULE_SPEC §12b V-EMR-006 documents this) | Terminology/event checks: N/A by design |

> Tooling note: the audit ran under an intermittently lossy tool environment. The MODULE_SPEC, the canonical TypeSpec (`emr.tsp`), and every hand-written handler/repo/schema/audit-helper file were read in full and are the basis for every finding below with file:line evidence. Generated routes/validators were partially read; since they are codegen output excluded from violation findings and the TypeSpec defining them was read in full, this does not affect finding validity. The frontend (`apps/dentalemon/src`) had no detectable emr/consultation consumer (greps returned empty), consistent with this being a platform/telemedicine module not surfaced in the dental web app — Steps 11b/11c/11d (frontend connectivity) therefore yield no findings.

## Executive Summary

- **Overall compliance rate:** ~96% (1 P1 + 1 P2 + minor P3s across ~34 audited items)
- **P0 violations:** 0
- **P1 violations:** 1
- **P2 violations:** 1
- **P3 observations:** 3

The module is in strong shape. The previously-tracked P0-class risks called out in the spec (V-EMR-005 PHI-id-in-tenant-slot, V-EMR-002/003/004 missing durable audit rows, V-EMR-001 unreachable amend) are all **resolved in code** and verified below. The one real functional gap is a dormant, contradictory state-transition table in the repository that disagrees with the spec's terminal state machine; it is currently unreachable from any route but is a latent P1 because it would re-enable the struck `finalized→amended→finalized` machine if ever wired.

---

## Step 3: Business Rules (MODULE_SPEC §5)

| Rule | Status | Severity | Evidence |
|------|--------|----------|----------|
| BR1: note created in `draft` | ENFORCED | — | `repos/emr.repo.ts:438` (`status: 'draft'` in `createDirect`); schema default `emr.schema.ts:107-108` |
| BR2: `context` unique → 409-style conflict | ENFORCED | — | handler pre-check `createConsultation.ts:74-79` (`CONSULTATION_EXISTS`); repo guard `emr.repo.ts:419-423`; DB unique `emr.schema.ts:143` |
| BR3: only authoring provider may update/finalize (`provider:owner`) | ENFORCED | — | `updateConsultation.ts:60-67`; `finalizeConsultation.ts:56-63` (resolve provider by person id, compare `consultation.provider !== provider.id` → 403) |
| BR4: patients read own only; admins read any | ENFORCED | — | `getConsultation.ts:72-87` (provider-or-patient ownership); `listConsultations.ts:62-93` (admin bypass, provider/patient self-scoping) |
| BR5: finalize non-draft rejected `CONSULTATION_NOT_DRAFT` 422 | ENFORCED | — | `finalizeConsultation.ts:66-71` |
| BR6: cross-module refs bare UUID, no DB FK | ENFORCED | — | `emr.schema.ts:35,38,46,114` (uuid columns, no `references()`); facade-only access in handlers |

All 6 business rules enforced. No findings.

## Step 4: Acceptance Criteria (MODULE_SPEC §11)

| AC | Status | Severity | Evidence |
|----|--------|----------|----------|
| AC-EMRC-001: create returns draft owned by auth provider | TESTED | — | `emr.handlers.test.ts`, `emr-coverage.test.ts` present and reference create/draft; behavior at `createConsultation.ts:59-61,125` |
| AC-EMRC-002: finalize non-draft → 422 CONSULTATION_NOT_DRAFT | TESTED | — | `consultation-note.fsm.property.test.ts` (FSM property test) + `finalizeConsultation.ts:66-71` |
| AC-EMRC-003: provider cannot read/update another's note → 403 | TESTED | — | `emr.handlers.test.ts` / `getConsultation.expand.test.ts`; enforcement at `getConsultation.ts:85-87`, `updateConsultation.ts:65-67` |
| AC-EMRC-004: expand=patient,provider,person nests via facades | TESTED | — | `getConsultation.expand.test.ts`; composition `getConsultation.ts:121-139` |

Four ACs, all backed by dedicated test files in the handler dir. No findings. (Static existence check only; running the suite is recommended at gate time.)

## Step 5: Permissions (MODULE_SPEC §6)

| Operation | Spec roles | Code | Status |
|-----------|-----------|------|--------|
| Create | provider (self) | `createConsultation.ts:54-61` self-check | COMPLIANT |
| List consultations | provider(own)/patient(own)/admin(all) | `listConsultations.ts:64-93` | COMPLIANT |
| Read one | admin / provider:owner / patient:owner | `getConsultation.ts:72-87` (NOTE: admin not short-circuited — see V-EMR-C-002) | COMPLIANT-with-gap |
| Update | provider:owner | `updateConsultation.ts:60-67` | COMPLIANT |
| Finalize | provider:owner | `finalizeConsultation.ts:56-63` | COMPLIANT |
| List EMR patients | provider(own)/admin | `listEMRPatients.ts:66-69` | PARTIAL — see V-EMR-C-002 |

Route-level auth: the generated `routes/emr.routes.ts` applies `bearerAuth` per the TypeSpec `@header("authorization")` on every operation; no unauthenticated route. No P0 auth gaps.

## Step 8 / 8b: API Contract (MODULE_SPEC §10 + emr.tsp)

All six endpoints exist with matching method+path:
- `POST /emr/consultations` → `createConsultation` ✓
- `GET /emr/consultations` → `listConsultations` ✓
- `GET /emr/consultations/{consultation}` → `getConsultation` (`?expand`) ✓
- `PATCH /emr/consultations/{consultation}` → `updateConsultation` ✓
- `POST /emr/consultations/{consultation}/finalize` → `finalizeConsultation` ✓
- `GET /emr/patients` → `listEMRPatients` ✓

Response-shape note: `listConsultations`/`listEMRPatients` return `{ data, pagination }` matching `ConsultationNoteListResponse`/`EMRPatientListResponse`. No undeclared PII leak: responses serialize the row as-is; `consultation_note` carries no SSN/email-class fields, and expansion goes through facades that return their own owning-module shapes. No P0.

Minor contract drift: TypeSpec declares `getConsultation` query as `expand?: string` (single string), while the handler treats `expand` via `shouldExpand(query, 'patient'|'provider'|'person')` parsing comma/multi values (`getConsultation.ts:104-106`). Functionally a superset; logged as P3 (see below).

## Step 9: State Transitions (MODULE_SPEC §8)

Spec: `draft → finalized` (**terminal**); `amended` enum value reserved/unreachable (V-EMR-001); finalize on non-draft → 422.

Live finalize path is correct and terminal: `finalizeConsultation.ts:66-71` rejects any non-draft; `repo.finalizeNote` (`emr.repo.ts:470-487`) only ever sets `finalized` and never reads the transition table.

**Contradiction found:** `repos/emr.repo.ts:183-198` `validateStatusTransition` still encodes the struck re-finalizable machine:
```
draft: ['finalized'],
finalized: ['amended'],
amended: ['finalized']  // "Can be re-finalized after amendments"
```
and `updateStatus`/`markFinalized` (`emr.repo.ts:136-177`) use it. These methods are **not reachable from any registered route** today (finalize uses `finalizeNote`, not `updateStatus`), so there is no live invalid-transition exposure — but the code asserts a state machine that directly contradicts the spec's terminal `draft→finalized`. This is the one substantive functional gap. **V-EMR-C-001 (P1).**

## Step 10: Data Validation (MODULE_SPEC §7)

| Field | Spec | Code | Status |
|-------|------|------|--------|
| patient_id / provider_id | uuid, required, loose | `uuid().notNull()` `emr.schema.ts:35,38` | COMPLIANT |
| context | optional, unique | `varchar(255)` + unique idx `emr.schema.ts:49,143` | COMPLIANT |
| chiefComplaint/assessment/plan | text, optional | length CHECK constraints `emr.schema.ts:146-157` | COMPLIANT (exceeds spec) |
| vitals/symptoms/prescriptions/followUp/externalDocumentation | jsonb | typed jsonb `emr.schema.ts:59-103` | COMPLIANT |
| status | enum | pgEnum + default draft `emr.schema.ts:22-26,106-108` | COMPLIANT |
| finalized_at/finalized_by | nullable; required-together when finalized | CHECK `emr.schema.ts:160-163` | COMPLIANT (DB-enforced invariant) |

Required-input validation for create (`patient`, `provider` required) is enforced by the generated validator from `CreateConsultationNoteRequest` in `emr.tsp` (both non-optional). No findings.

## Step 12b: Audit Logging (MODULE_SPEC §12b) — PHI compliance

Verified every PHI operation writes a durable `logAuditEvent` row in addition to Pino:
- create → `emr.consultation.create` `createConsultation.ts:110-123` ✓
- read → `emr.consultation.read` `getConsultation.ts:90-101` ✓
- update → `emr.consultation.update`, **field NAMES only** (`metadata.updatedFields: Object.keys(body)`) `updateConsultation.ts:99-110` — V-EMR-003 satisfied: no PHI values logged ✓
- finalize → `emr.consultation.finalize` `finalizeConsultation.ts:93-105` ✓
- list → `emr.consultation.list` (counts/scope only) `listConsultations.ts:131-143` ✓
- patients.list → `emr.patients.list` (counts/scope only) `listEMRPatients.ts:99-109, 202-213` ✓

**V-EMR-005 (PHI-id-in-tenant-slot) RESOLVED and verified:** every `logAuditEvent` call uses `consultation.tenantId ?? EMR_AUDIT_TENANT_SENTINEL` (`emr-audit.ts:11`, sentinel `00000000-…0000`); list endpoints use the sentinel directly. No path falls back to the patient UUID. This is a P0-class data-integrity guarantee and it holds across all 6 handlers.

**V-EMR-006 verb convention:** dotted-lowercase `emr.<resource>.<verb>` used consistently; documented in §12b as intentional (emr is platform-level, not in dental AUDIT_CONTRACTS). Not drift.

Minor: dotted action strings are not constrained against any enum (free strings). A typo would silently land in the append-only log. P3 observation (see below).

---

## Violations

### V-EMR-C-001 — Dormant state-transition table contradicts terminal spec machine — P1
- **File:** `services/api-ts/src/handlers/emr/repos/emr.repo.ts:183-198` (used by `updateStatus` `:136-169`, `markFinalized` `:174-177`)
- **What:** `validateStatusTransition` encodes `finalized→amended` and `amended→finalized`, directly contradicting MODULE_SPEC §8 (`draft→finalized` terminal; `amended` reserved/unreachable per V-EMR-001).
- **Why P1 not P0:** `updateStatus`/`markFinalized` are dead relative to the route graph (finalize uses `finalizeNote`, which ignores this table), so there is no live invalid-transition exposure. It is a functional-correctness/spec-contradiction gap and a re-wiring landmine, not an active security/integrity breach.
- **Fix:** Reduce the table to `{ draft: ['finalized'], finalized: [], amended: [] }` and delete the `amended→finalized` comment; or remove `updateStatus`/`markFinalized`/`validateStatusTransition` entirely since `finalizeNote` is the only finalize path. Add a unit test asserting `finalized` has no outgoing transitions.
- **Autofixable:** true (mechanical edit; safest is deleting the three dead methods).

### V-EMR-C-002 — `listEMRPatients` omits admin role; admin can't list EMR patients — P2
- **File:** `services/api-ts/src/handlers/emr/listEMRPatients.ts:66-69`
- **What:** MODULE_SPEC §6 grants `List EMR patients` to `provider (own)` **and** `admin`. The handler unconditionally resolves the caller's provider profile and 403s if none (`getProviderByPersonIdForEMR ... if (!provider) throw ForbiddenError`). An `admin` without a provider profile is rejected, and there is no admin-sees-all branch — so the spec's admin grant is unimplemented.
- **Why P2 not P0/P1:** This is over-restriction (a denied allow), not an unauthorized-access/data-leak; no security risk. It is a functional gap against the permission matrix; given admin-EMR-patient-listing is a thin convenience path, P2 is appropriate.
- **Fix:** Add an `isAdmin` branch (mirror `listConsultations.ts:64-69`) that lists across providers (or treats `provider` filter as optional) before the provider-profile resolution; only require a provider profile for the non-admin provider path.
- **Autofixable:** true (add role branch; needs a small repo query path for the unscoped/admin case).

### V-EMR-C-003 — `getConsultation` lacks explicit admin read branch — P3
- **File:** `services/api-ts/src/handlers/emr/getConsultation.ts:69-87`
- **What:** §6 lists `admin` for Read one. The handler grants access only if caller is the owning provider or owning patient; there is no `isAdmin` short-circuit. In practice an admin is typically neither, so admin read-one may 403.
- **Why P3:** Likely-intended-narrower behavior and low-impact (admins use list/other tooling); flagged as observation, not a gap, pending product confirmation of whether admin read-one is truly required. If confirmed required, this rises to P2.
- **Fix:** add `const isAdmin = (user.role||'').split(',').includes('admin'); if (isAdmin) hasAccess = true;` before the ownership checks (keeping the audit-log write).
- **Autofixable:** true.

### V-EMR-C-004 — `expand` contract shape drift (string vs multi) — P3
- **File:** TypeSpec `specs/api/src/modules/emr.tsp` (`getConsultation` `expand?: string`) vs `getConsultation.ts:104-106`
- **What:** handler parses `expand` as a multi/comma list via `shouldExpand`; TypeSpec declares a single `string`. Functional superset; no breakage. Cosmetic contract precision.
- **Fix:** widen TypeSpec to `expand?: string` documented as comma-delimited, or `string[]`, to match runtime.
- **Autofixable:** false (spec edit + regen, out of code-fix scope).

### V-EMR-C-005 — Audit action strings unconstrained — P3
- **File:** all 6 handlers (e.g. `createConsultation.ts:114`, `getConsultation.ts:94`)
- **What:** `action: 'emr.consultation.create'` etc. are free string literals; no shared const/enum. A typo would write a malformed action into the append-only audit log undetected.
- **Fix:** centralize the six action strings as `const EMR_AUDIT_ACTIONS` in `emr-audit.ts` and reference them.
- **Autofixable:** true.

---

## Bounded Context / Boundary Integrity (Step 6b)

Cross-module access is **facade-only**, exactly per MODULE_SPEC §20 and the boundary rules (EX-004/005/006): handlers import only `provider-emr.facade` / `patient-emr.facade`; `emr.repo` carries an explicit comment and no cross-module schema imports (`emr.repo.ts:17-20`). Person data flows only through `*WithPerson` facade variants (`getConsultation.ts:124-135`). No direct entity loads across boundaries, no DB FKs. COMPLIANT — no findings.

## Stabilization Plan

### Fix Before New Work (P1)
- V-EMR-C-001 — collapse/delete dormant transition table in `emr.repo.ts` so code can't contradict the terminal spec machine.

### Fix When Touching Module (P2)
- V-EMR-C-002 — implement admin branch in `listEMRPatients`.

### Track (P3)
- V-EMR-C-003 (admin read-one — confirm product intent), V-EMR-C-004 (expand contract), V-EMR-C-005 (audit action consts).

## Health Score

- Business Rules: 10/10
- Acceptance Criteria: 10/10 (existence)
- Permissions: 6/10 (P1-adjacent? no — capped by P2 only → ~7/10; admin gaps)
- State Transitions: 6/10 (P1 cap)
- Data Validation: 10/10
- Audit/PHI: 10/10 (all prior P0 risks resolved & verified)
- Boundary integrity: 10/10

**Overall: ~8.4/10 (HEALTHY).** No P0. One P1 (dormant contradictory FSM), one P2 (admin patient-list gap), three P3 observations.
