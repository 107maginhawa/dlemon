---
oli-version: "1.0"
based-on:
  - docs/product/CONSISTENCY_REPORT.md
  - docs/trace/TRACE_REPORT.md
  - docs/audits/COMPLIANCE_REPORT.md
  - docs/audits/CONFIDENCE_REPORT.md
  - docs/audits/ENFORCEMENT_REPORT.md
  - docs/audits/JOURNEY_COVERAGE_REPORT.md
  - docs/audits/UI_CONSISTENCY_REPORT.md
  - docs/execution/RUNTIME_TEST_PLAN.md
  - docs/audits/SEED_COHERENCE_REPORT.md
  - docs/audits/codebase-map/.map-meta.json
last-modified: 2026-06-01T12:00:00Z
last-modified-by: oli-check
---

# OLI Check Summary — full `--auto` sweep @ HEAD a3bfc9a5

## 0. TRUST STATUS

```
╔══ OLI TRUST STATUS ═════════════════════════════════════╗
║ Producer:  engine (@oli/engine)                          ║
║ Freshness: FRESH  (map@a3bfc9a vs HEAD@a3bfc9a)          ║
║ Degraded:  none (fields_unavailable: [])                 ║
║ Unverified (below-confidence-threshold) nodes: 0         ║
║ THESIS IN FORCE for this run.                            ║
╚══════════════════════════════════════════════════════════╝
```
Map refreshed this run (was STALE-OVERLAP @ 73aa9fc) → FRESH. No R1-strict floor.

## 1. Run Context
- **Flags:** `--auto` (non-interactive, all applicable dimensions)
- **Trigger:** re-verify after the data-governance backlog clear (V-DG-001/002, LegalHold, GAP-001, Part B).
- **Dimensions:** consistency, traceability, discovery, compliance, confidence, enforcement, journeys, ui-consistency, runtime, seed-coherence (10/10).

## 2. Dimension Results

| Dimension | Verdict | P0 | P1 | P2 | P3 | Report |
|-----------|---------|----|----|----|----|--------|
| Consistency | PASS | 0 | 0 | ~20 | ~7 | docs/product/CONSISTENCY_REPORT.md |
| Traceability | PASS (WARN-adj) | 0 | 2◇ | 35 | – | docs/trace/TRACE_REPORT.md |
| Discovery (map) | PASS (FRESH) | 0 | 0 | – | – | .map-meta.json |
| Compliance | PASS | 0 | 0 | 1 | 1 | docs/audits/COMPLIANCE_REPORT.md |
| Confidence | PASS | 0 | 0 | 2 | 1 | docs/audits/CONFIDENCE_REPORT.md |
| Enforcement | WARN | 0 | 0 | 2 | 2 | docs/audits/ENFORCEMENT_REPORT.md |
| Journeys | PASS | 0 | 0 | 3 | 6 | docs/audits/JOURNEY_COVERAGE_REPORT.md |
| UI Consistency | WARN (P3-cap) | 0 | 0 | 0 | 4 | docs/audits/UI_CONSISTENCY_REPORT.md |
| Runtime | PASS (live SKIP — app down) | 0 | 0 | 0 | 0 | docs/execution/RUNTIME_TEST_PLAN.md |
| Seed Coherence | SKIP (API down) | 0 | 0 | 0 | 0 | docs/audits/SEED_COHERENCE_REPORT.md |

◇ = carried/systemic (see §4) · **Enforcement: 0 NEW findings, 0 regressions** — the new
erasure/legal-hold modules + 5 facades landed clean (check:boundaries 0 alias, bun audit 0,
typecheck 0, new files 0 lint errors).

## 3. Coverage Matrix (module × dimension)

Legend: ✓ checked · ⊘ skipped (reason) · ✗ gap

