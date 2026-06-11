# AHA Module/Group Gap Plan: Dental Org & Staff

**Generated:** 2026-06-11 · **Branch:** `chore/workflow-verification-sweep` · **Prompt:** `docs/aha/prompts/02-module-or-group-audit-gap-plan.md`

## 1. Audit Scope

| Item | Details |
| --- | --- |
| Module/group | Dental Org & Staff (org/branches/memberships/settings/onboarding/PIN) |
| Module slug | dental-org |
| Type | Business Module |
| Output file | `docs/aha/module-gap-plans/dental-org-gap-plan.md` |
| Primary PRD/spec used | `docs/prd/v3-dentalemon.md` §6.6 (FR6.1–6.5) + §6.7 (FR7.1–7.6 onboarding) + §6.8 (FR8.1–8.15 settings) + §6.9 (FR9.3/9.7 PIN) |
| Supporting PRDs/specs used | BR-016/016b/016c; AC-ORG-001..003, AC-SETTINGS-01; `docs/product/modules/dental-org/MODULE_SPEC.md` (§6 role catalog = **source of truth**, 10 roles) + `API_CONTRACTS.md` (§10b PIN table); `docs/product/ROLE_PERMISSION_MATRIX.md` (E3 hygienist amendment; **flagged NEEDS-REVIEW**); ADR-007 self-service onboarding; WORKFLOW_MAP WF-004/025-029/043 |
| PRD/spec coverage quality | Strong |
| Paths inspected | `services/api-ts/src/handlers/dental-org/` (47 handlers, 31 ops, 8 repos/schemas, 4 facades, 37 test files); FE `features/staff/`, `features/settings/`, `features/onboarding/`; `dental-org.hurl`; E2E (add-staff, auth-pin, onboarding, journeys/18, fee-schedule) |
| PRDs/specs inspected | All above; 127-item requirement extraction |
| KG used | Yes — spine + grep; orphan claims individually verified |
| KG refreshed | No |
| `/understand-domain` used | Yes (cross-check only) |
| `/understand-domain` refreshed | No |
| Webwright used | No — staff-lifecycle smoke + onboarding cold-start E2E provide recent runtime evidence; new claims static |
| Playwright/E2E inspected | Yes (inspected): add-staff, auth-pin (lockout), dental-onboarding, journeys/18-org-onboarding, fee-schedule (Batch-4 proof) |
| Existing tests inspected | 37 backend files, dental-org.hurl, 7 FE files, 5 E2E |
| Cross-cutting audit reviewed | Not Available |
| Database/schema audit reviewed | Not Available |
| Limitations | No tests executed; FE staff tests are helper-only (no mutation-call assertions — known blind spot) |

## 2. Product Reference Summary

| Product Reference | Path | Type | Current / Stale / Unknown | How It Applies |
| --- | --- | --- | --- | --- |
| PRD §6.6/6.7/6.8/6.9 | `docs/prd/v3-dentalemon.md:456-517` | PRD | Current | staff CRUD (FR6.1 incl. **edit**), RBAC, tier limits, onboarding wizard, settings catalog (incl. FR8.4b consent templates, FR8.14 retention display, FR8.15 cert), PIN lockout/recovery |
| Module spec + API contracts | `docs/product/modules/dental-org/` | module spec | Current (role catalog §6 = authority) | 10-role enum, membership FSM, PIN ops, aggregates |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | RBAC spec | **NEEDS-REVIEW flagged** (2026-06-11 docs sweep) + auditor-row inconsistency (dental-audit round) | E3 hygienist gate amendment current |
| ADR-007 | onboarding | ADR | Current | self-service POST /dental/onboarding guardrails |
| Prior audit + gap plan + matrix Batch 4 §11 | 2026-06-08/09 artifacts | prior audit (pre-AHA) | Partially superseded — G1/G2/G3 verified fixed; G5/G6/G7 re-verified open | §3 |

## 3. Expected vs Actual

**Expected:** the practice backbone — org/branch model (multi-branch day one), 10-role membership with PIN local auth (lockout + self-recovery), staff management (create/**edit**/deactivate/reactivate), owner-only settings (clinic profile, fee schedule driving pricing, working hours driving booking, locale, notification defaults, consent templates FR8.4b, retention visibility, signing cert FR8.15), <10-min self-service onboarding.

