# Integration-Only Endpoints (headless API surface)

**Purpose.** A handful of API operations are intentionally **backend/integration
surfaces** — they have a handler and a TypeSpec contract and are tested, but they
deliberately have **no typed SDK hook and no frontend UI**. They exist for
external data exchange (practice-management-data import/export, EMR patient
listing for integrations), not as end-user features.

This doc exists so these are never mistaken for *unfinished* features. They are
finished and intentional. The list is derived from `contract-spine.json` — the
operations in the `withSdk` gap (handler present, no SDK hook).

> Methodology: `bun scripts/build-contract-spine.ts` → `.understand-anything/contract-spine.json`.
> As of `main` HEAD `d9f50d22`: 352 operations, 352 with handler, **344 with an
> SDK hook**. The 8 below are the difference.

## The endpoints

| operationId | Method + path | Handler | Why no UI |
|---|---|---|---|
| `importPMD` | `POST /dental/pmd/import` | `handlers/dental-pmd/importPMD.ts` | Ingests an external practice-management record (read-only link to patient). PHI-ingestion, audited (V-PMD-007). Integration entry point. |
| `exportPMD` | `GET /dental/visits/{visitId}/pmd/export` | `handlers/dental-pmd/exportPMD.ts` | Data-portability export for downstream systems. |
| `generatePMD` | `POST /dental/visits/{visitId}/pmd` | `handlers/dental-pmd/generatePMD.ts` | Generates the PMD payload for a visit (server-side document assembly). |
| `getPMDForVisit` | `GET /dental/visits/{visitId}/pmd` | `handlers/dental-pmd/getPMDForVisit.ts` | Read the generated PMD for a visit (consumed by integrations, not the UI). |
| `getImportedPMD` | `GET /dental/pmd/imported/{id}` | `handlers/dental-pmd/getImportedPMD.ts` | Fetch a single imported external record. |
| `listImportedPMDs` | `GET /dental/pmd/imported` | `handlers/dental-pmd/listImportedPMDs.ts` | List imported external records. |
| `listPMDs` | `GET /dental/visits/pmd` | `handlers/dental-pmd/listPMDs.ts` | List generated PMDs across visits. |
| `listEMRPatients` | `GET /emr/patients` | `handlers/emr/listEMRPatients.ts` | EMR patient listing for external/EMR integrations. |

## Coverage

Each is contract-defined and tested at the backend/contract layers (so a drift or
break is caught even without a UI path):
- TypeSpec: `specs/api/src/modules/dental-pmd.tsp`, `specs/api/src/modules/emr.tsp`.
- Tests: `handlers/dental-pmd/*.test.ts` (incl. `dental-pmd-auth`, `dental-pmd.data-portability`, `dental-pmd-events`) and `handlers/emr/*.test.ts`.
- Contract: `specs/api/tests/contract/dental-pmd.hurl`.

## If you later add a UI for one of these

Generate the SDK hook (it follows from the existing TypeSpec contract via
`@hey-api/openapi-ts`), then consume it from a `features/**` module. At that point
the operation moves out of this list automatically on the next spine regen.

> See also: [docs/testing/VERIFICATION_SNAPSHOT_2026-06-06.md](../testing/VERIFICATION_SNAPSHOT_2026-06-06.md) §2.
