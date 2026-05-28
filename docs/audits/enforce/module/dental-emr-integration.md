<!-- oli-enforce-module v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 | FUTURE_PHASE -->

# dental-emr-integration — Module Enforcement

**Audit Date:** 2026-05-28 (updated from 2026-05-27; F2 service-layer/DI pass added)
**Run ID:** run-5-f2-service-layer-di
**Auditor:** oli-enforce-module v1.0
**Module Spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**API Contracts:** `docs/product/modules/dental-emr-integration/API_CONTRACTS.md`
**Implementation Status:** FUTURE_PHASE — handler directory unexpectedly EXISTS; wrong-domain implementation present

## Summary
- **Status:** FUTURE_PHASE
- **Findings:** 12 (P0: 2, P1: 7, P2: 3)
- **Service-Layer Pattern (F2):** ABSENT — all handlers use inline `new Repository(db, logger)` instantiation
- **Compliance Score:** 22/100 (exempted from gate — FUTURE_PHASE; P0 caps score at 3 per dimension)

> **Key finding (F2 focus):** The `handlers/emr/` directory contains a fully-implemented Consultation Notes system that is **not** the dental-emr-integration module. All 6 handlers use inline repo instantiation with no DI. No service layer exists. The correct dental-emr-integration module (file import bridge, `emr_record` table) is entirely absent.

---

## Executive Summary

The `dental-emr-integration` module (external EMR/EHR import bridge) is **NOT IMPLEMENTED**. This is expected per the spec (`implementation_status: future_phase`).

However, there is a **critical identity collision**: a live handler directory named `emr/` exists at `services/api-ts/src/handlers/emr/` which implements a **general medical consultation notes system** (visit documentation, SOAP notes, provider-scoped consultation lifecycle) — this is NOT the dental-emr-integration module. It has a different domain, different schema, different routes, and different access control model. These are two distinct modules sharing a namespace collision.

**V1 Readiness:** RED (module not implemented; spec has structural gaps; identity collision with unrelated `emr/` module creates confusion risk)

---

## §1 Identity Collision — CRITICAL FINDING

| Item | Finding | Priority |
|------|---------|----------|
| Handler directory `services/api-ts/src/handlers/emr/` | EXISTS but implements consultation notes (SOAP documentation), NOT the dental-emr-integration spec | P0 |
| Module name overlap | `emr/` handler uses `consultation_note` table, providers/patients model — unrelated to dental-emr-integration (external EMR import) | P0 |
| Spec clarity | MODULE_SPEC.md §1 explicitly states "NOT an alias for dental-visit" but does not address the `emr/` consultation module collision | P1 |

**Impact:** Any future implementation of dental-emr-integration that creates a handler at `services/api-ts/src/handlers/dental-emr/` or similar will shadow/conflict with the existing `emr/` module. The `emr/` module should be renamed (e.g., `consultation-notes/` or `dental-consultation/`) to prevent namespace confusion before Phase 3+ work begins.

---

## §2 Spec Completeness Audit

### 2.1 Required Sections vs Present

| Section | Required by Standard | Present | Status | Priority |
|---------|---------------------|---------|--------|----------|
| §1 Module Overview | YES | YES | PRESENT | — |
| §2 Domain Terms | YES | YES (3 terms) | PARTIAL — missing "format_version", "imported_by_member_id" terms | P2 |
| §3 Workflows | YES | YES (WF-100, WF-101) | PRESENT (minimal) | — |
| §4 Integration Points | YES | MISSING (section skipped) | MISSING | P1 |
| §5 Business Rules | YES | YES (partial) | PARTIAL | P1 |
| §6 Permissions | YES | YES | PRESENT (terse) | P2 |
| §7 Data Requirements | YES | YES | PRESENT | — |
| §7b Aggregate Boundaries | YES | YES | PRESENT | — |
| §8 State Transitions | YES | YES | PRESENT (terminal-only) | — |
| **§9 UI/UX Expectations** | YES per standard | **MISSING** | **MISSING** | **P1** |
| **§10 API Expectations** | YES | YES (§10 present) | PRESENT (terse) | — |
| **§10b Events** | YES per standard | **MISSING** | **MISSING** | **P1** |
| §11 Acceptance Criteria | YES | YES (3 ACs) | PARTIAL — only 3 ACs, no auth/permission ACs | P1 |
| §12 Open Questions | YES | MISSING | MISSING | P2 |
| §13 Error Taxonomy | YES | MISSING (only in API_CONTRACTS) | MISSING from spec | P2 |
| §14 Dependencies | YES | YES | PRESENT | — |
| §15 Migration Notes | YES | MISSING | MISSING | P2 |
| §16 Performance Expectations | YES | YES | PRESENT | — |
| §17 Security Considerations | YES | MISSING | MISSING | P1 |
| §18 Compliance/HIPAA | YES | MISSING | MISSING | P1 |
| §19 Vertical Slice Plan | YES | YES | PRESENT | — |
| §20 AI Instructions | YES | YES | PRESENT | — |

