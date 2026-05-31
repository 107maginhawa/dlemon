---
oli-version: "1.0"
based-on:
  - docs/audits/CHECK_SUMMARY.md
  - docs/audits/codebase-map/.map-meta.json
  - .oli/config.json
last-modified: 2026-05-31
last-modified-by: oli-check
---

# OLI Check — Checker Self-Limitations

Rolling backlog of where **the checker itself** could not verify or lacks a rule (distinct
from project gaps, which live in CHECK_SUMMARY's matrix + gate). Paste back to harden the
skill. `◆` = new or recurring this run. These entries NEVER affect the GATE.

| category | observation | evidence_ref | suggested_improvement | first_seen | last_seen | times_seen |
|----------|-------------|--------------|-----------------------|------------|-----------|------------|
| low-confidence-heuristic | ◆ [evidenced] Confidence L2 FE→BE edge density read 0.11 and capped L2 at 6, but FE is genuinely covered (FE unit tests + 67 E2E specs). The engine `behavior.ts` resolver does not resolve `@monobase/sdk-ts` `*Options()` factories / `/react/hooks` auth hooks, so 16/18 real data-hook consumers (`useInvoices()`, `useSession()`) got empty `api_calls`. Recurs (0.17 prior run → 0.11 this run). | CONFIDENCE_REPORT §5.5; map@ae0d17d | Teach the codebase-map behavior resolver the SDK `*Options()`/hook factory patterns so edge density reflects real FE→BE wiring. | 2026-05-31 | 2026-05-31 | 2 |
| engine-field-gap | ◆ [evidenced] `CODE_SPEC_TRACE.json` is empty (0 matched ops, `spec_source: null`) though the OpenAPI doc ships 239 ops — `spec_trace_optin: false` in provenance. Traceability could not use the engine trace and fell back to the project `audit:trace` script; the "237/0/0 clean" memory figure is no longer engine-backed. | TRACE_REPORT §TR-INFRA-001; .map-meta.json provenance | Either enable `spec_trace_optin` + wire the OpenAPI doc into the engine spec-trace phase, or have Discovery flag the empty trace as a known opt-out (not stale). | 2026-05-31 | 2026-05-31 | 1 |
| engine-field-gap | ◆ [evidenced] Split route registration (146 generated + 57 manual `app.ts` registrations) leaves `CODE_ROUTE_MAP` sparse (0 dental page-route rows attributed) and backend modules attributed `module:"unknown"` in the API-surface layer; 57 routes are invisible to OpenAPI/spec-trace tooling. | DISCOVERY_VALIDATION; COMPLIANCE P3-2; CODE_ROUTE_MAP | Teach the engine to fold manual `app.ts` route registrations into the route/API-surface attribution so split-registration apps map fully. | 2026-05-31 | 2026-05-31 | 1 |
| new-stack-case | ◆ [evidenced] `UI_CONSISTENCY_SPEC.md` absent → enforcement ui-consistency sub-check degraded to infer-from-code draft mode (audit-only, findings capped at P3). UI-consistency therefore cannot gate; Journeys also ⊘-skipped (no UI_BLUEPRINT.md). | ENFORCEMENT EU-GLOBAL-uispec01 | Prompt to run `/oli-spec-ui --infer-from-code` to seed UI_CONSISTENCY_SPEC.md so the sub-check can score normally. | 2026-05-31 | 2026-05-31 | 1 |
| toolchain-gated | [evidenced] (RESOLVED this run) Prior run's dimension subagents inherited a plan-mode reminder and could not persist reports. This run they were dispatched in default (non-plan) mode and all six reports were written (CONSISTENCY/DISCOVERY/TRACE/COMPLIANCE/CONFIDENCE/ENFORCEMENT/SEED + RUNTIME plan). No recurrence. | this run; 6 subagent report writes | Keep dispatching dimension subagents in a write-capable permission mode. | 2026-05-31 | 2026-05-31 | 1 |
| freshness-trust | [evidenced] (Not recurring) Prior run started STALE-OVERLAP and self-healed by regenerating. This run the map was FRESH at start (0 source drift since map sha); THESIS IN FORCE without intervention. | .map-meta.json provenance | Auto-refresh (or prompt) the map at code-dimension start when STALE-OVERLAP is detected. | 2026-05-31 | 2026-05-31 | 1 |
