# AHA Fix-Ready Plan: Dental Org & Staff

**Generated:** 2026-06-11 · **Prompt:** `docs/aha/prompts/03-organize-gap-plan-for-fixing.md` · **Branch:** `chore/workflow-verification-sweep`

## 1. Source Gap Plan

| Item | Details |
| --- | --- |
| Module/group | Dental Org & Staff (org/branches/memberships/settings/onboarding/PIN) |
| Module slug | dental-org |
| Source gap plan | `docs/aha/module-gap-plans/dental-org-gap-plan.md` |
| Output file | `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` |
| Audit decision | PARTIAL PASS |
| Superpowers used | No — organizer discipline applied via shared rules (`/using-superpowers` not invoked; batch sequencing follows gap plan §26 + shared rules §19) |
| Organizer decision | READY |
| Reason | The decision-free active scope (staff edit P1, consent-templates wiring, settings-shell extension, doc reconcile, FE mutation-assert pins) is fully evidence-backed: every active fix wires an existing, tested, owner-gated backend handler verified present in `services/api-ts/src/handlers/dental-org/`. Two valid gaps (multi-branch UI, PIN recovery UI) are cleanly separable behind product decisions Q1/Q2 and do not block the active batches. |
| Limitations | Organizer pass; no tests executed. Cross-module dependents `docs/aha/module-fix-plans/data-governance-fix-ready-plan.md` and `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` did not exist at write time (forthcoming — referenced as planned dependents per orchestrator bundle ownership). FE staff/settings tests are helper-only (gap plan GAP-8), so RED-first FE tests are mandatory, not optional. |

## 2. Fix Strategy Summary

Everything in active scope is **wiring, not building**: the backend for every active gap already exists, is tested, and is owner-gated. The danger class (split-brain data) was closed in Batch 4 and re-verified by the audit — do not touch G1/G2/G3 landings.

- **Fix first:** Batch A — staff edit modal (GAP-1, the only P1; FR6.1-explicit; role mis-assignment is currently uncorrectable without deactivate+recreate). Pure module-local FE wiring to the existing `updateMember.ts`.
- **Then:** Batch B — the **shared settings-shell extension** (dental-org OWNS this platform batch per orchestrator decision) + the consent-templates panel and consent-sheet picker (GAP-2, cross-module with dental-clinical). The shell stays minimal: convert the hardcoded tab list in `routes/_dashboard/settings.tsx` into a small extensible panel registry and mount ONE new panel (consent-templates). Retention (data-governance) and cert (dental-pmd) panels are built by those modules' own 04 passes on top of the registry. [DO NOT OVERBUILD]
- **Anytime:** Batch E — doc reconcile (GAP-5/6), zero code risk.
- **Do not fix yet:** GAP-3 multi-branch UI (blocked on Q1) and GAP-4 PIN recovery UI (blocked on Q2) — both go to the cross-module decision queue.
- **Do not build:** invite-email flow, permission-grid revival, org-scoped membership API expansion, FR8.15 cert build-out (PMD-owned decision).
- **Major risks:** (1) GAP-8 — existing FE tests assert helpers only, so a wired-looking modal could be fake-green; every active FE fix must include mutation-call assertions. (2) Batch B touches a clinical-owned consumer (`consent-sheet.tsx`) and a shared route file — isolate in its own labeled batch, regression-pin the 5 existing settings tabs.
- **Multiple batches required:** yes — A (module-local P1), B (shared/platform + cross-module), E (docs); C/D parked behind decisions. No database/schema work needed anywhere in this plan.
- **Scheduler note:** no cron/scheduled work exists in this module's scope; if any emerges, it must register on the existing scheduler at `services/api-ts/src/core/jobs.ts` — never a new framework. [DO NOT OVERBUILD]

## 3. Active Fix Scope

