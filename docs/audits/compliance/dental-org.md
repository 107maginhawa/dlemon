# Compliance Audit — `dental-org`

> **Dimension:** compliance ("Does the code do what the specs say?")
> **Scope:** `dental-org` module (single-module audit)
> **Spec source of truth:** `docs/product/modules/dental-org/MODULE_SPEC.md` (Spec v1.0, 2026-05-24)
> **Date:** 2026-05-30
> **Verdict:** **WARN** — 0 P0, 4 P1, 5 P2, 3 P3. The authorization spine (`assertBranchAccess`/`assertBranchRole` in `handlers/shared/`, active-only role resolution, tenant/branch scoping, PIN lockout, credential-hash redaction, tier limits, IDOR guards) is enforced and backed by dedicated tests. Remaining gaps are functional/spec-fidelity issues, not security blockers.

---

## Scope & Method

Read exhaustively (no sampling). Bash required `dangerouslyDisableSandbox` to produce output; once enabled, the full file tree, the generated route registry, and every in-scope source file were read directly.

- **Spec:** `MODULE_SPEC.md` in full — 4 BRs (BR-016, BR-016b, BR-016c, BR-SCH-004), 3 ACs (AC-ORG-001/002/003), permission matrix + 9-role catalog, membership state machine, API contract (9 core + 5 PIN endpoints), 4-table data model, §10b domain-events (audit-log-only per ADR-006), §17 observability.
- **Handlers (all 35 non-test `.ts`):** `DentalOrganizationManagement_{create,get,update}`, `DentalBranchManagement_{create,get,list}`, `DentalMembershipManagement_{create,deactivate,list,setPin,verifyPin}`, `createMember`, `updateMember`, `deactivateMember`, `listMembers`, `createOrganization`, `getOrgContext`, `getBranchesByUser`, `feeSchedule`, `getDashboardSummary`, `pinRecovery`, `resetMemberPin`, `branchSettings`, `consentTemplates`, + 10 one-line re-export shims.
- **Repos (3) + 4 facades:** `organization.repo.ts`, `branch.repo.ts`, `membership.repo.ts`; `org-{billing,clinical,imaging,scheduling}.facade.ts`.
- **Schemas (4):** `organization.schema.ts`, `branch.schema.ts`, `membership.schema.ts`, `consent-template.schema.ts`.
- **Shared guards (read):** `handlers/shared/assert-branch-access.ts`, `handlers/shared/assert-branch-role.ts` (consumed by ~all handlers — confirmed to exist and be the auth chokepoint).
- **Generated routing (read, excluded from findings):** `src/generated/openapi/{routes,registry,validators}.ts` — confirms all 14 endpoints are registered with param/json validators + `validationErrorHandler`.
- **utils/:** only `locale.ts` + `locale.test.ts` (ISO/locale helpers) — there is **no** `assertBranchAccess` inside the module's `utils/`; the guard is the shared one above.
- **Tests (key, line-read):** `dental-org-auth-p0.test.ts` (6 P0/IDOR fixes, real routed handlers), `membership-audit-regression.test.ts` (routed audit locks), `org-member-role-active.test.ts` (EF-ORG-P020/P022 active-only role + inactive-branch skip), `pin-digit-pattern.test.ts` (digit-only PIN at validator boundary). ~20 further `.test.ts` exist (createMember/deactivateMember/verifyPin/memberTierLimits/em-org-ownership/fee-schedule/clinic-settings/pin-recovery/dashboard/staff-activity), counted toward AC coverage.

> **Knowledge-graph note:** `docs/audits/codebase-map/*.json` were not usable as structural ground truth for this slice (`CODE_API_SURFACE.json` empty; other maps lacked `dental` entries). Ground truth taken from the source tree + generated route registry directly.

### Spec Completeness Pre-Check
- §5 Business Rules: present (4 BRs). ✓
- §6 Permissions: present (matrix + 9-role catalog; spec declares MODULE_SPEC catalog the source of truth, ROLE_PERMISSION_MATRIX the 4-role subset). ✓
- §11 Acceptance Criteria: present but **thin** — only 3 ACs for 14 endpoints (no AC for state machine, lockout, tier gate, hash redaction). Flagged as spec gap (V-ORG-011), not a code bug.

---

## Summary Counts

| Severity | Count |
|----------|-------|
| **P0** | 0 |
| **P1** | 4 |
| **P2** | 5 |
| **P3** | 3 |
| **Total** | **12** |

---

## P1 — High (Must fix before ship)

