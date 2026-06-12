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

---

# Batch D — Amendments visibility (FR1.16) + Notes/Attachments role parity (FIX-007 + FIX-008) · 2026-06-12 · commit `10f28217`

## D.1 Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch D — Amendments visibility + role-gating parity |
| Fix scope | FIX-007 (P2, GAP-4 / FR1.16 "both visible") — wire the orphaned `listAmendments` into a read-only list **+ the user-approved create-path coherence fix** so the surface works end-to-end. FIX-008 (P3, GAP-11) — Notes/Med-history role parity. |
| Superpowers used | Yes (Vertical TDD + verification-before-completion); §15 handler-vs-SDK-vs-contract check run first; 3-lens adversarial review before commit |
| Product decision taken | **Option 1 (Fix create + read list, E2E loop)** — surfaced via AskUserQuestion because §15 found the only UI create path broken; user chose to make amendments work end-to-end rather than ship a read list beside a broken button |
| Out of scope | BR-019 amendment supervisor approval (V2, feature-flagged 501 stub — not touched); Batches E/F; consent-gate facades (V-CLN-010, untouched) |
| Shared files touched | `tooth-slideout.tsx` (shared read-only review surface — additive); `workspace-top-bar.tsx` (comment-only); `$patientId.tsx` (1-line `originalRecordId` thread) |
| Schema/migration/TypeSpec/SDK | **None** — §15 found the read contract/SDK already correct (see D.2); no regen this batch |
| Code commit | `10f28217` |

## D.2 §15 verification — NO contract drift; an FE create-path bug (TWO defects) found + fixed

This is the **first batch in the series where §15 found the wire clean** — verified, not assumed:
- `listAmendments` returns the offset envelope `{ data: Amendment[], pagination }` (the **list-shape trap** — unwrap `data.data`, NOT a bare array / `{items}`). The SDK `ListAmendmentsResponses[200]` matches the handler exactly. The TypeSpec `Amendment` model omits only `createdBy`/`updatedBy` (audit fields the handler returns as a harmless response **superset**); every field the FE reads (`reason`, `content`, `originalRecordType`, `createdAt`) is in the contract. **No actionable drift → no regen.** (Opposite of B/C, where the contract *omitted* fields the FE needed.)

Instead §15 surfaced a real **FE bug** on the *create* side (an FE defect, not a contract drift — the contract is correct), with **two** defects masked by a 201-returning fetch mock + an `as`-cast:
1. **Empty `originalRecordId`.** `tooth-slideout.tsx` mounted `AmendmentForm` with `originalRecordId={originalRecordId ?? ''}` and `$patientId.tsx` passed **no** `originalRecordId` → `''` → `CreateAmendmentRequestSchema.originalRecordId` is `UUIDSchema` → 400. So the **only** UI path that creates an `amendment`-table row was broken. (The note-addendum + medical-history "amendment" paths are *different* endpoints.)
2. **Missing `visitId` in the body.** The handler reads `visitId` from the path, but `CreateAmendmentRequestSchema` **also requires `visitId` in the body**; `amendment-form.tsx` omitted it (the `as Parameters<…>['body']` cast masked the missing field). Even with a valid `originalRecordId`, the UI create would 400 on missing `visitId`.

