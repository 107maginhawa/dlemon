---
oli-version: "1.0"
based-on:
  - docs/audits/codebase-map/.map-meta.json
  - docs/product/CONSISTENCY_REPORT.md
  - docs/audits/DISCOVERY_VALIDATION.md
  - docs/trace/TRACE_REPORT.md
  - docs/audits/COMPLIANCE_REPORT.md
  - docs/audits/CONFIDENCE_REPORT.md
  - docs/audits/ENFORCEMENT_REPORT.md
  - docs/execution/RUNTIME_TEST_PLAN.md
  - docs/audits/SEED_COHERENCE_REPORT.md
last-modified: 2026-05-31
last-modified-by: oli-check
---

# OLI Check — Roll-up Summary (2026-05-31, full fresh run)

Thorough fresh run — every applicable dimension, every product module covered. Dispatched
as parallel dimension subagents; each persisted its own report (linked below). This
aggregator writes only CHECK_SUMMARY.md + CHECK_LEARNINGS.md.

## 0. TRUST STATUS

- **Producer:** `engine` (oli-engine v0.1.0) · ts-morph AST · `fields_unavailable: []`
- **MAP-FRESHNESS:** `FRESH` — `map@ae0d17d` vs `HEAD@2900d28`. HEAD is a docs-only commit on top of the map sha; **0 source files drifted**, 0 uncommitted source changes in scope (`apps/dentalemon/src`, `services/api-ts/src`).
- **confidence_threshold:** MEDIUM · **unverified bucket:** 0 nodes (every finding source-anchored)
- **Verdict:** **THESIS IN FORCE** — code-dimension verdicts are graph-anchored; no `(map stale — verify)` annotations, no R1-strict escalation.

## 1. Run Context

- **Detected state:** specs (12 MODULE_SPECs) + source + 328 test files + engine map (v5, full set incl. CODE_ROUTE_MAP + CODE_COMPONENT_REGISTRY) + SEED_MANIFEST.md + runnable API. No UI_BLUEPRINT.md, no PERFORMANCE.md.
- **Dimensions selected (auto, no flags):** Consistency, Traceability, Discovery, Compliance, Confidence, Enforcement, Runtime, Seed-Coherence. **Journeys ⊘ skipped** (no `UI_BLUEPRINT.md`).
- **Flags:** none (read-only; not `--live`, not `--fix`, not `--strict`).
- **Module source for matrix:** 12 product modules under `docs/product/modules/` (richer than CODE_MODULE_MAP's 7 frontend folders; these are the spec'd domain modules every dimension scopes by). `MODULE_MAP.md` absent.

## 2. Dimension Results

| Dimension | Verdict | Report | P0 | P1 | P2 | P3 | unverified |
|-----------|---------|--------|----|----|----|----|-----------|
| Consistency | **PASS** ¹ | `docs/product/CONSISTENCY_REPORT.md` | 0 | 0 | ~18 | ~8 | — |
| Traceability | **PASS** | `docs/trace/TRACE_REPORT.md` | 0 | 2 | 34 | 0 | — |
| Discovery | **PASS** | `docs/audits/DISCOVERY_VALIDATION.md` | 0 | 0 | 0 | 0 | — |
| Compliance | **PASS** | `docs/audits/COMPLIANCE_REPORT.md` | 0 | 0 | 6 | 2 | 0 |
| Confidence | **WARN** | `docs/audits/CONFIDENCE_REPORT.md` | 0 | 1 | 3 | 1 | 0 |
| Enforcement | **WARN** | `docs/audits/ENFORCEMENT_REPORT.md` | 0 | 3 | 5 | 3 | — |
| Runtime | **PASS** | `docs/execution/RUNTIME_TEST_PLAN.md` | 0 | 0 | — | — | — |
| Seed-Coherence | **PASS** | `docs/audits/SEED_COHERENCE_REPORT.md` | 0 | 0 | 0 | 0 | — |
| Journeys | **⊘ skipped** (no-ui-blueprint) | — | — | — | — | — | — |

¹ Consistency: Stage-1 cross-validation PASS (0 HIGH conflicts; all 6 original HIGH remain code-verified RESOLVED). Stage-2 human sign-off correctly **DEFERRED** (regulated project → headless auto sign-off blocked). The ~18 MEDIUM + ~8 LOW are **documentation-lag reconciliations** (glossary / DOMAIN_MODEL / ERROR_TAXONOMY / WORKFLOW_MAP drift for perio + emr-consultation), non-blocking by spec-gate severity (only HIGH blocks).

### Empirical backstop (this run)
- **Suite ran green:** 2828 pass / 0 fail (203 files, real per-file Postgres-clone CI runner) — not assumed. Prior memory figure (~2684) was stale.
- **API booted live:** `services/api-ts` on :7213 — `livez`/auth/session 200, unauthed `GET /dental/branches`→401 (gate works). `readyz`→503 = optional dep (MinIO/Valkey) degraded-readiness, **not a boot crash** (liveness green).
- **Seed replay matched manifest exactly:** invoices 10/10, appointments 14/14, line-items 17, patients 20/20. 0 SC- findings.

## 3. Overall

**Overall verdict: `WARN`** (worst across dimensions: Confidence + Enforcement = WARN; all else PASS). Trust thesis IN FORCE → no WARN-WITH-PROOF floor forced; this is a genuine WARN, not a degraded-signal artifact.