| Fix ID | Gap | Severity | Scope Label | Fix Batch | Why Included | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: staff cannot be edited — no FE affordance for `updateMember` (role/name/license/NPI/credentials) | P1 | V1 REQUIRED | A | FR6.1 explicitly requires edit; wrong role = wrong PHI access until deactivate+recreate; daily-ops in PH SMB clinics (gap plan §17) | `services/api-ts/src/handlers/dental-org/updateMember.ts` (owner-only :62, tested, role-change audited Batch 2) has **0 FE consumers** (grep + spine); `staff-list.tsx` has no Edit affordance |
| FIX-002 | GAP-8: staff/settings FE tests assert helpers only — no mutation-call assertions | P3 | V1 RECOMMENDED `[TEST GAP]` | A (staff files) + B (settings files) | Pre-Batch-4 blind spot; without these pins FIX-001/004 wiring could be fake-green; near-zero cost when bundled with the FE work | gap plan §19/§20; 7 FE test files in `features/staff/` + `features/settings/` |
| FIX-003 | Settings shell: hardcoded 5-tab list in `settings.tsx` cannot host the three pending cross-module panels | P2 | V1 REQUIRED `[SHARED DEPENDENCY]` (orchestrator-assigned: dental-org owns shared settings shell) | B | Unblocks three consumers: dental-org consent-templates (this plan), data-governance retention panel (FR8.14 / its GAP-4), dental-pmd cert panel (FR8.15, post-decision). One module must own the seam; orchestrator assigned dental-org | `apps/dentalemon/src/routes/_dashboard/settings.tsx` (local `Tab` union + inline `tabs` array, read this round); gap plan §21 "settings surface hosts both… sequence the settings-shell work once" |
| FIX-004 | GAP-2: consent-template CRUD (4 ops) has zero UI; `consent-sheet.tsx` hardcodes a `CONSENT_TEMPLATES` const | P2 | V1 REQUIRED `[CROSS-MODULE RISK]` | B | FR8.4b; hardcoded legal text per clinic violates intent; backend already owner-gated (recorded erratum: backend EXISTS in dental-org — frontend/wiring only, no backend rebuild) | `consentTemplates.ts` + `createConsentTemplate.ts` + `updateConsentTemplate.ts` + `deleteConsentTemplate.ts` + `listConsentTemplates.ts` verified in `handlers/dental-org/`; const verified in `apps/dentalemon/src/features/workspace/components/consent-sheet.tsx` |
| FIX-005 | GAP-5: spec invite-flow (`invited` state, WF-004) vs live direct-add+PIN model; dead enum values | P3 | V1 RECOMMENDED (doc-only) | E | Spec drift misleads future audits/agents; decided model is direct-add+PIN (G4) | tsp `MemberStatus={active,inactive}` :85; gap plan §4 row "Membership invited state" |
| FIX-006 | GAP-6: 6 orphaned `DentalMembershipManagement_*` ops + dormant permission-grid handlers undocumented | P3 | V1 RECOMMENDED (doc-only) | E | Orphans without a disposition note get re-flagged every audit and tempt rebuilds (G3 was already decided: coarse roles ARE the model) | contract-spine orphan list; gap plan §12 |

Excluded from active scope: GAP-3 (Q1), GAP-4 (Q2), GAP-7 verification items (Q3/Q4) — see §8/§9; V2/DO-NOT-ADD items — see §10/§11.

## 4. Fix Batches

| Batch | Purpose | Included Fix IDs | Risk | Recommended Execution |
| --- | --- | --- | --- | --- |
| Batch A — Staff edit (P1) | Wire staff edit modal to existing `updateMember`; harden staff FE tests with mutation-call pins | FIX-001, FIX-002 (staff portion) | Low — module-local FE; backend untouched | **Run in current `04` pass, first** |
| Batch B — Settings shell + consent templates `[SHARED DEPENDENCY]` `[CROSS-MODULE RISK]` | Minimal panel registry in settings route; consent-templates panel; consent-sheet picker reads API; hurl CRUD; settings FE mutation pins | FIX-003, FIX-004, FIX-002 (settings portion) | Medium — touches shared route file + one clinical-owned consumer; mitigated by regression pins on existing 5 tabs | Run in current or next `04` pass, **after Batch A**; coordinate with dental-clinical consent batch (cross-listed; erratum recorded there) |
| Batch C — PIN recovery UI | Self-service recovery flow on PIN screen wiring `recoverPin` | (future FIX, from GAP-4) | Low once unblocked | **Requires product decision first** (Q2: self-service on shared device vs owner-reset-only by design) — do not run yet |
| Batch D — Multi-branch UI | Branch create/list + header switcher writing `org-context.store` | (future FIX, from GAP-3) | Medium (shared FE state touchpoint) | **Requires product decision first** (Q1: V1-launch vs growth scope) — do not run yet |
| Batch E — Doc reconcile | Reconcile MODULE_SPEC/WF-004 to direct-add model; disposition notes for org-scoped ops + dormant permission grid | FIX-005, FIX-006 | None (docs only) | Run anytime — may piggyback on the Batch A or B `04` pass commit train |

