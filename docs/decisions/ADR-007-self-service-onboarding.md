# ADR-007: Self-Service Clinic Onboarding via a New Guarded Endpoint

**Status**: Accepted
**Date**: 2026-06-03
**Context**: Organization creation is platform-admin-only today — `DentalOrganizationManagement_create` (POST `/dental/organizations`) requires `user.role === 'admin'` (audited P0 **EM-ORG-002**). Investigation proved this breaks real onboarding: the signup wizard (`onboarding-wizard.tsx`) POSTs `/dental/organizations` and 403s for every normal clinic owner; the demo seed only works because `demo@dentalemon.com` is silently in `AUTH_ADMIN_EMAILS`. The code conflated **platform superadmin** (Better-Auth `role: 'admin'`) with **tenant owner** (`ownerPersonId`). Industry practice (Slack/Notion/Stripe; Jane/Curve/tab32) is self-service workspace creation where the creator becomes the tenant owner, behind guardrails, with platform-admin a separate elevated capability. Two expert reviews (security + architecture) validated the thesis.

---

## Decision

**Add a NEW, separate self-service endpoint `POST /dental/onboarding` and leave the audited admin endpoint untouched.**

- `POST /dental/onboarding` (`createOnboarding` handler) is pure self-service — **no admin branch**. For the authenticated caller it transactionally creates: a `dental_organization` (`ownerPersonId = caller`, `status = 'provisional'`), a default `dental_branch`, and the caller's `dentist_owner` `dental_membership`. Returns `{ organizationId, branchId, membershipId }`.
- **`POST /dental/organizations` keeps its `user.role === 'admin'` gate verbatim. EM-ORG-002 stays enforced and audit-honest** — this is an *added, compensated capability*, NOT a relaxed P0. The admin endpoint remains the controlled platform-provisioning surface.

**Compensating guardrails on the self-service endpoint (no role bypass):**

1. **Verified email — required in production** via its OWN check (`NODE_ENV === 'production' && !user.emailVerified → 403 EMAIL_NOT_VERIFIED`). Deliberately decoupled from the sign-in `requireEmailVerification` flag so disabling that operational lever can never silently drop this PHI-provisioning control. Relaxed in dev/test so local/CI signups onboard.
2. **One active org per owner** — app-level pre-check → friendly `409 ORG_LIMIT_REACHED`, backed by the race-safe DB partial-unique index `dental_org_one_active_per_owner ON dental_organization (owner_person_id) WHERE active = true AND tier IN ('solo','clinic')`. The unique index is the load-bearing control; the pre-check is the friendly path.
3. **Self-service tiers only** — `solo`/`clinic`; `group`/`enterprise` (legitimately multi-org) are provisioned via admin/sales → `403 TIER_NOT_SELF_SERVICE`.
4. **Per-IP rate limit** — `FixedWindowRateLimiter`, documented as a single-instance **stopgap**; the one-active-org index is the real abuse control.

**Audit attribution fixed:** the onboarding audit row records the REAL actor role (`dentist_owner`) and `mode: 'self-service'` — never the hardcoded `actorRole: 'admin'` the admin path uses.

---

## Rationale

| Concern | New endpoint (chosen) | Relax EM-ORG-002 in place (rejected) |
|---------|------------------------|--------------------------------------|
| **Audit integrity** | The audited `user.role === 'admin'` assertion is literally untouched and still enforced on `/dental/organizations`; the audit/oli-check trail stays honest | Deleting the assertion + rewriting the spec so oli-check re-passes is relaxing a P0 by redefinition |
| **Trust boundaries** | Platform-admin, tenant-owner, and branch-role stay cleanly separated; becoming an org owner grants no platform-admin | Conflates the two surfaces on one handler with a role branch |
| **Spam/abuse** | verified-email + one-active-org index + rate-limit bound creation; index is race-safe | Same guardrails possible but entangled with the admin path |
| **Half-provisioned tenants** | One transactional call (org+branch+owner) removes the multi-call failure mode the wizard had | Unchanged |

---

## Consequences

- **Positive:** Real clinic owners self-onboard; the demo seed stops masquerading as admin (`demo@dentalemon.com` dropped from default `AUTH_ADMIN_EMAILS`; `db:reseed` provisions via `/dental/onboarding`); contract + self-seed E2E bootstraps use one onboarding call; EM-ORG-002 stays a live, enforced control.
- **Accepted trade-offs / fast-follows (designed, not built here):**
  - **PHI go-live gating (security P1).** The `status` column lands now as the **hook only** (`provisional` on self-service, `live` for admin/seed/back-compat). **Nothing enforces on it yet.** Fast-follow: transition `provisional → live` on BAA/terms acceptance and gate patient/imaging/clinical writes on `status = 'live'`.
  - **Sybil resistance.** One-org-per-*owner* is defeated by N accounts × 1 org each; verified-email raises but does not eliminate throwaway-identity cost. Bounded acceptably for launch; revisit with per-identity persistent limits.
  - **Defense-in-depth.** No DB RLS exists (app-level isolation only); a per-identity persistent rate limit (shared store) and RLS are recommended before GA.

---

## References

- `services/api-ts/src/handlers/dental-org/createOnboarding.ts` — the self-service handler + guardrails
- `services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts` — admin endpoint, EM-ORG-002 gate UNTOUCHED
- `services/api-ts/src/generated/migrations/0088_sloppy_sprite.sql` — `status` hook column + `dental_org_one_active_per_owner` partial unique index
- `specs/api/src/modules/dental-org.tsp` — `DentalOnboarding` interface / `OnboardingRequest` / `OnboardingResponse`
- `docs/audits/enforce/module/dental-org.md` — EM-ORG-002 (now annotated: enforced + compensated by this ADR)
- Plan + reviews: `splendid-roaming-kitten.md` (+ security/architecture review reports)
- Supersedes the admin-token-threading approach in `docs/reviews/TEST_BOOTSTRAP_FOLLOWUP.md`