**Actual — Batch 4 closed the dangerous class; verified again this round:**

- **G1 working hours:** canonical `dental_branch.working_hours` column end-to-end (FE `use-working-hours.ts` + shape reconciler w/ 10 unit tests; enforcement tz-tests 16/0; hurl GET-after-PUT; seed populates).
- **G2 fee schedule:** dedicated endpoints canonical; `resolveFeeCents` (override→catalog→0) drives treatment pricing (`createDentalTreatment.ts:69`); catalog seeded idempotently; E2E `fee-schedule.spec.ts` proves set-fee→treatment-default→persists.
- **G3 permission grid:** REMOVED per decision — coarse 10-role model + `assertBranchRole` (109 files) is THE model; grid FE deleted; backend grid handlers remain harmless orphans.
- Notif-defaults relabel + retention observability (Batch 4), role-change audit (Batch 2), `deactivateMember` wiring (2026-06-04), ADR-007 onboarding with verified-email gate + per-IP rate limit + one-active-org index + separate untouched admin endpoint (EM-ORG-002) — all source-verified.

**What remains is the familiar orphan-affordance cluster:**

1. **G5 — staff cannot be edited (P1 this round).** FR6.1 explicitly requires editing details/role/PIN; `updateMember.ts` is complete (displayName/role/license/NPI/credentials, owner-only) with tests — **zero FE consumers**; `staff-list.tsx` has no Edit affordance. Same class as dental-patient GAP-1 (records permanent after creation): wrong role assignment is uncorrectable from the product (workaround: deactivate + recreate, losing identity/PIN continuity).
2. **G6 — consent templates (FR8.4b) backend exists, zero UI:** 4 CRUD ops routed (owner-only writes); `consent-sheet.tsx` hardcodes a `CONSENT_TEMPLATES` const instead. (Cross-module correction: the dental-clinical plan's Q4 assumed no template backend exists — it does, here.)
3. **G7 — multi-branch UI absent:** `DentalBranchManagement_create/list` + `getBranchesByUser` essentially unconsumed; no branch switcher/create surface despite "multi-branch from day one."
4. **PIN self-recovery UI absent** (`recoverPin` orphan; FR9.7 security question captured at onboarding but no recovery flow surface) `[NEEDS CONFIRMATION]` device-level UX intent.
5. **G4 doc reconcile:** tsp `MemberStatus={active,inactive}` — `invited` never implemented; direct-add+PIN is the live model (createMember doubles as both). Doc-only.
6. Org-scoped `DentalMembershipManagement_*` duplicates (6 ops) orphaned — admin/migration path; document or trim.

## 4. PRD / Spec Coverage Matrix

| PRD / Spec Requirement | Expected Behavior | Current Implementation | UI Evidence | API / Backend Evidence | Schema Evidence | Test Evidence | Status | Gap? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR6.1 staff create + PIN | add member w/ role + 6-digit PIN | ✓ | `staff-create-modal.tsx` | `createMember.ts` (+resetPin chain :110-114) | membership schema | add-staff E2E + backend | Implemented | No |
| FR6.1 staff **edit** (details/role/PIN) | editable post-creation | ✓BE — **zero FE** | no edit modal | `updateMember.ts` (owner-only :62; license/NPI) | — | handler tests; role-change audit pin (Batch 2) | Partially Implemented | **GAP-1** |
| FR6.1 deactivate/reactivate | lifecycle | ✓ deactivate wired; reactivate `[NEEDS CONFIRMATION]` | staff-list :101 | `deactivateMember` | status enum | wired 2026-06-04 + smoke | Implemented (deactivate) | reactivate check (P3) |
| FR6.2/E3 RBAC + hygienist gate | 10 roles; hygiene-visit scoping | ✓ | — | `assertBranchRole` ×109; E3 conditionals | VALID_MEMBER_ROLES :60-71 | role tests + E3 pins | Implemented | matrix doc NEEDS-REVIEW (prompt 05) |
| FR6.3 tier user limits | Solo 2 / Practice 5 | `[NEEDS CONFIRMATION]` — not located | — | orgTier exists | tier col | — | Unclear | GAP-7 (P3) |
| BR-016b PIN lockout + FR9.7 recovery | progressive lockout; security-question recovery | lockout ✓ + E2E; **recovery UI absent** | auth-pin spec | `recoverPin` orphan | pin cols | lockout tests | Partially Implemented | **GAP-4** |
| FR7.x onboarding (ADR-007) | 4-step wizard, guarded self-service | ✓ | wizard | `createOnboarding.ts:64-218` | provisional status, unique index | cold-start E2E + journeys/18 | Implemented | No |
| FR8.1 clinic settings | profile/logo/license | ✓ | `clinic-settings.tsx` | branch settings ops | settings JSONB | FE+contract | Implemented | No |
| FR8.3 fee schedule drives pricing | per-branch override, prospective | ✓ (Batch 4) | fee-schedule UI + E2E | `resolveFeeCents` :23-31 | catalog table | 5/0 + 3/0 + E2E | Implemented | No |
| FR8.6 working hours | column-canonical, enforced | ✓ (Batch 4) | settings UI + hook | scheduling-owned writer | TEXT column :18 | 16/0 tz + hurl | Implemented | No |
| FR8.4b consent templates | branch template CRUD + merge fields | ✓BE (4 ops, owner-only) — **zero UI**; sheet hardcodes const | `consent-sheet.tsx` const | `consentTemplates.ts` | `consent-template.schema.ts` | backend tested; no hurl/FE | Partially Implemented | **GAP-2** |
| Multi-branch (PRD §2.5 day-one) | create/list/switch branches | ✓BE — **no UI**; context store holds branchId w/o switcher | — | branch ops orphaned | branch schema | `DentalBranchManagement_create.test.ts` | Partially Implemented | **GAP-3** |
| FR8.8/8.9 locale + notif defaults | settings panels | ✓ (notif relabeled Batch 4) | locale/notification-settings.tsx | settings ops | — | FE tests | Implemented | No |
| FR8.14 retention visibility | policy display in Settings | Missing (owned by data-governance GAP-4 — cross-listed) | — | summarizer exists | — | — | Partially Implemented | cross-ref |
| FR8.15 signing cert mgmt | facility cert status/expiry | Missing (pairs with PMD GAP-4 signing decision) | — | — | — | — | Missing | cross-ref `[NEEDS PRODUCT DECISION]` |
| FR8.11 data export | CSV/JSON org-level | patient export ✓ (patient round); org-wide `[NEEDS CONFIRMATION]` | — | — | — | — | Unclear | GAP-7 (P3) |
| AC-ORG-001..003 / AC-SETTINGS-01 | gates + flows | ✓ | — | — | — | pins + hurl | Implemented | No |
| Membership `invited` state (G4) | per spec WF-004 invite flow | Not implemented — direct-add+PIN is live model | — | tsp :85 `{active,inactive}` | — | — | Not Required for V1 (doc reconcile) | GAP-5 (P3 doc) |

## 5. PRD / Spec Gaps

| Requirement | Gap | Severity | Scope Label | Evidence | Recommended Fix |
| --- | --- | --- | --- | --- | --- |
| FR6.1 staff edit | **GAP-1**: no edit affordance — role/name/credentials uncorrectable from product; `updateMember` 0 consumers | P1 | V1 REQUIRED | grep; no edit modal | Staff edit modal (role change w/ confirm, license/NPI fields) → existing handler; RED-first FE tests + role-change E2E |
| FR8.4b consent templates | **GAP-2**: 4 CRUD ops zero UI; consent sheet hardcodes templates | P2 | V1 REQUIRED | `consent-sheet.tsx` const; ops orphaned | Settings templates panel + sheet picker reads `listConsentTemplates`; hurl CRUD; coordinate with dental-clinical consent batch `[CROSS-MODULE RISK]` |
| Multi-branch | **GAP-3**: no branch create/list/switcher UI | P2 | V1 RECOMMENDED `[NEEDS CONFIRMATION]` (is multi-branch V1-launch or growth?) | orphan ops | Branch section in settings + header switcher writing org-context |
| FR9.7 PIN recovery | **GAP-4**: `recoverPin` self-service flow has no UI | P2 | V1 RECOMMENDED | orphan | Recovery flow on PIN entry screen (security question) |
| G4 invited-state doc | **GAP-5**: spec WF-004 invite flow vs live direct-add+PIN; dead enum values | P3 | V1 RECOMMENDED (doc-only) | tsp :85 | reconcile MODULE_SPEC/WF-004 to direct-add model |
| Org-scoped membership duplicates | **GAP-6**: 6 `DentalMembershipManagement_*` ops orphaned (admin path) | P3 | V1 RECOMMENDED | spine | document admin-only or trim from spec |
| Unverified small FRs | **GAP-7**: tier user limits (FR6.3), org-wide export (FR8.11), reactivate affordance | P3 | `[NEEDS CONFIRMATION]` ×3 | not located | verify then classify |
| FE test depth | **GAP-8**: staff/settings FE tests assert helpers only — no mutation-call assertions (pre-Batch-4 blind spot persists) | P3 | V1 RECOMMENDED `[TEST GAP]` | 7 FE files | add mutation-call pins with GAP-1/2 work |

## 6. Implemented But Not In PRD / Possible Overbuild

| Implemented Item | Evidence | Product Reference Status | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| Permission-grid backend (`getPermissionGrid`/`updatePermissions`) | orphans post-G3 removal | decision: coarse roles only | confusion risk | Keep dormant or delete with spec note `[DO NOT OVERBUILD]` |
| Org-scoped membership op family | 6 orphans | admin/migration path | low | GAP-6 document |
| 6 extended roles beyond PRD's 4 | role catalog §6 | spec-sanctioned (source of truth) | none | Keep |

## 7. Domain Workflow Summary

| Workflow | Actor | Trigger | Main Steps | Current Implementation | Gap? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Self-service clinic founding (ADR-007) | new owner | signup | wizard → org+branch+membership+PIN | Implemented | No | cold-start E2E |
| Staff lifecycle: add → PIN → role effect → deactivate | owner | hiring | create+PIN → role gates → deactivate | Implemented **except edit** | **GAP-1** | smoke + E2E |
| Correct a staff role/details | owner | mis-assignment | edit modal → updateMember (audited) | Backend only | **GAP-1** | 0 consumers |
| Configure practice (hours/fees/locale/notifs) | owner | setup | settings panels → enforcement downstream | Implemented (Batch 4 verified) | No | E2E + tz tests |
| Manage consent templates | owner | compliance setup | CRUD → picker in consent sheet | Backend only | **GAP-2** | hardcoded const |
| Open second branch | owner | growth | create branch → staff per branch → switch | Backend only | **GAP-3** | orphan ops |
| Forgot PIN | staff | lockout | security-question recovery | Backend only | **GAP-4** | orphan |

## 8. Domain Workflow Step Review

| Workflow Step | Expected Behavior | Current Status | Evidence | Scope Label | Notes |
| --- | --- | --- | --- | --- | --- |
| Onboarding guardrails | email-verified, rate-limited, one-active-org | Implemented | :75-111 | V1 REQUIRED | done |
| Member create + PIN set | owner action | Implemented | E2E | V1 REQUIRED | done |
| Member edit | owner corrects | Missing (BE ready) | GAP-1 | V1 REQUIRED | |
| PIN lockout ladder | 5→30s, 10→5min | Implemented | auth-pin E2E | V1 REQUIRED | done |
| PIN self-recovery | security question | Missing (BE ready) | GAP-4 | V1 RECOMMENDED | |
| Fee → pricing default | resolveFeeCents | Implemented | Batch 4 pins | V1 REQUIRED | done |
| Hours → booking enforcement | column canonical | Implemented | Batch 4 pins | V1 REQUIRED | done |
| Template CRUD → sheet picker | branch templates | Missing (BE ready) | GAP-2 | V1 REQUIRED | |
| Branch create/switch | multi-branch ops | Missing (BE ready) | GAP-3 | V1 RECOMMENDED | confirm scope |

## 9. Use Case Completeness

| Use Case | Actor | Expected Behavior | Current Status | Gap? | Scope Label | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Found a clinic in <10min | owner | wizard | Implemented | No | V1 REQUIRED | E2E |
| Hire + onboard staff w/ PIN | owner | create flow | Implemented | No | V1 REQUIRED | smoke |
| Fix a wrong role assignment | owner | edit | Missing | GAP-1 | V1 REQUIRED | |
| Maintain consent template library | owner | CRUD + merge fields | Missing (BE ready) | GAP-2 | V1 REQUIRED | |
| Operate two branches | owner | switcher | Missing (BE ready) | GAP-3 | V1 RECOMMENDED `[NC]` | |
| Staff recovers forgotten PIN | staff | self-service | Missing (BE ready) | GAP-4 | V1 RECOMMENDED | |
| Configure fees/hours and see them bite | owner | downstream effect | Implemented | No | V1 REQUIRED | fee E2E |

## 10. Critical Gaps

| Gap | Area | Severity | Scope Label | Evidence | Why It Matters | Recommended Fix |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-1 staff edit | FE affordance | P1 | V1 REQUIRED | 0 consumers | FR6.1-explicit; mis-assigned role = wrong PHI access until deactivate-recreate workaround; same record-permanence class as patient edit | edit modal → existing audited handler |
| GAP-2 consent templates | FE affordance / compliance | P2 | V1 REQUIRED | hardcoded const | Hardcoded legal text per clinic violates FR8.4b intent; backend already owner-gated | settings panel + picker |
| GAP-3 multi-branch UI | FE affordance | P2 | V1 RECOMMENDED `[NC]` | orphans | "Multi-branch day one" claim vs single-branch-only UI | confirm scope, then switcher |
| GAP-4 PIN recovery | FE affordance | P2 | V1 RECOMMENDED | orphan | FR9.7 promise; lockout without recovery = owner bottleneck | recovery flow |

## 11. Broken / Misleading Journeys

| Journey | Expected | Actual | Evidence | Severity | Recommended Test |
| --- | --- | --- | --- | --- | --- |
| Owner promotes associate → staff_full corrected | edit role | deactivate+recreate only | GAP-1 | P1 | FE edit→persist + role-effect E2E |
| Clinic customizes consent wording | template editor | hardcoded const | GAP-2 | P2 | FE CRUD + picker tests |
| Locked-out staff self-recovers | security question | owner reset only | GAP-4 | P2 | recovery flow E2E |
| Owner opens branch #2 | settings action | API-only | GAP-3 | P2 | post-confirm |

## 12. Unused / Unwired Implementation

| Item | Type | Evidence | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `updateMember` | API, 0 FE | grep | P1 | Wire (GAP-1) |
| consent-template CRUD ×4 | API, 0 FE | grep | P2 | Wire (GAP-2) |
| `DentalBranchManagement_create/list`, `getBranchesByUser` (near-zero) | API ×3 | spine | P2 | GAP-3 |
| `recoverPin` | API, 0 FE | spine | P2 | GAP-4 |
| `DentalMembershipManagement_*` ×6 (incl. org-scoped setPin/verifyPin variants — wizard uses setPin only) | API | spine | P3 | GAP-6 document |
| `getPermissionGrid`/`updatePermissions` | API, post-G3 orphans | source | P3 | dormant-or-delete note |

## 13. Data, API, State, and Schema Findings

| Finding | Layer | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Working-hours TEXT column canonical; settings-blob retired (G1) | schema | branch schema :18 | — | none (verified) |
| Fee resolution single-source w/ catalog seed | backend | fee-resolution.ts :23-31 | — | none |
| Membership: nullable personId for PIN-only staff; 10-role enum | schema | membership :60-71 | — | none |
| `MemberStatus` dead values vs spec invite flow | API/docs | tsp :85 | P3 | GAP-5 doc |
| One-active-org partial index (onboarding) | schema | :105-111 | — | none |

## 14. Permission / RBAC / Security Findings

| Finding | Role/Permission Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Coarse-role model THE model (G3 decision); assertBranchRole ×109 | platform RBAC | Batch 4 | — | none — do not re-litigate |
| E3 hygienist hygiene-visit gate implemented | clinical scoping | conditionals + pins | — | none |
| updateMember owner-only + role-change audited (Batch 2) | write guards | :62 + audit pin | — | none (just unreachable) |
| Onboarding rate-limit + email gate | abuse controls | :75-87 | — | none |
| ROLE_PERMISSION_MATRIX needs-review + auditor-row conflict | RBAC doc | flags | P2 (doc) | prompt 05 cross-cutting refresh |

## 15. Record Safety / Audit History Findings

| Finding | Record Area | Evidence | Severity | Recommendation |
| --- | --- | --- | --- | --- |
| Role changes audited w/ before/after (fail-closed) | staff trail | Batch 2 pin | — | none |
| Onboarding audited (tier + mode) | org founding | :196 | — | none |
| Deactivate preserves membership row | staff history | handler | — | none |

## 16. Knowledge Graph Findings

| KG Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| Orphan cluster = exactly the §12 list; core staff/settings/onboarding loop fully wired | spine + grep | gap class = affordances, not rot | §5 |
| dental-org facades export org context to billing/clinical/imaging/scheduling; working-hours writer deliberately owned by scheduling | facades | seams healthy post-Batch-4 | none |
| Consent-template backend here vs consent-sheet consumer in clinical | cross-module | GAP-2 spans modules | one batch, two plans cross-listed |

## 17. Domain Knowledge Findings

| Domain Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- |
| PH SMB clinics churn staff frequently — role correction is routine, not edge | personas | GAP-1 is daily-ops | P1 |
| Consent wording varies by clinic/procedure locally | FR8.4b intent | GAP-2 compliance-flavored | P2 |
| Many target clinics are single-branch at launch | market `[INFERRED]` | GAP-3 may be honest growth scope | confirm |

## 18. Webwright / Playwright Findings

Not used this round — staff-lifecycle smoke tool + onboarding/auth-pin/fee-schedule E2E provide recent runtime evidence; remaining claims are statically conclusive. No new evidence saved.

## 19. Existing Tests Found

| Test File | Type | What It Covers | Confidence |
| --- | --- | --- | --- |
| 37 backend files (memberships/PIN/lockout, role-change audit, working-hours tz 16, onboarding, fee round-trip, branch mgmt) | backend | core + Batch-4 pins | High |
| `dental-org.hurl` | contract | lifecycle, PIN, settings/hours round-trips | High |
| FE 7 files (staff-list/create-modal/hooks, clinic/locale/notification settings) | frontend | helpers only — **no mutation-call asserts** | Medium-Low |
| E2E: add-staff, auth-pin (lockout), dental-onboarding, journeys/18, fee-schedule | E2E | core journeys + Batch-4 proof | High |
| Smoke: staff_lifecycle tool | smoke | re-runnable lifecycle | High |

## 20. Test Gaps

| Missing Test | Type | Why Needed | Should Be Added Before/During Fix |
| --- | --- | --- | --- |
| Staff edit FE: modal renders, owner-only, role change persists + audit row | frontend + E2E | GAP-1 RED-first | Before |
| Consent-template CRUD FE + hurl + picker-reads-API | frontend/contract | GAP-2 RED-first | Before |
| PIN recovery flow | frontend + E2E | GAP-4 | Before |
| Branch create/switch (post-confirm) | frontend + E2E | GAP-3 | Post-decision |
| Mutation-call assertions in existing staff/settings FE tests | frontend | GAP-8 blind spot | During batches |
| Tier-limit enforcement (FR6.3) once located/confirmed | backend | GAP-7 | Post-confirm |

## 21. Shared / Cross-Module / Database Dependencies

| Dependency | Type | Evidence | Why It Matters | Recommended Handling |
| --- | --- | --- | --- | --- |
| Consent templates: org owns CRUD, clinical owns sheet consumer | cross-module `[CROSS-MODULE RISK]` | GAP-2 | one batch, cross-listed with dental-clinical (whose plan's Q4 wrongly assumed no backend — corrected via erratum) | joint batch |
| Working-hours writer owned by dental-scheduling | cross-module | re-export | settled seam | none |
| FR8.14 retention panel = data-governance GAP-4; FR8.15 cert = PMD GAP-4 decision | cross-module | settings surface hosts both | settings-area batch sequencing | cross-list |
| ROLE_PERMISSION_MATRIX refresh | product decision / docs | needs-review flag | feeds audit GAP-2 + org RBAC docs | prompt 05 |
| Org-context store (branchId) | shared FE state | switcher target | GAP-3 touchpoint | reuse store |

## 22. Raw Recommended Fix Ideas

| Fix Idea | Related Gap | Severity | Scope Label | Likely Test Needed | Notes |
| --- | --- | --- | --- | --- | --- |
| Staff edit modal (role + details + credentials) | GAP-1 | P1 | V1 REQUIRED | FE RED + E2E | backend untouched |
| Consent-templates settings panel + sheet picker | GAP-2 | P2 | V1 REQUIRED | FE + hurl | joint w/ clinical |
| PIN recovery flow on PIN screen | GAP-4 | P2 | V1 RECOMMENDED | FE + E2E | |
| Branch switcher + create (post-confirm) | GAP-3 | P2 | `[NC]` | FE + E2E | |
| Doc batch: invited-state reconcile, org-scoped-op disposition, permission-grid dormancy note | GAP-5/6 | P3 | V1 RECOMMENDED | none | quick |
| Verify FR6.3 tier limits / FR8.11 export / reactivate | GAP-7 | P3 | `[NC]` | depends | quick checks |

## 23. V2 Deferred / Do Not Add

| Item | Label | Why Deferred or Rejected |
| --- | --- | --- |
| Invite-email flow (`invited` state) | V2 DEFERRED | direct-add+PIN is the decided live model (G4) |
| Granular permission grid revival | DO NOT ADD | G3 decision: coarse roles ARE the model |
| FR8.15 cert management build-out | `[NEEDS PRODUCT DECISION]` | pairs with PMD signing Q2 |
| Org-scoped membership API expansion | DO NOT ADD `[DO NOT OVERBUILD]` | duplicates live path |
| Staff activity dashboards beyond FR6.4 basics | V2 DEFERRED | no anchor |

## 24. Audit Decision

**PARTIAL PASS.**

The dangerous gap class is closed and verified: Batch 4's split-brain eliminations (working hours, fee schedule, permission grid) all hold in source with downstream-effect proofs (fee→treatment-default E2E, tz enforcement tests), onboarding is guarded per ADR-007 with the admin path intact, PIN lockout works end-to-end, role changes are fail-closed audited, and the coarse-role RBAC model is uniformly enforced.

It is not a PASS because staff records are append-only in practice — FR6.1's explicit edit capability has a complete, tested, audited backend and **no UI** (GAP-1, P1) — and two more owner workflows (consent-template management, PIN self-recovery) plus the multi-branch surface are backend-complete orphans. Nothing found is data-unsafe.

## 25. Open Questions

| Question | Label | Why It Matters | Suggested Owner |
| --- | --- | --- | --- |
| Q1: Is multi-branch UI V1-launch scope or growth-phase? | `[NEEDS CONFIRMATION]` | GAP-3 | Product |
| Q2: PIN recovery — self-service on shared device acceptable, or owner-reset-only by design? | `[NEEDS PRODUCT DECISION]` | GAP-4 | Product |
| Q3: FR6.3 tier limits — enforced anywhere? | `[NEEDS CONFIRMATION]` | GAP-7 | Eng |
| Q4: Reactivate-member affordance present? Org-wide export (FR8.11)? | `[NEEDS CONFIRMATION]` | GAP-7 | Eng |
| Q5: Disposition of dormant permission-grid + org-scoped membership ops | `[NEEDS CONFIRMATION]` | GAP-6 | Eng |

## 26. Notes for Gap Plan Organizer

- **Truly V1 (decision-free):** GAP-1 (staff edit — the P1), GAP-2 (consent templates — joint batch with dental-clinical consent work), GAP-5/6 docs, GAP-8 test-depth pins.
- **Likely batch shape:** Batch A = staff edit modal + mutation-assert pins + E2E; Batch B = consent-templates panel+picker (cross-module with clinical GAP-2 batch); Batch C = PIN recovery (post-Q2); Batch D = branch UI (post-Q1); docs batch anytime.
- **Blocked until confirmed:** GAP-3 (Q1), GAP-4 (Q2), GAP-7 items (Q3/Q4).
- **Must NOT implement:** invite-email flow, permission-grid revival, org-scoped API expansion.
- **Tests first:** staff-edit FE RED; template CRUD hurl + FE RED.
- **Cross-module:** consent templates cross-listed with dental-clinical (erratum issued there); settings area will also host retention panel (governance GAP-4) and possibly cert status (PMD Q2) — sequence the settings-shell work once; ROLE_PERMISSION_MATRIX refresh belongs to prompt 05.
- **Do not re-litigate:** G1/G2/G3 Batch-4 landings, ADR-007 guardrails, deactivate wiring, role-change audit, E3 gate.

---

Next recommended step:
Module/group: Dental Org & Staff
Module slug: dental-org
Primary PRD/spec: PRD §6.6-6.9 + docs/product/modules/dental-org/
Prompt: docs/aha/prompts/03-organize-gap-plan-for-fixing.md
Input gap plan: docs/aha/module-gap-plans/dental-org-gap-plan.md
