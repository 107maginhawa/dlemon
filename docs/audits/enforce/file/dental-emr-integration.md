# dental-emr-integration — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-6-strict-2026-05-29 | --strict -->

**Module spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**Handler dir checked:** `services/api-ts/src/handlers/emr/` (exists)
**Alt dir checked:** `services/api-ts/src/handlers/dental-emr/` (MISSING)
**Run focus:** Identity verification + F2 service-layer/DI baseline (--strict)

---

## Identity Mismatch Verdict

**CONFIRMED MISMATCH.** The directory `services/api-ts/src/handlers/emr/` exists and contains live code, but it does **NOT** implement the `dental-emr-integration` module spec.

| Attribute | MODULE_SPEC says | `emr/` implements |
|-----------|-----------------|-------------------|
| **Purpose** | External EMR import bridge (Open Dental, Dentrix, HL7/FHIR) — read-only import records | Consultation notes lifecycle (draft → finalized → amended) |
| **Primary entity** | `EMRRecord` (imported_at, source_system, file_url, status=`imported`) | `ConsultationNote` (chief_complaint, assessment, plan, vitals, status=draft/finalized/amended) |
| **Key endpoints** | `POST /dental/emr/import` (multipart/form-data, file upload) | `POST /emr/consultations`, `PATCH /emr/consultations/:id`, `POST /emr/consultations/:id/finalize` |
| **Immutability rule** | Records are read-only after import; PATCH/DELETE → 405 `EMR_IMMUTABLE` | Records are mutable (updateConsultation.ts present) |
| **Auth** | `dentist_associate`, `dentist_owner` only | Provider role via `ctx.get('user')` |
| **Branch isolation** | `assertBranchAccess` required (spec §14) | **No `assertBranchAccess` call found anywhere in `emr/`** |
| **Implementation status** | Future Phase (Phase 3+) — MODULE_SPEC §1 explicitly states "no handler directory exists" | Active code shipped |

**Root cause:** The `emr/` directory is the upstream Monobase consultation-notes module, repurposed/retained from the base platform. The `dental-emr-integration` spec was written to define a *new, separate* external-import module. The names overlap ("EMR"), creating the illusion of mapping that does not exist.

---

## Summary

- Files scanned: 12 (`services/api-ts/src/handlers/emr/`)
- **Identity mismatch: YES**
- **Wrong implementation: YES** — `emr/` is consultation notes, not EMR import
- Findings: 8 (P0: 1, P1: 2, P2: 5, P3: 0)

---

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-EMR-001 | **P0** | **Identity mismatch — `emr/` implements consultation notes, not external EMR import.** `dental-emr-integration` MODULE_SPEC defines `POST /dental/emr/import` (multipart file upload, `source_system`, `file_url`, immutable after import). The `emr/` directory implements a consultation-notes FSM (`draft→finalized→amended`, mutable, no file upload, no `source_system`). These are different domains. The directory should be `dental-consultation/` (or `consultation/`) and the spec-required `dental-emr-integration/` handler must be created separately when Phase 3 executes. | `services/api-ts/src/handlers/emr/` | — |
| EF-EMR-002 | **P1** | **Missing `assertBranchAccess`** — MODULE_SPEC §14 lists `dental-org (assertBranchAccess)` as a required dependency. Zero calls to `assertBranchAccess` exist in any handler or repo file in `emr/`. All consultation endpoints are branch-scoped clinical data; branch isolation must be enforced. | `emr/*.ts` | — |
| EF-EMR-003 | **P1** | **Missing `.service.ts`** — `emr.repo.ts` is 678 lines containing FSM validation, consultation state transitions, and multi-step orchestration. A `emr.service.ts` (or `consultation.service.ts` post-rename) must be extracted to separate orchestration from data access. | `emr/repos/emr.repo.ts` | 1–678 |
| EF-EMR-004 | P2 | **`emr.repo.ts` exceeds 500-line threshold** (678 lines) — oversized; business logic and raw query methods should be split after service extraction. | `repos/emr.repo.ts` | 1–678 |
| EF-EMR-005 | P2 | **Handler `createConsultation.ts`** (105 lines) contains inline orchestration that belongs in service layer. | `createConsultation.ts` | 1–105 |
| EF-EMR-006 | P2 | **Handlers `listEMRPatients.ts`** (187 lines), **`getConsultation.ts`** (127 lines), **`listConsultations.ts`** (132 lines) — all oversized; review for inline query logic that belongs in repo. | listed files | — |
| EF-EMR-007 | P2 | **Test file `emr-coverage.test.ts` too large** (624 lines) — split into feature-scoped test files. | `emr-coverage.test.ts` | — |
| EF-EMR-008 | P2 | **FUTURE_PHASE: `dental-emr-integration/` handler directory absent** — the actual MODULE_SPEC implementation (external import, `emr_record` table, 405 guards) has zero code. Required when Phase 3 executes. See expected file inventory below. | `services/api-ts/src/handlers/dental-emr-integration/` | — |

---

## P0 Detail: EF-EMR-001 — Identity Mismatch

### What the spec requires (`dental-emr-integration`)

```
POST /api/v1/dental/emr/import
  body: multipart/form-data { patient_id, branch_id, source_system, file, description? }
  response: { id, patient_id, branch_id, source_system, description, status: "imported", imported_at, file_url }
  PATCH → 405 EMR_IMMUTABLE
  DELETE → 405 EMR_IMMUTABLE

GET /api/v1/dental/emr/:patientId   — list patient's imported records
GET /api/v1/dental/emr/:id          — get single imported record
```

Schema: `emr_record` table with `source_system` enum (`hl7_fhir`, `cda`, `pdf`, `csv`, `other`), `file_url`, `imported_at`, `status='imported'` (terminal).