No Batch F: no database/schema dependency exists in this plan.

## 5. Test-First Plan

| Fix ID | Test To Add/Update First | Test Type | What It Must Prove | Existing Test File or New Test Location |
| --- | --- | --- | --- | --- |
| FIX-001 | Staff edit modal RED-first: renders prefilled fields (role/displayName/license/NPI), owner-only visibility, submit calls `updateMember` SDK op with changed role, success refreshes list | frontend/component | UI→API wiring is real (mutation-call assertion, not helper-only); non-owner sees no Edit affordance | New: `apps/dentalemon/src/features/staff/components/staff-edit-modal.test.tsx`; extend `staff-list.test.ts` (Edit button per row, owner-gated) |
| FIX-001 | Role-change E2E: owner edits associate → role persists after reload; audit row exists (role-change audit already pinned in backend — assert FE journey only) | E2E/Playwright | The P1 broken journey (gap plan §11 row 1) is fixed end-to-end | Extend `add-staff` E2E spec or new `staff-edit.spec.ts` alongside it |
| FIX-002 | Mutation-call assertions added to existing staff + settings FE tests (create modal posts correct body; settings panels call their update ops) | frontend/regression | Closes the helper-only blind spot; prevents fake-green wiring | Extend: `staff-create-modal.test.ts`, `staff-list.test.ts`, `clinic-settings.test.ts`, `notification-settings.test.ts`, `locale-settings.test.ts` |
| FIX-003 | Settings route regression RED-first: all 5 existing tabs still render + a registered new panel appears and mounts; RBAC gate unchanged | frontend/component + regression | Shell extension does not regress existing panels; registry actually mounts registered panels | New: `apps/dentalemon/src/routes/_dashboard/settings.test.tsx` (or co-located registry test in `features/settings/`) |
| FIX-004 | Consent-templates panel RED-first: list renders from `listConsentTemplates`, create/edit/delete call the CRUD ops (owner-only writes), empty state shown | frontend/component | Panel is wired to the real API, not another const | New: `apps/dentalemon/src/features/settings/components/consent-templates.test.tsx` |
| FIX-004 | Consent-sheet picker test: templates sourced from API hook; hardcoded `CONSENT_TEMPLATES` const removed/fallback-only | frontend/component | The compliance gap (hardcoded legal text) is actually closed at the consumer | Extend tests beside `features/workspace/components/consent-sheet.tsx` (cross-module file — coordinate with dental-clinical) |
| FIX-004 | Hurl consent-template CRUD round-trip (create→list→update→delete, owner-only write rejection) | integration/contract | API contract pinned; gap plan notes no hurl coverage exists | Extend `specs/api/tests/contract/dental-org.hurl` |
| FIX-005/006 | None (doc-only) | — | — | — |

No new backend unit tests required: `updateMember.test.ts`, consent-template handler tests, and role-change audit pins already exist and must stay green.

## 6. Likely Files To Touch

| Fix ID | Files / Areas Likely Touched | Module-Local or Shared? | Blast Radius |
| --- | --- | --- | --- |
| FIX-001 | NEW `features/staff/components/staff-edit-modal.tsx` (+test); `features/staff/components/staff-list.tsx` (Edit affordance); `features/staff/hooks/use-staff-members.ts` (update mutation hook); E2E spec | module-local | Staff page only; backend untouched |
| FIX-002 | 5 existing FE test files under `features/staff/` and `features/settings/` (tests only) | module-local | None (test hardening) |
| FIX-003 | `apps/dentalemon/src/routes/_dashboard/settings.tsx` (tab union + inline array → minimal panel registry); possibly NEW `features/settings/settings-panels.ts(x)` registry | shared/platform | Settings page used by all owner workflows; **future consumers: data-governance retention panel, dental-pmd cert panel** (their 04 passes mount onto this registry) |
| FIX-004 | NEW `features/settings/components/consent-templates.tsx` (+test); NEW `features/settings/hooks/use-consent-templates.ts`; `features/workspace/components/consent-sheet.tsx` (picker reads API — clinical-owned consumer); `specs/api/tests/contract/dental-org.hurl` | cross-module | Settings page + clinical consent capture flow; backend untouched (erratum: CRUD exists) |
| FIX-005 | `docs/product/modules/dental-org/MODULE_SPEC.md`; `docs/product/WORKFLOW_MAP.md` (WF-004) | module-local (docs) | Docs only |
| FIX-006 | `docs/product/modules/dental-org/API_CONTRACTS.md` (disposition notes: org-scoped ops admin-only; permission-grid dormant per G3) | module-local (docs) | Docs only |