Both were fixed FE-side (the contract is right): wire a real `originalRecordId` (the selected tooth's treatment id), gate the affordance on it, add `visitId` to the body, and **drop the cast** (the complete body now matches `CreateAmendmentRequest` exactly — dropping the cast *restored* type safety and would have caught defect 2 at compile time).

## D.3 FIX-008 — matrix-verified visibility PIN (no affordance removed)

Resolved the `ROLE_PERMISSION_MATRIX` truth FIRST (per the task's caution). "Notes / Medical History" (`onNotes`→`SoapNotesSheet`) and "Attachments" (`onAttachments`→`AttachmentsSheet`) are **VIEW + supervised-draft entry points**, not pure write launchers: the matrix grants Draft-notes + Upload to `dental_assistant`, `staff_full` is "Clinical Workspace: View-only", and Sign-&-Lock is already role-gated *inside* `SoapNotesSheet`. So the current unconditional render is **correct** — hiding these would wrongly strip legitimate VIEW access. FIX-008 therefore **pins** the intended visibility (a regression guard, green-on-arrival) rather than removing a button: added role-parity assertions (`staff_full` sees Notes+Attachments, hides all 5 write launchers; Notes/Attachments stay across writer + supervised-assistant) and a clarified rationale comment. This is exactly the outcome the fix-ready plan anticipated for a P3 "FE parity, not security" fix.

## D.4 Changes

| Layer | Change | Files |
| --- | --- | --- |
| FE (FIX-007 read) | NEW `amendments-list.tsx` — read-only, visit-scoped list (direct-SDK `listAmendments`, unwrap `data.data`, deterministic newest-first display, loading/empty/error states, stale-response guard, `reloadToken` refetch). Mounted in the tooth-slideout read-only area alongside the original record (FR1.16 "both visible"). | `amendments-list.tsx` (new) |
| FE (FIX-007 create coherence) | Gate "Add Amendment" on `canAmend = readOnly && visitId && originalRecordId`; mount `AmendmentsList`; bump `reloadToken` on save | `tooth-slideout.tsx` |
| FE (FIX-007 create coherence) | Thread `originalRecordId = treatments.find(t => t.toothNumber === selectedTooth)?.id` | `$patientId.tsx` |
| FE (FIX-007 create bug) | Add `visitId` to the createAmendment **body**; drop the masking `as` cast | `amendment-form.tsx` |
| FE (FIX-008) | Comment-only: clarify Notes/Attachments are view/supervised-draft entry points (+ flag the pre-existing route-guard / sheet-gating gaps) | `workspace-top-bar.tsx` |
| Contract (FIX-007 pin) | Strengthen list-amendments asserts: `data[0].reason/originalRecordType/content/id` + `pagination.totalCount` | `dental-clinical.hurl` |

## D.5 Tests (RED→GREEN)

| Test | Type | Result |
| --- | --- | --- |
| `amendments-list.test.ts` (NEW, +6: envelope-unwrap + row-count coherence oracle; type/reason labels; empty; error; read-only no-controls; refetch-on-reloadToken) | frontend/component | 6/6 |
| `tooth-slideout.test.ts` (+4: Add-Amendment gated on `originalRecordId`; list renders in readOnly; absent in edit) | frontend/component | 13/13 |
| `amendment-form.test.ts` (+1: body must include `visitId`) — RED on the masked bug → GREEN after fix | frontend/component | 3/3 |
| `workspace-top-bar.test.ts` (+2 FIX-008 parity pins) | frontend/component + RBAC | 7/7 |
| `dental-clinical.hurl` (strengthened list-amendments row asserts) | contract | 52 requests, 100% |
| `workspace-readonly.spec.ts` (seed performed treatment on tooth 21; **read a pre-filed amendment back + file one via the UI → reads back** = closed write→read loop) | E2E/Playwright | 3/3 chromium (loop stable 2/2 repeat) |
| `amendment.repo` (sanity — backend untouched) | backend unit | 7/0 |

## D.6 Gate

Full FE **2357/0** · amendments-list 6/0 · tooth-slideout 13/0 · top-bar 7/0 · amendment-form 3/0 · contract **52/0** · E2E **3/0** (loop 2/2 repeat) · backend amendment.repo 7/0 · typecheck (FE + api-ts) **0** · sdk-ts typecheck **n/a** (no regen) · lint **0 errors** (2 pre-existing warnings: `useNavigate`/`APP` unused, untouched) · module boundaries **n/a** (zero api-ts changes).

## D.7 Adversarial review (pre-commit)

A 3-lens adversarial workflow (§15/contract · FE-coherence · blast-radius/test-honesty) returned **no blockers, no majors** and independently verified the create-path fix (visitId-in-body + dropped cast = type-safe **and** runtime-correct), the read-path unwrap, and a tight blast radius (AmendmentForm/AmendmentsList consumed only by tooth-slideout; ToothSlideout's new prop is optional). **Actioned:** closed the E2E write→read loop (assert the UI-filed correction reads back — confirmed not false-green: a failed create keeps the form open + shows the error banner); made the displayed list **deterministic** (FE sort newest-first) + added a **stale-response guard**; tightened the FIX-008 wording to "workspace-VIEW-capable roles" and the create-path comment to "UUID-format" (the backend does not verify `tooth_treatment` record existence). **Documented, not fixed (pre-existing, flagged for roadmap):** (a) the `_workspace` route guard does not enforce `canAccess(role,'workspace')`; (b) `SoapNotesSheet`/`AttachmentsSheet` do not client-gate Save/upload by draft/upload capability (backend 403 is the hard gate); (c) the contract's `data[0]` assertion + `originalRecordId` pick rely on unordered backend queries — robust today (single amendment / one treatment per tooth in the suite) and the user-facing list is now FE-ordered, but a deterministic backend `orderBy` is the durable fix.

## D.8 Cross-module / notes

- **Backend untouched** — no handler/schema/TypeSpec/SDK change; the §15 finding was an FE create-path bug, not a contract drift.
- Consent-gate facades / V-CLN-010 untouched. No scheduler, no migration.
- Cross-references: dental-pmd Batch A/D already own the PMD chain; FIX-002 button landed in Batch A. Batch E (consent-template picker) still pending (coordinate dental-org).

## D.9 Completion

`COMPLETE` (Batch D) — FIX-007 + FIX-008 landed RED-first across component + contract + a genuine UI write→read E2E loop. The orphaned `listAmendments` (FR1.16) is now reachable from the real UI **and the amendment create path actually works** (both masked defects fixed); Notes/Attachments visibility is pinned to the role matrix. **Remaining:** E (consent-template picker — coordinate dental-org), F (docs reconcile: lab enum + 50MB attachment cap).

---

# Batch E — Consent-template picker: surface per-clinic body wording (FIX-009) · 2026-06-12 · commit `c8bfcb89`

## E.1 Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch E — Consent-template picker (FR8.4b, per-clinic consent wording); **consumer-side only** — consumes dental-org's existing `listConsentTemplates` backend |
| Fix scope | FIX-009 (P2, `[CROSS-MODULE RISK]`) — the consent sheet dropped the clinic template's configured `body` wording (picker passed only `{id,name}`); surface it. |
| Superpowers used | Yes (Vertical TDD + verification-before-completion); §15 handler-vs-SDK-vs-contract check run FIRST; 3-lens adversarial review before commit |
| Product decisions taken | **Q1 = Option A (read-only reference panel, FE-only)** and **Q2 = graceful fallback + nudge** — both surfaced via AskUserQuestion (content-fill design + empty-state copy are genuine forks) |
| Out of scope | Any consent-template **backend** (owned by dental-org, §11 Do Not Build — NOT touched); witness-signature capture (no `ConsentForm` witness fields → roadmap, deliberately not surfaced); body-snapshot-onto-signed-form (Q1 deferral → roadmap); consent-gate facades (V-CLN-010, untouched); Batch F |
| Shared files touched | `consent-sheet.tsx` (clinical-owned consumer — additive); `$patientId.tsx` (1-line map passthrough) |
| Schema/migration/TypeSpec/SDK | **None** — §15 found the SDK shape already carries `body`; FE-only, no regen |
| Code commit | `c8bfcb89` |

## E.2 §15 verification — the fix-ready "hardcodes CONSENT_TEMPLATES" is STALE; real gap is dropped `body`

The mandatory §15 pre-wire check **corrected the fix-ready plan's premise** and isolated the true gap (verified, not assumed):
- The picker is **already wired** to read clinic templates — dental-org's FIX-004 shipped the producer (settings panel + `use-consent-templates` hook + CRUD) **and** the consumer reading `{id,name}` (`templates` prop + `$patientId` `useConsentTemplates` + a passing "uses API-provided templates" test). So "replace the hardcoded const" was **already done**.
- The fix-ready/task hypothesis that "the const carries full content, dynamic leaves it blank" is **inaccurate**: the const `CONSENT_TEMPLATES` is **also** just `{id,name}`, and `handleSelectTemplate` only ever set `templateId`+`templateName` — neither path ever filled the 5 structured ADA fields (those are always free-text). Nothing was "going blank."
- **The real gap (plan line 76 "selecting a template fills body text"):** the dental-org template model carries a single plain-text **`body`** (`DentalOrgModuleDentalConsentTemplate.body`, required string, SDK `types.gen.ts:4213`; Drizzle `body text NOT NULL`; handler returns the full row as a bare array) — the actual consent wording the patient reads and signs. The picker's `ConsentTemplateOption` was `{id,name}` only, and `$patientId.tsx` mapped `{ id, name }` — **so the configured per-clinic wording was dropped entirely.** Selecting a clinic template populated only the name.
- **Shape match:** `ConsentForm` (the signed record) has the 5 structured ADA fields but **no single `body` field**, and neither does `CreateConsentFormRequest`. So the template's one `body` blob has nowhere to be *persisted* without a contract change. Per §15, the SDK shape is **not** deficient (it carries `body`); the gap is purely the **FE mapping dropping content** → the §15 decision tree's "fix the prop wiring, FE-only, no regen" branch. **No drift → no regen** (consistent with Batch D; opposite of B/C where the contract omitted fields).

## E.3 Product forks (AskUserQuestion) — resolved before coding

| Fork | Options | Decision | Rationale |
| --- | --- | --- | --- |
| Q1 — how to surface the template `body` | (A) read-only reference panel, FE-only · (B) snapshot `templateBody` onto the signed form, contract change · (C) prefill `procedureNature` from body | **A** | Matches the plan's FE-only scope + §15 "FE mapping" branch; semantically honest (body = full clinic document, the 5 ADA fields = structured discussion); B's persistence-snapshot recorded as roadmap (templates are versioned, so the `templateId` reference is traceable today) |
| Q2 — empty-state when no clinic templates | (A) keep generic fallback + nudge · (B) fallback, no nudge · (C) require configured templates (block) | **A** | Industry norm (Dentrix/Open Dental/Curve ship default templates, never block care); generic fallback carries names only (no legal text → can't masquerade as clinic consent); nudge drives FR8.4b configuration without blocking same-day care |

## E.4 Changes

| Layer | Change | Files |
| --- | --- | --- |
| FE (picker contract) | `ConsentTemplateOption` += optional `body?` (per-clinic wording; absent on generic fallback) | `consent-sheet.tsx` |
| FE (body surface) | Derive `selectedTemplate = templateOptions.find(t => t.id === templateId)`; render a **read-only** "Clinic consent wording" panel (`whitespace-pre-wrap`, plain-text → React-escaped, XSS-safe) when the selected template has a `body`. Mode-gated to `consent`; resets on close (derives from `templateId`, cleared in the `!open` effect) | `consent-sheet.tsx` |
| FE (empty-state) | `usingFallbackTemplates` flag → subtle amber "Using default templates. Add your clinic's own wording in Settings → Consent Forms" nudge, shown only on fallback | `consent-sheet.tsx` |
| FE (consumer passthrough) | Map now passes `body: t.body` (was `{id,name}` only) | `$patientId.tsx` |

## E.5 Tests (RED→GREEN)

| Test | Type | Result |
| --- | --- | --- |
| `consent-sheet.test.ts` (+5: select clinic template surfaces body read-only; switching swaps wording; empty-string body renders no panel [review NIT pin]; generic fallback shows no panel; nudge shows only on fallback) | frontend/component | 15/15 |
| `consent-template-picker.spec.ts` (NEW — owner POSTs a real clinic template to the dental-org API → opens the sheet → asserts the template appears, the nudge is absent, selecting it renders the configured body read-only) | E2E/Playwright | 1/1 chromium |
| `consent-templates.test.tsx` (dental-org settings panel — regression) | frontend/component | green (20/0 combined with consent-sheet) |
| `dental-org.hurl` (consent-template CRUD round-trip the picker consumes) | contract | 33 requests, 100% |

## E.6 Gate

Full FE **2362/0** (+5 new) · consent-sheet 15/0 · contract `dental-org` **33/0** · E2E **1/0** · typecheck (FE + api-ts) **0** · sdk-ts typecheck **n/a** (no regen) · lint **0 errors** (1 pre-existing `useNavigate` warning, untouched) · backend/module-boundaries **n/a** (zero api-ts changes).

## E.7 Adversarial review (pre-commit)

A 3-lens adversarial workflow (§15/contract · FE-coherence · blast-radius/test-honesty) returned **2× SHIP + 1× SHIP_WITH_NITS — no blockers, no majors**. The blast-radius lens **mutation-tested** the new component tests (disabled the body panel + nudge → 3 of 4 fail) confirming they're honest, not vacuous; verified `$patientId.tsx` is the **only** `ConsentSheet` mount/`templates=` passthrough (optional `body?` breaks no call site); and confirmed the E2E drives the **real** app + real dental-org POST (no stubbed fetch). The contract lens confirmed the FE-only decision masked **no** SDK shape gap (`body` is a required string end-to-end, no `any`/cast) and the `templates!` non-null assertion is provably safe. **Actioned:** added the empty-string-body guard pin (FE NIT). **Documented, not fixed (roadmap):** (a) **body-snapshot onto the signed `ConsentForm`** — Q1-deferred; for full medico-legal fidelity a future contract change would persist `bodySnapshot`+`templateVersion` at sign time so a later template edit/soft-delete can't alter what a patient signed (today the `templateId` reference is to a versioned record); (b) `templateName` is an imperative point-in-time snapshot that can theoretically diverge from the re-derived `selectedTemplate` on a mid-sheet refetch — **pre-existing**, not introduced here, and the read-time body derivation is the more-correct of the two.

## E.8 Cross-module / coordination

- **dental-org FIX-004 is the producer and is DONE** (settings consent-templates panel + CRUD + `use-consent-templates` hook + picker reading `{id,name}` all shipped). Batch E closes the one thing that wiring left out — surfacing the `body`. The two are only useful together; both are now live.
- **Backend untouched** — no handler/schema/TypeSpec/SDK change; §11 "Do Not Build any consent-template backend in dental-clinical" honored.
- Consent-gate facades / V-CLN-010 untouched. No scheduler, no migration.

## E.9 Completion

`COMPLETE` (Batch E) — FIX-009 landed RED-first across component + a real cross-module E2E (owner configures a clinic template via the dental-org API → the picker surfaces its wording). The clinic's per-clinic consent `body` (FR8.4b) is now reachable in the consent capture flow as read-only reference text, with a graceful fallback + nudge when none is configured. **Remaining:** F (docs reconcile: lab-status enum + 50MB attachment-cap).