### 2.2 Missing §9 UI/UX

The spec has no UI section. Per the IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD §8 and per the known risk flagged in the task prompt, UI expectations are absent.

**Required UI items not specified:**
- Patient cabinet view: where imported EMR records appear relative to native dental records
- Import flow: file picker UX, source system selector, progress/error feedback
- Read-only enforcement: UI affordances for non-editable imported records
- Record detail view: file preview / download UX, presigned URL expiry handling

**Priority: P1** — UI spec must exist before frontend implementation begins.

### 2.3 Missing §10b Events

No domain events are defined for this module. Reviewing the EVENT_CONTRACTS.md (DE-001 through DE-024), there is no `EMRImported` event or equivalent. This is a gap.

**Expected event not defined:**
- `EMRImported@1` — trigger: POST /dental/emr/import succeeds; consumers: dental-audit (at minimum)

The absence means: (a) no audit trail event on import, and (b) downstream consumers cannot react to new EMR records.

**Priority: P1** — dental-audit is listed as subscriber to ALL events; without this event, audit coverage is broken for EMR imports.

---

## §3 API Contract Compliance Audit

### 3.1 Endpoint Coverage

| Endpoint | Defined in API_CONTRACTS.md | Implemented | Status |
|----------|---------------------------|-------------|--------|
| `POST /api/v1/dental/emr/import` | YES | NO | MISSING |
| `GET /api/v1/dental/emr/:patientId` | YES | NO | MISSING |
| `GET /api/v1/dental/emr/:id` | YES | NO | MISSING |
| `PATCH /dental/emr/*` → 405 | YES (AC-EMR-001) | NO | MISSING |
| `DELETE /dental/emr/*` → 405 | YES (AC-EMR-001) | NO | MISSING |

**All 5 required routes are MISSING.** This is expected for a Phase 3+ module.

### 3.2 API Contract Defects (spec-level bugs, independent of implementation)

| ID | Location | Issue | Priority |
|----|---------|-------|----------|
| API-D1 | `GET /api/v1/dental/emr/:patientId` vs `GET /api/v1/dental/emr/:id` | **Route collision risk**: both use `/dental/emr/:param` path pattern. Router cannot distinguish `:patientId` from `:id` without additional path segment or explicit differentiation. One must be `/dental/emr/patient/:patientId` or `/dental/emr/records/:id`. | P0 |
| API-D2 | `POST /api/v1/dental/emr/import` — `source_system` enum | Enum values are `hl7_fhir`, `cda`, `pdf`, `csv`, `other`. MODULE_SPEC §7 lists `"open-dental"`, `"dentrix"`, `"eaglesoft"` as import sources. No `open-dental`, `dentrix`, or `eaglesoft` values exist in the API contract enum. Spec §5 says "Source system identifier is required for audit trail" — these major PMS systems are missing. | P1 |
| API-D3 | `POST /api/v1/dental/emr/import` response | Response shape includes `file_url` (presigned URL, 24h TTL) but no `expires_at` field. The detail endpoint `GET /:id` response DOES include `expires_at`. Inconsistency: import response omits expiry metadata that callers need to know when to refresh. | P2 |
| API-D4 | `GET /api/v1/dental/emr/:patientId` — `branch_id` as required query param | `branch_id` is required in the list endpoint but NOT required in the import or detail endpoints. This is inconsistent with `assertBranchAccess` dependency declared in §14. If branch scoping is enforced, all endpoints should require it. If it's only needed for list, that should be documented. | P1 |
| API-D5 | `PATCH/DELETE` → 405 | The contract says "Returns `405 EMR_IMMUTABLE`" but does not specify whether a route handler must be registered (returning 405) or whether the absence of the route (returning 404) is acceptable. The AC-EMR-001 says "PATCH/DELETE imported EMR → 405" — this requires an explicit route registration returning 405, not a missing route. | P1 |
| API-D6 | Error code `EMR_NOT_FOUND(404)` on detail vs `NOT_FOUND(404)` on list | Inconsistent error code naming between the two GET endpoints. Should both use `EMR_NOT_FOUND` or both use `NOT_FOUND`. | P2 |

