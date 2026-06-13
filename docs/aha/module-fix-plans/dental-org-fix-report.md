# AHA Module/Group Fix Report: Dental Org & Staff

## 1. Fix Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Org & Staff (org/branches/memberships/settings/onboarding/PIN) |
| Module slug | dental-org |
| Raw gap plan used | `docs/aha/module-gap-plans/dental-org-gap-plan.md` |
| Fix-ready plan used | `docs/aha/module-fix-plans/dental-org-fix-ready-plan.md` |
| Output fix report | `docs/aha/module-fix-plans/dental-org-fix-report.md` |
| Fix date | 2026-06-11 |
| Batch executed | Batch A — Staff edit (P1); Batch B appended below when executed |
| Superpowers used | Yes (`superpowers:test-driven-development` + `superpowers:verification-before-completion`) |
| Working tree status checked | Yes — clean before Batch A |
| Fix scope | P1 (FIX-001) + V1 RECOMMENDED test pins (FIX-002 staff portion) |
| Out of scope | Batch C (PIN recovery, Q2), Batch D (multi-branch, Q1), invite flow, permission grid, Batch-4 landing rework |
| Shared files touched | No (Batch A is fully module-local) |
| Schema/migration touched | No |
| Limitations | None for Batch A |

## 2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Batch | Reason Selected | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FIX-001 | GAP-1: staff cannot be edited — no FE affordance for `updateMember` | P1 | V1 REQUIRED | A | Only P1 in module; FR6.1-explicit; eliminates deactivate+recreate workaround | Fixed |
| FIX-002 (staff portion) | GAP-8: staff FE tests assert helpers only | P3 | V1 RECOMMENDED `[TEST GAP]` | A | Prevents fake-green wiring of FIX-001 | Fixed |

## 3. Baseline Before Changes

| Check/Test | Result Before Changes | Related Fix ID | Notes |
| --- | --- | --- | --- |
| `bun test src/features/staff/` | All existing (helper-only) tests pass | FIX-001/002 | Confirmed GAP-8: no rendered/mutation assertions existed |
| New RED tests (3 files) | staff-edit-modal.test.tsx: module-not-found (component absent); staff-list.render: owner-Edit-affordance + open-modal FAIL (no Edit button); create-modal pin: PASS (pins existing wiring) | FIX-001/002 | Failures confirmed for the expected reasons before implementation |

## 4. Changes Made

| Fix ID | Fix Implemented | Files Changed | Shared Dependency? | Notes |
| --- | --- | --- | --- | --- |
| FIX-001 | New `StaffEditModal` (prefilled role/displayName/license/NPI/credential; changed-fields-only PATCH; owner-row role locked); Edit affordance per row (owner-only) in `staff-list.tsx`; `update` mutation added to `useStaffMutations` (invalidates list); `Member` view-model extended with licenseNumber/npi/credentialType | `staff-edit-modal.tsx` (new), `staff-list.tsx`, `use-staff-members.ts` | No | Backend untouched; uses existing `updateMemberMutation` SDK hook (verified present, no regen needed) |
| FIX-002 | Rendered mutation-call pins: edit PATCH url+body, create POST body + reset-pin body, affordance RBAC gating | `staff-edit-modal.test.tsx`, `staff-list.render.test.tsx`, `staff-create-modal.render.test.tsx` (all new) | No | global.fetch mock per repo convention (no mock.module); pre-existing helper-only tests left intact |

## 5. Tests Added / Updated

| Test File | Type | What It Proves | Related Fix ID |
| --- | --- | --- | --- |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.test.tsx` | frontend/component | Prefill from member; Save PATCHes `/dental/org/members/{id}` with changed role + credentials; no-edit ⇒ no PATCH; blank-name validation blocks save | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-list.render.test.tsx` | frontend/component + permission/RBAC | Owner sees Edit per row; non-owner sees none; Edit opens modal prefilled with that member | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-create-modal.render.test.tsx` | frontend/regression | Create posts `{displayName, role}` to branch-scoped endpoint then sets PIN via reset-pin | FIX-002 |
| `apps/dentalemon/tests/e2e/add-staff.spec.ts` (extended) | E2E/Playwright | FR6.1 journey: owner edits associate role → badge updates → persists after full reload | FIX-001 |

## 6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/features/staff/` (apps/dentalemon) | Passed | 46/0 |
| `bun test src/` (full FE suite) | Passed | 2248 pass / 0 fail |
| `bun run typecheck` (apps/dentalemon) | Passed | tsc --noEmit clean |
| `bunx playwright test tests/e2e/add-staff.spec.ts -g "owner edits" --project=chromium` | Passed | 1/1 (12.3s, API+app auto-booted) |

