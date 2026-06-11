# AHA Module/Group Fix Report: Dental Clinical

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Clinical |
| Module slug | dental-clinical |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-clinical-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-clinical-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-clinical-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — WorkspaceTopBar dead-trigger fix + honest E2E (FIX-001, FIX-002, FIX-003) |
| Superpowers used | Yes (TDD + verification-before-completion) |
| Working tree status checked | Yes — clean before Batch A |
| Fix scope | FIX-001 (P1), FIX-002 (P1, cross-module for dental-pmd), FIX-003 (P2 `[TEST GAP]`) |
| Out of scope | Batches B/C/D/E/F; anything decision-gated; any backend change |
| Shared files touched | Yes — `workspace-top-bar.tsx` (shared workspace shell, render-only) + `test-setup.ts` (lucide mock) |
| Schema/migration touched | No |
| Code commit | `d774c1e5` |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Status |
| --- | --- | --- | --- |
| FIX-001 | GAP-1: Lab button never rendered — dead `onLab` prop; lab FSM unreachable | P1 | Fixed |
| FIX-002 | dental-pmd GAP-2: dead `onPmd` prop in the same component (owned here per orchestrator bundle) | P1 | Fixed |
| FIX-003 | GAP-9: `lab-order-tracking.spec.ts` was API-only false-green (masked GAP-1) | P2 `[TEST GAP]` | Fixed |

## 3. Baseline / RED

New `workspace-top-bar.test.ts` assertions (Lab + PMD buttons render + fire `onLab`/`onPmd`, dentist-gated) failed RED before the render was added (`Unable to find a label: Lab orders` / `Portable medical document`). Confirmed for the expected reason.

## 4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-001/002 | Render dentist-gated Lab (`FlaskConical`) + PMD (`IdCard`) icon buttons in the shared top bar, gated on `canAddTreatment` (= the backend lab gate; PMD generation is dentist-only). Both props already plumbed from `$patientId.tsx`. | `workspace-top-bar.tsx`, `test-setup.ts` (lucide mock + 2 icons) |
| FIX-003 | Relabeled the false-green spec → `lab-order-tracking-api.spec.ts` (honest API coverage, header rewritten); added genuine rendered UI journey `lab-order-ui.spec.ts` | `tests/e2e/lab-order-tracking-api.spec.ts` (renamed), `tests/e2e/lab-order-ui.spec.ts` (new) |

## 5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `workspace-top-bar.test.ts` (extended) | frontend/component + RBAC | Lab + PMD buttons render and fire their callbacks for a dentist; hidden for `dental_assistant` |
| `lab-order-ui.spec.ts` (new) | E2E/Playwright | Real journey: workspace → click "Lab orders" top-bar button → Lab Orders sheet opens (the affordance the dead prop hid) |
| `lab-order-tracking-api.spec.ts` (renamed) | E2E/API | Honestly named API-FSM coverage (no longer masquerading as a UI journey) |

## 6. Tests Run

| Command | Result |
| --- | --- |
| `bun test workspace-top-bar.test.ts` | 5/0 |
| `bun test src/` (full FE — shared shell) | 2275/0 |
| `bun run typecheck` (FE) | clean |
| `lab-order-ui.spec.ts` (chromium) | 1/1 (7.2s) — button renders + opens sheet |

## 7. Shared / Cross-Module Impact

| Area | Files | Note |
| --- | --- | --- |
| Shared workspace shell `[SHARED DEPENDENCY]` | `workspace-top-bar.tsx` | Render-only additive change; full FE suite (regression net) green; gates were dentist-only, matching backend |
| Cross-module (dental-pmd) | FIX-002 satisfies **dental-pmd GAP-2** | The PMD top-bar button is now done — dental-pmd's plan must NOT re-implement it; its Batch D (honest PMD E2E) is now unblocked (button exists + generation trigger landed in dental-pmd Batch A) |

## 8. Completion Decision

`COMPLETE` (Batch A) — FIX-001/002/003 fixed RED-first, verified by unit + a genuine rendered UI E2E + the full FE suite. Two complete tested workflows (lab FSM, PMD viewer/import) are now reachable from the real UI; the false-green masking is removed.

## 9. Remaining (later passes)

Batch B (consent revoke/history), C (Rx list + lifecycle), D (amendments visibility + role parity), E (consent-template picker — coordinate with dental-org), F (docs reconcile). None decision-blocked except the picker's coordination. Decision-gated items (allergy posture Q3, occlusion/postop/inventory Q1) remain out of scope.

## 10. Recommended Next Step

Per the execution order, proceed to **dental-patient Batch A** (patient-edit UI; SDK hooks exist). dental-pmd Batch D (honest PMD E2E) is now unblocked by this batch + dental-pmd Batch A.
