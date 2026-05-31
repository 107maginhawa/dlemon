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
| low-confidence-heuristic | ◆ [evidenced] Confidence L2 FE→BE edge density read 0.17 and capped L2 at 6, but FE behavior is genuinely covered (1375 FE unit tests + 18/18 live journeys). The engine `behavior.ts` resolver does not resolve `@monobase/sdk-ts/generated/react-query` `*Options()` factories or `/react/hooks` auth hooks, so ~57 real data-hook consumers got empty `api_calls`. | CONFIDENCE_REPORT §5.5; map@ae0d17d | Teach the codebase-map behavior resolver the SDK `*Options()`/hook factory patterns so edge density reflects real FE→BE wiring. | 2026-05-31 | 2026-05-31 | 1 |
| toolchain-gated | ◆ [evidenced] Dimension subagents inherited a plan-mode reminder and could not write their own report artifacts (COMPLIANCE/CONFIDENCE/ENFORCEMENT/TRACE); verdicts were returned to the aggregator and rolled into CHECK_SUMMARY inline, but per-dimension reports were not refreshed this run. | this run; 4 subagent returns | When dispatching dimension subagents, pass an explicit non-plan permission mode so they can persist their reports. | 2026-05-31 | 2026-05-31 | 1 |
| freshness-trust | ◆ [evidenced] Map was STALE-OVERLAP at run start (map@d8745b9 vs HEAD@ae0d17d, 4 stale modules + 51 unmapped changes); resolved by regenerating in-run (`oli-engine scan --write`) → FRESH. THESIS restored to IN FORCE. | .map-meta.json provenance | Auto-refresh (or prompt to refresh) the map at the start of a code-dimension run when STALE-OVERLAP is detected. | 2026-05-31 | 2026-05-31 | 1 |
