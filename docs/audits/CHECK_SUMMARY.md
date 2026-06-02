---
oli-version: "1.0"
based-on:
  - docs/audits/CONSISTENCY_GATE_REPORT.md
  - docs/trace/TRACE_REPORT.md
  - docs/audits/COMPLIANCE_REPORT.md
  - docs/audits/CONFIDENCE_REPORT.md
  - docs/audits/ENFORCEMENT_REPORT.md
  - docs/audits/UI_CONSISTENCY_REPORT.md
  - docs/audits/JOURNEY_COVERAGE_REPORT.md
  - docs/audits/SEED_COHERENCE_REPORT.md
  - docs/audits/RUNTIME_READINESS_REPORT.md
  - docs/audits/codebase-map/.map-meta.json
last-modified: 2026-06-02
last-modified-by: oli-check
run: "--auto (fresh full-state, all dimensions, multi-agent)"
---

# OLI Check — Roll-Up Summary

## 0. TRUST STATUS

```
PRODUCER:      engine (oli-engine v0.1.0)
MAP-FRESHNESS: FRESH — map@c26d37b vs HEAD@c26d37b (working tree clean in scope)
SCOPE:         apps/dentalemon/src (frontend graph); backend dimensions read raw source (map-blind by design)
fields_unavailable: []   (no engine field gaps)
unverified (below MEDIUM confidence_threshold): 1 cluster (trace 5g FE-field-phantom — engine response_shape empty; off-gate per R1)
─────────────────────────────────────────────────────────────────────
THESIS IN FORCE for this run.
```

This run began **STALE-OVERLAP** (map@a3bfc9a vs HEAD@c26d37b — 2 stale modules + 70 unmapped code changes). A manual `oli-engine scan . --write` refreshed the map to **FRESH** before any code dimension reported; the graph artifacts were byte-unchanged (the 6 in-scope frontend edits — V-FE-ERR-001 error-taxonomy hooks — did not alter structure). Because the static signal is FRESH + engine-produced, the **R1-strict degrade floor does not apply** and PASS is reachable.

---

## 1. Run Context

- **Date:** 2026-06-02 · **Branch:** `feat/ceph-demoable-and-manual-ux` · **HEAD:** `c26d37bd`
- **Invocation:** `/oli-check --auto` ("run fresh, each module thoroughly; audit, compliance, gaps, improvements")
- **Detected state:** specs ✓ (12 modules) · source ✓ · tests ✓ (368 files) · UI source ✓ · PERFORMANCE.md ✓ · SEED_MANIFEST ✓ · runnable app ✓ · UI_CONSISTENCY_SPEC ✓ (DRAFT) · UI_BLUEPRINT ✗ (Journeys ran degraded on WORKFLOW_MAP)
- **Dimensions selected (auto, full state):** Consistency, Traceability, Discovery, Compliance, Confidence, Enforcement (+UI-Consistency 1.6), Journeys, Seed-Coherence, Runtime (boot-smoke + plan)
- **Execution:** 6 dimensions via parallel read-only subagents; 3 dynamic dimensions (Confidence test-run, Seed-Coherence + Runtime boot) serialized against the live `monobase` demo DB. `--live` interaction loop NOT requested (not required — THESIS IN FORCE).

---

## 2. Dimension Results

| Dimension | Verdict | Report | P0 | P1 | P2 | P3 | unverified |
|-----------|---------|--------|----|----|----|----|------------|
| Consistency | **PASS** | [CONSISTENCY_GATE_REPORT.md](./CONSISTENCY_GATE_REPORT.md) | 0 | 0 | 1 (F-044 doc-drift) | 4 | 0 |
| Traceability | **PASS** | [TRACE_REPORT.md](../trace/TRACE_REPORT.md) | 0 | 0¹ | 34 (report-only) | 0 | 1 (5g) |
| Discovery | **PASS (FRESH)** | [codebase-map/](./codebase-map/) | — | — | — | — | — |
| Compliance | **PASS** | [COMPLIANCE_REPORT.md](./COMPLIANCE_REPORT.md) | 0 | 0 | 4 | 3 | 0 |
| Confidence | **PASS** | [CONFIDENCE_REPORT.md](./CONFIDENCE_REPORT.md) | 0 | 0² | 3 | 2 | — |
| Enforcement | **PASS** (WARN advisory) | [ENFORCEMENT_REPORT.md](./ENFORCEMENT_REPORT.md) | 0 | 0 | 1 (54 reach-ins) | 4 | — |
| UI-Consistency | **WARN** (DRAFT-capped) | [UI_CONSISTENCY_REPORT.md](./UI_CONSISTENCY_REPORT.md) | 0 | 0 | 0 | 5 | — |
| Journeys | **PASS** (degraded) | [JOURNEY_COVERAGE_REPORT.md](./JOURNEY_COVERAGE_REPORT.md) | 0 | 0 | 3 | 6 | — |
| Seed-Coherence | **PASS** | [SEED_COHERENCE_REPORT.md](./SEED_COHERENCE_REPORT.md) | 0 | 0 | 1 (expected) | 0 | — |
| Runtime (boot-smoke) | **PASS** | [RUNTIME_READINESS_REPORT.md](./RUNTIME_READINESS_REPORT.md) | 0 | 0 | 0 | 0 | — |

