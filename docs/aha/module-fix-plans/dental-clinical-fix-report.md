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

---

# Batch B — Consent revoke + history (FIX-004, FIX-005) · 2026-06-12 · commit `8c869db5`

## B.1 Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch B — Consent revoke + history |
| Fix scope | FIX-004 (P1, consent revoke + history FE), FIX-005 (P2 `[TEST GAP]`, hurl pins) |
| Superpowers used | Yes (TDD + verification-before-completion); §15 handler-vs-SDK-vs-contract verification run first via a parallel workflow |
| Out of scope | Batches C/D/E/F; GAP-5 allergy dialog (Track 3, decision #11); consent gate facades (V-CLN-010, untouched) |
| Shared files touched | No (consent-sheet is module-local). `$patientId.tsx` got a 1-line `canRevoke` prop thread (module-local mount) |
| Schema/migration touched | No |
| Code commit | `8c869db5` |

## B.2 §15 verification finding — contract drift, FIXED (not papered over)

The mandatory §15 pre-wire check surfaced a real response-shape drift: `listConsentForms` + `revokeConsentForm` return `revoked`/`revokedAt`/`revokedBy` (full-row `select()`; DB schema has `revoked NOT NULL default false`), but the TypeSpec `ConsentForm` model **omitted** them → the SDK type omitted them → the history UI could not distinguish a *revoked* form from a *pending* one (and would wrongly offer Revoke on an already-revoked form → 409).

Rather than a lying FE cast, the **contract was made honest**: added the three read-only fields to the `ConsentForm` TypeSpec model + regenerated (openapi → api-ts validators → sdk types/client/transformers). Additive, non-breaking (the model is a response shape, not a request validator — the contract still creates consents 201 with it in place). It also makes the FIX-005 hurl `$.revoked==true` assertion schema-backed (no Schemathesis extra-field flag).

## B.3 Changes

| Layer | Change | Files |
| --- | --- | --- |
| TypeSpec | `ConsentForm` model + `@example` gain `revoked`/`revokedAt`/`revokedBy`; regen | `specs/api/src/modules/dental-clinical.tsp` + generated (`validators.ts`, sdk `types`/`sdk`/`transformers`/`react-query`) |
| FE (FIX-004) | "History" tab (3rd mode) lists consent forms with derived Signed/Pending/Revoked status + informed refusals; Revoke action gated to **pending** forms AND `canRevoke`. Direct-SDK + local-state (no react-query). | `consent-sheet.tsx` |
| FE wiring | `canRevoke={orgRole ∈ {dentist_owner, dentist_associate}}` threaded to the consent sheet | `$patientId.tsx` |
| Contract (FIX-005) | revoke (PATCH→200), sign-after-revoke (422 `CONSENT_FORM_REVOKED`), re-revoke (409), refusal record (201) + refusals list (200); step-8 strengthened with `$.code==CONSENT_FORM_SIGNED` | `dental-clinical.hurl` |

## B.4 Tests (RED→GREEN)

| Test | Type | Result |
| --- | --- | --- |
| `consent-sheet.test.ts` +4 (history status; revoke only on pending; revoke PATCHes + refetches; hidden when `canRevoke=false`) | frontend/component | 10/10 |
| `dental-clinical.hurl` (6 new consent scenarios) | contract | 47 requests, 100% |
| `consent-revoke-ui.spec.ts` (NEW — seed pending consent via API → revoke through History UI → flips to Revoked) + `consent-signing.spec.ts` | E2E/Playwright | 5/5 chromium |
| consent backend (`clinical-consent-lab`, `repos/consent-form`, `consent-content`, `consent-revoke-route`) | backend unit | 53/0 (post-regen, no regression) |

## B.5 Gate

Full FE 2340/0 · consent-sheet 10/0 · contract 47 req/0 · E2E 5/0 · consent backend 53/0 · typecheck (FE + api-ts + sdk-ts) clean · lint clean (consent-sheet; one pre-existing unrelated `useNavigate` warning in `$patientId.tsx`) · module boundaries clean.

## B.6 Cross-module / incidental notes

- Consent gate facades (`clinical-visit.facade`, `consent-billing.facade`) and the V-CLN-010 sign/revoke guards were **not** touched — Batch B is read-mostly wiring.
- The `ConsentForm.revoked` field addition is additive for the one other consumer (`pre-completion-checklist.tsx`, reads `.signed` only).
- **Incidental regen drift-correction:** the SDK regen also refreshed stale erasure/legal-hold JSDoc role comments (`'user'`→`'admin'`) in `sdk.gen.ts`/`react-query.gen.ts` to match the already-committed admin-role TypeSpec (Track-1 `a1fc138c`). Comment-only; server-side admin enforcement was already correct (proven by the 33/33 + 21/21 governance contract tests). Bundled here because they are unavoidable output of the same regen.
- Batch E (consent-template picker, FIX-009) remains pending and is to be coordinated with dental-org (settings-shell owner).

## B.7 Completion

`COMPLETE` (Batch B) — FIX-004 + FIX-005 landed RED-first across component + contract + E2E. The orphaned revoke/history surface (WF-035) is now reachable from the real product UI. **Remaining:** C (Rx list + dispense/cancel), D (amendments visibility + role parity), E (consent-template picker — coordinate dental-org), F (docs reconcile: lab enum + 50MB attachment cap per decision Batch B).

---

# Batch C — Rx list + dispense/cancel lifecycle (FIX-006) · 2026-06-12 · commit `c25eed44`

## C.1 Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch C — Rx list + dispense/cancel lifecycle (WF-016) |
| Fix scope | FIX-006 (P1) — wire the orphaned `listPrescriptions` + `updatePrescription` ops into `rx-sheet.tsx` |
| Superpowers used | Yes (Vertical TDD + verification-before-completion); §15 handler-vs-SDK-vs-contract check run first; 3-lens adversarial review before commit |
| Out of scope | Per-patient Rx list (no per-patient route exists — per-visit only); GAP-5 allergy override dialog (Track 3, decision #11); Batches D/E/F |
| Shared files touched | No (rx-sheet is module-local). `$patientId.tsx` got a 1-line `canManage` prop thread (module-local mount) |
| Schema/migration touched | No |
| Code commit | `c25eed44` |

## C.2 §15 verification finding — contract drift, FIXED (Batch-B class, both directions)

The mandatory §15 pre-wire check surfaced the **same drift class as Batch B**, in both directions: the DB row + **every** handler response carry `status` (`pending`/`dispensed`/`cancelled`; column is `NOT NULL DEFAULT 'pending'`), and the PATCH endpoint **accepts** `status` (the primary dispense/cancel operation, tested at the HTTP level — `prescription.status.test.ts`), but the TypeSpec **omitted `status` both ways**: the `Prescription` response model *and* `UpdatePrescriptionRequest`. So the SDK type couldn't render Rx status (read) and couldn't express a transition (write).

Rather than a lying FE cast, the **contract was made honest**: added a `PrescriptionStatus` enum, `status` to the `Prescription` model (+ `@example`), and optional `status` to `UpdatePrescriptionRequest` → regen (openapi → api-ts validators → sdk types/index). The additive request-side enum is non-breaking — **no test pinned invalid-enum-at-route at 422**, so the validator now returning 400 for a bad enum string breaks nothing (verified). Because `status` is now in the validated body, the handler's raw-JSON re-read + the now-unreachable `INVALID_PRESCRIPTION_STATUS` guard were removed (review MINOR 1); the FSM-routing decision is behaviorally identical.

## C.3 Changes

| Layer | Change | Files |
| --- | --- | --- |
| TypeSpec | `PrescriptionStatus` enum; `Prescription.status` (+ `@example`); optional `UpdatePrescriptionRequest.status`; regen | `specs/api/src/modules/dental-clinical.tsp` + generated (`validators.ts`, sdk `types`/`index`) |
| Backend | read the validated `body.status` (drop the redundant raw `ctx.req.json()` parse + the now-dead enum guard); logic equivalent | `services/api-ts/src/handlers/dental-clinical/prescriptions/updatePrescription.ts` |
| FE (FIX-006) | mode toggle (New \| Prescriptions); per-visit list with derived status badges; Dispense/Cancel **FSM-gated** (pending only) AND **role-gated** (`canManage`); optimistic flip + best-effort reconcile. Direct-SDK + local state (no react-query). | `rx-sheet.tsx` |
| FE wiring | `canManage={orgRole ∈ {dentist_owner, dentist_associate}}` threaded to the Rx sheet | `$patientId.tsx` |
| Contract (FSM pins) | pending→pending (422), dispense (200), dispensed→cancelled (422 `INVALID_PRESCRIPTION_TRANSITION`), create+cancel (200); + create `status==pending` + list `status exists` | `dental-clinical.hurl` |

## C.4 Tests (RED→GREEN)

| Test | Type | Result |
| --- | --- | --- |
| `rx-sheet.test.ts` +6 (list unwrap `{data,pagination}`+badges; dispense PATCH+flip; cancel PATCH; FSM-gated terminal rows; role-gated hidden; empty state) | frontend/component | 14/14 |
| `dental-clinical.hurl` (5 new prescription FSM requests) | contract | 52 requests, 100% |
| `rx-lifecycle-ui.spec.ts` (NEW — seed pending Rx via API → dispense through the Prescriptions tab → flips to dispensed, action drops) | E2E/Playwright | 1/1 chromium |
| dental-clinical backend (all 19 handler files, incl prescription status 8 / fsm 8 / history 30) | backend unit | 209/0 (post-regen + handler change, no regression) |

## C.5 Gate

Full FE 2346/0 · rx-sheet 14/0 · contract 52 req/0 · E2E 1/1 · dental-clinical backend 209/0 · typecheck (FE + api-ts + sdk-ts) clean · lint 0 errors (changed files; one pre-existing unrelated `useNavigate` warning in `$patientId.tsx`, untouched) · regen scope minimal (validators +4 lines, sdk index +1 export `PrescriptionStatus`, nothing else changed).

## C.6 Adversarial review (pre-commit)

A 3-lens adversarial workflow (contract/§15 · FE/FSM · blast-radius/test-honesty) returned **no blockers, no majors**. Actioned: **MINOR 1** (handler reads validated `body.status`; redundant raw read + dead guard removed), **MINOR 2** (optimistic flip so a refetch failure after a committed PATCH no longer shows a false "failed" banner — clinically relevant), **NIT 3** (drop the impossible `?? 'pending'` fallback/cast now that `status` is required), **NIT 5** (added the `pending→pending`→422 self-transition pin to hurl). **NIT 4** (E2E visit-selected guard) declined — confirmed non-false-green (the 8s `sheet.waitFor` is the real guard).

## C.7 Cross-module / notes

- `Prescription.status` is additive for any other consumer of the type; no consumer asserts its absence.
- **Per-patient Rx history is NOT built** — only a per-visit route (`GET /dental/visits/{visitId}/prescriptions`) exists; a cross-visit list would need a new backend route. Decision-free deferral, out of this FE-only batch (the fix-ready "per visit + per patient" wording outran the available backend).
- Consent gate facades / V-CLN-010 untouched. No scheduler, no migration, no schema change.

## C.8 Completion

`COMPLETE` (Batch C) — FIX-006 landed RED-first across component + contract + E2E. The orphaned `listPrescriptions`/`updatePrescription` lifecycle (WF-016) is now reachable from the real product UI with FSM- and role-gated dispense/cancel. **Remaining:** D (amendments visibility + role parity), E (consent-template picker — coordinate dental-org), F (docs reconcile: lab enum + 50MB attachment cap).
