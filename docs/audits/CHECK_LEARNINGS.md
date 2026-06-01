---
oli-version: "1.0"
based-on:
  - docs/audits/CHECK_SUMMARY.md
  - docs/audits/codebase-map/.map-meta.json
  - .oli/config.json
last-modified: 2026-06-01
last-modified-by: oli-check
---

# OLI Check — Checker Self-Limitations

Rolling backlog of where **the checker itself** could not verify or lacks a rule (distinct
from project gaps, which live in CHECK_SUMMARY's matrix + gate). Paste back to harden the
skill. `◆` = new or recurring this run. These entries NEVER affect the GATE.

| category | observation | evidence_ref | suggested_improvement | first_seen | last_seen | times_seen |
|----------|-------------|--------------|-----------------------|------------|-----------|------------|
| low-confidence-heuristic | ◆ [evidenced] Confidence L2 FE→BE edge density read 0.11 and capped L2 at 6, but FE is genuinely covered (FE unit tests + 67 E2E specs). The engine `behavior.ts` resolver does not resolve `@monobase/sdk-ts` `*Options()` factories / `/react/hooks` auth hooks, so 16/18 real data-hook consumers (`useInvoices()`, `useSession()`) got empty `api_calls`. Recurs (0.17 prior run → 0.11 this run). | CONFIDENCE_REPORT §5.5; map@ae0d17d | Teach the codebase-map behavior resolver the SDK `*Options()`/hook factory patterns so edge density reflects real FE→BE wiring. | 2026-05-31 | 2026-05-31 | 2 |
| engine-field-gap | ◆ [evidenced] `CODE_SPEC_TRACE.json` is empty (0 matched ops, `spec_source: null`) though the OpenAPI doc ships 239 ops — `spec_trace_optin: false` in provenance. Traceability could not use the engine trace and fell back to the project `audit:trace` script; the "237/0/0 clean" memory figure is no longer engine-backed. Recurs (re-flagged as TR-INFRA-001 this run + 2026-06-01). | TRACE_REPORT §TR-INFRA-001; .map-meta.json provenance | Either enable `spec_trace_optin` + wire the OpenAPI doc into the engine spec-trace phase, or have Discovery flag the empty trace as a known opt-out (not stale). | 2026-05-31 | 2026-06-01 | 3 |
| engine-field-gap | ◆ [evidenced] Manual dental route registration (`(app as any).post/get` in app.ts) means dental endpoint PATHS never reach the compiled `openapi.json` (only component schemas emit) → traceability flags each new dental endpoint group as a wire-contract P1 (this run: TR-DG-002 for the erasure routes; same class as dental-audit/all dental modules). The checker cannot tell "intentional manual route" from "missing route". | TRACE_REPORT §TR-DG-002; app.ts manual routes | Let traceability treat manual-but-tested dental routes as a known divergence (downgrade to P2 / consult a manual-route allowlist) until the manual-route→TypeSpec migration lands. | 2026-05-31 | 2026-06-01 | 2 |
| new-stack-case | ◆ [evidenced] `UI_CONSISTENCY_SPEC.md` absent → enforcement ui-consistency sub-check degraded to infer-from-code draft mode (audit-only, findings capped at P3). UI-consistency therefore cannot gate; Journeys also ⊘-skipped (no UI_BLUEPRINT.md). | ENFORCEMENT EU-GLOBAL-uispec01 | Prompt to run `/oli-spec-ui --infer-from-code` to seed UI_CONSISTENCY_SPEC.md so the sub-check can score normally. | 2026-05-31 | 2026-05-31 | 1 |
| toolchain-gated | [evidenced] (RESOLVED this run) Prior run's dimension subagents inherited a plan-mode reminder and could not persist reports. This run they were dispatched in default (non-plan) mode and all six reports were written (CONSISTENCY/DISCOVERY/TRACE/COMPLIANCE/CONFIDENCE/ENFORCEMENT/SEED + RUNTIME plan). No recurrence. | this run; 6 subagent report writes | Keep dispatching dimension subagents in a write-capable permission mode. | 2026-05-31 | 2026-05-31 | 1 |
| freshness-trust | ◆ [evidenced] (Recurs) This run again started STALE-OVERLAP (map@ae0d17d vs HEAD@f1b38d8 — prior frontend error-toast/RBAC commits drifted `features`/`lib`/`routes`). Required a manual `oli-engine scan . --write` before code dimensions; recurs every run (this run: STALE-OVERLAP map@73aa9fc vs HEAD@a3bfc9a, 35 unmapped backend changes → refreshed FRESH). The check still does not auto-refresh. | --check-fresh output; .map-meta.json | Have `/oli-check` auto-run `oli-codebase-map --incremental` (or hard-prompt) when the Step-3.5 preamble detects STALE-OVERLAP, instead of relying on the operator to refresh first. | 2026-05-31 | 2026-06-01 | 3 |
| toolchain-gated | ◆ [evidenced] Runtime `--live` and Seed-Coherence SKIP'd again because no app was listening on :7213 (API down at check time). Tiers 1-2 (plan + static boot-smoke) ran; the empirical interaction/persona-replay backstop did not. Recurs. No false PASS, but the live signal is absent unless the operator boots the stack first. | RUNTIME_TEST_PLAN (RUNTIME-LIVE: skipped); SEED_COHERENCE_REPORT (SC-API-UNREACHABLE) | Have `/oli-check --runtime --live`/`--seed-coherence` optionally boot the app itself (or document a one-liner pre-step) so the live tier isn't silently skipped on unattended runs. | 2026-05-31 | 2026-06-01 | 2 |