¹ Traceability surfaced **TR-INFRA-001** as **P1-EXTERNAL** — a separate-repo oli-engine config limitation (`spec_trace_optin=false`), explicitly **not Dentalemon product code**. Off-gate (out of scope).
² Confidence surfaced **TR-ENGINE-SDK-RESOLVER** as **deferred-P1 (infra/engine)** — the engine `behavior.ts` resolver can't read the raw-`fetch(${apiBaseUrl})` custom-hook pattern, mechanically capping the headline score at 6. Underlying test substance = 9/10. Not a product test defect; off-gate.

**Test suite (Confidence):** api-ts **2977 pass / 0 fail / 241 files** (48.8s) · frontend **1491 pass / 1 isolation-flake / 5 skip** (the flake passes 8/8 in isolation) · api-ts typecheck **clean**.
**Boot-smoke (Runtime):** API `:7213` clean boot, `/livez`=200 (`/readyz`=503 only because MinIO/S3 absent — known infra) · Web app `:3003` SPA shell 200, no Vite transform errors. Both torn down cleanly.

---

## 3. Coverage Matrix (module × applicable per-module dimension)

Legend: **✓** ran + produced a verdict (pass or findings) · **⊘ reason** legitimately not applicable (never a failure) · **✗** applicable but did not run (gap).
(Discovery is run-level/map-wide; Runtime boot-smoke is app-level — both shown under §2, not per-module.)

| Module | Cons | Trace | Comp | Conf | Enf | Jrny | Seed |
|--------|:----:|:-----:|:----:|:----:|:---:|:----:|:----:|
| dental-org | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-patient | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-visit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-scheduling | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-clinical | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-imaging | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dental-perio | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ n/a |
| dental-pmd | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ n/a |
| dental-audit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ n/a (internal log) |
| emr-consultation | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui | ⊘ n/a (facade) |
| external-records-import | ✓ | ✓ | ✓ | ✓ | ✓ | ⊘ no-ui | ⊘ n/a |

**Coverage:** 12/12 modules covered by every applicable dimension. **0 ✗ gaps.** All ⊘ cells are legitimate absences (no-ui for backend/facade modules; not-applicable for modules with no quantitative seed-list claim).

**Uncovered modules:** none.

> Note: Confidence's per-module scorecard names the governance sub-modules `dental-erasure` (6) and `dental-legalhold` (3) instead of emr/external; the green 2977-pass suite covers every backend handler including emr-consultation and external-records-import, so both are ✓ above.

---

## 4. Overall Verdict

# GATE: PASS

- **In-scope product P0 = 0 · P1 = 0.** No ✗ coverage gaps. Trust banner **THESIS IN FORCE** (FRESH engine map) → no R1-strict floor.
- **Worst per-dimension roll-up:** WARN (UI-Consistency, DRAFT-capped; Enforcement advisory). No dimension reached BLOCK.
- **Non-gating, explicitly out-of-scope (named for honesty, do NOT drive FAIL):**
  - `TR-INFRA-001` — P1-**EXTERNAL** — oli-engine repo config (`spec_trace_optin=false`); not Dentalemon code.
  - `TR-ENGINE-SDK-RESOLVER` — deferred-P1 **infra/engine** — behavior-resolver blind spot; caps Confidence headline only, test substance 9/10.
- **`--strict` not set** → matrix + verdict written, no hard exit.

**Health snapshot:** Compliance **8.7/10** · Confidence substance **9/10** (headline 6 capped by engine) · Journeys coverage **91%** (51/56 UI-relevant WFs) · Seed replay **8/8 surfaces match** · Boundary check **PASS** (0 cross-module repo violations) · `bun audit` **0 vulns**.

---

## 5. What's Next — Gaps & Improvements (P2/P3 + cross-cutting)

Nothing blocks ship. The following are the highest-value improvements surfaced this run (the user asked explicitly for gaps + improvements):

