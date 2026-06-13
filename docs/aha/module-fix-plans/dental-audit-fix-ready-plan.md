# AHA Fix-Ready Plan: Dental Audit

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Audit (compliance audit log) |
| Module slug | dental-audit |
| Source gap plan | `docs/aha/module-gap-plans/dental-audit-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-audit-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (§19); no Superpowers agent invoked |
| Organizer decision | READY |
| Reason | The module has exactly one V1-required build item (GAP-1 viewer FE) that is decision-free, fully evidence-backed, prototype-spec'd, and backend-frozen. Two small decision-free riders (GAP-4 doc sweep, GAP-3a boundary doc + canary) follow. Everything else is decision-blocked or deferred and is cleanly separated below. |
| Limitations | No tests executed during organizing. Organizer verification (new info, does not change the gap plan): `getAuditEvents` SDK hooks already exist in `packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts` — FIX-001 is pure FE wiring; no codegen or backend step is required. Settings shell (`apps/dentalemon/src/routes/_dashboard/settings.tsx`) already has a tab pattern + `requireRole('settings')` guard to extend. |

## 2. Fix Strategy Summary

- **Fix first:** Batch A — the audit viewer frontend (GAP-1). It is the module's only P1 and only V1 REQUIRED item; its prior gating condition (trail trustworthiness via Batch 2 of the master-gap-matrix) is satisfied, so there is no remaining reason to defer. Backend is complete and frozen; this is FE-only wiring plus one E2E proof.
- **Then:** Batch B — GAP-4 comment/doc sweep (zero-risk, doc-only). Batch C — GAP-3a sink-boundary documentation + legacy dual-write divergence canary (test + doc only; no write-path changes).
- **Do not fix:** GAP-2 (auditor role) and GAP-3 routing scope (base-module PHI reads into the dental viewer) — both `[NEEDS PRODUCT DECISION]` (Q1/Q2). GAP-5/GAP-6 and all §23 items stay out.
- **Major risks:** (1) `logAuditEvent` has 98 callers across 15 modules — its API is **frozen**; no signature or behavior changes in any batch. (2) Viewer must not expose snapshots (deliberate latent-PHI guard in the DTO — render only what the endpoint returns). (3) Do not re-litigate verified guards (append-only, sanitizer, fail-closed, cross-tenant pins).
- **Pass shape:** three small batches; A now, B and C in the same or an immediately following `04` pass. No shared/platform or database/schema code changes required for any active batch.
- **Blockers:** product decisions Q1 (auditor role) and Q2 (single-pane routing); confirmation Q3 (legacy sunset timing). No environment blockers.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: no FE audit viewer — `getAuditEvents` has 0 consumers; WF-028 (owner reviews trail) is V1-required and currently impossible in the UI | P1 | V1 REQUIRED | A | A trail nobody can read fails its compliance purpose (PH PHIC/NPC audits); prior gating now satisfied; prototype spec exists (`docs/product/modules/dental-audit/ui-prototype/screens.md` + data-table/form/microcopy contracts) | Gap plan §5/§10/§12; contract-spine: 0 consumers, grep-verified |
| FIX-002 | GAP-1 (proof slice): no end-user E2E evidence that a sensitive write becomes visible in the viewer | P1 | V1 REQUIRED | A | Core compliance journey ("who voided this invoice?") needs browser-level proof; existing journey 10 already drives void+amend writes — extend, don't duplicate | Gap plan §11/§20; `apps/dentalemon/tests/e2e/journeys/10-void-amend-audit.journey.spec.ts` |
| FIX-003 | GAP-4: stale pg-boss/async comments in `audit-logger.ts` header + lingering reconciled-param comments in MODULE_SPEC §3 | P3 | V1 RECOMMENDED | B | Doc drift misleads future fixers into thinking the write path is async (ADR-005 settled inline-sync); zero-risk, minutes of work | Gap plan §5 GAP-4; `core/audit-logger.ts` header; `MODULE_SPEC.md` §3 |
| FIX-004 | GAP-3a (decision-free portion): sink boundary undocumented + legacy `dental_audit` dual-write is fire-and-forget with no divergence detection | P2 | V1 RECOMMENDED `[SHARED DEPENDENCY]` | C | Documents the 3-sink boundary (so base-module PHI-read invisibility is a known, written boundary, not a surprise) and adds a divergence canary so silent legacy drift is caught; explicitly NOT the consolidation/routing itself | Gap plan §5 GAP-3, §13, §22; `audit-logger.ts:196-214`; `handlers/audit/` |

GAP-3's routing/consolidation scope (base PHI reads into dental viewer, legacy sunset) is **excluded** from active scope — see §8/§9.

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Viewer FE + E2E proof | Build WF-028 audit viewer (settings-area tab: table + actor/eventType/action/target/date filters + pagination, owner-only) and prove the void→viewer journey end-to-end | FIX-001, FIX-002 | Low — backend untouched; SDK hooks already generated; isolated new component + one route-file tab addition | Run in current `04` pass (first) |
| Batch B — Docs/comment hygiene | Remove stale pg-boss/async references; align comments with ADR-005 inline-sync reality | FIX-003 | Trivial — doc/comment-only, no code paths | Run in current `04` pass (after A) or fold into A's commit tail |
| Batch C — Sink boundary doc + divergence canary | Write the 3-sink boundary section in MODULE_SPEC + add an integration canary asserting authoritative/legacy dual-write parity | FIX-004 | Low-medium — test touches dual-write behavior read-only; **must not** change `logAuditEvent`; cross-module reads of base `handlers/audit/` are inspection-only | Run in current or immediately-following `04` pass; independent of A/B |
| (no batch) — Auditor role widening | GAP-2 | — | — | Requires product decision first (Q1) — do not run |
| (no batch) — Sink routing/consolidation + legacy sunset | GAP-3 remainder | — | — | Requires product decision first (Q2) + confirmation (Q3) — do not run |

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED-first component tests for the viewer: renders rows from `getAuditEvents` data; actor/eventType/action/target/date filters change query params; pagination works; empty/loading/error states render; tab hidden for non-owner roles; **no snapshot fields rendered** | frontend/component | UI and API agree on the wire shape (use the real SDK error/envelope shapes per the error-envelope learning — no self-consistent-fiction mocks); owner-only visibility; filters round-trip | New: `apps/dentalemon/src/features/settings/components/audit-log.test.tsx` (colocated, matching `notification-settings.test.ts` pattern) |
| FIX-002 | Extend journey 10: after void/amend, navigate Settings → Audit Log, filter by action, assert the `invoice.voided` (and amend) events appear with actor + reason | E2E/Playwright | The full compliance journey works against the real backend: write → trail → viewer; also implicitly proves self-audit read does not break the page | Extend: `apps/dentalemon/tests/e2e/journeys/10-void-amend-audit.journey.spec.ts` |
| FIX-003 | None (doc/comment-only) | — | — | — |
| FIX-004 | Divergence canary: after N `logAuditEvent` calls (mixed event types), authoritative `dental_audit_log` count == legacy `dental_audit` count for dual-written categories; canary fails loudly if fire-and-forget legacy write silently drops | integration | Legacy sink is not silently diverging; gives the future sunset decision (Q3) a measured baseline | New: `services/api-ts/src/handlers/dental-audit/legacy-sink-divergence.test.ts` (run via `scripts/test-with-db.ts`, real Postgres, same harness as `audit-immutability-db.test.ts`) |

Test ordering inside Batch A: FIX-001 component tests RED → implement component + tab → GREEN → FIX-002 E2E extension → GREEN. Do not write the E2E before the component exists (it would fail for the wrong reason).

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | New `apps/dentalemon/src/features/settings/components/audit-log.tsx` (+ colocated test); `apps/dentalemon/src/routes/_dashboard/settings.tsx` (add `audit` tab to the existing `Tab` union + tabs array, owner-gated); possibly `apps/dentalemon/src/lib/rbac.ts` only if tab gating needs a new capability key (prefer reusing existing role check — endpoint already enforces owner). **No SDK regen, no backend, no TypeSpec.** | module-local (FE) | Low — one shared route file edited additively (settings tab list); everything else new |
| FIX-002 | `apps/dentalemon/tests/e2e/journeys/10-void-amend-audit.journey.spec.ts` | module-local (test) | None (test-only) |
| FIX-003 | `services/api-ts/src/core/audit-logger.ts` (comments only — zero executable change); `docs/product/modules/dental-audit/MODULE_SPEC.md` | shared/platform (comments in a 98-caller file — comment-only edits) | None at runtime; reviewer must confirm diff is comment-only |
| FIX-004 | New `services/api-ts/src/handlers/dental-audit/legacy-sink-divergence.test.ts`; `docs/product/modules/dental-audit/MODULE_SPEC.md` (new "Sink boundary" section documenting the 3 tables + what each viewer can/cannot see) | module-local (test + doc); reads cross-module (`handlers/audit/`) for the doc only | Low — no production code changes permitted |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001 | shared/platform `[SHARED DEPENDENCY]` | `logAuditEvent` API frozen (98 callers / 15 modules) | Viewer work must not touch the logger; any logger change is platform-wide blast radius | No — constraint, not prerequisite |
| FIX-001 | cross-module | Viewer placement in the settings shell (dental-org-owned `_dashboard/settings.tsx`) | Tab addition lives in a shared route file; keep the edit additive | No — coordinate in-pass |
| FIX-001 | module-local | SDK hooks for `getAuditEvents` already generated | Removes the codegen step entirely (organizer-verified) | Already satisfied |
| FIX-002 | environment/tooling | E2E needs API on 7213 + seeded demo org with voidable invoice (journey 10 already provisions this) | Reuse existing journey fixture; do not build new seed | No — exists |
| FIX-004 | cross-module | Base `handlers/audit/` module + its retention job (sink #3) | Boundary doc must describe it accurately; canary covers sinks #1/#2 only | No — read-only inspection |
| GAP-2 (no Fix ID) | product decision | ROLE_PERMISSION_MATRIX refresh (flagged NEEDS-REVIEW 2026-06-11) | Auditor-role widening rides the matrix decision, not this module's pass | Yes — blocks any role work |
| GAP-3 remainder (no Fix ID) | product decision + cross-module | Q2 routing scope; base-module write paths | Routing base PHI-read events into `dental_audit_log` touches other modules' write paths — cross-module dependency row, not an expansion of this plan | Yes — blocks consolidation |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Should a read-only/auditor role read the trail? (ROLE_PERMISSION_MATRIX line 100 says yes, line 183 says owner-only; matrix flagged NEEDS-REVIEW) | `[NEEDS PRODUCT DECISION]` | None active (GAP-2; would spawn a future fix) | Wrong default over- or under-exposes PHI access history | Decide alongside the ROLE_PERMISSION_MATRIX refresh; if widening → add role + 2-org permission pins; if not → fix the matrix doc. Queue on the cross-module decision queue |
| Q2: Must base-module PHI-access reads appear in the dental viewer (single pane), or is the documented boundary acceptable? | `[NEEDS PRODUCT DECISION]` | FIX-004 scope ceiling (GAP-3 remainder) | Determines whether consolidation/routing work ever starts; FIX-004 deliberately stops at "document + canary" | Decide after FIX-004's boundary doc exists (it is the decision input). Queue on the cross-module decision queue |
| Q3: Legacy `dental_audit` sunset timing | `[NEEDS CONFIRMATION]` | Future sunset work (not active) | Fire-and-forget dual-write is a divergence risk; canary (FIX-004) buys time and data | Eng confirms after canary baseline exists; do not sunset in this module pass |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-2 auditor-role widening (or matrix doc correction) | `[NEEDS PRODUCT DECISION]` | Matrix is internally inconsistent and flagged NEEDS-REVIEW; either outcome (code change vs doc fix) depends on the decision | Q1 decided with the ROLE_PERMISSION_MATRIX refresh |
| GAP-3 consolidation: route base-module PHI-read events into `dental_audit_log` | `[NEEDS PRODUCT DECISION]` `[CROSS-MODULE RISK]` | Scope undecided (Q2); touches other modules' write paths and the base `handlers/audit/` module | Q2 decided; then plan as its own cross-module batch, not inside dental-audit |
| Legacy `dental_audit` table sunset | `[NEEDS CONFIRMATION]` | Timing unconfirmed (Q3); removing the dual-write without a canary baseline risks silent history loss for any unnoticed reader | FIX-004 canary landed + Q3 confirmed |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Audit export (CSV) from viewer | §23 / use-case "regulator asks for access log" | V2 DEFERRED | WF-028 is satisfied by viewing; export has no spec anchor |
| Denied-attempt (`access.denied`) logging rollout | GAP-5 / AUD-BR-003 | V2 DEFERRED | Taxonomy spec'd but recommended-not-required for V1; zero callers today is acceptable |
| Auditor-role implementation | GAP-2 | `[NEEDS PRODUCT DECISION]` | Blocked on Q1 (see §9) |
| Sink consolidation / single-pane routing | GAP-3 remainder | `[NEEDS PRODUCT DECISION]` | Blocked on Q2 (see §9); FIX-004 covers only the decision-free portion |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| TRUNCATE blocking on the audit table | GAP-6 | Documented intentional carve-out (test-reset need; table-owner privilege required) — risk acceptance recorded |
| Real event bus / async pipeline for audit events | §23 | ADR-005/006 settled inline-sync `[DO NOT OVERBUILD]`; also note: if any scheduled work ever arises here, it must register on the existing `services/api-ts/src/core/jobs.ts` scheduler, never a new framework |
| Big-bang sink migration (merge 3 tables in one pass) | §23 / GAP-3 | GAP-3 wants a boundary doc + plan, not a rewrite `[DO NOT OVERBUILD]` |
| Any `logAuditEvent` signature/behavior change | §16/§21 | 98 callers across 15 modules; frozen during all batches |
| Re-litigation of verified guards (append-only trigger+405, PHI sanitizer, fail-closed chain, EM-AUD-002 cross-tenant pins, Batch-2 coverage) | §3/§14/§15 | All source-verified with regression pins; touching them adds risk for zero value |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | The viewer was deliberately sequenced behind trail trustworthiness (Batch 2); the absence is a planned-but-now-due build, not a regression. Building it closes the root gap (WF-028 unreachable) |
| FIX-002 | Root cause | Test gap is the direct cause of "no end-user compliance proof"; extending journey 10 closes it at the journey level |
| FIX-003 | Root cause | Comments describe a superseded architecture (pg-boss/async) — fix is removing the stale text itself |
| FIX-004 | Workaround (deliberate, scoped) | The canary + boundary doc do not fix fragmentation (root cause = 3 sinks); they contain its risk until Q2/Q3 authorize the root-cause fix. Acceptable per §11 of prompt 03 because the root fix is decision-blocked, and the canary prevents the larger issue (silent divergence) from hiding |

## 13. Recommended First Fix Batch

- **Batch name:** Batch A — Viewer FE + E2E proof
- **Included Fix IDs:** FIX-001, FIX-002
- **Why first:** It is the module's only P1 / V1 REQUIRED item, fully decision-free, with a complete prototype spec and a finished, frozen backend; closing it converts the module's PARTIAL PASS driver into a wired workflow. Batches B/C are riders that cannot precede anything meaningfully.
- **Tests to write first:** `audit-log.test.tsx` component tests (RED): rows render from `getAuditEvents` mock matching the real wire shape; filters (actor/eventType/action/target/date) map to query params; pagination; empty/loading/error states; non-owner sees no tab; no snapshot fields rendered. Then (after GREEN) the journey-10 E2E extension: void → Settings → Audit Log → event visible.
- **Explicit out-of-scope:** any backend/TypeSpec/SDK-codegen change; `logAuditEvent` changes; auditor-role logic (Q1); base-sink events in the viewer (Q2); CSV export; legacy-table work; GAP-3/GAP-4 items (Batches B/C).

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Dental Audit
- **Module slug:** dental-audit
- **Fix-ready plan:** `docs/aha/module-fix-plans/dental-audit-fix-ready-plan.md`
- **Execute first:** Batch A (FIX-001 viewer FE, then FIX-002 E2E). Batches B (FIX-003 doc sweep) and C (FIX-004 boundary doc + canary) may follow in the same pass if Batch A lands green; otherwise stop after A.
- **Tests to prioritize:** new `apps/dentalemon/src/features/settings/components/audit-log.test.tsx` (RED-first); then extend `apps/dentalemon/tests/e2e/journeys/10-void-amend-audit.journey.spec.ts`. For FIX-004: new `services/api-ts/src/handlers/dental-audit/legacy-sink-divergence.test.ts` via the `scripts/test-with-db.ts` harness.
- **Files likely touched:** `apps/dentalemon/src/features/settings/components/audit-log.tsx` (new) + test; `apps/dentalemon/src/routes/_dashboard/settings.tsx` (additive tab); journey 10 spec; `services/api-ts/src/core/audit-logger.ts` (FIX-003, **comments only**); `docs/product/modules/dental-audit/MODULE_SPEC.md` (FIX-003/FIX-004).
- **Shared/database cautions:** `logAuditEvent` is frozen — 98 callers across 15 modules; no signature, ordering, or behavior changes. No database/schema changes in any batch. Viewer DTO deliberately omits snapshots — render only returned fields; do not add snapshot exposure. Settings route file is shared — keep the edit additive. SDK hooks for `getAuditEvents` already exist; do not regenerate the SDK for this work. Use real SDK wire/error shapes in component tests (no self-consistent-fiction mocks). Never point the dev server/contract/E2E at `monobase_test`.
- **Do not implement:** GAP-2 auditor role (Q1 `[NEEDS PRODUCT DECISION]`); GAP-3 routing/consolidation or legacy sunset (Q2/Q3); CSV export; `access.denied` rollout; TRUNCATE blocking; event bus; big-bang sink migration; any V2 DEFERRED / DO NOT ADD item; any re-litigation of verified guards.

---

Next recommended step:
Module/group: Dental Audit
Module slug: dental-audit
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-audit-fix-ready-plan.md
Recommended batch: Batch A — Viewer FE + E2E proof (FIX-001, FIX-002)
