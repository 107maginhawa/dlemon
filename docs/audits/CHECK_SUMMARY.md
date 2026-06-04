---
oli-version: "1.0"
based-on:
  - docs/trace/TRACE_REPORT.md
  - docs/audits/codebase-map/CODE_SPEC_TRACE.json
  - docs/audits/codebase-map/CODE_API_SURFACE.json
  - docs/audits/codebase-map/.map-meta.json
last-modified: 2026-06-04
last-modified-by: oli-check
run: "single-dimension — /oli-check --traceability (full-scope spec-trace map, engine v6); 1 P1 found + fixed same session"
---

# OLI Check — Roll-Up Summary

## 0. TRUST STATUS

```
PRODUCER:      engine (oli-engine v6)
MAP-FRESHNESS: FRESH (rescanned post-fix this session)
ENGINE:        resolved via legacy fallback (~/Desktop/oli-engine/dist/cli.js)
SPEC-TRACE:    ON — spec_trace_optin=true, spec_source=specs/api/dist/openapi/openapi.json
               matched=352, spec_only=0, code_only=0, auth_drift=0 (full parity)
SCOPE:         apps/dentalemon/src/** + services/api-ts/src/** (full FE+BE)
fields_unavailable: []
unverified:    0   (5g materialized — response_shape populated 336/353; is_phantom 1, an engine URL-parse artifact)
─────────────────────────────────────────────────────────────────────
THESIS IN FORCE for this run.
```

---

## 1. GATE VERDICT

```
GATE: PASS
```

This run first surfaced one in-scope **P1** (`TR-PHANTOM-ORG-001`), which was **fixed in the same session**. After the fix + map rescan, in-scope product P0/P1 = 0 and there are no `✗` coverage gaps → **PASS**.

## 2. Triage — Fix-First Ranking

✓ No actionable findings. Pipeline unblocked.

*(Resolved this run: TR-PHANTOM-ORG-001 — fixed; TR-INFRA-001 — root-cause cleared by spec-trace enablement.)*

## 3. Run Context

- **Date:** 2026-06-04 · **Branch:** `main` · **HEAD:** `08b91b79` (+ uncommitted fix)
- **Invocation:** `/oli-check --traceability` (single dimension), followed by the fix the user requested
- **State detected:** specs ✓, source ✓ (FE+BE), tests ✓, engine map ✓ (FRESH, full-scope, spec-trace ON)
- **Dimension run:** Traceability (`dimensions/traceability.md`, Phase D — full chain).
- **Method:** read-only audit → root-cause confirmed → fix applied (TypeSpec op + codegen + regression test) → re-verified via full test suite + map rescan.

## 4. Dimension Results

| Dimension | Verdict | Report | report_age | P0 | P1 | P2 |
|-----------|---------|--------|-----------|----|----|----|
| Traceability | **PASS** | [docs/trace/TRACE_REPORT.md](../trace/TRACE_REPORT.md) | current (re-traced + post-fix re-verified @ 08b91b79) | 0 | 0 | 34 |

Dimensions not selected this run (single `--traceability`): Consistency, Discovery, Compliance, Confidence, Enforcement, Journeys, UI-Consistency, Runtime, Seed-Coherence. Run `/oli-check` (no flags) for a full multi-dimension sweep.

## 5. Coverage Matrix (module × Traceability)

| Module | Traceability |
|--------|--------------|
| dental-org | ✓ checked (TR-PHANTOM-ORG-001 found + FIXED — DELETE member route now wired) |
| dental-audit | ✓ checked |
| dental-billing | ✓ checked (TR-BR-013 deferred → P2) |
| dental-clinical | ✓ checked (BR-019 deferred 501) |
| dental-imaging | ✓ checked (ceph/analysis:qs phantom = engine URL-parse artifact, non-gap) |
| dental-patient | ✓ checked (auth_drift merge/unmerge = confirmed FP; BR-020 deferred) |
| dental-perio | ✓ checked (0 AC-NNN — P2) |
| dental-pmd | ✓ checked |
| dental-scheduling | ✓ checked |
| dental-visit | ✓ checked (FSM transitions traced) |
| emr-consultation | ✓ checked |
| external-records-import | ✓ checked |
| legal-hold | ⊘ skipped (no product MODULE_SPEC — orphan-by-design, code→test→contract complete) |
| retention | ⊘ skipped (no product MODULE_SPEC — internal cron, code→test complete) |

**Uncovered modules:** none with a `✗`. The `legal-hold`/`retention` ⊘-skips are legitimate (governance modules with no product spec node).

## 6. Overall

**Overall verdict: PASS.** Trust banner `THESIS IN FORCE`. The single P1 surfaced this run was a pre-existing latent defect (newly *detectable* once the map covered the backend route table) — it was fixed in-session, re-verified by the full backend suite (286 files / 3368 pass / 0 fail), typecheck, `check:boundaries`, and a fresh map rescan.

Movement vs prior run (2026-06-02 @ c26d37bd):
- **Resolved:** TR-INFRA-001 (EXTERNAL spec-trace-off → fully resolved, matched=352/0/0); 5g map-degenerate caveat (response_shape populated); **TR-PHANTOM-ORG-001** (found + fixed this session).
- **Cleared:** `auth_drift` 2→0 — added `@useAuth(bearerAuth)` to `/patients/merge`+`/unmerge` in TypeSpec; routes now carry `authMiddleware({roles:["admin"]})` + OpenAPI `security` (was a route-level-only FP; now declared = defense in depth).

## 7. What's Next

1. **Commit the fix** (currently uncommitted): `specs/api/src/modules/dental-org.tsp` (+`@delete deactivateMember`), regenerated `services/api-ts/src/generated/openapi/{routes,registry,validators}.ts` + `specs/api/dist/openapi/openapi.json`, new test `deactivateMember.route.test.ts`, refreshed codebase-map + trace artifacts.
2. ~~Declare the admin security scheme on `POST /patients/merge` + `/unmerge`~~ — **DONE 2026-06-04** (`@useAuth(bearerAuth)` added; `auth_drift` 2→0).
3. *(Optional)* Regenerate `packages/sdk-ts` to add the `deactivateMember` operation for SDK parity (the FE uses a raw `fetch` for this call, so no functional dependency).
4. P2 backlog (report-only) unchanged — E2E for unit-only BRs, AC tag normalization, perio ACs, legal-hold/retention spec nodes.