### V-ORG-001 — Membership state machine is unguarded (§8)
- **Severity:** P1
- **Spec:** §8 `invited → active → inactive`, with `inactive → active` only via "Owner reactivates" and `invited → active` only via first login; transitions are directional and trigger-gated.
- **Location:** `repos/membership.repo.ts:99-106` (`deactivate()`), `createMember.ts:89` / `DentalMembershipManagement_create.ts:69` (status set to `'active'` directly), `DentalMembershipManagement_verifyPin.ts` (activation via PIN, no status transition write).
- **What's wrong:** There is no single guarded transition function. `deactivate()` unconditionally sets `status:'inactive'` regardless of the current state (an `invited` or already-`inactive` row can be "deactivated"). Members are created straight to `'active'` (the spec's `invited → active` first-login step is collapsed). The schema enum also has a 4th value `'revoked'` that the spec's §8 diagram never mentions, and no code transitions to/validates it. Out-of-order transitions are not rejected. Admin-only surface mitigates this to P1, not P0.
- **Fix:** Add `transitionStatus(id, from, to)` in the membership repo whitelisting `{invited→active, active→inactive, inactive→active}` (decide where `revoked` fits or remove it); route all status writes through it; 422 on illegal transition. Reconcile the `revoked` enum value with §8.
- **Autofixable:** No.

### V-ORG-002 — Fee-schedule, branch-settings, and consent-template mutations write NO audit row (AC §10b / §17, HIPAA AL-* pattern)
- **Severity:** P1
- **Spec:** §10b (ADR-006) — every org mutation must be satisfied by a synchronous `logAuditEvent()` row in `dental_audit_log`; §17 lists membership/branch config changes as audited. Org/branch/membership create+deactivate handlers all call `logAuditEvent` (AL-001..AL-004); these three do not.
- **Location:** `feeSchedule.ts:114` (`updateFeeScheduleEntry` — DB write, no `logAuditEvent`), `branchSettings.ts:85` (`updateBranchSettings` — no audit), `consentTemplates.ts:87/128/166` (create/update/soft-delete — no audit).
- **What's wrong:** Fee-schedule price changes (WF-025, financially material), branch-settings edits, and consent-template lifecycle are all owner-only mutations with zero audit trail, breaking the module's own AL-* convention and §10b. `membership-audit-regression.test.ts` locks the membership paths but nothing guards these.
- **Fix:** Add `logAuditEvent({actor, action, target, branchId, orgId})` to `updateFeeScheduleEntry`, `updateBranchSettings`, and consent create/update/delete; extend a regression test to cover them.
- **Autofixable:** Partial.

### V-ORG-003 — BR-SCH-004 (validate appointment vs branch working_hours) has no enforced/typed contract from dental-org, which owns `working_hours` (BR-SCH-004)
- **Severity:** P1
- **Spec:** §5 BR-SCH-004; dental-org owns `dental_branch.working_hours`.
- **Location:** `repos/branch.schema.ts:18` (`workingHours` stored as a raw `text` JSON string), `org-scheduling.facade.ts:12-21` (`getBranchSchedulingConfig` returns `workingHours: string | null` untyped); `getWorkingHours.ts`/`updateWorkingHours.ts` re-export to `dental-scheduling/workingHours`.
- **What's wrong:** `working_hours` is an un-parsed/untyped `text` blob; the facade hands scheduling a raw string with no shape contract or validation, and dental-org has no test proving the structure scheduling depends on for BR-SCH-004. Enforcement genuinely lives in dental-scheduling, but the owner-of-record contract is unverified here.
- **Fix:** Type `working_hours` (jsonb + zod shape) and expose a validated `getWorkingHours(branchId): WorkingHours` from the facade with a contract test; or relocate BR-SCH-004 to the dental-scheduling spec.
- **Autofixable:** No.

### V-ORG-004 — Org-context default-branch & member resolution scan all branches/members in app code (perf §16 + correctness)
- **Severity:** P1 (perf/correctness; not a security gap)
- **Spec:** §16 staff list < 500ms / dashboard < 2s; §13 "zero active branches → empty".
- **Location:** `getOrgContext.ts:38-45` (`branchRepo.listByOrg` then `.find(b => b.active)`, then `memberRepo.listByBranch(branch.id)` then `.find(m => m.personId === user.id)`); `getBranchesByUser.ts` (two-query fan-out is fine), `listMembers.ts:34-41` (loads ALL members then slices in JS for pagination).
- **What's wrong:** Default-branch and own-membership are resolved by loading full collections and filtering in JS rather than a scoped `WHERE active=true LIMIT 1` / `WHERE personId=? AND branchId=?`. `listMembers`/`DentalMembershipManagement_list` fetch every member then paginate in memory (`allItems.slice(offset, offset+limit)`), so the `limit`/`offset` contract doesn't bound the DB read — violates the §16 staff-list budget at scale (≤100/branch is tolerable today, but the pattern is wrong and `total` is computed by full load).
- **Fix:** Push `active`/`personId` filters and `LIMIT/OFFSET` into the repo queries; compute `total` with a `count()`.
- **Autofixable:** No.

---

