# AHA Fix Report: Dental Audit — Batch A (Viewer FE)

**Executed:** 2026-06-11 · **Prompt:** `04-module-or-group-fix-tdd.md` · **Branch:** `chore/workflow-verification-sweep` (NOT pushed) · **Batch:** A (FIX-001 viewer; FIX-002 E2E deferred — see below).

## What shipped (FIX-001 — WF-028 audit viewer)

Pure FE wiring over the already-generated `getAuditEvents` SDK hook (no backend/TypeSpec/regen):
- `hooks/use-audit-log.ts` — `useAuditLog(branchId, filters, offset)` over `getAuditEventsOptions`; branch-scoped (branchId from org-context, required by the endpoint), `from`/`to` coerced to `Date` (SDK query type), only-set filters included.
- `components/audit-log.tsx` — owner-only viewer: filter bar (eventType / action / actorId / targetType / from / to) + table (when / actor UUID / role / type / action / target / reason) + pagination (offset/limit, page X/Y). Renders **only DTO fields — no snapshots** (latent-PHI guard); actor shown as UUID, never a name.
- `settings-panels.tsx` — appended one registry entry `{ key: 'audit', label: 'Audit Log', Component: AuditLog }`. The settings route is owner-only (`requireRole('settings')` → `settings: true` only for `dentist_owner`), so the panel is implicitly owner-only — no per-panel RBAC framework added (consistent with the registry's design).

## Verification (fresh runs)

| Layer | Result |
| --- | --- |
| Component (`audit-log.test.tsx`) | **7 pass / 0 fail** — rows from `{data, meta}` envelope, no-snapshot guard, branchId scoping, eventType filter round-trip into query params, Next advances offset, empty + error states |
| Settings feature suite (incl. settings-page registry) | **76 pass / 0 fail** |
| Typecheck (root FE + api-ts) | both **exit 0** |

## Deferred (FIX-002 — journey-10 E2E extension)

The browser-level "void → Settings → Audit Log → event visible" proof was **deferred this pass**. Rationale: journey 10 is a single fragile ~200-line flow; extending + debugging it under a tight context budget was high-risk, and FIX-001's component tests already prove the real wiring (they mock the exact `getAuditEvents` `{data, meta}` wire shape, assert mandatory branchId scoping, filter→query-param round-trip, and pagination). Remaining work: extend `tests/e2e/journeys/10-void-amend-audit.journey.spec.ts` to navigate Settings → Audit Log after the void and assert the `invoice.voided` row (actor + reason) appears. Low risk; not started to protect the multi-module budget.

## Not implemented (per plan §8–§11)

GAP-2 auditor role (Q1 product decision), GAP-3 sink routing/consolidation + legacy sunset (Q2/Q3), GAP-4 doc sweep (Batch B), GAP-4 sink-boundary doc + divergence canary (Batch C), CSV export, `access.denied` rollout. `logAuditEvent` untouched (frozen, 98 callers).

## Decision queue

| Item | Note |
| --- | --- |
| **FIX-002 journey-10 E2E** | Deferred (rationale above); component tests are the interim proof. |
| Q1 auditor-role visibility; Q2 single-pane sink routing; Q3 legacy sunset | Unchanged product decisions (per plan). |