## 7. Shared / Cross-Module / Database Dependencies

| Fix ID | Dependency Type | Dependency | Why It Matters | Required Before Fix? |
| --- | --- | --- | --- | --- |
| FIX-003 | shared/platform | `routes/_dashboard/settings.tsx` is the single mount surface for three modules' panels (orchestrator decision: dental-org owns the shell) | Without one owner, three 04 passes would each restructure the same route file; dependents: `docs/aha/module-fix-plans/data-governance-fix-ready-plan.md` (retention panel) and `docs/aha/module-fix-plans/dental-pmd-fix-ready-plan.md` (cert panel) — forthcoming at write time; their 04 passes build ON TOP of this shell, dental-org does NOT build their panels [DO NOT OVERBUILD] | No — FIX-003 IS the prerequisite; it lands in Batch B before the dependent modules' passes |
| FIX-004 | cross-module `[CROSS-MODULE RISK]` | `consent-sheet.tsx` consumer is dental-clinical-owned; dental-org owns the CRUD backend + settings panel | One joint batch, two plans cross-listed; clinical's plan Q4 wrongly assumed no backend — corrected by recorded erratum (backend EXISTS here; frontend/wiring only) | No — coordinate commit ordering with the dental-clinical consent batch; if clinical's pass runs first, it must consume the same hooks |
| FIX-004 | module-local (SDK) | Consent-template ops must be present in generated SDK hooks before FE wiring | If absent, regenerate SDK from existing spec (separate step per repo convention) — not a TypeSpec change | Verify during `04` setup |
| FIX-001 | module-local | `updateMember` SDK op availability (same check as above) | Same | Verify during `04` setup |
| (Batch D) | shared FE state | `stores/org-context.store.ts` branchId is the switcher write target | Touchpoint documented for when Q1 unblocks | Yes — Q1 decision |
| (none) | database/schema | — | No schema work anywhere in this plan | — |

## 8. Product Decisions / Confirmations Needed Before Fixing

| Item | Label | Affected Fix ID(s) | Why Needed | Recommended Action |
| --- | --- | --- | --- | --- |
| Q1: Is multi-branch UI V1-launch scope or growth-phase? (PRD says "multi-branch day one"; market signal says many launch clinics are single-branch `[INFERRED]`) | `[NEEDS PRODUCT DECISION]` | Batch D (GAP-3) | Determines whether branch create/switcher enters V1 active scope | Add to cross-module decision queue; on YES → promote to a FIX in Batch D |
| Q2: PIN recovery — self-service security-question flow on a shared device acceptable, or owner-reset-only by design? | `[NEEDS PRODUCT DECISION]` | Batch C (GAP-4) | FR9.7 promises recovery; UX/security model on shared clinic iPads is a product call | Add to cross-module decision queue; on self-service → promote to Batch C |
| Q3: FR6.3 tier user limits (Solo 2 / Practice 5) — enforced anywhere? | `[NEEDS CONFIRMATION]` | (GAP-7) | Auditor could not locate enforcement; verify-then-classify, not fix-ready | 10-min eng check during a `04` pass; if absent, file as new gap (likely P2 backend guard in `createMember`) |
| Q4: Reactivate-member affordance present? Org-wide export (FR8.11) beyond patient export? | `[NEEDS CONFIRMATION]` | (GAP-7) | Same verify-then-classify | Same quick eng check |
| Q5: Final disposition of dormant permission-grid + org-scoped membership ops (document vs delete) | `[NEEDS CONFIRMATION]` | FIX-006 | Batch E writes the disposition note; delete-vs-dormant is a one-line eng call | Default to "document as dormant" (lowest risk); deletion only with explicit sign-off |
| FR8.15 signing-cert management | `[NEEDS PRODUCT DECISION]` | none here (dental-pmd-owned) | Pairs with PMD signing Q2; dental-org only provides the shell mount point (FIX-003) | Decided in dental-pmd's plan; do not build cert UI in this module's passes |

