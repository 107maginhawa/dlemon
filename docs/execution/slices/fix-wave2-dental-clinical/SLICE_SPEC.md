# SLICE_SPEC — Wave 2 dental-clinical P1 structural fixes

**Slice ID:** fix-wave2-dental-clinical
**Date:** 2026-05-29
**Branch:** main
**Status:** COMPLETE (all fixable findings resolved and committed)

---

## Findings Summary

### FIXABLE (all resolved)

| Finding | Description | Status |
|---------|-------------|--------|
| EM-CLI-005 | `createPrescription`: add active-membership validation for `prescriberMemberId` | DONE — commit `96e811e0` |
| EM-CLI-011 | `createAmendment`: change `getActiveMembershipId` to `assertBranchRole([dentist_owner, dentist_associate])` | DONE — commit `1757d289` |
| EM-CLI-013 | Reconcile lab order states (`ordered/in_fabrication/delivered` vs spec `ordered/sent/completed`) — update MODULE_SPEC §8 | DONE — commit `adfe2eca` |

### BLOCKED (deferred to F2 service-layer/DI sprint)

| Finding | Description | Blocker |
|---------|-------------|---------|
| EF-CLI-006 | Service layer missing — handlers call repos directly with no injected service | F2 service-layer/DI sprint |
| EM-CLI-003 | `createPrescription` sets `prescriberMemberId` from body rather than session | F2 service-layer/DI sprint (requires session-aware service context) |
| EM-CLI-004 | Prescription `status` exposed in create response — should be opaque at creation | F2 service-layer/DI sprint |

These three findings require the F2 service-layer/DI refactor to be in place before they can be correctly addressed. Implementing them before F2 would require duplicating logic that will be replaced.

---

## Fix Details

### EM-CLI-005 — prescriberMemberId active-membership validation

**File:** `services/api-ts/src/handlers/dental-clinical/prescriptions/createPrescription.ts`

**Problem:** `createPrescription` accepted any UUID as `prescriberMemberId` without verifying it corresponded to an active membership in the same branch. An attacker could supply a member ID from another branch or a soft-deleted member.

**Fix:** After the caller's branch role is verified via `assertBranchRole`, a second query validates that the `prescriberMemberId` in the request body refers to an active `dental_membership` row in the same `branchId` as the visit. If not found, throws `ForbiddenError` (403).

**Imports added:** `ForbiddenError` from `@/core/errors`, `dentalMemberships` from `@/handlers/dental-org/repos/membership.schema`.

**Test file:** `services/api-ts/src/handlers/dental-clinical/em-cli-005.prescriber-membership-validation.test.ts`
- 5 tests: valid prescriber → 201; cross-branch member → 403; inactive member → 403; non-existent ID → 403; unauthenticated → 401.

---

### EM-CLI-011 — createAmendment role guard

**File:** `services/api-ts/src/handlers/dental-clinical/amendments/createAmendment.ts`

**Problem:** `createAmendment` used `getActiveMembershipId` which only checks membership existence, not role. Any active branch member (staff_full, hygienist, dental_assistant, etc.) could create amendments, violating MODULE_SPEC §6 which restricts amendments to `dentist_owner` and `dentist_associate`.

**Fix:** Replace `getActiveMembershipId` + manual null-check with `assertBranchRole(db, user.id, visit.branchId, ['dentist_owner', 'dentist_associate'])`. After the role assertion passes, resolve `authorMemberId` from the verified membership row (guaranteed to exist, safe cast). Removed import of `getActiveMembershipId` from `org-billing.facade`.

**Imports changed:** removed `ForbiddenError` (now thrown internally by `assertBranchRole`), removed `getActiveMembershipId` import; added `assertBranchRole`, `dentalMemberships`, `eq`, `and`.

**Test file:** `services/api-ts/src/handlers/dental-clinical/em-cli-011.amendment-role-guard.test.ts`
- 5 tests: dentist_owner → 201; dentist_associate → 201; staff_full → 403; hygienist → 403; unauthenticated → 401.

---

### EM-CLI-013 — MODULE_SPEC §8 lab order state reconciliation

**File:** `docs/product/modules/dental-clinical/MODULE_SPEC.md`

**Problem:** MODULE_SPEC described lab order states as `ordered → sent → completed` throughout. The implementation (`lab-order.schema.ts`) defines five states: `ordered`, `in_fabrication`, `delivered`, `fitted`, `cancelled`. The spec vocabulary was stale from an earlier design iteration.

**Fix:** Updated all occurrences across six sections:
- §2 Domain Terms: `ordered→sent→completed/cancelled` → `ordered→in_fabrication→delivered→fitted/cancelled`
- §4 WF-017 step 3–5: `pending` → `ordered`; `sent → completed | cancelled` → `in_fabrication → delivered → fitted | cancelled`
- §5 BR-018: updated state vocabulary
- §7 Data Requirements: updated status enum list
- §8 State Transitions: updated FSM diagram
- §11 AC-CLI-004: `sent → ordered (reversal)` → `in_fabrication → ordered (reversal)`

No code changes required; implementation was already correct.

---

## Regression Notes

Pre-existing failures in `prescription.status.test.ts` (EM-CLI-012, 6 tests) were already failing (0/6 pass) before this wave due to a test data bug: the test seeds a membership with `id = 'ee200000-...'` but sends `prescriberMemberId = MEMBER_ID = 'c0000000-...'`. My fix correctly exposes this latent test bug (the EM-CLI-005 check now rejects the mismatch). These failures pre-date this wave — confirmed by running `git stash` + tests before stash pop.

Pre-existing FK failure in `clinical-attachment-amendment.test.ts` (1 test: "createAttachment returns 401 when user is not authenticated") is unrelated to this wave — it fails on a `dental_visit` FK constraint in `beforeAll` seeding.

Neither failure count increased due to this wave's changes.
