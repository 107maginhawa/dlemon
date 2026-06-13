# Workflow verification — `person` module

Branch `chore/workflow-verification-sweep`. Spec-light module (no
`docs/product/modules/person/MODULE_SPEC.md`) → verified against IDEAL §3 person
row, `specs/api/src/modules/person.tsp`, and the handler code. Person is the
base-platform PII safeguard (a frozen upstream-template module).

## Scope

The base `person` module's FE surface is the user's OWN profile, whose only
workflow is **new-user signup → onboarding wizard → create own Person**
(`createPerson`), with `getPerson('me')` loading the current profile in
`app.tsx`/`__root.tsx`/`onboarding.tsx`. There is no post-onboarding
profile-edit route (`updatePerson`/`listPersons` have no FE consumer).
Clinic/branch "settings" = the dental-org module (out of scope). Consent
(marketing/data_sharing/sms/email) is NOT a person-module concern — see Deferred.

## Personas driven

- **Owner / authenticated user (own profile)** — a brand-new run-unique signup
  acting as the owner of their own Person record (the persona that performs the
  person workflow; demo users like Dr. Maria Reyes already have a Person so the
  `requireNoPerson` guard bounces them off `/onboarding`).
- **RBAC negative** — driven at two layers: FE owner-guard (an already-onboarded
  user cannot re-enter `/onboarding`, CP5) and contract layer (a second user gets
  **403** reading the first user's record — added to `person-lifecycle.hurl`).

## CP table (smoke: `apps/dentalemon/tests/smoke/person_smoke.py`)

| CP | Workflow | Result |
|----|----------|--------|
| CP1 | Signup (run-unique email) → dev verify-email → `/onboarding` Step 1 renders | PASS |
| CP2 | Step 1 personal info (name + DOB calendar popover + gender) → Next → Step 2 | PASS |
| CP3 | Step 2 "Skip for now" → `createPerson` POST /persons 201 → leaves `/onboarding` | PASS |
| CP4 | Coherence: `getPerson('me')` GET /persons/me 200 (own profile readable) | PASS |
| CP5 | RBAC/owner guard: re-navigating `/onboarding` redirects away (`requireNoPerson`) | PASS |

Smoke final datum: **5/5 CP pass**, exit 0. Evidence: `screenshots/*.png` +
`final_script_log.txt` in this dir.

## STEP 3a — static contract diff (per operation)

ZERO Type-A shape drift. All four ops are byte-consistent across
`.tsp` ↔ validator ↔ handler return ↔ SDK type ↔ FE consumer:

| op | request | response | FE consumer | verdict |
|----|---------|----------|-------------|---------|
| createPerson | `PersonCreateRequest` (firstName req) | `Person` 201 | onboarding.tsx | MATCH |
| getPerson | param `UUID \| "me"` | `Person` 200 | app/__root/onboarding `{person:'me'}` | MATCH |
| updatePerson | `PersonUpdateRequest` (all opt, nullable-clear) | `Person` 200 | none | MATCH |
| listPersons | `PaginationQuery` | `{data, pagination}` 200 | none | MATCH (no `{items}` drift) |

`Person` carries no `consent` field at any layer (correct).

## Gaps fixed

None requiring a code fix — no Type-A gap (no BR/AC citation, no 3a shape
mismatch, no broken happy-path or failed coherence oracle). `ran_regen: false`.

## Tests added (STEP 5b backfill — passing green pins)

- **`specs/api/tests/contract/person-lifecycle.hurl`** — added the
  `GET /persons/me` alias read (the exact path the FE uses; previously
  untested at the contract layer) **and** a cross-user **403** PII-safeguard
  RBAC negative. 7 requests, Succeeds. The whole-journey FE pin is
  `person_smoke.py` (committed). Backend (`src/handlers/person/*.test.ts`,
  38 tests) and FE unit (person/onboarding, 62 tests) already pin the rest —
  not duplicated.

## Deferred / report-only (Type C — default-deny, no citation to fix)

- **`getPerson` role drift** — `.tsp` lists `[admin, support, user:owner]` but
  the handler enforces owner-only. *More restrictive* (denies admin/support,
  never leaks); no BR/AC requires admin read; no FE consumer. Report-only.
- **Consent (marketing/data_sharing/sms/email)** — NOT on any person endpoint.
  `br-registry` records the legacy 4-flag model as "never implemented, removed";
  the single-consent model (`{registrationConsent, capturedAt}`) lives in
  dental-patient registration (V-PAT-004), not person. Intentional; do not add.
- **`updatePerson`/`listPersons` have no FE consumer**, and
  `preferences-form`/`contact-info-form` are unmounted base-template components.
  Half-wired base primitives; no citation. Report-only.

## Gate

- typecheck (FE + api-ts): **0 errors**
- backend (`src/handlers/person`): **38 pass / 0 fail**
- contract: **person-lifecycle.hurl + person-validation.hurl Succeed**; 8 failures
  are exactly the standing infra baseline (storage*/dental-imaging*/dental-assistant/
  billing-lifecycle/auth-verification/auth-password-reset — MinIO + Mailpit down).
  No NEW failures.
- lint: **0 errors** (358 pre-existing warnings) · boundaries: **clean**
- FE unit (person + onboarding): **62 pass / 0 fail**
- committed smoke: **5/5 CP pass**, exit 0

## Evidence

- `person_smoke.py` (canonical) + `final_script_log.txt`
- `screenshots/final_execution_1_onboarding_step1.png` … `_5_reentry_blocked.png`
