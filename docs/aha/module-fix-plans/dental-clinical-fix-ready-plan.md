# AHA Fix-Ready Plan: Dental Clinical

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Clinical |
| Module slug | dental-clinical |
| Source gap plan | `docs/aha/module-gap-plans/dental-clinical-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (`/using-superpowers` not invoked; gap plan §26 already provided organizer-ready batch shapes) |
| Organizer decision | READY |
| Reason | The active fix scope is almost entirely FE wiring onto complete, tested, source-verified backends. All P1 items (GAP-1/2/3) plus the V1 REQUIRED P2 items (GAP-4/9) are decision-free with strong static evidence (dead prop verified at `workspace-top-bar.tsx:24,90` and icon block :170-200; zero-consumer ops grep + contract-spine verified). Decision-gated items (GAP-5/6/7/8) cleanly separate out. |
| Limitations | (1) Organizer did not run tests — fix readiness is based on source inspection of cited lines + 2026-06-10 contract-spine. (2) Q2 (consent history placement) is unresolved; this plan proceeds with the gap plan's recommended default (inside consent sheet) and records it as a reversible UI choice. (3) Cross-referenced fix-ready plans `dental-pmd-fix-ready-plan.md` and `dental-org-fix-ready-plan.md` did not yet exist at write time — cross-references are forward references the orchestrator pre-decided. |

**Organizer source verifications (this prompt, read-only):**
- `workspace-top-bar.tsx`: `onLab` (line 24) and `onPmd` (line 25) declared, destructured (:90-91); icon block (~:170-200) renders Rx/Consent/Notes/Attachments/Treatment-Plan/Complete only — no Lab, no PMD button. Confirms GAP-1 and the pmd `onPmd` twin are one component, one fix pattern.
- `lab-orders-sheet.tsx` already uses `@monobase/sdk-ts/generated/react-query` hooks (full FSM inside sheet) — FIX-001 is render-trigger only, zero data work.
- `consent-sheet.tsx:20` hardcodes `CONSENT_TEMPLATES` const (erratum-confirmed: real backend CRUD lives in dental-org `consentTemplates.ts`).
- `rx-sheet.tsx` imports only `createPrescription` — confirms write-only Rx record (GAP-3).

## 2. Fix Strategy Summary

- **Fix first:** Batch A — the `WorkspaceTopBar` dead-prop fix (Lab button per clinical GAP-1 **and** PMD button per dental-pmd GAP-2, same component, one batch — cross-module bundle pre-decided by orchestrator), plus the honest lab UI E2E that replaces the false-green API-only spec (GAP-9). Smallest, highest-leverage fix in the module; unblocks an entire tested workflow.
- **Then:** three independent FE-wiring batches against already-tested backends — consent revoke/history (Batch B), Rx list + dispense/cancel (Batch C), amendments visibility + role-gating parity (Batch D). Each is module-local FE work; backend changes ≈ zero across the whole active scope.
- **Cross-module joint work:** the consent-template **picker** in `consent-sheet.tsx` (Batch E) consumes dental-org's existing `listConsentTemplates` backend; coordinate with dental-org's consent-template batch (dental-org owns the settings-shell management panel). Do not duplicate any consent-template backend — it exists (erratum).
- **Do not fix:** anything decision-gated (GAP-5 allergy blocking, GAP-6/7/8 wire-vs-park), V2 deferred items (§10), or anything in §11 Do Not Build. Do not touch consent gate facades — `[CROSS-MODULE RISK]`, they feed billing/case-presentation/visit completion and were hardened 2026-06-08 (V-CLN-010).
- **Major risks:** low overall. The only shared file is `workspace-top-bar.tsx` (shared workspace shell — Batch A is isolated for that reason). Batch B must be read-mostly: render consent state + call existing `revokeConsentForm`; never alter gate semantics.
- **One pass or multiple:** multiple small `04` passes — A first, then B/C/D in any order (independent), E coordinated with dental-org, F (docs) anytime.
- **Shared/platform/database work required:** shared FE shell only (Batch A). No database/schema work anywhere in active scope. No scheduler work needed in this module.
- **Product decisions / environment blockers:** Q1 (occlusion/postop/inventory) and Q3 (allergy posture) block their items — escalated to the cross-module decision queue (§8). No environment blockers.

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: Lab button never rendered — dead `onLab` prop; entire tested lab FSM (FR1.24/BR-018/WF-017) unreachable | P1 | V1 REQUIRED | A | Core daily dental workflow undeliverable despite complete backend + sheet | `workspace-top-bar.tsx:24,90` + icon block omits Lab; sheet mounted `$patientId.tsx:450` |
| FIX-002 | dental-pmd GAP-2: dead `onPmd` prop in the same component — PMD viewer/import/export unreachable. **Owned here on behalf of dental-pmd (orchestrator bundle decision: one component, one fix).** | P1 | V1 REQUIRED `[CROSS-MODULE RISK]` | A | Same dead-trigger class, same file, same test file — splitting it across two passes would touch the shared shell twice | `dental-pmd-gap-plan.md` §5 GAP-2: `workspace-top-bar.tsx:25,91` vs icon block; viewer mounted `$patientId.tsx:301,565-570` |
| FIX-003 | GAP-9: `lab-order-tracking.spec.ts` is API-only false-green (drives FSM via `page.evaluate(fetch)`, never opens UI) — masked GAP-1 | P2 | V1 REQUIRED `[TEST GAP]` | A | Test honesty; same class previously caused imaging misses; must land with FIX-001 so the new button has end-user proof | spec header line 8 admits API-only |
| FIX-004 | GAP-2: consent revocation (WF-035) + consent/refusal history have zero FE — compliance workflow impossible from UI | P1 | V1 REQUIRED `[CROSS-MODULE RISK]` (read-only wrt gates) | B | Legal/compliance workflow (informed-consent withdrawal); consent state invisible post-signing | `revokeConsentForm`, `listConsentRefusals` 0 consumers (spine + grep); `listConsentForms` only used by `pre-completion-checklist.tsx` |
| FIX-005 | GAP-2/GAP-12 subset: zero hurl coverage for consent revoke + refusals list | P2 | V1 RECOMMENDED `[TEST GAP]` | B | Contract pin for the newly-wired surface; cheap while Batch B is open | `dental-clinical.hurl` lacks revoke/refusals cases; only backend-unit covers them |
| FIX-006 | GAP-3: prescription record write-only — no Rx list, no dispense/cancel UI (WF-016 FSM dead) | P1 | V1 REQUIRED | C | Medication review before procedures is a clinical-safety ritual; safety floor has no drill-down | `listPrescriptions`, `updatePrescription` 0 consumers; `rx-sheet.tsx` imports `createPrescription` only |
| FIX-007 | GAP-4: amendments write-only — `listAmendments` zero consumers; FR1.16 "both visible" unmet | P2 | V1 REQUIRED | D | Compliance promise: original + correction both reviewable | spine + grep; `amendment-form.tsx` create-only |
| FIX-008 | GAP-11: Notes/Med-history affordances shown to all roles (backend 403 is the real gate) | P3 | V1 RECOMMENDED | D | Cheap UX-parity fix in the same files Batch D already touches | `workspace-top-bar.test.ts` asserts Rx/Consent/TP gating only |
| FIX-009 | Erratum / dental-org GAP-2 (clinical side): `consent-sheet.tsx` hardcodes `CONSENT_TEMPLATES` const instead of reading dental-org's existing `listConsentTemplates` API | P2 | V1 REQUIRED `[CROSS-MODULE RISK]` | E | FR8.4b — per-clinic consent wording; backend (owner-gated CRUD ×4) already exists in dental-org; this is the consumer-side wiring | Erratum in gap-plan header; `consent-sheet.tsx:20`; `handlers/dental-org/consentTemplates.ts` |
| FIX-010 | GAP-13 + Q5: API_CONTRACTS lab enum (`sent/received/...`) contradicts MODULE_SPEC/BR-018/code; attachment cap 5MB vs 50MB doc conflict — verify actual validator and reconcile docs | P3 | V1 RECOMMENDED | F | Doc drift misleads future agents/tests; near-zero risk | `docs/product/modules/dental-clinical/API_CONTRACTS.md` lab + attachment sections vs MODULE_SPEC §8 / code |

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| **Batch A — WorkspaceTopBar dead-trigger fix + honest E2E** | Render role-gated Lab and PMD icon buttons in the shared top bar; replace false-green lab E2E with a genuine UI journey | FIX-001, FIX-002, FIX-003 | Low-Medium (shared FE shell, heavily tested; render-only change) | **Run first in current `04` pass.** Covers pmd `onPmd` on behalf of dental-pmd — cross-reference `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` (that plan must NOT re-do the button; its remaining pmd work builds on this) |
| **Batch B — Consent revoke + history** | Consent history list (signed/pending/revoked/refusals) + revoke-pending action in consent sheet; hurl pins | FIX-004, FIX-005 | Low (read-mostly UI; existing ops; gates untouched) | Run in a separate `04` pass after/independent of A |
| **Batch C — Rx list + lifecycle** | Rx list (per visit + per patient) with dispense/cancel actions in rx-sheet | FIX-006 | Low | Separate `04` pass; independent of A/B |
| **Batch D — Amendments visibility + role-gating parity** | Read-only amendments list on locked visit; hide Notes/MH affordances per role matrix | FIX-007, FIX-008 | Low | Separate `04` pass; independent |
| **Batch E — Consent-template picker (cross-module joint)** | Replace hardcoded `CONSENT_TEMPLATES` with `listConsentTemplates` reads (graceful fallback/empty state) | FIX-009 | Low-Medium (cross-module coordination) | Run coordinated with dental-org's consent-template batch — dental-org owns the settings-shell management panel (see `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`). The picker itself is NOT blocked by the settings shell, but ship it in the same window so clinics can actually manage what the picker reads |
| **Batch F — Docs reconcile** | Fix lab-status enum + attachment-cap doc drift after verifying the actual validator cap (Q5) | FIX-010 | Trivial | Anytime; can piggyback on any pass |

Batch independence: B, C, D touch disjoint components and can run in any order after A. A goes first because it is the smallest fix that unblocks the largest tested surface, and because FIX-003's honest E2E needs the button to exist.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | RED-first: top bar renders a Lab icon button (role-gated per matrix) and clicking it calls `onLab` | frontend/component | The dead prop is now a live affordance; pins the dead-prop class | extend `apps/dentalemon/src/features/workspace/components/workspace-top-bar.test.ts` |
| FIX-002 | RED-first: top bar renders a PMD icon button and clicking it calls `onPmd` (role-gating per pmd plan) | frontend/component | Same, for pmd | same file |
| FIX-003 | New genuine UI E2E: top bar → Lab button → sheet opens → create order → advance status (ordered→in_fabrication) | E2E/Playwright | End-user reachability of the lab FSM; replaces false-green | new `apps/dentalemon/tests/e2e/lab-order-ui.spec.ts`; relabel existing `lab-order-tracking.spec.ts` → `lab-order-tracking-api.spec.ts` (keep as API coverage, honestly named) |
| FIX-004 | RED-first: consent sheet renders history (signed/pending/revoked/refused); revoke action visible **only** on pending forms, absent on signed/revoked | frontend/component | WF-035 deliverable; sign/revoke mutual exclusion respected in UI (no UI path to the V-CLN-010 exploit) | extend `apps/dentalemon/src/features/workspace/components/consent-sheet.test.ts` |
| FIX-005 | Hurl: revoke pending consent → 2xx; sign-after-revoke → 422; `GET` refusals list returns recorded refusal | contract | Wire-level pin of revoke + refusals-list shapes | extend `specs/api/tests/contract/dental-clinical.hurl` |
| FIX-006 | RED-first: rx-sheet renders prescription list with status; dispense/cancel actions follow FSM (no dispense on cancelled, etc.); per-visit and per-patient scope | frontend/component | Medication record reviewable; FSM guarded in UI | extend `apps/dentalemon/src/features/workspace/components/rx-sheet.test.ts` |
| FIX-007 | RED-first: locked/completed visit view shows amendments list alongside original record (read-only) | frontend/component | FR1.16 "both visible" | new `amendments-list.test.ts` next to new component (or extend `amendment-form.test.ts` if list lives in the same sheet) |
| FIX-008 | Extend role-matrix assertions: Notes/MH buttons hidden for roles lacking permission (mirror existing Rx/Consent/TP assertions) | frontend/component + permission/RBAC | FE affordances match backend gates | `workspace-top-bar.test.ts` |
| FIX-009 | RED-first: consent sheet template picker populated from `listConsentTemplates` response (mocked SDK); sane empty-state when no templates; selecting a template fills body text | frontend/component | Sheet consumes the real backend, not the const | `consent-sheet.test.ts` |
| FIX-010 | None (docs-only). Optional cheap pin: backend test asserting actual attachment size-cap once Q5 verified from the validator source | data/schema (optional) | Docs match code; cap pinned | n/a / `services/api-ts/src/handlers/dental-clinical/` attachment tests |

Test-style cautions for `04` (from project memory/history): mock SDK errors with the real `SdkError` shape (flat envelope), not nested fictions; assert content not just chrome; lucide icons are globally mocked (`icon-${name}` testids); E2E must drive the real UI — no `page.evaluate(fetch)`.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx` + `.test.ts` | shared/platform (shared workspace shell) | All workspace users see the bar; render-only addition — low |
| FIX-002 | same two files | shared/platform + cross-module (pmd) | Same; unblocks dental-pmd's viewer/import surfaces already mounted at `$patientId.tsx:301,565-570` |
| FIX-003 | `apps/dentalemon/tests/e2e/lab-order-tracking.spec.ts` (relabel), new `lab-order-ui.spec.ts` | module-local (tests only) | None (test honesty) |
| FIX-004 | `consent-sheet.tsx` + `.test.ts`; SDK react-query hooks for `listConsentForms`/`listConsentRefusals`/`revokeConsentForm` (already generated — pattern: `lab-orders-sheet.tsx:12-18`) | module-local | Consent sheet only; **must not touch** `repos/*.facade.ts` consent gates |
| FIX-005 | `specs/api/tests/contract/dental-clinical.hurl` | module-local (contract) | None |
| FIX-006 | `rx-sheet.tsx` + `.test.ts` | module-local | Rx sheet only; backend untouched |
| FIX-007 | new `amendments-list.tsx` (+ test) in workspace components; mount point in locked-visit view (`$patientId.tsx` read-only state area) | module-local | Locked-visit view |
| FIX-008 | `workspace-top-bar.tsx` + `.test.ts` (role props already flow — `allowRx`/`allowConsent` pattern exists) | shared/platform | Low; follows existing gating pattern |
| FIX-009 | `consent-sheet.tsx` + `.test.ts` (remove/fallback `CONSENT_TEMPLATES` const; read dental-org's `listConsentTemplates`) | cross-module (consumes dental-org API) | Consent sheet; coordinate with dental-org batch |
| FIX-010 | `docs/product/modules/dental-clinical/API_CONTRACTS.md` (+ read-only check of attachment validator) | module-local (docs) | None |

Note for `04`: no SDK regeneration expected — all consumed operations already exist in `@monobase/sdk-ts/generated` (the spine maps them as orphans, meaning generated-but-unconsumed). If a hook is somehow missing, regenerate SDK as a separate step (known gotcha: SDK regen is its own step).

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-001/002/008 | shared/platform | `WorkspaceTopBar` is the shared workspace shell `[SHARED DEPENDENCY]` | Every workspace persona sees it; existing top-bar tests are the regression net | No — fix is additive render; run full FE suite after |
| FIX-002 | cross-module | dental-pmd owns the rest of the PMD chain (generation trigger, safety-floor merge, honest pmd E2E) | This batch ONLY renders the button; pmd's own plan (`docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md`) must treat the button as done and not re-implement it | No |
| FIX-004 | cross-module `[CROSS-MODULE RISK]` | Consent gate facades (`consent-billing.facade.ts`, `clinical-visit.facade.ts`, case-presentation reads) | Revoke UI must be read-mostly wiring; gate semantics hardened 2026-06-08 (V-CLN-010) — do not modify facades or handler guards | No (constraint, not prerequisite) |
| FIX-009 | cross-module | dental-org owns consent-template CRUD backend + the settings-shell management panel (org GAP-2). Settings shell is dental-org's batch — see `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` | Picker is independent of the settings shell but pointless without managed templates; ship coordinated. Do NOT build any consent-template backend here (erratum) | Soft — coordinate timing; not technically blocked |
| FIX-005 | environment/tooling (minor) | Contract tests need API on :7213 against a fresh server (stale-server gotcha) | Known false-pass risk | No — operational note for `04` |
| All | database/schema | None | Active scope touches zero schemas/migrations | — |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Occlusion / post-op templates / inventory — wire FE or park as documented-dormant backend? | `[NEEDS PRODUCT DECISION]` | (blocked items, no Fix IDs assigned) | 10 orphan ops, no PRD anchor; decides GAP-6/7/8 | Add to cross-module decision queue; default lean = park + document as dormant `[DO NOT OVERBUILD]` |
| Q3: Allergy conflict — ratify current advisory or restore PRD blocking-with-override? | `[NEEDS PRODUCT DECISION]` | (blocked GAP-5) | Safety posture divergence from FR1.12/FR2.15 was silent | Decision queue; if blocking ratified, fix = FE confirm-dialog override only (backend unchanged); if advisory ratified, fix = PRD edit |
| Q2: Consent history/revoke placement — consent sheet vs patient profile? | `[NEEDS CONFIRMATION]` | FIX-004 | Fix shape | **Proceed with default = inside consent sheet** (gap plan §5 recommendation; reversible UI choice). Record placement in fix report; revisit only if product objects |
| Q5: Attachment max size — 5MB (API_CONTRACTS) vs 50MB (MODULE_SPEC); what does the validator enforce? | `[NEEDS CONFIRMATION]` | FIX-010 | Doc reconcile must match code truth | Eng confirmation inside Batch F: read the validator, pin, fix docs — no product decision needed |
| Q4: Consent template editor V1? | RESOLVED by erratum | FIX-009 | Backend already exists in dental-org — reduced to a wiring task | No decision needed; coordinate Batch E with dental-org |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| GAP-5 allergy blocking override dialog | `[NEEDS PRODUCT DECISION]` | PRD says blocking-with-override; code is advisory; building the dialog before ratification could be wasted or wrong | Q3 decision (cross-module decision queue) |
| GAP-6 occlusion FE wiring | `[NEEDS PRODUCT DECISION]` | No PRD anchor; wire-vs-park undecided | Q1 decision |
| GAP-7 post-op templates FE wiring | `[NEEDS PRODUCT DECISION]` | Same class | Q1 decision |
| GAP-8 inventory FE wiring | `[NEEDS PRODUCT DECISION]` | Same class (5 ops + ledger) | Q1 decision |
| Consent-template **management panel** (settings UI) | `[SHARED DEPENDENCY]` | Owned by dental-org; mounts in the shared settings shell that dental-org's plan sequences | dental-org settings-shell batch (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`) |
| GAP-12 remainder: hurl for occlusion/postop/inventory | `[TEST GAP]` + Q1 | Contract-pinning unwired surfaces is premature until wire-vs-park decided | Q1 decision |
| FR0.8 dashboard pending-lab feed | `[NEEDS CONFIRMATION]` (P3) | Gap plan could not confirm absence conclusively (`use-dashboard-summary`); P3 follow-on of GAP-1 | Confirm absence after Batch A lands; then decide if V1 |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Med-history review-history endpoint + UI | GAP-10 | V2 DEFERRED | Needs a new backend endpoint; latest-review read suffices for V1 |
| Amendment supervisor approval | BR-019 | V2 DEFERRED | Spec-declared 501 stub; intentionally feature-flagged off |
| RxNorm/ICD-10/SNOMED coded lookups | §23 | V2 DEFERRED | Free-text works; coding layer is a large dependency with no V1 need |
| Storage-capacity device telemetry (FR1.21 90%/95% warn/block) | GAP-12 note / §23 | V2 DEFERRED `[NEEDS CONFIRMATION]` | Device-capacity sensing belongs with offline/iPad work; revisit with offline-sync group |
| FE wiring for occlusion/post-op/inventory | GAP-6/7/8 | `[NEEDS PRODUCT DECISION]` | See §9 — deferred pending Q1; not in active scope either way until decided |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Any consent-template backend in dental-clinical | erratum / §25 Q4 | Full owner-gated CRUD already exists in dental-org (`handlers/dental-org/consentTemplates.ts`) — building it here duplicates code `[DO NOT OVERBUILD]` |
| Backend expansion for occlusion/post-op/inventory | §23 | Already built beyond PRD; no expansion until product anchors exist `[DO NOT OVERBUILD]` |
| Drug-interaction engine expansion beyond advisory | §23 | No PRD anchor; advisory check suffices |
| Changes to consent gate facades / sign-revoke guard semantics | §16/§21 | Hardened + triple-pinned (V-CLN-010); UI work is read-mostly `[CROSS-MODULE RISK]` |
| Re-litigating fixed items: V-CLN-010, G10 list shapes, visit immutability, RBAC guards | §26 | Source-verified GREEN this round |
| New scheduler/cron framework (if any follow-on needs scheduled work) | orchestrator rule | A job scheduler already exists at `services/api-ts/src/core/jobs.ts` — register on it; never build a new one `[DO NOT OVERBUILD]` (no active clinical fix needs it) |
| AI-assisted features of any kind | platform non-goal | Binding non-goals: no-AI, offline-first (`docs/clinical/STANDARDS_COMPLIANCE.md`) |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001/002 | Root cause | Dead-trigger class: feature built bottom-up (backend → sheet → prop plumbed) but the final affordance render was never added; component tests asserted existing buttons only, so nothing failed. Fixing the render IS the root fix. Pattern (×2 in one file) flagged for prompt 05 cross-cutting audit |
| FIX-003 | Root cause (of the masking) | E2E asserted API behavior while named as a UI journey — false-green by construction. Honest relabel + genuine UI spec removes the masking class |
| FIX-004 | Root cause | Backend-complete workflow with zero consumer wiring; UI list+action is the complete fix (gates already correct) |
| FIX-005 | Root cause (test gap) | Surface was never contract-pinned because it was never wired |
| FIX-006 | Root cause | Same zero-consumer class as FIX-004 |
| FIX-007 | Root cause | Same class; "both visible" needs only a read view |
| FIX-008 | Symptom-level parity fix (acceptable) | Real gate is backend 403; FE hiding is UX parity, not security. Low risk, included because Batch D touches the same file |
| FIX-009 | Root cause | Sheet was built against a hardcoded const before the org backend existed/was known; wiring the read is the fix |
| FIX-010 | Root cause (doc drift) | API_CONTRACTS written before BR-018 enum settled; reconcile to code truth |

## 13. Recommended First Fix Batch

**Batch A — WorkspaceTopBar dead-trigger fix + honest E2E**

- **Included Fix IDs:** FIX-001 (Lab button, GAP-1), FIX-002 (PMD button, dental-pmd GAP-2 — owned here), FIX-003 (honest lab UI E2E + relabel false-green spec, GAP-9)
- **Why first:** Smallest change with the largest unblocking effect — two complete, tested workflows (lab FSM; PMD viewer/import) become reachable by editing one shared component. It also removes the false-green E2E that masked the gap, restoring test honesty before the other batches rely on the suite. It is the only batch touching the shared shell, so isolating it first contains the platform risk.
- **Tests to write first (RED):**
  1. `workspace-top-bar.test.ts`: asserts a Lab icon button renders (role-gated) and fires `onLab` — currently fails.
  2. Same file: PMD icon button renders and fires `onPmd` — currently fails.
  3. Then (during): new `lab-order-ui.spec.ts` genuine Playwright journey (top bar → sheet → create → status advance); relabel `lab-order-tracking.spec.ts` → `-api`.
- **Explicit out-of-scope for Batch A:** consent work (B/E), Rx list (C), amendments (D), any pmd work beyond rendering the button (generation trigger, safety-floor merge, pmd E2E — all belong to `dental-pmd-fix-ready-plan.md`), anything in §9/§10/§11, FR0.8 dashboard lab feed, any backend change.

## 14. Instructions for 04 Fix Prompt

- **Module/group name:** Dental Clinical
- **Module slug:** dental-clinical
- **Fix-ready plan path:** `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/dental-clinical-gap-plan.md`
- **Execute first:** Batch A (FIX-001, FIX-002, FIX-003) only. Do not continue to Batch B/C/D/E/F without explicit instruction.
- **Tests to prioritize:** RED-first component tests in `workspace-top-bar.test.ts` (Lab + PMD button assertions), then the genuine lab UI E2E; run the full FE suite after (shared shell).
- **Files likely to touch:** `apps/dentalemon/src/features/workspace/components/workspace-top-bar.tsx` + `.test.ts`; `apps/dentalemon/tests/e2e/lab-order-tracking.spec.ts` (relabel) + new `lab-order-ui.spec.ts`. Possibly `$patientId.tsx` only if role props need plumbing (verify `allowRx`-style pattern first — prefer reusing it).
- **Shared/database cautions:** `WorkspaceTopBar` is the shared workspace shell — additive render only; zero backend, zero schema, zero SDK-regen expected. Never run servers/contract/E2E against `monobase_test` (template pollution); restart the :7213 server before any contract run; backend tests go through `scripts/test-with-db.ts` with inline `DATABASE_URL`.
- **Do not implement:** GAP-5 allergy dialog (Q3), GAP-6/7/8 wiring (Q1), consent-template backend (exists in dental-org), consent-gate facade changes, BR-019 approval, GAP-10 review history, RxNorm coding, storage telemetry, dashboard lab feed, any pmd work beyond the button, any new scheduler (use `core/jobs.ts` if ever needed), any AI feature.
- **Cross-references:** FIX-002 satisfies dental-pmd GAP-2's button — record this in the fix report so `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` treats it as done. Batch E coordinates with dental-org's consent-template batch (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`); the settings-shell management panel is dental-org-owned.

---

Next recommended step:
Module/group: Dental Clinical
Module slug: dental-clinical
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md
Recommended batch: Batch A — WorkspaceTopBar dead-trigger fix + honest E2E (FIX-001, FIX-002, FIX-003)