## P2 — Medium (Should fix)

### V-ORG-005 — Required-field/enum validation inconsistent across create paths; surfaces as 500/DB-constraint instead of 422 `ORG_VALIDATION` (§7 / §15)
- **Severity:** P2
- **Location:** `DentalOrganizationManagement_create.ts:32-37` and `DentalBranchManagement_create.ts:38-47` rely on the **generated** validator + DB NOT-NULL (e.g. `BranchRepository.createOne` throws a plain `Error('timezone is required')` → 500, not 422); `createOrganization.ts:29-37` *does* validate name/tier/countryCode → 422 but `country_code` is only `.toUpperCase().slice(0,2)` with no ISO-3166 membership check, and `timezone` is never validated as IANA.
- **What's wrong:** Two org-create handlers exist with different validation rigor; branch `timezone`/`city`/`address` presence and `country_code`/`timezone` value validity are not uniformly enforced at 422. Spec §7 marks these required and §15 maps invalid input to 422.
- **Fix:** Validate `country_code` against an ISO alpha-2 set and `timezone` against IANA in all create handlers; convert repo `Error` throws to `ValidationError` (422). Consolidate the duplicate org-create handlers.
- **Autofixable:** Partial.

### V-ORG-006 — `DentalMembershipManagement_create` is a deprecated duplicate of `createMember` still registered in routes (API contract / duplication)
- **Severity:** P2
- **Location:** `DentalMembershipManagement_create.ts:1-11` (self-documented `@deprecated`, Sunset 2026-09-01) — still imported by `generated/openapi/registry.ts`; canonical is `createMember.ts`.
- **What's wrong:** Two live endpoints create memberships (`POST …/branches/:branchId/members` and `POST /dental/org/members`). Both enforce tier limits + owner role, but maintaining two paths risks drift (the deprecated one already lacks the zod body schema `createMember` has, and uses a looser role cast `body.role as typeof …role._.data`).
- **Fix:** Remove the deprecated operationId from the spec, regenerate routes, delete the shim after the sunset window.
- **Autofixable:** No.

### V-ORG-007 — Audit-viewer query params use camelCase + `limit`/`offset` vs spec snake_case + `page` (§10, EM-AUD-013 — spec-acknowledged)
- **Severity:** P2
- **Location:** audit-events viewer + `listMembers`/fee-schedule pagination (`parsePagination` → `limit`/`offset`).
- **What's wrong:** Documented in spec §10 "Known contract gaps (EM-AUD-013)" — deferred to a normalization pass.
- **Fix:** Normalize naming/pagination, or ratify camelCase + limit/offset in the spec.
- **Autofixable:** No.

### V-ORG-008 — PIN endpoints absent from `sdk-ts` (§10, EM-AUD-013 — spec-acknowledged)
- **Severity:** P2
- **Location:** `DentalMembershipManagement_{setPin,verifyPin}.ts`, `resetMemberPin.ts`, `pinRecovery.ts` exist server-side; no SDK bindings.
- **What's wrong:** Contract-completeness gap (spec: "PIN UI is local-only, no frontend consumer yet").
- **Fix:** Generate SDK bindings when the PIN UI ships, or mark endpoints `x-internal`.
- **Autofixable:** No.

### V-ORG-009 — `recoverPin` newPin accepts 4-6 digits while `resetMemberPin`/spec reset require exactly 6 (§10 PIN contract drift)
- **Severity:** P2
- **Location:** `pinRecovery.ts:25` (`/^\d{4,6}$/`) vs `resetMemberPin.ts:19` and spec §10 reset (`/^\d{6}$/` "exactly 6 digits").
- **What's wrong:** The two PIN-reset paths disagree on policy: self-service recovery lets a user set a 4- or 5-digit PIN, undercutting the 6-digit reset standard the spec states for `reset-pin`. Inconsistent credential strength.
- **Fix:** Align `recoverPin` newPin to the same policy as set/reset (decide 4-8 vs exactly-6 and apply uniformly across set/verify/reset/recover).
- **Autofixable:** Yes.

---

## P3 — Low (Nice to fix)

### V-ORG-010 — 9-role `member_role` enum vs 4-role ROLE_PERMISSION_MATRIX (terminology/matrix sync)
- **Severity:** P3 (spec declares the MODULE_SPEC 9-role catalog the source of truth and reconciles the gap)
- **Location:** `repos/membership.schema.ts:10-20,53-63` (9 roles) vs `ROLE_PERMISSION_MATRIX.md` (4).
- **Fix:** Backfill `hygienist`/`dental_assistant`/`front_desk`/`billing_staff`/`read_only` into the matrix so cross-module audits see all 9.
- **Autofixable:** Yes (doc edit).