### 3.3 Schema Completeness vs MODULE_SPEC §7

MODULE_SPEC §7 defines the `emr_record` entity fields:

| Field | In Spec §7 | In API_CONTRACTS Response | Status |
|-------|-----------|--------------------------|--------|
| `id` | YES | YES | OK |
| `patient_id` | YES | YES | OK |
| `branch_id` | YES | YES | OK |
| `source_system` | YES | YES | OK |
| `import_date` / `imported_at` | YES (as `import_date`) | YES (as `imported_at`) | MISMATCH — spec says `import_date`, contract says `imported_at` |
| `content` (JSONB) | YES | NO — not exposed in any response | MISSING — raw imported content not accessible via API |
| `imported_by_member_id` | YES | NO — not in any response field | MISSING — audit trail field dropped from API responses |
| `format_version` | YES | NO | MISSING |
| `description` | NO (not in spec §7) | YES (in API_CONTRACTS) | ADDED in contract, not in spec — inconsistency |
| `status` | NO (not in spec §7 field list) | YES | ADDED in contract |
| `file_url` | NO (not in spec §7) | YES | ADDED in contract — not reconciled back to spec |
| `expires_at` | NO | YES (detail only) | ADDED in contract |

**Key discrepancy:** `content (JSONB)` is defined in spec §7 as a core field but never surfaced in the API contract. If this is intentional (content only accessible via `file_url`), it must be documented. If `content` stores raw imported data and `file_url` is the access path, the spec should say so.

---

## §4 Permission/Role Compliance Audit

### 4.1 Spec §6 vs ROLE_PERMISSION_MATRIX.md

| Role | Spec §6 | ROLE_PERMISSION_MATRIX.md | Status |
|------|---------|--------------------------|--------|
| `dentist_owner` | Import + View + Delete | Not listed for dental-emr-integration | MISSING from matrix |
| `dentist_associate` | Import + View | Not listed | MISSING from matrix |
| `staff_full` | View only | Not listed | MISSING from matrix |
| `staff_scheduling` | Not mentioned | Not listed | GAP — should be explicitly "No access" |

**Finding:** dental-emr-integration permissions are not represented in ROLE_PERMISSION_MATRIX.md. This is expected for a Phase 3+ module but creates a gap when implementing.

### 4.2 Delete Permission — Security Gap

MODULE_SPEC §6 states: "Delete: dentist_owner only". However:
- AC-EMR-001 says "PATCH/DELETE imported EMR → 405" (always rejected)
- This contradicts the spec's own permission statement granting delete to dentist_owner

**This is a spec-level contradiction.** Either:
1. Delete is intentionally blocked (405) for everyone — in which case §6 should not mention delete permission
2. Delete is allowed for dentist_owner — in which case AC-EMR-001 must be scoped to non-owners

Priority: **P1 BLOCKER** — contradictory spec language will produce incorrect implementation.

### 4.3 Branch Access Not Enforced in Spec

MODULE_SPEC §14 declares `dental-org (assertBranchAccess)` as a dependency, but:
- §6 Permissions does not reference branch scoping
- §5 Business Rules does not include a rule for branch isolation
- §11 Acceptance Criteria has no AC for cross-branch access denial

A provider from Branch A must not be able to import or view EMR records for patients in Branch B. This invariant is not captured anywhere in the spec.

**Priority: P1** — HIPAA/clinical data isolation requirement.

---

## §5 Business Rule Completeness

| Rule ID | Rule | Spec Section | Status |
|---------|------|-------------|--------|
| BR-EMR-001 | Read-only after import (BR-022 analog) | §5, §7b | PRESENT |
| BR-EMR-002 | source_system required → 422 if absent | §5, AC-EMR-003 | PRESENT |
| BR-EMR-003 | No auto-merge into dental records | §1, §5 | PRESENT |
| BR-EMR-004 | No DB FK to dental_patient table | §7b | PRESENT |
| **BR-EMR-005** | **Branch isolation — importer must belong to patient's branch** | §14 only | **MISSING as explicit rule** |
| **BR-EMR-006** | **File size limit (10 MB per API_CONTRACTS)** | API_CONTRACTS only | **MISSING from spec §5** |
| **BR-EMR-007** | **Presigned URL TTL behavior (24h) and refresh policy** | API_CONTRACTS only | **MISSING from spec** |
| **BR-EMR-008** | **Who can delete: dentist_owner ONLY vs no-one (AC-EMR-001 contradiction)** | CONTRADICTED | **UNRESOLVED** |
| **BR-EMR-009** | **Import of duplicate records: behavior undefined** | Not covered | **MISSING** |

