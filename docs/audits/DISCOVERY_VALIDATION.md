# Discovery Validation — Codebase Map Freshness & Coverage

<!-- oli: discovery-dimension | oli-check | read-only -->
<!-- based-on: docs/audits/codebase-map/.map-meta.json (version 5, git_sha ae0d17da) -->
_Run: 2026-05-31 · Dimension: DISCOVERY · Mode: validate-existing-map (no regeneration)_

## Verdict

**PASS (map is FRESH + complete for what it scanned)** — with one scoped caveat: the
spec-trace layer is intentionally empty this run (`spec_trace_optin: false`), so the
map does NOT itself attribute the 43 backend endpoints to the 12 MODULE_SPECs. Trace
attribution is the `/oli-check --traceability` dimension's job, not discovery's.

## 1. Freshness — VALIDATED FRESH

Authoritative manifest: `docs/audits/codebase-map/.map-meta.json`

| Field | Value | Check |
|---|---|---|
| `version` | 5 | matches trust-thesis baseline ✅ |
| `git_sha` | `ae0d17da…` | = HEAD parent; map regenerated + committed at `2900d281` (HEAD) ✅ |
| `file_count` | 199 | scanned tree current ✅ |
| `producer` | `engine` (ts-morph AST, v0.1.0) | engine path, NOT regex fallback — trust thesis IN FORCE ✅ |
| `fields_unavailable` | `[]` | no degraded fields ✅ |
| `timestamp` | 2026-05-31T10:39:06Z | same-day as HEAD ✅ |

**Source drift check:** `git status --porcelain` on `services/api-ts/src` + `apps/dentalemon/src`
is empty → **0 source files drifted vs HEAD.** The map commit (`2900d281`) is one commit
ahead of the manifest's recorded sha (`ae0d17da`); the only intervening commit IS the map
regeneration itself, with no source change. **Map content matches HEAD. FRESH.**

## 2. Coverage — all 12 spec modules have a code footprint

Every one of the 12 product modules resolves to backend code captured by the engine:

| MODULE_SPEC | Backend handler dir | In API surface? |
|---|---|---|
| dental-audit | `handlers/dental-audit` | yes |
| dental-billing | `handlers/dental-billing` | yes (`/dental/billing/*`) |
| dental-clinical | `handlers/dental-clinical` | yes |
| dental-imaging | `handlers/dental-imaging` | yes (`/dental/imaging/*`, ceph) |
| dental-org | `handlers/dental-org` | yes (`/dental/org/*`, branches) |
| dental-patient | `handlers/dental-patient` | yes (`/dental/patients/*`) |
| dental-perio | `handlers/dental-perio` | yes |
| dental-pmd | `handlers/dental-pmd` | yes (`/dental/pmd/import`) |
| dental-scheduling | `handlers/dental-scheduling` | yes (queue, recalls) |
| dental-visit | `handlers/dental-visit` | yes (`/dental/visits/*`, treatment-plans) |
| emr-consultation | `handlers/emr` | yes |
| external-records-import | `handlers/emr` (EMR-*/emr_record) | yes |

**0 spec modules missing from the scanned tree.** Frontend: 199 files, 739 components,
react+generic frameworks. Backend: Hono phase ran (26ms), 43 endpoints catalogued.

## 3. Known map limitations (NOT staleness — by design or by opt-in)

These are completeness notes for downstream dimensions, not discovery BLOCKs:

1. **CODE_SPEC_TRACE empty** — `spec_trace_optin: false`, `phase_timings.spec-trace: 0`.
   `openapi.json` exists at `specs/api/dist/openapi/openapi.json` but trace was opt-out
   this run. The "237/0/0 spec-trace" figure in project memory came from a prior
   traceability run, not from this map. → defer to `/oli-check --traceability`.
2. **CODE_MODULE_MAP lists only frontend modules** (`apps/dentalemon/src/*`). Backend
   handlers are captured in CODE_API_SURFACE, not as named entries in MODULE_MAP. This is
   the engine's frontend-module convention; backend coverage is via the API-surface layer.
3. **CODE_API_SURFACE module attribution = `"unknown"`** for all 43 endpoints — paths are
   captured (correctly, all under `/dental/*`) but not bucketed to a domain module.
   Cosmetic for discovery; relevant if traceability needs per-module endpoint grouping.
4. **CODE_ROUTE_MAP / CODE_DATA_MODEL sparse** — route count 0, no dental tables surfaced.
   TanStack phase ran (62ms) but emitted no rows; data-model phase ran (1ms). Low-signal
   layers; not blocking. Flag for the next full regen if these dimensions are needed.

## What's Next

- Discovery PASS → map is a trustworthy substrate for the other dimensions.
- For endpoint→spec attribution + the 237-op trace, run `/oli-check --traceability`
  (re-run the map with `spec_trace_optin: true` if per-op trace is needed inline).
