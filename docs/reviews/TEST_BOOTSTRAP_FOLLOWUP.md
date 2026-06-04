# Follow-up A — Test-bootstrap rework for admin-gated org creation

> **SUPERSEDED 2026-06-03 by the self-service onboarding work.** The conclusion below
> ("org admin-gating is intended; thread an admin token into the bootstraps") was
> reversed: investigation proved admin-only org creation is a real product bug (a clinic
> owner cannot onboard). The fix shipped is a NEW guarded endpoint `POST /dental/onboarding`
> (the admin endpoint + EM-ORG-002 stay enforced and untouched). The test bootstraps now
> use ONE `/dental/onboarding` call instead of admin-token threading. See
> **`docs/decisions/ADR-007-self-service-onboarding.md`** and the plan
> `~/.claude/plans/splendid-roaming-kitten.md`. This file is kept for history only.
>
> _Original (now-obsolete) note below._

> Created 2026-06-03 during the "run the authored E2E + contract tests" pass.
> Scope decision (with the user): **do this as a follow-up**; org admin-gating is **intended**
> (admins / seed provision orgs — no product change). This doc is the spec for that follow-up.

## The root cause

`createOrganization` is wired to `DentalOrganizationManagement_create`
(`services/api-ts/src/handlers/dental-org/DentalOrganizationManagement_create.ts`), which
**requires `user.role === 'admin'`** (EM-ORG-002). Signup assigns `role` from an exact-match
`AUTH_ADMIN_EMAILS` list, else `defaultRole: 'user'` (`services/api-ts/src/core/auth.ts:120-182`).

Every test bootstrap **signs up a fresh `user`-role identity and immediately `POST /dental/organizations`**,
so it now gets **403** — they've been silently broken since EM-ORG-002 landed (CI's contract job is
non-blocking, so nobody noticed). This blocks:

- **All dental contract files** (`specs/api/tests/contract/dental-*.hurl`) — they 403 at the org-create setup step.
- **All self-seed E2E specs** — `signUpSeedOrgAndVisit()` and equivalents in
  `apps/dentalemon/tests/e2e/{perio-charting,reminders-confirm,recall-due-list,insurance-claims,perio-voice-charting}.spec.ts`.

Downstream drift compounds it (observed live against the running API):
- `POST /dental/patients` now **requires `branchId`** (contract files omit it → 400).
- `GET /dental/patients/{id}/treatment-plan` and `…/treatment-plan/accept` now **require `?branchId=`**.
- `…/treatment-plan/versions/{versionId}` takes a **UUID**, not the integer `1`.
- After-org ops gate on **org ownership** (`org.ownerPersonId === user.id`) — branch/member creation
  (`DentalBranchManagement_create`, `DentalMembershipManagement_create`), not on a branch role.

## The fix (no product change)

### Contract files (`specs/api/tests/contract/dental-*.hurl`)
The runner's admin preflight already signs up `admin@contract-tests.local` (must be in
`AUTH_ADMIN_EMAILS` — now set in `.github/workflows/contract.yml`) and injects **`{{admin_token}}`**.
Rework each dental file's setup block to:
1. Create the **org** with `Cookie: better-auth.session_token={{admin_token}}` (admin → owner).
2. Create the **branch** with `{{admin_token}}` (only the owner may).
3. Add the per-file signed-up user as a **member** with `{{admin_token}}` (`personId={{user_id}}`, a `dentist_owner`/role).
4. Run the **module operations under test** with the user's own `{{session_token}}` (so role-gating
   fidelity is preserved — the clinician, not the admin, exercises the feature).
Also add the now-required `?branchId={{branch_id}}` / `branchId` body field where the live API demands it,
and use the captured version **UUID** for treatment-plan version reads (already fixed in `dental-patient.hurl`
this session as the template — mirror it).

### E2E self-seed helper(s)
`signUpSeedOrgAndVisit()` (and siblings) must provision the org/branch as an **admin**, then operate as the
clinician member. Options, simplest first:
- Sign in as the seeded admin `demo@dentalemon.com` (in `AUTH_ADMIN_EMAILS`, exists after `bun run db:reseed`)
  via a `fetch` to `/auth/sign-in/email`, create org+branch+member with that cookie jar, then continue the spec
  as the freshly-signed-up clinician. Requires the demo admin creds + a reseeded test DB.
- Or seed entirely against the demo data: sign in as an existing demo clinician and use a demo branch/patient,
  skipping self-provisioning. Lower fidelity but no admin juggling.

## Verify
- Contract: `bun run infra:up` (Postgres+MinIO+Mailpit) → boot `services/api-ts` (`.env` already has
  `AUTH_ADMIN_EMAILS` incl. `admin@contract-tests.local`) → `bun run test:contract`. Note: imaging contract
  files (`dental-imaging*.hurl`) additionally need a MinIO bucket (`monobase-files`) + working presign/multipart.
- E2E self-seed: `bun run test:e2e` (Playwright now auto-boots the API + web). The 5 self-seed specs should
  drive real flows green; they currently `test.skip()` when seeding throws.

## Already done this session (so A starts from here)
- `dental-patient.hurl` treatment-plan block fixed (hurl-8 syntax + branchId + version UUID) — use as the template.
- `AUTH_ADMIN_EMAILS` added to the contract CI workflow.
- Playwright auto-boots the API (`apps/dentalemon/playwright.config.ts`), so self-seed specs reach a live API.
- `infra:up` brings the dev deps up with one command.
- `/imaging-test` + `/imaging-comparison-test` harness routes exist, so the **imaging** E2E specs (mocked API,
  no org) already run — they are NOT part of this follow-up.
