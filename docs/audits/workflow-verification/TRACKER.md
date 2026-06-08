# Workflow Verification Tracker

**What this is:** the worklist AND durable progress log for the live-frontend workflow
verification sweep. The orchestrator in [`PROMPT.md`](./PROMPT.md) walks this table top-to-bottom,
dispatching one fresh subagent per non-DONE module to drive the live UI, find gaps, autofix
confirmed contract/behavior bugs (TDD), and write the result back here.

**This is a runtime ledger, not the static audit.** The 15-round static traceability audit lives
in [`../MODULE_AUDIT_TRACKER.md`](../MODULE_AUDIT_TRACKER.md). This sweep is the *runtime*
counterpart: it proves workflows actually work in a browser, not just that handlers are wired.

**Resume contract:** the orchestrator resumes from the first row whose Status ≠ `DONE`. Never
edit a row's Status to `DONE` without the evidence path + commit shas filled in.

---

## Rollup (filled at end of run)

- **Run branch:** _(set by orchestrator, e.g. `chore/workflow-verification-sweep`)_
- **Started / finished:** _(stamp after the run; scripts can't read the clock)_
- **DONE:** 0/18 · **NEEDS-REVIEW:** 0 · **REOPENED:** 0 · **BLOCKED:** 0
- **Modules needing human follow-up:** _(list NEEDS-REVIEW / REOPENED / BLOCKED here)_
- **Deferred gaps reported (not fixed):** _(aggregate the Type-C report-only items here)_

> **Pre-loop dry-run gate: 🟢 PASSED (2026-06-08).** dental-visit driven report-only via `/browse`
> as the owner persona — §23 workspace journey green (auto-select, tooth panel Overview→Treatment→
> Review, coherence ₱800+₱3,500=₱4,300, affordances reachable, prior-visit historical snapshot
> distinct from active edits). No bugs found. See `runs/dental-visit/DRY-RUN-REPORT.md`. Full sweep
> authorized. The 3 harness fixes the dry run surfaced are now folded into PROMPT.md: Docker-down →
> local Postgres + tolerate readyz storage=fail for non-imaging; screenshot to /tmp then copy;
> **staff PINs wired (Ana Santos staff_full = 654321, owner = 123456, free-tier = 111111)** so RBAC
> negatives are driven, not skipped. PROMPT.md now also backfills a test per verified workflow and
> runs a cross-module §4 E2E phase after the module loop.

---

## Status legend

| Status | Meaning |
|---|---|
| `PENDING` | not yet processed |
| `IN-PROGRESS` | a module subagent is running |
| `DONE` | gate green, evidence + commit shas recorded |
| `NEEDS-REVIEW` | a circuit breaker tripped (max-fixes / repeated-gate-fail / no citation) — human eyes needed |
| `REOPENED` | was DONE, then a later module's regen broke its gate |
| `BLOCKED` | gate could not go green; details in Notes |

**V1 readiness rating** (IDEAL §11.1): 🟢 Green · 🟡 Yellow · 🟠 Orange · 🔴 Red
**Gap priority** (IDEAL §11.2): P0 blocks safe V1 · P1 fix before prod · P2 recommended · P3 deferred

---

## Module sequence (dependency-first)

Order reconciled against `docs/product/MODULE_MAP.md`, `services/api-ts/src/handlers/`, and
`docs/product/modules/`. FE-surface = has a `NAVIGATION_MAP.md` route AND ≥1 `contract-spine.json`
consumer file under `apps/dentalemon/src/` (see PROMPT.md STEP 0). Spec-light = no
`docs/product/modules/{M}/MODULE_SPEC.md` (falls back to IDEAL §3 + `.tsp`) → reduced confidence.

| # | Module | FE? | Spec-light? | Status | Rating | Gaps fixed (P#) | Tests added | Deferred-reported | Evidence | Commits |
|---|--------|-----|-------------|--------|--------|-----------------|-------------|-------------------|----------|---------|
| 1 | dental-org | yes | no | PENDING | — | — | — | — | — | — |
| 2 | person / profile + settings | yes | yes | PENDING | — | — | — | — | — | — |
| 3 | dental-patient | yes | no | PENDING | — | — | — | — | — | — |
| 4 | dental-scheduling | yes | no | PENDING | — | — | — | — | — | — |
| 5 | dental-visit | yes | no | DRY-RUN ✅ | 🟢 | 0 (no bugs) | n/a (dry run) | none | runs/dental-visit/ | none (report-only) |
| 6 | dental-clinical | yes | no | PENDING | — | — | — | — | — | — |
| 7 | dental-perio | yes | no | PENDING | — | — | — | — | — | — |
| 8 | dental-imaging | yes | no | PENDING | — | — | — | — | — | — |
| 9 | dental-billing | yes | no | PENDING | — | — | — | — | — | — |
| 10 | dental-pmd | yes | no | PENDING | — | — | — | — | — | — |
| 11 | case-presentation | yes | yes | PENDING | — | — | — | — | — | — |
| 12 | dental-portal | yes | yes | PENDING | — | — | — | — | — | — |
| 13 | provider | partial | yes | PENDING | — | — | — | — | — | — |
| 14 | emr-consultation | partial | no | PENDING | — | — | — | — | — | — |
| 15 | external-records-import | partial | no | PENDING | — | — | — | — | — | — |
| 16 | notifications | yes | yes | PENDING | — | — | — | — | — | — |
| 17 | dental-audit | light | no | PENDING | — | — | — | — | — | — |
| 18 | dental-erasure / legal-hold / retention | none/light | no | PENDING | — | — | — | — | — | — |

### Cross-module journeys (IDEAL §4 — run after the module loop, end-to-end)

| ID | Journey (§4.x) | Status | Key seam asserted | Gaps fixed | Smoke | Evidence | Commits |
|----|----------------|--------|-------------------|-----------|-------|----------|---------|
| X1 | §4.1 new-patient → visit → baseline-chart → plan | PENDING | diagnoses → proposed plan items (coherent total) | — | xmod_new_patient_smoke.py | — | — |
| X2 | §4.2 same-day-treatment → billing → recall | PENDING | performed treatment → invoice line; completed visit → billing unlocked | — | xmod_treatment_billing_smoke.py | — | — |
| X3 | §4.3 emergency walk-in → work → billing → follow-up | PENDING | walk-in needs no appt; direct work auditable | — | xmod_walkin_smoke.py | — | — |
| X4 | §4.4 plan-approval → partial-completion | PENDING | one item completes; rest pending; plan → partially-completed | — | xmod_plan_partial_smoke.py | — | — |
| X5 | §4.5 imaging attachment (needs MinIO) | PENDING | attachment reachable from linked clinical context | — | xmod_imaging_attach_smoke.py | — | — |
| X6 | §4.6 offline-ready clinical | PENDING | sync status shown; refs preserved on reload | — | xmod_offline_sync_smoke.py | — | — |

---

## Per-module detail log

> The orchestrator appends one block per module here as it completes. Template:

```
### {N}. {module} — {STATUS} {RATING}
- Persona(s) driven: ...
- Workflows verified (happy / error / RBAC-neg / coherence / affordance / cross-workflow): ...
- IDEAL §4 seam(s) checked: ...
- Gaps fixed (Type A, with BR/AC citation + commit sha): ...
- Doc fixes (Type B): ...
- Deferred-reported (Type C, with reason / do-not-fix source): ...
- Circuit breakers tripped: none | max-fixes | repeated-gate-fail
- Evidence: docs/audits/workflow-verification/runs/{module}/
- Gate: typecheck ✓/✗ · backend ✓/✗ · contract ✓/✗ · FE unit ✓/✗ · lint/boundaries ✓/✗ · smoke ✓/✗
```
