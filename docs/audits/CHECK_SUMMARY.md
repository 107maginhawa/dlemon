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
2. **`TR-DG-002` (P1, systemic — NOT erasure-specific)** — the erasure HTTP paths are hand-mounted in
   `app.ts` and absent from the compiled `openapi.json` (only the component schemas emit). This is
   the **same manual-routing divergence that affects EVERY dental module** (dental-audit's
   `/dental/audit-events` etc. are also absent from compiled paths) — the project mounts dental
   routes manually rather than via codegen. Runtime is correct (boot-smoke 401, 6 route tests).
   The proper fix is the standing **"migrate manual dental routes → TypeSpec codegen"** structural
   effort, tracked separately — fixing erasure alone would be inconsistent. Belongs to that debt
   bucket, not this governance slice.

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
- Manual-route→TypeSpec migration (clears TR-DG-002 + the systemic class); oli-engine spec-trace
  opt-in (clears TR-INFRA-001) — both separate efforts.
- Tidy doc-drift: update DATA_GOVERNANCE §3 "Still to add" lines (consent/imaging/legal-hold now done).