## 9. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| Multi-branch UI (GAP-3): branch section in settings + header switcher | `[NEEDS PRODUCT DECISION]` | V1 scope unconfirmed (Q1); backend ops verified ready (`DentalBranchManagement_create/list`, `getBranchesByUser`) | Q1 decision → then Batch D with FE + E2E RED-first |
| PIN self-recovery UI (GAP-4): security-question flow wiring `recoverPin.ts` | `[NEEDS PRODUCT DECISION]` | Shared-device UX intent unconfirmed (Q2); backend verified ready (`recoverPin.ts`, `pinRecovery.ts`, `dental-org.pin-recovery.test.ts`) | Q2 decision → then Batch C with FE + E2E RED-first |
| Tier-limit enforcement test (FR6.3) | `[NEEDS CONFIRMATION]` | Enforcement not located; writing a test first requires knowing whether the guard exists | Q3 verification |
| Retention panel (FR8.14) + cert panel (FR8.15) inside settings | cross-module ownership | Owned by data-governance and dental-pmd respectively; dental-org only ships the shell (FIX-003) | Their own `04` passes, after Batch B lands |

## 10. Deferred Items

| Item | Source Gap | Scope Label | Why Deferred |
| --- | --- | --- | --- |
| Invite-email flow (`invited` membership state) | GAP-5 / G4 | V2 DEFERRED | Direct-add+PIN is the decided live model; Batch E reconciles docs instead |
| Staff activity dashboards beyond FR6.4 basics | gap plan §23 | V2 DEFERRED | No product anchor |
| Multi-branch UI | GAP-3 | `[NEEDS PRODUCT DECISION]` (Q1) | Parked as Batch D until decided |
| PIN recovery UI | GAP-4 | `[NEEDS PRODUCT DECISION]` (Q2) | Parked as Batch C until decided |
| FR8.15 cert management build-out | gap plan §23 | `[NEEDS PRODUCT DECISION]` | Dental-pmd-owned decision; only the shell mount point ships here |
| Generic settings-panel plugin framework (lazy loading, per-panel RBAC config, cross-app registry) | FIX-003 scope edge | `[DO NOT OVERBUILD]` | Shell = minimal registry over the existing tab pattern, nothing more |

## 11. Do Not Build

| Item | Source Gap | Reason |
| --- | --- | --- |
| Granular permission-grid revival (FE or new enforcement) | gap plan §6/§23 | G3 decision is final: coarse 10-role model + `assertBranchRole` (×109) IS the model; do not re-litigate |
| Org-scoped membership API expansion (`DentalMembershipManagement_*`) | GAP-6 | `[DO NOT OVERBUILD]` — duplicates the live branch-scoped path; Batch E documents disposition only |
| New consent-template backend / schema / TypeSpec work | GAP-2 erratum | Backend CRUD already exists, tested and owner-gated in dental-org — frontend/wiring only |
| New job-scheduler framework (for any future scheduled org work) | orchestrator constraint | Scheduler already exists at `services/api-ts/src/core/jobs.ts`; register jobs there |
| Retention or cert panels themselves | cross-module bundle | Built by data-governance / dental-pmd `04` passes atop the FIX-003 shell |
| Rework of Batch-4 landings (working hours G1, fee schedule G2, permission-grid removal G3), ADR-007 guardrails, deactivate wiring, role-change audit, E3 hygienist gate | gap plan §26 | Verified-fixed this round; touching them is pure regression risk |

## 12. Root-Cause Notes