---

## §6 Acceptance Criteria Gap Analysis

| AC | Text | Testable? | Gap |
|----|------|-----------|-----|
| AC-EMR-001 | PATCH/DELETE → 405 | YES | Contradicts §6 delete permission for dentist_owner |
| AC-EMR-002 | Import creates read-only record; editable records unchanged | YES | No test verifies "editable records unchanged" (needs cross-module assertion) |
| AC-EMR-003 | source_system absent → 422 | YES | None |
| **MISSING** | Import with invalid format → IMPORT_PARSE_ERROR(422) | — | API_CONTRACTS defines this error code but no AC tests it |
| **MISSING** | Unauthorized role attempts import → 403 | — | No permission AC |
| **MISSING** | Cross-branch access → 403 | — | No branch isolation AC |
| **MISSING** | File > 10MB → rejection | — | No file size AC |
| **MISSING** | UNSUPPORTED_SOURCE_SYSTEM → 422 | — | API_CONTRACTS defines this but no AC |

Only 3 of ~9 required ACs are present.

---

## §7 Event Contract Compliance

| Event | Required? | Defined in EVENT_CONTRACTS? | Status |
|-------|----------|---------------------------|--------|
| `EMRImported@1` | YES — dental-audit requires all events | NO | **MISSING** |

The consumer subscription table in EVENT_CONTRACTS.md §4 lists `dental-audit` as subscribing to ALL events. Without `EMRImported@1`, audit coverage for EMR imports is broken by design.

**Priority: P1**

---

## §8 Domain Model Compliance

From DOMAIN_MODEL.md §3:

| Item | Domain Model | Implementation | Status |
|------|-------------|---------------|--------|
| `EMRRecord` aggregate root | YES — listed in §3 | NOT IMPLEMENTED | MISSING (expected) |
| Context: Records & Compliance | YES | — | — |
| Loose coupling (UUID refs, no DB FK) | YES — §7b | NOT IMPLEMENTED | MISSING (expected) |

The `emr/` handler that EXISTS implements `consultation_note` which belongs to the **Clinical Encounter** context (or a generic Medical Records context), not the Records & Compliance context. This is a separate domain entity not the EMRRecord aggregate from the domain model.

---

## §9 Test Coverage

| Test Type | Required | Present (dental-emr-integration) | Status |
|-----------|---------|----------------------------------|--------|
| Unit tests (business rules) | YES | NONE | MISSING |
| Integration tests (API routes) | YES | NONE | MISSING |
| Permission tests (role-based deny) | YES | NONE | MISSING |
| Branch isolation tests | YES | NONE | MISSING |
| Immutability tests (405 response) | YES | NONE | MISSING |
| E2E tests | YES | NONE | MISSING |

All test coverage is MISSING. This is expected for Phase 3+. Tests must be written before implementation (Vertical TDD requirement per CLAUDE.md).

---

## §10 Seed Data

| Seed Item | Required | Present | Status |
|-----------|---------|---------|--------|
| EMR import example records | YES | NONE | MISSING |
| EMR records per patient in seed | YES | NONE | MISSING |

---

## §11 Prioritized Gap Register

