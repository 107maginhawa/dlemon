# Backend Handler Module Template

Reference layout for every module under `services/api-ts/src/handlers/`.
Deviation from this layout requires a comment explaining why.

## Canonical Layout

```
handlers/<module-name>/
├── <verb><Entity>.ts          # Handler files — FLAT, never in subdirectories
├── <verb><Entity>.test.ts     # Co-located tests for that handler
├── <module>.test.ts           # Module-level integration tests
├── <domain>.fsm.property.test.ts  # FSM property tests (if applicable)
├── repos/                     # Schemas + repos — nothing else
│   ├── <entity>.schema.ts
│   ├── <entity>.repo.ts
│   ├── <entity>.test.ts       # Repo-level unit tests
│   └── <entity>.facade.ts     # Cross-module facade (if this module exposes data to others)
└── utils/                     # Validators, helpers, service logic — not registered in registry.ts
    ├── <entity>-validators.ts
    ├── <domain>.service.ts
    └── <helper>.ts
```

## Rules

### Handler files are always flat at module root

`registry.ts` (generated) imports handlers by exact path:
```ts
import { createDentalPatient } from '../../handlers/dental-patient/createDentalPatient';
```
Moving handlers into subdirectories breaks `registry.ts`. Handler files **must stay flat** at the module root.

### No `index.ts` barrel exports

Handlers are imported by name in `registry.ts`. Barrel files add indirection without benefit and obscure the dependency graph.

### `repos/` is for schemas and repos only

- `<entity>.schema.ts` — Drizzle schema definitions
- `<entity>.repo.ts` — repository class with typed query methods
- `<entity>.test.ts` — unit tests for the repo (use real DB, not mocks)
- `<entity>.facade.ts` — thin read-only facade exposing data to other modules without crossing the repo boundary

Nothing else belongs in `repos/`. Validators, helpers, and service logic go to `utils/`.

### `utils/` is for non-handler, non-repo supporting code

- Input validators (Zod schemas used by handlers)
- Domain service logic shared by multiple handlers in this module
- Pure utility functions specific to this module

Tests for `utils/` files are co-located in `utils/` next to the file under test.

### Naming conventions

| Purpose | Pattern | Example |
|---------|---------|---------|
| Handler | `<verb><PascalEntity>.ts` | `createDentalPatient.ts` |
| Handler test | `<verb><PascalEntity>.test.ts` | `createDentalPatient.test.ts` |
| Module integration test | `<kebab-module>.test.ts` | `dental-patient.test.ts` |
| Schema | `<kebab-entity>.schema.ts` | `patient-contact.schema.ts` |
| Repo | `<kebab-entity>.repo.ts` | `patient-contact.repo.ts` |
| Facade | `<kebab-scope>.facade.ts` | `visit-billing.facade.ts` |
| Validator | `<kebab-entity>-validators.ts` | `contact-validators.ts` |
| Service | `<kebab-domain>.service.ts` | `visit.service.ts` |

### Test placement

- Handler co-located tests: `<handler>.test.ts` at module root
- Repo tests: in `repos/` next to the repo file
- Util tests: in `utils/` next to the util file
- Module-level integration tests: `<module>.test.ts` at module root
- FSM property tests: `<domain>.fsm.property.test.ts` at module root

## Reference Modules

These modules already conform to this template:

| Module | Notes |
|--------|-------|
| `dental-scheduling/` | Has `repos/` + `utils/` (assert-branch-access shim) |
| `dental-billing/` | Has `repos/` + `utils/` (rounding helper with test) |
| `dental-imaging/` | Has `repos/` |

## Modules Requiring Cleanup (Phase 11)

| Module | Issue | Fix |
|--------|-------|-----|
| `dental-patient/` | 7 validator files flat at module root | Move to `utils/` |
| `dental-clinical/` | 3 validator files flat at module root | Move to `utils/` |
| `dental-visit/` | `visit.service.ts`, `treatmentTemplates.ts` flat at root | Move to `utils/` |
