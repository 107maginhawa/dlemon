# dental-emr-integration — File Enforcement
<!-- oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | 2026-05-28 -->

**Module spec:** `docs/product/modules/dental-emr-integration/MODULE_SPEC.md`
**Backend source:** `services/api-ts/src/handlers/emr/` (FUTURE_PHASE — actual target dir absent; `emr/` is a different module)
**Run focus:** F2 — Service-layer DI (file presence, direct DB calls in handlers, naming, size)
**Phase status:** FUTURE_PHASE — `services/api-ts/src/handlers/dental-emr-integration/` does not exist

---

## Summary

- Files scanned: 12 (in `services/api-ts/src/handlers/emr/` — the existing adjacent module)
- Findings: 7 (P0: 0, P1: 2, P2: 5, P3: 0)
- Service files present: `.service.ts` ❌ (absent), `.repo.ts` ✅ (`emr.repo.ts` present)

> **Important:** The `emr/` directory implements the upstream Monobase consultation-notes module (draft/finalized consultation lifecycle), NOT the `dental-emr-integration` module (external practice data import from Open Dental/Dentrix/Eaglesoft/HL7-FHIR). For FUTURE_PHASE items, severities are downgraded to P2/P3 unless dangerous patterns exist. The `emr/` module is audited here as the only live code in scope per the task instruction (`services/api-ts/src/handlers/emr/`).

---

## Findings

| ID | Sev | Description | File | Line |
|----|-----|-------------|------|------|
| EF-EMR-001 | P1 | **Missing `.service.ts`** — `emr.repo.ts` is 678 lines containing business logic (FSM validation, consultation state transitions, complex joins); a `emr.service.ts` should extract orchestration from handlers | `emr/repos/emr.repo.ts` | — |
| EF-EMR-002 | P1 | **`emr.repo.ts` exceeds 500-line threshold** (678 lines) — file is oversized; business logic and query methods should be split | `repos/emr.repo.ts` | 1–678 |
| EF-EMR-003 | P2 | **Handler file `createConsultation.ts` exceeds 100 lines** (105 lines) with inline business logic — move orchestration to service layer | `createConsultation.ts` | 1–105 |
| EF-EMR-004 | P2 | **Handler file `listEMRPatients.ts`** (187 lines) is large for a list handler; likely contains inline query logic that belongs in repo | `listEMRPatients.ts` | 1–187 |
| EF-EMR-005 | P2 | **Handler file `getConsultation.ts`** (127 lines) and `listConsultations.ts` (132 lines) exceed recommended handler size; review for inline business logic | `getConsultation.ts`, `listConsultations.ts` | — |
| EF-EMR-006 | P2 | **Test file `emr-coverage.test.ts` too large** (624 lines) — split into feature-scoped test files | `emr-coverage.test.ts` | — |
| EF-EMR-007 | P2 | **FUTURE_PHASE: `dental-emr-integration/` handler directory absent** — the module specified in `docs/product/modules/dental-emr-integration/MODULE_SPEC.md` has no implementation; all expected files are missing. Severity is P2 (not P0/P1) because this is an explicitly deferred future phase. | `services/api-ts/src/handlers/dental-emr-integration/` | — |

---

## F2 Analysis: Service-Layer Presence

### `emr/` module (live code)

**`.service.ts` — ABSENT (P1)**

`emr.repo.ts` at 678 lines is doing double duty — it contains both raw DB query methods and higher-level orchestration logic (FSM state validation, consultation lifecycle management). A `emr.service.ts` should be extracted to:

1. Own the consultation FSM (draft → finalized → amended transitions)
2. Orchestrate multi-step operations (create + attach vitals, finalize + notify)
3. Keep `emr.repo.ts` to pure data-access operations under 300 lines

**`.repo.ts` — PRESENT ✅**

`repos/emr.repo.ts` (678 lines) and `repos/emr.schema.ts` (273 lines) are present. `repos/emr.repo.test.ts` (111 lines) provides repo-level test coverage.

**`.types.ts` — ABSENT (informational)**

No `emr.types.ts`. Consultation state enum and related types presumably co-located in the schema or repo file. Not a blocking finding.

### `dental-emr-integration/` module (future phase)

**Entire module absent.** Per MODULE_SPEC, the module requires:

```
services/api-ts/src/handlers/dental-emr-integration/
├── repos/
│   ├── emr-record.schema.ts      # emr_record table, pgEnum source_system
│   ├── emr-record.repo.ts        # EmrRecordRepository
│   └── emr-record.repo.test.ts
├── emr-integration.service.ts    # import orchestration, source validation
├── importEMR.ts
├── listEMRRecords.ts
├── getEMRRecord.ts
└── index.ts                      # route registration + 405 guards
```

When this module is implemented, a `.service.ts` is required from day one given:
- Multi-step import flow (validate source system → parse file → store record → generate presigned URL)
- Immutability enforcement (405 guards for PATCH/DELETE)
- Cross-module loose-ref resolution (`patient_id` UUID without FK)

---

## Direct DB Calls in Handlers

**`emr/` module:** No direct `db.select/insert/update/delete` calls found in handler files outside `repos/`. All DB operations are delegated to `emr.repo.ts`. PASS.

**`dental-emr-integration/` module:** N/A — not yet implemented.

---

## Naming Convention Check

### `emr/` handler files

| File | Convention | Status |
|------|-----------|--------|
| `createConsultation.ts` | camelCase .ts | PASS |
| `finalizeConsultation.ts` | camelCase .ts | PASS |
| `getConsultation.ts` | camelCase .ts | PASS |
| `listConsultations.ts` | camelCase .ts | PASS |
| `listEMRPatients.ts` | camelCase .ts — `EMR` is an acronym, acceptable | PASS |
| `updateConsultation.ts` | camelCase .ts | PASS |
| `repos/emr.repo.ts` | kebab.repo.ts | PASS |
| `repos/emr.schema.ts` | kebab.schema.ts | PASS |
| `repos/emr.repo.test.ts` | kebab.repo.test.ts | PASS |
| `emr.handlers.test.ts` | kebab.handlers.test.ts | PASS |
| `emr-coverage.test.ts` | kebab-coverage.test.ts | PASS |
| `consultation-note.fsm.property.test.ts` | kebab.fsm.property.test.ts | PASS |

No PascalCase non-component files. No naming violations.

---

## Cross-Module Import Analysis

No cross-module `from '@/handlers/...'` imports found in any `emr/` handler or repo file. Module is self-contained. PASS.

---

## File Inventory

### `emr/` Handler Files

| File | Lines | Flag |
|------|-------|------|
| `createConsultation.ts` | 105 | P2 — slightly oversized |
| `finalizeConsultation.ts` | 91 | OK |
| `getConsultation.ts` | 127 | P2 — review for inline logic |
| `listConsultations.ts` | 132 | P2 — review for inline logic |
| `listEMRPatients.ts` | 187 | P2 — oversized list handler |
| `updateConsultation.ts` | 96 | OK |

### `emr/repos/` Files

| File | Lines | Flag |
|------|-------|------|
| `emr.repo.ts` | 678 | P1 — exceeds 500-line threshold |
| `emr.schema.ts` | 273 | OK |
| `emr.repo.test.ts` | 111 | OK |

### `emr/` Test Files

| File | Lines | Flag |
|------|-------|------|
| `consultation-note.fsm.property.test.ts` | 99 | OK |
| `emr-coverage.test.ts` | 624 | P2 — too large |
| `emr.handlers.test.ts` | 286 | OK |

---

## FUTURE_PHASE: Expected File Inventory for `dental-emr-integration/`

All files below are MISSING. Severity downgraded to P2 (future phase, not dangerous).

```
services/api-ts/src/handlers/dental-emr-integration/
├── repos/
│   ├── emr-record.schema.ts          # MISSING P2
│   ├── emr-record.repo.ts            # MISSING P2
│   └── emr-record.repo.test.ts       # MISSING P2
├── emr-integration.service.ts        # MISSING P2 — required for import orchestration
├── importEMR.ts                       # MISSING P2
├── listEMRRecords.ts                  # MISSING P2
├── getEMRRecord.ts                    # MISSING P2
├── dental-emr-integration.test.ts    # MISSING P2
└── index.ts                           # MISSING P2
```

**Name collision risk:** Implement as `dental-emr-integration/` (not `emr/`) to avoid conflicting with the existing upstream `emr/` consultation-notes module.

---

_Generated by oli-enforce-file v1.0 | run: run-5-f2-service-layer-di | dental-emr-integration | 2026-05-28_