## 7. Validation Summary

All Batch A validation passed: focused RED→GREEN component tests, full FE suite (no regressions), FE typecheck, and the browser-level role-edit persistence journey. No backend, contract, or schema surface was touched, so backend/contract gates were not required for this batch.

## 8. Shared / Cross-Module / Database Impact

None — Batch A touched only `features/staff/` and one E2E spec.

## 9. Remaining Gaps

| Gap | Source Fix ID / Gap | Reason Not Completed | Recommended Next Step |
| --- | --- | --- | --- |
| Settings shell + consent templates | FIX-003/004 + FIX-002 settings portion | Batch B — next selected batch | Run Batch B in this 04 pass (per user instruction) |
| Doc reconcile | FIX-005/006 | Batch E not yet run | Piggyback on a later pass |

## 10. Blocked Items

| Item | Label | Why Blocked | What Must Happen First |
| --- | --- | --- | --- |
| PIN recovery UI (Batch C) | `[NEEDS PRODUCT DECISION]` | Q2 unresolved (self-service vs owner-reset-only on shared device) | Product decision Q2 |
| Multi-branch UI (Batch D) | `[NEEDS PRODUCT DECISION]` | Q1 unresolved (V1-launch vs growth scope) | Product decision Q1 |
| Tier-limit enforcement check (FR6.3) | `[NEEDS CONFIRMATION]` | Q3 verify-then-classify not yet performed | Quick eng check |

## 11. Deferred / Not Implemented

| Item | Label | Why Not Implemented |
| --- | --- | --- |
| Invite-email flow | V2 DEFERRED | Direct-add+PIN is the decided model |
| Permission-grid revival, org-scoped membership API expansion | DO NOT ADD | G3 decision final; duplicate path |
| Generic settings-panel plugin framework | `[DO NOT OVERBUILD]` | Batch B ships a minimal registry only |

## 12. Files Changed

| File | Change Summary | Related Fix ID |
| --- | --- | --- |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.tsx` | New edit modal (PATCH changed fields only) | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-list.tsx` | Edit affordance per row (owner-only) + modal mount | FIX-001 |
| `apps/dentalemon/src/features/staff/hooks/use-staff-members.ts` | `update` mutation + Member credential fields | FIX-001 |
| `apps/dentalemon/src/features/staff/components/staff-edit-modal.test.tsx` | New rendered tests | FIX-001/002 |
| `apps/dentalemon/src/features/staff/components/staff-list.render.test.tsx` | New rendered RBAC/affordance tests | FIX-001/002 |
| `apps/dentalemon/src/features/staff/components/staff-create-modal.render.test.tsx` | New create mutation pin | FIX-002 |
| `apps/dentalemon/tests/e2e/add-staff.spec.ts` | FR6.1 role-edit persistence journey | FIX-001 |

## 13. Evidence Saved

| Evidence | Location | Related Fix ID |
| --- | --- | --- |
| Test output recorded in this report §6 (RED runs + GREEN runs + E2E pass) | this file | all |

## 14. Completion Decision

`COMPLETE` (Batch A) — the selected batch (FIX-001 + FIX-002 staff portion) was fixed RED-first, all relevant validation ran and passed, no regressions.

## 15. Recommended Next Step

Run another `04-module-or-group-fix-tdd.md` pass for **Batch B — settings shell + consent templates** (`docs/aha/module-fix-plans/dental-org-fix-ready-plan.md`), which unblocks the data-governance retention panel and dental-pmd cert panel mounts.

---

# Batch B — Settings Shell + Consent Templates (appended 2026-06-11)

## B1. Fix Scope

| Item | Details |
| --- | --- |
| Batch executed | Batch B — Settings shell (FIX-003) + consent templates (FIX-004) + settings-portion test pins (FIX-002) |
| Superpowers used | Yes (TDD + verification-before-completion) + a 4-lens adversarial verification workflow before commit |
| Working tree status checked | Yes — clean before Batch B |
| Fix scope | P2 (FIX-003 shared shell), P2→escalated-P1 (FIX-004 — a real contract bug was discovered), V1 RECOMMENDED test pins (FIX-002 settings portion) |
| Shared files touched | Yes — `routes/_dashboard/settings.tsx` (shell), `consent-sheet.tsx` (clinical-owned consumer), TypeSpec `dental-org.tsp` + regenerated SDK/validators |
| Schema/migration touched | No (DB already matched the reconciled contract) |
| Code commit | `27e2cc20` |