| Module | Cons | Trace | Compl | Conf | Enf | Journ | UI |
|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| dental-audit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui |
| dental-billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-clinical | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-emr | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui |
| dental-imaging | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-org | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-patient | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-pmd | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-scheduling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-visit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| retention (code-only) | ⊘ no-spec | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui | ⊘ no-ui |
| erasure (code-only) | ⊘ no-spec | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui | ⊘ no-ui |
| legal-hold (code-only) | ⊘ no-spec | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui | ⊘ no-ui |

**Uncovered modules:** none (no `✗ gap`). The 3 governance modules' ⊘-no-spec is intentional
(internal governance modules without a MODULE_SPEC, like dental-audit).

## 4. Overall — GATE: PASS for this cycle's work; 2 standing/systemic P1s remain (not from this cycle)

**No P0. Zero NEW functional findings from this cycle** — enforcement reports 0 new / 0 regressions,
compliance PASS (V-DG-002 SATISFIES WFG-006), confidence PASS, full suite 2905/0, check:boundaries 0,
bun audit 0. The two P1s are both pre-existing or systemic, neither a functional regression:

1. **`TR-INFRA-001` (P1, carried)** — the engine's `CODE_SPEC_TRACE` is empty (spec_trace_optin
   off). This is a **tooling gap in the oli-engine repo** (`$OLI_ENGINE_HOME`), not dentalemon code.
2. **`TR-DG-002` (P1, systemic) — ✅ CLEARED 2026-06-01** (commits `fa703bc8`…`c90d007c` on
   `feat/ceph-demoable-and-manual-ux`). The full manual-route→TypeSpec migration was executed.
   - Root cause (docs/audits/TR-DG-002-FINDINGS.md): TypeSpec emits a path only when the operation is
     reachable from the `@service` namespace (`MonobaseAPI`); data-governance modules were imported
     but never re-declared there, and ~13 other features had no TypeSpec at all.
   - Migrated: erasure (5), audit-events (1), legal-hold (3, new tsp) + 13 Cat-3 feature groups
     (contacts/recalls/alerts/tasks/treatment-plans/sync-logs/insurance/claims/occlusion/postop/
     inventory/fee-schedule/queue) + `GET /dental/branches`. **Dental paths in `openapi.json`:
     103 → 140.** 191 generated dental routes, all in spec; 0 codegen stubs (291 handlers resolved).
   - Remaining hand-mounted (8, all **unmodelable** Cat-1 exceptions — NOT the divergence this
     finding targeted): audit/pmd `:id` **405 immutability method-guards** (the resource GETs ARE in
     spec) and the two **operationId-collision** treatment-plan keeps (`GET :planId` + `/accept`
     re-export dental-visit ops whose operationIds already emit).
   - Verify: `bun run test` 239 files **2957 pass / 0 fail**, `typecheck` clean, `check:boundaries` 0,
     no migration/better-auth drift; per-feature real-app boot-smoke (401-not-404).

**Bottom line:** the data-governance work (V-DG-001/002 + LegalHold + GAP-001) is verified clean and
introduced no new P0/P1. The gate's two P1s are a separate-repo tooling item and the project-wide
manual-route↔OpenAPI divergence — both pre-existing/standing, neither blocking this work.

Lower-severity (all pre-existing/known): doc-drift nits (compliance P2 V-GOV-002: DATA_GOVERNANCE §3
"Still to add" lines now stale; P3 V-GOV-003 comment), enforcement P2×2 (dead imaging twins,
54 relative reach-ins), UI draft-spec P3×4, journeys P2×3 (patient-portal Phase-2 gap, doc drift).
Plus the documented imaging **physical S3-delete** storage-service follow-up and the **7 pre-existing
`bun run lint` errors** (not from this work).

## 5. What's Next
- Optional empirical backstop: boot the stack + `/oli-check --runtime --live --seed-coherence`.
- ~~Manual-route→TypeSpec migration (clears TR-DG-002 + the systemic class)~~ — ✅ DONE 2026-06-01
  (see #2 above). oli-engine spec-trace opt-in (clears TR-INFRA-001) — still a separate-repo effort.
- Tidy doc-drift: update DATA_GOVERNANCE §3 "Still to add" lines (consent/imaging/legal-hold now done).