### What `emr/` actually implements (consultation notes)

```
POST   /emr/consultations                   — createConsultation.ts
GET    /emr/consultations                   — listConsultations.ts
GET    /emr/consultations/:id               — getConsultation.ts
PATCH  /emr/consultations/:id               — updateConsultation.ts (mutable — opposite of spec)
POST   /emr/consultations/:id/finalize      — finalizeConsultation.ts
GET    /emr/patients                        — listEMRPatients.ts
```

Schema: `consultation_note` table with `chief_complaint`, `assessment`, `plan`, `vitals` (JSONB), `symptoms` (JSONB), `status` enum (`draft`, `finalized`, `amended`).

### Required remediation

1. **Rename `emr/` → `consultation/` (or `dental-consultation/`)** — reflects actual domain; eliminates name collision with future EMR import module.
2. **Update all imports** pointing to `@/handlers/emr/`.
3. **Add `assertBranchAccess`** to all consultation handlers (P1 — do not defer).
4. **Create `dental-emr-integration/`** as a new directory when Phase 3 executes.
5. **Do NOT merge consultation logic into the future EMR import module** — these are separate bounded contexts.

---

## P1 Detail: EF-EMR-002 — Missing assertBranchAccess

All consultation note endpoints expose branch-scoped PHI. The spec §14 requires `assertBranchAccess`. Current handlers authenticate the user but do not verify the user belongs to the branch owning the patient/consultation.

```bash
# Verification command — returns 0 results (confirms absence)
grep -rn 'assertBranchAccess' services/api-ts/src/handlers/emr/
# (no output)
```

Fix: import and call `assertBranchAccess(ctx, branchId)` in each handler before DB access.

---

## F2 Analysis: Service-Layer Presence

| Layer | File | Status |
|-------|------|--------|
| `.service.ts` | absent | P1 — required |
| `.repo.ts` | `emr.repo.ts` (678 lines) | PRESENT but oversized |
| `.schema.ts` | `emr.schema.ts` (273 lines) | PRESENT, OK |
| `.repo.test.ts` | `emr.repo.test.ts` (111 lines) | PRESENT, OK |

No direct `db.select/insert/update/delete` calls in handler files. DB access fully delegated to repo. PASS.

---

## Naming Convention Check

| File | Convention | Status |
|------|-----------|--------|
| `createConsultation.ts` | camelCase .ts | PASS |
| `finalizeConsultation.ts` | camelCase .ts | PASS |
| `getConsultation.ts` | camelCase .ts | PASS |
| `listConsultations.ts` | camelCase .ts | PASS |
| `listEMRPatients.ts` | camelCase .ts — EMR acronym acceptable | PASS |
| `updateConsultation.ts` | camelCase .ts | PASS |
| `repos/emr.repo.ts` | kebab.repo.ts | PASS |
| `repos/emr.schema.ts` | kebab.schema.ts | PASS |
| `repos/emr.repo.test.ts` | kebab.repo.test.ts | PASS |
| `emr.handlers.test.ts` | kebab.handlers.test.ts | PASS |
| `emr-coverage.test.ts` | kebab-coverage.test.ts | PASS |
| `consultation-note.fsm.property.test.ts` | kebab.fsm.property.test.ts | PASS |

No naming violations. Note: names are internally consistent but the directory name `emr/` is misleading (see P0).

---

## Cross-Module Import Analysis

No `from '@/handlers/...'` cross-module imports in `emr/` handlers or repos. Module is self-contained. PASS.

---

## File Inventory (`emr/` — live consultation-notes module)

### Handler Files

| File | Lines | Flag |
|------|-------|------|
| `createConsultation.ts` | 105 | P2 — slightly oversized |
| `finalizeConsultation.ts` | 91 | OK |
| `getConsultation.ts` | 127 | P2 — review inline logic |
| `listConsultations.ts` | 132 | P2 — review inline logic |
| `listEMRPatients.ts` | 187 | P2 — oversized |
| `updateConsultation.ts` | 96 | OK |

### Repo Files

| File | Lines | Flag |
|------|-------|------|
| `emr.repo.ts` | 678 | P1 — exceeds threshold |
| `emr.schema.ts` | 273 | OK |
| `emr.repo.test.ts` | 111 | OK |

### Test Files

| File | Lines | Flag |
|------|-------|------|
| `consultation-note.fsm.property.test.ts` | 99 | OK |
| `emr-coverage.test.ts` | 624 | P2 — too large |
| `emr.handlers.test.ts` | 286 | OK |

---

## FUTURE_PHASE: Expected File Inventory for `dental-emr-integration/`

All below are MISSING. P2 (future phase, explicitly deferred to Phase 3+).

```
services/api-ts/src/handlers/dental-emr-integration/
├── repos/
│   ├── emr-record.schema.ts          # MISSING P2 — emr_record table, source_system pgEnum
│   ├── emr-record.repo.ts            # MISSING P2 — EmrRecordRepository (read-only after insert)
│   └── emr-record.repo.test.ts       # MISSING P2
├── emr-integration.service.ts        # MISSING P2 — import orchestration, source validation, presigned URL
├── importEMR.ts                       # MISSING P2 — POST /dental/emr/import (multipart)
├── listEMRRecords.ts                  # MISSING P2 — GET /dental/emr/:patientId
├── getEMRRecord.ts                    # MISSING P2 — GET /dental/emr/:id
├── dental-emr-integration.test.ts    # MISSING P2
└── index.ts                           # MISSING P2 — route registration + 405 guards
```

**Name collision note:** Implement as `dental-emr-integration/` (not `emr/`) to avoid conflicting with the consultation-notes module that currently occupies `emr/`.

---

_Generated by oli-enforce-file v1.0 | run: run-6-strict-2026-05-29 | dental-emr-integration | --strict_