## B2. Fixes Selected

| Fix ID | Gap | Severity | Scope Label | Reason | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-003 | Settings shell hardcoded 5-tab list can't host pending cross-module panels | P2 | V1 REQUIRED `[SHARED DEPENDENCY]` | Unblocks data-governance retention + dental-pmd cert panel mounts; one owner of the seam | Fixed |
| FIX-004 | Consent-template CRUD had zero UI; `consent-sheet.tsx` hardcoded legal text | P2→**P1** | V1 REQUIRED `[CROSS-MODULE RISK]` | While wiring, discovered the endpoints were **non-functional in production** (validator/handler field-name contradiction + wrapped-vs-bare response drift) | Fixed |
| FIX-002 (settings) | New-panel FE tests must assert mutation calls | P3 | V1 RECOMMENDED `[TEST GAP]` | Prevents fake-green wiring of the new panel + shell | Fixed |

## B3. Discovered Erratum (fix-ready plan was wrong)

The plan's erratum said "consent-template backend already exists, tested, owner-gated — frontend/wiring only, no TypeSpec/backend rebuild." **This was incorrect.** Ground truth found during wiring:

1. **Request field drift:** TypeSpec `Create/UpdateDentalConsentTemplateRequest` declared `title`/`content`/`isActive`; the DB schema, handler zod, and audit tests all use `name`/`body`/`requiresWitnessSignature`/`active`. The generated `zValidator('json', CreateConsentTemplateBody)` therefore required `{title, content}` while the handler required `{name, body}` — **no request body could satisfy both layers**, so create/update were non-functional in the real app (404/400/500). This stayed invisible because there was no FE consumer, and the backend integration tests mount the raw handler (skipping the generated validator) — the exact "raw-handler masks validator drift" gotcha.
2. **Response envelope drift:** handlers returned `{ templates }` / `{ template }` / `{ deleted }` while the operation contracts already declared bare `ApiOkResponse<T[]>` / `ApiCreatedResponse<T>` / `ApiOkResponse<{}>` bodies.

**Resolution (in-scope, spec-first-correct):** reconciled the stale TypeSpec models to the implemented DB/handler reality, regenerated OpenAPI → validators → SDK, and unwrapped the 4 handler responses. This aligns spec ↔ validator ↔ handler ↔ SDK ↔ FE ↔ tests. The scope-discipline verification lens confirmed this is a justified contract-bug fix, not scope creep (aligning the spec to ground truth, not warping code to a never-built spec).

## B4. Changes Made

| Fix ID | Implemented | Files |
| --- | --- | --- |
| FIX-003 | Minimal flat panel registry + router-free `SettingsPage`; route is now a thin wrapper | `features/settings/settings-panels.tsx` (new), `features/settings/components/settings-page.tsx` (new), `routes/_dashboard/settings.tsx` |
| FIX-004 | TypeSpec reconcile (name/body/requiresWitnessSignature/active) + regen; 4 handler returns unwrapped to bare bodies; new consent-templates panel + hook (owner-only writes, inline two-step delete confirm); consent-sheet optional `templates` prop (const fallback) wired from workspace route; hurl + 2 backend tests corrected to bare shapes; seed-demo + 8 E2E seeders de-crufted | `specs/api/src/modules/dental-org.tsp`, `services/api-ts/src/handlers/dental-org/consentTemplates.ts`, generated `validators.ts` + SDK `types.gen.ts`, `features/settings/components/consent-templates.tsx` + `hooks/use-consent-templates.ts` (new), `features/workspace/components/consent-sheet.tsx`, `routes/_workspace/$patientId.tsx`, `specs/api/tests/contract/dental-org.hurl`, `dental-org.clinic-settings.test.ts`, `dental-org-audit-convergence.test.ts`, `scripts/seed-demo.ts`, 8 `tests/e2e/*.spec.ts` + `fixtures.ts` |
| FIX-002 | Rendered mutation-call pins (POST/PATCH/DELETE body + owner-only gating) + shell mount/RBAC test | `consent-templates.test.tsx`, `settings-page.test.tsx`, `consent-sheet.test.ts` (new API-templates test) |

## B5. Tests Added / Updated