**No P0 blockers anywhere. 0 BLOCK dimensions.** Every P1 is either a **pre-triaged deferred-backlog item**, an **intentional feature-flagged stub**, or a **tooling blind-spot** — none is a new code / security / behavior regression:

| P1 | Dimension | Module | Class |
|----|-----------|--------|-------|
| ED-GLOBAL-drizzle1 — drizzle-orm <0.45.2 SQL-injection (direct core ORM) | Enforcement | GLOBAL | deferred-backlog dep-CVE |
| ED-GLOBAL-fasturi1 — fast-uri ≤3.1.1 host-confusion/path-traversal (transitive) | Enforcement | GLOBAL | deferred-backlog dep-CVE |
| ED-GLOBAL-uuid1 — uuid <11.1.1 buffer-bounds (transitive) | Enforcement | GLOBAL | deferred-backlog dep-CVE |
| §5.5 FE→BE edge-density cap (SDK `*Options()`/hook resolver) | Confidence | GLOBAL | tooling blind-spot (FE genuinely covered; deferred-backlog) |
| TR-INFRA-001 — engine CODE_SPEC_TRACE empty (spec_trace_optin off) | Traceability | GLOBAL | tooling (product trace done via `audit:trace`) |
| TR-PAT-020 — BR-020 patient-merge spec'd, `501 NOT IMPLEMENTED` | Traceability | dental-patient | intentional feature-flag (WFG-007) |

## 4. Coverage Matrix (module × applicable dimension)

Rows = 12 product modules. `✓` checked · `⊘ reason` legitimate-absence · `✗` gap (applicable but didn't run). Discovery / Runtime / Seed are app/persona-global — `✓` = covered via the global run.

| Module | Consist. | Trace | Discov. | Compl. | Conf. | Enforce | Runtime | Seed | Journeys |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| dental-audit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| dental-billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (invoices) | ⊘ no-ui-bp |
| dental-clinical | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| dental-imaging | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (P2 dead twins) | ✓ | ✓ | ⊘ no-ui-bp |
| dental-org | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| dental-patient | ✓ | ✓ (BR-020 501) | ✓ | ✓ | ✓ | ✓ (P2 reach-ins) | ✓ | ✓ (patients) | ⊘ no-ui-bp |
| dental-perio | ✓ (doc-lag) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| dental-pmd | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| dental-scheduling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (appts) | ⊘ no-ui-bp |
| dental-visit | ✓ (doc-lag) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| emr-consultation | ✓ (doc-lag) | ✓ | ✓ | ✓ | ✓ (emr 6f) | ✓ | ✓ | ✓ | ⊘ no-ui-bp |
| external-records-import | ✓ | ✓ | ✓ | ⊘ future-phase | ⊘ no-tests (future) | ✓ | ✓ | ✓ | ⊘ no-ui-bp |

Global dimensions (Discovery / Runtime / Seed) produce an app/persona-level verdict that covers all modules: Discovery 12/12 mapped to handler dirs; Runtime boot-smoke app-wide PASS; Seed primary-persona replay, all manifest entities matched.

**Uncovered modules:** none. **`✗` gaps:** **0** — no applicable dimension failed to run. The only ⊘ cells are legitimate absences: Journeys (no UI_BLUEPRINT, all 12) and external-records-import compliance/confidence (`future_phase` — spec-declared no-handler, no tests yet).

## GATE: FAIL

- **Driver:** P1 findings present (6 total — see §3). FAIL is the mechanical rule (`any P0/P1 ⇒ FAIL`), **not** a coverage gap: 0 `✗` cells, 0 P0 blockers.
- **Nature:** Every P1 is pre-triaged/deferred (3 dep-CVEs + SDK-resolver tooling cap), tooling-only (spec-trace infra), or an intentional feature-flagged stub (BR-020). This matches the standing **Deferred P1 backlog** — no NEW blocking regression surfaced this run. BLOCK remains cleared (0 P0).
- **Run mode:** non-`--strict` → matrix + verdict written, **no hard exit**. Re-run with `--strict` for CI gating.

## 5. What's Next

- **Clear the 3 dep-CVE P1s** (the only externally-actionable P1s): `bun update drizzle-orm@^0.45.2` (direct), and pull transitive `fast-uri` / `uuid` via lockfile bump. Then `/oli-check --enforcement` to confirm.
- **Confidence SDK-resolver cap:** tooling gap, not a test gap (FE covered by unit + E2E). Tracked in CHECK_LEARNINGS + deferred backlog; needs engine `behavior.ts` to resolve `@monobase/sdk-ts` `*Options()`/hook factories.
- **Doc-lag (Consistency MEDIUM):** reconcile perio / emr-consultation glossary + DOMAIN_MODEL + ERROR_TAXONOMY + WORKFLOW_MAP entries (F-036..F-043). Non-blocking.
- **Spec-sync P2s (Compliance):** path drift in pmd/patient/org + stale imaging `API_CONTRACTS.md` (code is correct in all cases) — doc reconciliation.
- **Optional:** add `UI_BLUEPRINT.md` to unlock Journeys; run `/oli-check --runtime --live` for the Tier-3 interaction loop; `/oli-spec-ui --infer-from-code` to seed `UI_CONSISTENCY_SPEC.md`.
- **Ship-wise:** 0 P0, suite green, API boots, seed coherent → demoable. Resolve the dep-CVEs before a production cut.
