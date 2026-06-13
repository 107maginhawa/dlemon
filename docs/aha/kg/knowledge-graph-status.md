# AHA — Knowledge Graph Status

**Date:** 2026-06-11 · **Prompt:** 01-platform-discovery-audit-index

| Item | Status | Notes |
| --- | --- | --- |
| Existing KG found | Yes | `.understand-anything/knowledge-graph.json` (4.4 MB, touched 2026-06-10) — gitignored artifact |
| KG tool/source | understand-anything 2.7.6 | Plus `contract-spine.json` (357 ops → handler → SDK → FE-consumer map, regenerated 2026-06-10) and `domain-graph.json` (15 domains, 2026-06-08) |
| KG appears fresh | Partially | Node graph baseline is `1196799b` (2026-06-06); known drift is **type-import edges only** (the any-burndown refactor) — zero architectural change. `contract-spine.json` is fresh and is the wiring oracle of record. |
| KG refreshed or regenerated | No | Deliberate. Full regeneration was previously measured at ~12M tokens / 60–90 min for marginal value; the type-edge drift does not affect FE→BE wiring questions. |
| Regeneration needed | No | For AHA audits, use `contract-spine.json` for wiring/orphan-endpoint claims and the node graph (with caution) for module boundaries. Ground-truth every claim in source before reporting. |
| Missing areas | Some | Known KG under-modeling (from the 2026-06-08 audit series): no `emr` node; phantom routes (`/dental/audit/events`, `/dental/data-governance/*`, billing ar/aging); bulk patient-import + FHIR bridge unmodeled; retention layer unmodeled. Do not trust the node graph for these — use source + contract-spine. |
| KG status file saved | Yes | This file |

**Rule for AHA prompts 02+:** wiring claims (orphan endpoints, FE consumers) come from `contract-spine.json` + direct source verification, never from the stale node graph alone.
