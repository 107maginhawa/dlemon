# Org / Auth & Staff — Standards & Experience Review
> Review date 2026-06-02 · Depth: LIGHT (table-stakes)

## 1. What we have
Multi-tenant org/branch model with role-based access. Roles enum `dentist_owner | dentist_associate | hygienist | staff_full | front_desk` (`dental-org/repos/membership.schema.ts`); organization + branch + membership CRUD; per-branch access enforced via `assert-branch-access` / `assert-branch-role` across handlers. Chairside **PIN** flow: `setPin`/`verifyPin` with bcrypt `pinHash`, security-question recovery (`pinRecovery.ts`, `recoverPin.ts`, `setSecurityQuestion.ts`), failed-attempt **lockout** (`recordFailedPinAttempt`, `isLockedOut`, `pinLockedUntil`). Heavy auth-hardening test coverage (`auth-security-hardening.test.ts`, `dental-org-auth-p0.test.ts`, `pin-digit-pattern.test.ts`). Org-level audit convergence tests (`dental-org-audit-convergence.test.ts`, `membership-audit-regression.test.ts`). Branch settings + working hours + fee schedule + consent templates. Frontend: `features/settings/` and `features/staff/`.

## 2. Table-stakes gaps
| Capability | Industry table-stakes | Our status | Evidence | Severity |
|---|---|---|---|---|
| Role-based permissions | Granular per-feature perms by user group | ⚠️ | 5 fixed roles enforced per handler (`assertBranchRole`); **roles are coarse/hard-coded, no per-feature permission grid** | P2 |
| Multi-location | Per-user clinic restriction | ✅ | Membership is per-branch; `getBranchesByUser.ts`, `assertBranchAccess` scope every call | — |
| PIN / quick user-switch | Fast chairside login/switch | ⚠️ | Implemented (bcrypt + lockout + recovery) but **session drops across route trees** (see findings) | P2 |
| Password rules + auto-logoff | Strength enforcement, auto log-off, lock dates | ⚠️ | PIN lockout present; Better-Auth handles passwords; **auto-logoff / idle timeout not verified** | P2 |
| Access audit trail | Log every login/logoff + record edits | ✅ | Org mutations audited; PHI reads audited (`patient.view`); append-only store (see pmd-audit review) | — |
| Provider credentials | License/NPI on provider record for claims | ❓ | `provider/` handler exists but NPI/license fields not confirmed; claims are draft-only so unused downstream | P2 |

## 3. Notable findings
- **[P2] PIN session drops on workspace↔dashboard navigation.** Crossing between the `_workspace` and `_dashboard` route trees (e.g. "Profile" from workspace) bounces to `/auth/pin-select`, forcing PIN re-entry — friction for the chairside switching journey. Decide intended PIN-session lifetime and persist it across the route-tree boundary, or scope re-auth to genuine privilege changes. Evidence: `LIVE_AUDIT_NOTES.md` CC-2.
- **[P2] Roles are coarse and hard-coded.** Five fixed roles enforced inline per handler; no user-group / per-feature permission grid as in Open Dental. Fine for MVP, but customers expect configurable permissions. Recommend a permission matrix layer if/when multi-role practices onboard.
- **[P2] Auto-logoff / idle timeout unverified.** PIN lockout exists for failed attempts, but HIPAA workstation auto-logoff after idle was not confirmed; verify session idle expiry.
- **[P2] Provider credential fields (NPI/license) unconfirmed** — needed once real claim submission lands.

## 4. Carousel relevance
Low. Org/auth is configuration/identity, not patient-longitudinal. Possible secondary angle: **staff activity timeline** (audit-driven) per member, but not a core carousel surface.