### V-ORG-011 — Acceptance-criteria coverage thin: 3 ACs for 14 endpoints (spec gap, §11)
- **Severity:** P3
- **Location:** `MODULE_SPEC.md §11`.
- **What's wrong:** No AC for state machine, PIN lockout (BR-016b), imagingTier gate (BR-016c), hash redaction (G7-S2), tier limits, or owner IDOR — though the code implements & tests several of these. Behavior outruns written ACs.
- **Fix:** Add AC-ORG-004..N for lockout, tier gate, IDOR, hash redaction, state machine.
- **Autofixable:** No.

### V-ORG-012 — 10 one-line re-export shim handlers add route-to-impl indirection (consistency)
- **Severity:** P3
- **Location:** `createConsentTemplate.ts`, `listConsentTemplates.ts`, `updateConsentTemplate.ts`, `deleteConsentTemplate.ts`, `getBranchSettings.ts`, `updateBranchSettings.ts`, `recoverPin.ts`, `setSecurityQuestion.ts` (→ `consentTemplates`/`branchSettings`/`pinRecovery`), and `getWorkingHours.ts`/`updateWorkingHours.ts` (→ `../dental-scheduling/workingHours`).
- **What's wrong:** Pure re-exports increase surface area and make tracing indirect; two cross into `dental-scheduling`, blurring the module boundary.
- **Fix:** Register routes against the consolidated files directly and delete the shims, or document the convention.
- **Autofixable:** Yes.

---

## What's Compliant (verified against real code)

- **BR-016 / AC-ORG-001 (auth spine):** Every mutation/read path calls `assertBranchAccess` or `assertBranchRole(['dentist_owner'(,'dentist_associate')])` from `handlers/shared/`. `dental-org-auth-p0.test.ts` proves 403 for non-member/non-owner across branch-create, branch-list, member-invite, deactivate, recover-pin, org-get (EF-ORG-001/002/003/004, EM-ORG-001/006). ✓
- **EF-ORG-P020 (revoked-member bypass closed):** `getMemberRole` in `branchSettings.ts:26` and `consentTemplates.ts:33` filter `status='active'`; `org-member-role-active.test.ts` proves revoked/inactive/invited → null role → 403. ✓
- **EF-ORG-P022:** `getOrgContext` only auto-selects `active` branches; tested. ✓
- **IDOR guards:** setPin/verifyPin/resetPin/recoverPin/deactivate all look up the target's `branchId` first, then `assertBranchAccess`; cross-branch reset is 403 (EF-ORG-P015 tested). ✓
- **BR-016b (PIN lockout):** `recordFailedPinAttempt` applies 30s @5 / 5min @10; `isLockedOut` gates verify/recover with 429. ✓
- **Hash redaction (G7-S2):** `pinHash`/`securityAnswerHash`/`securityQuestion` stripped from every membership response (`listMembers`, `DentalMembershipManagement_{list,deactivate,setPin}`, `updateMember`, `createMember`). ✓
- **BR-016c (imagingTier gate):** `org-imaging.facade.getImagingTierForBranch` + `resolveImagingTier` (null→'free') feed ceph gating. ✓
- **Tier limits (FR6.3):** `countActiveStaffByBranch` excludes owner; `createMember`/`DentalMembershipManagement_create` enforce solo=2/clinic=5/group=20/enterprise=∞ → 409. ✓
- **Audit on org/branch/membership create+deactivate:** AL-001..AL-004 `logAuditEvent` with `tenantId`+`branchId`; PII deliberately kept out of metadata (V-AUD-001 comment). `membership-audit-regression.test.ts` locks the routed paths. ✓ (gaps only on fee/settings/consent — V-ORG-002)
- **Uniqueness constraints exist:** `dental_org_name_owner_unique` (org name+owner); `dental_membership_person_branch_unique` partial index `WHERE person_id IS NOT NULL` (one membership per person+branch). ✓
- **Consent soft-delete:** `deleteConsentTemplate` sets `active=false`; `listConsentTemplates` filters `active=true`. ✓
- **Dashboard financials gated to dentist_owner** (N-ORG-01), matching the matrix. ✓
- **Role-change self-promotion blocked:** `updateMember` requires caller be active `dentist_owner` (G7-S3). ✓

---

## Verdict

**WARN.** No P0. The dental-org authorization spine is the most thoroughly hardened part of the module — shared `assertBranchAccess`/`assertBranchRole`, active-only role resolution, IDOR target-branch lookups, credential redaction, lockout, and tier limits are all implemented and covered by dedicated TDD-proof tests hitting the real routed handlers. The 4 P1s are functional/spec-fidelity gaps: an unguarded membership state machine (+ an unreconciled `revoked` enum value), missing audit rows on fee-schedule/branch-settings/consent mutations, an unverified BR-SCH-004 working-hours contract, and load-all-then-filter query patterns that breach the §16 perf budget at scale. Fix before ship; none is independently exploitable.
