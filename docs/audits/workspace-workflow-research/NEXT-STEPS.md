# Workspace-Workflow Research — Next Steps & Resume Guide

**Status (checkpoint):** the read-only workspace-workflow gap-research pass is COMPLETE.
This directory holds the full output. Nothing has been implemented yet — the next move is
to execute the no-decision fixes and resolve the gated decisions.

**Branch:** `chore/workflow-verification-sweep`.

## What's here

- `REPORT.md` — the decision-ready synthesis. Read **§5 Master Slice Plan** (44 slices,
  Tier 1/2/3) and **§6 Open Questions / Decisions** (21 product decisions) first.
- `appendix-A-visit-fsm.md` … `appendix-F-cross-cutting.md` — per-chunk detail (inventory,
  sequencing analysis, full register rows, per-chunk slice specs).
- `RESEARCH-PROMPT-AND-ROADMAP.md` — the methodology that produced the report (traceability).

## Headline

- ~80 workflows/rules **implemented**; **37 known** gaps + **39 new** findings.
- **Zero new P0.** Highest new severity is P1; dominant theme is **offline-first hardening**.
- **~22 slices are ready to execute with no decision**; ~21 are decision-gated; 4 are
  deferred-by-design (ADR-008 write-time chart sync, cadence P2P, FHIR import, AI non-goals).

## Recommended first move — three no-decision P1 slices (Vertical TDD)

Each: RED tests first → implement → full gate (api-ts `bunx tsc` + `bun run check:boundaries`,
backend, contract, FE tsc + unit, E2E) → one atomic commit.

1. **SL-03 — per-tooth chart data-loss (live today).** `updateTooth` / per-surface PATCH
   skips the baseline merge that `upsertDentalChart` performs, so single-tooth edits drop
   out of next-visit carry-over. See `appendix-B` B-G1.
2. **SL-05 — invoice-void audit not fail-closed.** `services/api-ts/src/handlers/dental-billing/voidDentalInvoice.ts:61`
   lacks `{ failClosed: true }` (payment-void/discount/payment have it). Also corrects the
   `MASTER-GAP-MATRIX.md` P1-C "fixed" claim. See `appendix-E` E-NEW-02.
3. **SL-08 — cross-tenant optional-branch sweep** for portal/emr/provider/external-import.
   See `appendix-F` F-G06.

## Then: resolve the high-leverage decisions before the gated slices

- **#1 Canonical plan-accept** — version-snapshot vs header-FSM source of truth (blocks SL-06/19/35).
- **#2 Offline-sync hardening now vs defer** — recommended **now** (cheap before cadence
  activates; dangerous to retrofit after bad data exists). Unblocks SL-01/02/04/09 (5 P1 slices).
- **#7 Carry-over model** + source-status guard (blocks SL-19).
- **#14 EMR scope** — and run the cross-tenant regression test regardless of scope.

Full decision list with what each blocks: `REPORT.md` §6.

## Resume prompt (paste into Claude Code at repo root on the new device)

> On branch `chore/workflow-verification-sweep`. Read
> `docs/audits/workspace-workflow-research/NEXT-STEPS.md` and `REPORT.md` (especially §5
> Master Slice Plan and §6 Decisions). We just finished a read-only workspace-workflow
> gap-research pass. I want to start executing the fixes. Begin with the three no-decision
> P1 slices, each via Vertical TDD (RED tests first, full gate, one atomic commit per slice):
> SL-03 (per-tooth chart baseline-merge data-loss, appendix-B B-G1), SL-05 (fail-closed
> audit on `voidDentalInvoice.ts:61`, appendix-E E-NEW-02), SL-08 (cross-tenant optional-branch
> sweep for portal/emr/provider/external-import, appendix-F F-G06). Then surface decisions
> #1 (canonical plan-accept), #2 (offline-sync harden now vs defer — recommended now), #7
> (carry-over model), #14 (EMR scope + cross-tenant regression test) before the gated slices.
> Gotchas: backend tests per-file via `services/api-ts/scripts/test-with-db.ts` with
> `DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test`; restart API
> before contract; api-ts `bunx tsc` separately from root `bun run typecheck`.

**Note:** Claude Code's per-device memory does NOT transfer — this file + `REPORT.md` are
the self-contained resume context.