| ID | Gap | Priority | Blocking? |
|----|-----|----------|-----------|
| G-EMR-01 | Route collision: `GET /dental/emr/:patientId` vs `GET /dental/emr/:id` | **P0** | YES — implementation cannot proceed without resolution |
| G-EMR-02 | Spec contradiction: §6 grants delete to dentist_owner; AC-EMR-001 blocks all DELETE → 405 | **P0** | YES — contradictory spec |
| G-EMR-03 | `emr/` handler (consultation notes) name-collides with future dental-emr-integration module | **P0** | YES — must rename before Phase 3+ |
| G-EMR-04 | `EMRImported@1` domain event not defined in EVENT_CONTRACTS.md | **P1** | YES — audit trail broken |
| G-EMR-05 | §9 UI/UX section missing from MODULE_SPEC | **P1** | YES — required before frontend work |
| G-EMR-06 | §10b events section missing from MODULE_SPEC | **P1** | YES — required before implementation |
| G-EMR-07 | Branch isolation business rule not explicit in spec (BR-EMR-005) | **P1** | YES — HIPAA data isolation |
| G-EMR-08 | `imported_by_member_id` not surfaced in API response (audit trail gap) | **P1** | YES — audit/compliance |
| G-EMR-09 | Permissions not added to ROLE_PERMISSION_MATRIX.md | **P1** | Before implementation |
| G-EMR-10 | `source_system` enum missing `open-dental`, `dentrix`, `eaglesoft` (named in spec §1) | **P1** | Feature gap |
| G-EMR-11 | `branch_id` consistency: required on list but not on import/detail | **P1** | API contract design |
| G-EMR-12 | Field mismatch: spec says `import_date`, contract says `imported_at` | **P2** | Rename to align |
| G-EMR-13 | `content (JSONB)` field: in spec §7, not in any API response — intent undocumented | **P2** | Clarify |
| G-EMR-14 | Import duplicate behavior (same file/source for same patient) not defined | **P2** | — |
| G-EMR-15 | Presigned URL refresh policy not documented in spec | **P2** | — |
| G-EMR-16 | §12/§13/§15/§17/§18 sections missing (open questions, error taxonomy, migration, security, compliance) | **P2** | — |
| G-EMR-17 | UNSUPPORTED_SOURCE_SYSTEM and IMPORT_PARSE_ERROR error codes in contract but no AC/test mapping | **P2** | — |
| G-EMR-18 | Inconsistent error code naming: `EMR_NOT_FOUND` vs `NOT_FOUND` between endpoints | **P2** | — |

---

## §12 V1 Readiness Rating

**RED** — Module not implemented (expected). Spec has two P0 contradictions (route collision, delete permission contradiction) and a P0 naming collision with an existing unrelated `emr/` handler that must be resolved before Phase 3+ execution can begin safely.

---

---

## §13 F2: Service-Layer / DI Assessment (run-5-f2-service-layer-di)

**Pattern: ABSENT**

All six handlers in `services/api-ts/src/handlers/emr/` instantiate repositories inline on every request. No service class, no factory, no context-injected singleton.

**Representative pattern (createConsultation.ts:36-38):**
```typescript
const consultationRepo = new ConsultationNoteRepository(db, logger);
const providerRepo = new ProviderRepository(db, logger);
const patientRepo = new PatientRepository(db, logger);
```

Same pattern repeated in: `listEMRPatients.ts`, `getConsultation.ts`, `listConsultations.ts`, `updateConsultation.ts`, `finalizeConsultation.ts`.

**Repo export (emr.repo.ts:678):**
```typescript
export const consultationNoteRepo = ConsultationNoteRepository;
// Exports the CLASS, not an instance — no singleton
```

**Confidence:** HIGH (all 6 handler files read; repo file read)

**DI impact by layer:**

| Layer | Status | Notes |
|-------|--------|-------|
| Repository | Inline `new` on every request | No injection point |
| Service | None exists | No service wrapper class |
| Context injection | `ctx.get('database')` only | DB injected; repos are not |
| Test isolation | Manual DB required for all tests | Cannot stub repo methods without full DB |

**Comparison to correct pattern (other modules):** Modules like `dental-visit` and `dental-patient` pass `db` via Hono context but provide injectable repo instances or service factories registered at app startup. The `emr/` module skips this step entirely.

**Findings from this pass:**

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EM-EMR-1f36ddd3 | P3 | Inline repo instantiation in all 6 handlers; no DI, no service layer, no singleton export — limits mock injection in tests | `services/api-ts/src/handlers/emr/createConsultation.ts` (and 5 others) | 36–38 |
| EM-EMR-d936bbb5 | P1 | Wrong-domain implementation registered in live app against MODULE_SPEC AI Instruction #3 prohibition | `services/api-ts/src/handlers/emr/` | — |

**Recommended fix (for when this module is scheduled):**
1. Create `emr.service.ts` exporting a service class wrapping `EmrRecordRepository`
2. Register singleton on app startup: `app.set('emrService', new EmrService(db, logger))`
3. Handlers retrieve via `ctx.get('emrService')` — enabling mock injection in tests
4. Note: this applies to the **correct** dental-emr-integration module (file import bridge), not the consultation notes system currently at `handlers/emr/`

---

_Audit produced by: oli-enforce-module v1.0 | run: run-5-f2-service-layer-di_
_Standard reference: `docs/audits/reference/IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md`_
_Inputs: MODULE_SPEC.md, API_CONTRACTS.md, ROLE_PERMISSION_MATRIX.md, EVENT_CONTRACTS.md, DOMAIN_MODEL.md_
_Implementation checked: `services/api-ts/src/handlers/emr/` (NOT the dental-emr-integration module — see §1 and G-EMR-03)_