| Test File | Type | What It Proves |
| --- | --- | --- |
| `features/settings/components/consent-templates.test.tsx` | frontend/component + RBAC | list renders; create POST body; **edit PATCH body** (added after verification); delete DELETE; empty state; non-owner sees no writes |
| `features/settings/components/settings-page.test.tsx` | frontend/component + regression | 5 original tabs + new Consent Forms tab render; consent panel mounts; non-settings role denied |
| `features/workspace/components/consent-sheet.test.ts` | frontend/component | API-provided templates replace the hardcoded const and flow into createConsentForm |
| `specs/api/tests/contract/dental-org.hurl` | integration/contract | owner-only CRUD round-trip pinning bare shapes; soft-delete removed from list |
| `dental-org.clinic-settings.test.ts`, `dental-org-audit-convergence.test.ts` | backend/unit | consent CRUD now asserts the contract-correct bare bodies |

## B6. Tests Run

| Command | Result | Notes |
| --- | --- | --- |
| `bun test src/features/settings/ + consent-sheet` | Passed | 75/0 |
| `bun test src/` (full FE) | Passed | 2258/0 |
| `bun run typecheck` (FE; includes tests/e2e) | Passed | clean |
| `bunx tsc --noEmit` (api-ts) | Passed | clean |
| `bun run typecheck` (sdk-ts) | Passed | clean |
| dental-org backend (`scripts/test-with-db.ts src/handlers/dental-org/`) | Passed | 674/0 |
| `CONTRACT_ONLY=dental-org` contract suite (fresh :7213) | Passed | 33 reqs, 100% |
| `bun run lint` (FE) | Passed | 0 errors |
| `bun run check:boundaries:dental-org` | Passed | no violations |

## B7. Adversarial Verification (pre-commit)

A 4-lens workflow reviewed the uncommitted diff before commit:
- **RBAC/security:** clean — owner-only enforcement intact at backend + FE; no branch leak; no PHI logging.
- **Scope-discipline:** clean — minimal registry (no plugin framework), no DO-NOT-BUILD violations; TypeSpec reconcile confirmed justified.
- **Contract-integrity:** clean end-to-end; 2 high-confidence nits (stale title/content cruft in seed-demo + 8 E2E seeders) — **folded into this commit.**
- **Fake-green:** 1 valid P2 — the panel test claimed edit/update coverage it didn't have — **folded in (added the PATCH mutation-call test).**

## B8. Shared / Cross-Module / Database Impact

| Area | Files | Blast Radius | Coverage |
| --- | --- | --- | --- |
| Settings shell `[SHARED DEPENDENCY]` | `routes/_dashboard/settings.tsx` + registry | data-governance + dental-pmd panels mount onto the registry next | settings-page regression test pins all 5 existing tabs |
| Consent-sheet `[CROSS-MODULE RISK]` | `consent-sheet.tsx` (clinical-owned) | workspace consent capture flow | const fallback preserves all existing consent-sheet tests; new API-templates test |
| TypeSpec/SDK regen `[SHARED DEPENDENCY]` | `dental-org.tsp` + generated validators/SDK | repo-wide SDK; verified no non-generated consumer of the renamed models (both typechecks clean + repo grep) | hurl + backend + FE coverage |

## B9. Completion Decision

`COMPLETE` (Batch B) — FIX-003 + FIX-004 + FIX-002 (settings portion) fixed RED-first, a real P1 production contract bug discovered and resolved, all gates green, adversarial findings folded in before commit.

## B10. Remaining dental-org Items

| Item | Status |
| --- | --- |
| FIX-005/006 (Batch E doc reconcile) | Not run — low-priority docs; can piggyback a later pass |
| Pre-existing settings panels (clinic/notification/locale) mutation pins | Deferred V1-RECOMMENDED — those panels already ship; this batch pinned the new wiring where the risk lives |
| Batch C (PIN recovery, Q2) / Batch D (multi-branch, Q1) | Blocked on product decisions |

## B11. Recommended Next Step

Proceed to the next module per the execution order: **dental-billing Batch A** (overdue cron on the existing `services/api-ts/src/core/jobs.ts`) then **Batch E** (shared print/PDF utility + receipt). The dental-org settings shell (FIX-003) is now in place for data-governance and dental-pmd to mount their panels.

---

## Batch C — PIN recovery (#9) + provisional-org PHI gate (C-1) — DONE 2026-06-13