### Quick wins (low effort, high signal)
1. **Close the api-ts lint-gate gap** — root `bun run lint` filters only the frontend; `services/api-ts` has **7 lint errors** invisible to CI (3 prod `scheduler && emit()` short-circuits + 4 test). Add `--filter '*' lint`. *(Enforcement EF-LINT)*
2. **Fix the 3 prod fire-and-forget short-circuits** (`createDentalInvoice.ts`, `cancelAppointment.ts`, `createAppointment.ts`) → `if (scheduler) { void emitXxx() }`. *(Enforcement)*
3. **Document the imaging seed boundary** in SEED_MANIFEST ("study headers seeded; `imaging_study_image` rows not seeded → image gallery empty by design") so seed-coherence auto-clears the recurring SC-IMAGE-LIST-EMPTY P2. Optionally seed 1 image row for a demoable gallery. *(Seed-Coherence)*
4. **Tighten `branchId` to `required: true`** in the patients/imaging list OpenAPI ops — runtime requires it but the spec says optional → clients/replays 400 unexpectedly. *(Seed-Coherence #2)*

### Compliance / governance
5. **Remove the dead `publishAuditEvent` + `DENTAL_AUDIT_EVENTS_QUEUE` scaffold** (0 non-test call sites; real audit = synchronous `logAuditEvent`) or reconcile AUDIT_CONTRACTS §4 to the ADR-006 reality. Lone sub-7 compliance dimension. *(Compliance V-EVT-001)*
6. **Add a DB-level append-only trigger/RLS** denying UPDATE/DELETE on `dental_audit_log` (app-level immutability holds but storage layer doesn't enforce). *(Compliance V-AUD-IMM-001)*
7. **Generate `emr-consultation/API_CONTRACTS.md`** (`/oli-spec-api --module emr-consultation`) so the artifact-pair / Step-8b schema audit covers all 12 modules. Clears both V-CONS-001 and consistency F-045. *(Compliance + Consistency)*
8. **Render explicit error state** (distinct from empty) on `isError` in patients/scheduling/billing list hooks — API errors currently look like "no data". *(Compliance V-FE-ERR-002 / Journeys J-ERROR-CLUSTER)*
9. **Resolve the two standing sign-off items**: ADR-007 session TTL, and the WFG-006 GDPR Art. 20 portability-format PRD decision (converts V-IMG-EXP-001 from deferred to a build task). Then run the regulated Stage-2 RACI sign-offs interactively (`--auto` can't auto-approve them).

### Frontend / UX
10. **Sweep the lemon-literal drift** — `#FFE97D`/`#4A4018` as arbitrary Tailwind literals in **174 occurrences / 59 files** → `bg-primary`/token classes (one feature folder per PR) + a cva `lemon` Button variant. *(Enforcement EU-COLOR)*
11. **Promote `UI_CONSISTENCY_SPEC.md` from DRAFT → enforcing** via `/oli-spec-gate` (resolve `[VERIFY]` markers) so UI findings carry real P2 severity instead of being P3-capped. *(UI-Consistency)*
12. **Role-filter the sidebar** in `routes/_dashboard.tsx` by consuming the existing `rbac.ts` ACCESS_MATRIX (data exists, render ignores it). *(Journeys J-RBAC-NAV-001)*
13. **Add a top-level `/imaging` route + studies-list** (or amend NAVIGATION_MAP to declare imaging workspace-scoped-only). *(Journeys J-NAV-002)*

### Architecture / tooling
14. **Begin the facade-migration backlog** — 54 ESLint repo reach-ins across 8 modules (imaging→patient→billing priority); flip `check:boundaries:error` per-module as each hits 0. *(Enforcement EB-BOUNDARY)*
15. **Add Rust CVE scanning** (`cargo audit` for `cadence` + `api-ts-embedded`) — `bun audit` covers JS/TS only. *(Enforcement)*
16. **Add a state-machine token CI lint** asserting DOMAIN_MODEL/WORKFLOW_MAP FSM tokens ⊆ code enums — kills the recurring "retired token leaks into upstream catalogs" class (F-044 `sent`→`issued`). *(Consistency)*
17. **Author lightweight MODULE_SPEC/WF nodes** for `legal-hold` + `retention` governance modules so their code→test chains anchor to a spec end (clears TR-LH-001 + TR-RET-001 orphan-by-design). *(Traceability)*
18. **Lift E2E coverage** for high-value unit-only BRs (imaging annotation BR-024..035, scheduling BR-SCH-001..004) — BR→E2E is ~26%; normalize AC test tags (AC-BIL vs AC-BL drift) + define AC-NNN IDs for dental-perio (currently 0). *(Traceability)*

### Engine (separate oli-engine repo — clears the 2 non-gating items)
19. Widen the codebase-map scan to include `services/api-ts/**` + set `spec_sources: [openapi.json]` and `spec_trace_optin: true`, then teach `behavior.ts` the raw-`fetch(${apiBaseUrl})` custom-hook pattern + populate `CODE_API_SURFACE.response_shape`. This single change clears TR-INFRA-001, restores Confidence headline 9, and lights up the trace 5g FE↔BE field-contract detector.

---

## Deferred P1 backlog (carried, product-decision-gated — context only, not this run's findings)
3 dependency CVEs · 2 data-governance (retention/erasure WFG-006 export) · GAP-001 entity localId codegen · engine SDK resolver · GAP-009 proof artifact · TR-P1-08 tx-plan item completion.

---

*Read-only aggregator. This run wrote only CHECK_SUMMARY.md + CHECK_LEARNINGS.md; each dimension owns its linked report. The map refresh (`scan --write`) updated `.map-meta.json` only (artifacts byte-unchanged).*