| Fix ID | Root Cause / Symptom / Workaround / Unclear | Notes |
| --- | --- | --- |
| FIX-001 | Root cause | Gap class = backend-first development leaving FE affordance unbuilt; wiring the existing handler IS the root-cause fix (no backend defect exists). Deactivate+recreate is the current workaround being eliminated |
| FIX-002 | Root cause | Helper-only FE tests are why orphan-affordance gaps stayed invisible; mutation-call pins fix the detection mechanism, not just the instance |
| FIX-003 | Root cause | Hardcoded per-module tab list is the structural reason three modules would collide in one file; minimal registry removes the collision once |
| FIX-004 | Root cause | Same orphan-affordance class as FIX-001 plus a stale consumer (hardcoded const predates the backend); fix both ends in one batch so no half-wired state ships |
| FIX-005/006 | Root cause (doc drift) | Spec describes an invite flow that was never built and stays silent on deliberate orphans; reconcile docs to decided reality |

## 13. Recommended First Fix Batch

**Batch A — Staff edit (P1)**

- **Included Fix IDs:** FIX-001, FIX-002 (staff-file portion)
- **Why first:** the only P1 in the module; FR6.1-explicit; daily-ops journey ("owner promotes associate") is broken with a PHI-relevant workaround (deactivate+recreate loses identity/PIN continuity); fully module-local with zero shared/platform risk and zero backend changes — the safest highest-value start.
- **Tests to write first (RED):**
  1. `staff-edit-modal.test.tsx` — renders prefilled member, owner-only, submit calls `updateMember` with changed role + credentials (mutation-call assertion).
  2. `staff-list.test.ts` extension — Edit affordance per row, hidden for non-owners.
  3. E2E: owner edits role → persists after reload (extend `add-staff` spec or sibling `staff-edit.spec.ts`).
  4. FIX-002 pins in `staff-create-modal.test.ts` (create posts correct body).
- **Explicit out-of-scope:** settings shell (Batch B), consent templates (Batch B), PIN recovery (Q2), branch UI (Q1), any backend/TypeSpec/schema change, any touch of Batch-4 landings, invite flow, permission grid.

## 14. Instructions for 04 Fix Prompt

- **Module/group:** Dental Org & Staff
- **Module slug:** `dental-org`
- **Fix-ready plan:** `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`
- **Raw gap plan (context only):** `docs/aha/module-gap-plans/dental-org-gap-plan.md`
- **Execute first:** **Batch A** (FIX-001 + FIX-002 staff portion) only. Do not start Batch B in the same pass unless explicitly instructed.
- **Tests to prioritize:** RED-first FE component tests with mutation-call assertions (staff-edit modal), then staff-list affordance/gating, then the role-change E2E. Existing backend tests (`updateMember.test.ts`, role-change audit pins) must stay green untouched.
- **Files likely touched:** NEW `features/staff/components/staff-edit-modal.tsx` (+test); `staff-list.tsx`; `features/staff/hooks/use-staff-members.ts`; one E2E spec. Verify the `updateMember` SDK hook exists before wiring; if missing, regenerate SDK from the existing spec — do NOT edit TypeSpec.
- **Shared/database cautions:** Batch A must touch nothing shared and nothing in the database. Batch B (when selected) is the labeled shared/platform batch: keep the settings shell to a minimal panel registry + the consent-templates panel only; regression-pin all 5 existing settings tabs; coordinate `consent-sheet.tsx` changes with the dental-clinical consent batch; consent-template backend already exists — frontend/wiring + hurl only.
- **Do NOT implement:** invite-email flow; permission-grid revival; org-scoped membership API expansion; retention/cert panels (data-governance / dental-pmd own them); multi-branch UI (Q1) or PIN-recovery UI (Q2) before decisions; any new scheduler (use `services/api-ts/src/core/jobs.ts` if scheduling ever needed); any rework of Batch-4 landings (working hours, fee schedule, permission-grid removal), ADR-007 guardrails, deactivate wiring, role-change audit, or the E3 hygienist gate.
- **Validation gate:** FE suite + typecheck green; relevant E2E green; for Batch B additionally `dental-org.hurl` green against a restarted server.

---

Next recommended step:
Module/group: Dental Org & Staff
Module slug: dental-org
Prompt: docs/aha/prompts/04-module-or-group-fix-tdd.md
Input fix-ready plan: docs/aha/module-fix-plans/dental-org-fix-ready-plan.md
Recommended batch: Batch A — Staff edit (P1) (FIX-001 + FIX-002 staff portion)