Commits (NOT pushed): `c51e0705` (#9 owner-reset PIN) · `68e64c41` (C-1 gate + activate backend) · `4faa4119` (C-1 FE banner + seed/E2E wiring).

**Pre-flight (Track-0 / C-3 session-TTL) resolved inline, NOT a fork:** The C-3 "fixed conservative idle timeout (~15–30 min, exact value to confirm)" is the **PIN-session inactivity timeout**, already implemented: `apps/dentalemon/src/lib/pin-session.ts` `INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000` (5 min). 5 min is *more* conservative than the 15–30 min estimate, so C-3's intent is satisfied; the confirmed value is **5 min**. (The Better-Auth absolute `sessionExpiresIn` is a separate 7-day layer.) Decoupled from owner-reset-PIN and the provisional gate (neither touches session timing) → no AskUserQuestion; the C-3 data-gov ADR-007 sign-off can cite 5 min.

**#9 PIN recovery — §15 corrected the fix-ready premise (largely already in the decided direction).** Decision #9 = owner-reset-only, no self-service security-question flow. Trace found: (a) the PIN-entry "Forgot PIN?" message already reads *"Ask your practice owner or administrator to reset your PIN via the Staff settings"* (owner-reset messaging, no self-service UI); (b) the owner-gated `resetMemberPin` handler exists and `resetMemberPinMutation` was already wired into member-**create**; (c) the self-service `recoverPin`/`setSecurityQuestion`/`pinRecovery.ts` handlers are **orphaned** (zero FE consumers — the model #9 rejects). **The real gap:** Staff settings had **no Reset-PIN affordance for an existing member** — the mutation was defined but unexposed in `useStaffMutations`, so the "reset via Staff settings" promise was hollow. Fix (FE-only, backend ready, no regen): exposed `resetPin(memberId,newPin)` + added a "Reset PIN" section to the (owner-gated) `StaffEditModal` (6-digit client validation, success banner, distinct op from profile Save). Owner-only-reachable (Edit is role-gated + `/staff` route-guarded; backend hard-gates owner). E2E proves server-side effect (new PIN verifies, old fails). Gate: hook 2/0 + modal 9/0 (full staff 62/0), reset-PIN E2E PASS, tsc 0, lint 0.

**C-1 provisional-org PHI gate — built (ADR-007 fast-follow).** ADR-007 left `dental_organization.status` as "the hook only; nothing gates on it yet". Built:
- **Gate** (`assert-org-live.ts`): after the branch-role check, the PHI-root writes `createDentalPatient` + `createDentalVisit` call `assertOrgLive(db, branchId)` → 403 `ORG_NOT_LIVE` for a non-live org. **Production-only by design** — the exact pattern of `createOnboarding`'s sibling verified-email/rate-limit guards (ADR-007 relaxes those in dev/test so local/CI/seed flow). Clinical/imaging/billing PHI all require an existing patient/visit, so a provisional org is transitively blocked. **Enforcement-scope fork** (always-on vs production-only) was surfaced → user "defer to your best judgment" → chose production-only: it fully closes the *production*-PHI compliance hole C-1 targets, mirrors the established sibling-guard pattern, and avoids ~18 files of hurl/seed/E2E churn + a provisional-banner-in-every-test problem. Honesty preserved by a unit test that runs the gate under `NODE_ENV=production` (provisional→403, live→201, non-prod→201 relaxed).
- **Activation** (`activateOrganization`, POST `/dental/organizations/{id}/activate`): owner-only (`ownerPersonId`), idempotent (already-live→200), suspended→403 `ORG_SUSPENDED`, audited (`org.activate`). Represents the owner's terms/BAA acceptance per ADR-007. TypeSpec: new op + `OrgStatus` enum + `status` on `DentalOrganization` + `OrgContextOrg`; `getOrgContext` returns status. Full regen.
- **FE**: `ClinicActivationBanner` (owner + provisional only) in the dashboard shell → "Activate clinic" → self-dismisses on status→live. Activation wired into seed-demo (idempotent/unconditional — reset-db preserves the demo org) + the E2E helpers so dev/E2E run live (no banner; `{ activate: false }` exercises provisional).

Gate (C-1): gate 4/0, activate 6/0, createDentalPatient 7/0, getOrgContext 8/0, banner 4/0; dental-org hurl **35/35** (+provisional-status pin +activate +idempotent) + dental-patient 46 + dental-visit 66 (gate relaxed non-prod → no PHI-suite regression); clinic-activation E2E 1/1 + add-staff 7/7 + patient-checkin 1/1; db:reseed → both demo orgs `live`; root typecheck 0, lint 0 err.

**Roadmap / deferred:** gate covers the PHI *root* (patient+visit) only — deeper per-write gates are unreachable for a provisional (zero-patient) org, deliberately not added; `suspended` has no setter (reserved); the gate's 403 is unit-pinned not contract-pinned (contract server is non-prod, like the sibling verified-email guard); orphaned `recoverPin`/`setSecurityQuestion` security-question handlers left unwired (decision #9 — disposition/remove in a later doc pass if desired).
