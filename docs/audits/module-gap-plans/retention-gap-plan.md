# Module Gap Plan — `retention` (data-retention governance engine)

**Date:** 2026-06-09
**Auditor:** module workflow/usability audit (`/webwright`-style, but adapted — see note)
**Module:** `services/api-ts/src/handlers/retention/`
**Audit Decision:** ⚠️ **PARTIAL PASS**

> **`/webwright` note.** Webwright drives a live browser. The `retention` module
> has **no HTTP API and no frontend by design** (engine + cron + policy registry;
> see `handlers/retention/README.md` and ARCHITECTURE invariant 3). There is
> nothing to drive in a browser. This audit was therefore conducted via code +
> wiring + test + spec verification — the correct method for a headless module.
> The *absence of a browser session is itself a finding*, not an omission.

> **Disambiguation.** Two unrelated "retention" concepts exist in this repo:
> 1. **Data-retention governance** (this module) — archives expired records per
>    policy. BUILT.
> 2. **Patient-relationship / CRM "retention workflows"** (campaigns, segmented
>    reminders) — listed in `IDEAL_DENTAL_MODULE_WORKFLOW_STANDARD.md` line 305 as
>    **V2 / Deferred**. NOT built; out of scope for this audit.

---

## Audit Decision: PARTIAL PASS

The **engine is production-grade**: every hard safety invariant (dry-run default,
soft-archive-only / no hard-delete path, never-purge-audit, legal-hold exclusion
via the real store, fully audited) is implemented at a single choke point and
covered by tests. The prior deep audit (`MODULE_erasure-legal-hold-retention_AUDIT_2026-06-08.md`)
correctly rated the governance cluster **READY** through a *safety/compliance-invariant*
lens.

This audit applies a different lens — **reliable, usable, testable, product-aligned** —
and on **usability + observability** the module falls short: there is **no operator
surface to view, edit, enable, or audit retention policies**, and **no way to
confirm whether enforcement is running**. In practice that makes the feature
**inert and unverifiable in production** without direct DB + env access. Hence
PARTIAL PASS: the dangerous parts are excellent; the operable parts are missing.

---

## Critical Gaps

| # | Gap | Area | Severity | Why It Matters | Recommended Fix |
|---|-----|------|----------|----------------|-----------------|
| G1 | **No operator surface to view/edit retention policies.** The only way to see what policies exist or change a period/action/`enabled` flag is raw SQL on `dental_retention_policy`. Yet jurisdiction tuning is explicitly required (every seeded row carries "DEFAULT — review against your jurisdiction"). | Usability / product | **P1** | A compliance feature that requires per-jurisdiction review but offers no review surface will, in practice, *never be reviewed*. Clinics silently run conservative defaults they cannot see. | Add a read-only (then editable) admin policy surface: TypeSpec ops `GET/PATCH /dental/retention-policies` in a `dental-*` module calling this lib, + a settings screen. RBAC = admin/DPO, same scope as legal-hold/erasure. |
| G2 | **Enforcement is OFF by default with zero observability.** `RETENTION_ENFORCEMENT_ENABLED` is an env var; the cron is dry-run otherwise. There is no admin-visible "is retention live or dry-run?", no last-run summary, no surfacing of the `retention.dry_run` / `retention.enforced` audit events. | Trust / observability | **P1** | A clinic believing records are being archived per policy cannot confirm it — and cannot tell whether the system is even acting. Combined with G1 the feature is effectively a no-op in prod. (Env-gated-OFF is a *correct* safety posture; the missing piece is **visibility + an operator attestation/enable path**, not auto-enablement.) | Surface last-run outcome + dry-run/live status (read the `compliance` audit events into an admin panel). Document a go-live attestation step. Optionally a manual "run now (dry-run)" preview op. |
| G3 | **3 declared entity types are unenforceable (no target wired).** `clinical` (10y), `visit` (10y), `prescription` (5y) are declared in `DEFAULT_RETENTION_POLICIES` + `DATA_GOVERNANCE §2` but seeded `enabled:false` because no `RETENTION_TARGETS` entry exists. Only `attachment` + `appointment` are actually actionable. | Coverage vs stated policy | **P2** | The governance contract advertises retention for clinical/visit/prescription records, but those will never be archived even with enforcement ON. Partial enforcement of a stated compliance policy. | Per-domain: add a `*-retention.facade.ts` (find-eligible + soft-archive) in the owning module and register a target. Deferred-by-design today — track explicitly so it isn't mistaken for "covered". |
| G4 | **No end-to-end test of the live (enforcement-ON) cron → repo → engine → real facade → DB archive chain.** Engine is tested with injected targets; targets + legal-hold + org-seeding + cron-registration are each tested; but no single test runs `dryRun:false` through the *real* `RETENTION_TARGETS` facades and asserts a row's `deletedAt` is set. | Test completeness | **P2** | The enforcement path (the one that mutates data) is the highest-risk path and is only proven in pieces. A facade regression could silently break real archival. | Add an integration test: seed an old attachment + appointment, run `evaluateRetention(db, …, { dryRun:false })` with the real registry, assert `deletedAt` set + `retention.enforced` audit row; assert a legal-held subject's row is untouched in the same run. |
| G5 | **Misleading code comments reference a non-existent "policy UI".** `retention-defaults.ts:6` ("visible in the policy UI") and `:48` ("so operators see it in the registry") imply an operator surface that does not exist. | Doc/code drift | **P3** | Future maintainers (human or AI) assume a UI exists and won't build G1. Self-contradicting comments erode trust in the spec. | Either build G1 or rewrite the comments to say "stored in the `dental_retention_policy` registry table (no UI yet — see retention-gap-plan G1)". |
| G6 | **Knowledge-graph drift (carried from prior audit).** `domain-graph.json` models retention only as a tag/entity — the enforcement engine, env-gated cron, targets, and the retention→legal-hold exclusion edge have **no flow node**. (Sibling erasure/legal-hold also cite phantom `/dental/data-governance/*` routes.) | KG accuracy | **P3** | Anyone reasoning about blast radius from the KG will miss that retention can archive attachments/appointments and that it depends on legal-hold. | Regenerate the KG (do not hand-edit); add a retention-enforcement flow node + the legal-hold-exclusion edge. |

---

## Expected vs Actual

| Expected (per MODULE_SPEC + DATA_GOVERNANCE) | Actual | Verdict |
|----------------------------------------------|--------|---------|
| Policy-as-data engine, all safety invariants in engine | `retention-engine.ts` — dry-run default, delete→archive downgrade, protected-skip, legal-hold filter, full audit | ✅ Matches |
| Idempotent default-policy seeding on org provisioning | `seedDefaultRetentionPolicies` wired into `DentalOrganizationManagement_create.ts:64` **and** `createOnboarding.ts:205` | ✅ Matches |
| Daily env-gated enforcement cron | `registerRetentionJobs` @ `03:30`, wired `app.ts:283`, dry-run unless `RETENTION_ENFORCEMENT_ENABLED=true` | ✅ Matches |
| Wired targets: attachment, appointment, audit(protected) | `RETENTION_TARGETS` — all three present; legal-hold exclusion via real `personsUnderLegalHold` store | ✅ Matches |
| No HTTP surface (engine + cron only) | Confirmed: no TypeSpec, no generated routes, no SDK client fn, no FE consumer | ✅ Matches (by design) |
| Operators "edit policy rows" / rows "visible in the policy UI" | **No UI, no read/write API — DB-only access** | ❌ Gap (G1) |
| `clinical` / `visit` / `prescription` retention per DATA_GOVERNANCE §2 | Declared but `enabled:false`, no target — never enforced | ⚠️ Partial (G3) |

---

## Broken / Misleading Journeys

- **No user journey exists** (headless module) — so none are "broken" in the UI sense.
- **Misleading operator mental model (G1/G2/G5):** the spec + code imply an operator
  can review/tune policies "in the registry/UI" and that policies are enforced.
  Reality: an operator has no surface to do either and cannot tell that enforcement
  is dry-run-OFF. The *implied* journey ("review and tune your retention schedule")
  is unwalkable.

## Unused / Unwired Implementation

- **None that is dead.** Every export is consumed: engine ← cron + tests; seeder ←
  both org-create paths; targets ← engine; repo ← cron + seeder.
- **`seed-retention-policies.ts`** ops script is a manual backfill (not auto-run) —
  intentional, documented.
- **`legalHoldExempt` policy column** is forward-compat metadata that the engine
  deliberately **never** honors as a bypass — intentionally inert, documented.
- The two `apps/` grep hits for "retention" (`locale-settings.tsx`, `cdt-codes.json`)
  are **incidental display text** ("15-year record retention" regulatory notes), not
  consumers of this module.

## Test Gaps

**Existing (strong):** `retention-engine.test.ts`, `retention-targets.test.ts`,
`retention-defaults.test.ts`, `retention-appointment.test.ts`,
`retention-legalhold.test.ts` (real store), `retention-org-seeding.test.ts`,
`repos/retention-policy.repo.test.ts`, `jobs/jobs.test.ts`. Prior audit: 77 passing
across the governance cluster, gates green (2026-06-08).

**Missing:**
- **(P2, G4)** Live enforcement E2E: `dryRun:false` through the *real* target
  registry → assert `deletedAt` set + `retention.enforced` audit + legal-held row
  untouched.
- **(P2)** Cron-fires integration: assert the registered `retention.enforcement` job
  callback executes end-to-end against a seeded DB (currently only registration is
  asserted).
- **(P3)** If G1 is built: contract + RBAC tests for the new policy GET/PATCH ops
  (admin-only → 403 for non-admin; PATCH cannot set a hard-delete action).

## Permission / RBAC / Security

- **No HTTP attack surface** (no routes) → no RBAC surface to exploit. Cron runs as
  `RETENTION_SYSTEM_ACTOR` (sentinel UUID). Seeder runs inside admin-gated org-create.
- **If G1 adds endpoints**, gate them admin/DPO (same scope as erasure/legal-hold)
  and forbid setting `action:'delete'` from the API (engine downgrades it anyway, but
  reject at the edge for honesty).
- No clinical-history risk: engine **cannot hard-delete**, excludes legal-held,
  never touches the audit trail — the safest possible posture.

## Knowledge-Graph Findings

- `domain:data-governance` captures `RetentionPolicy` as an entity + the
  legal-hold-blocks-erasure rule, but **under-models retention enforcement** (no flow
  node for engine/cron/targets; the retention→legal-hold exclusion edge is missing).
- Sibling flows cite **phantom routes** `/dental/data-governance/*` (real siblings:
  `/dental/erasure-requests`, `/dental/legal-holds`); retention has none.
- **Blast radius:** retention depends on `dental-legalhold` (`personsUnderLegalHold`),
  `dental-clinical` (`attachment-retention.facade`), `dental-scheduling`
  (`dental-appointment-retention.facade`), `dental-audit` (writer), `@/core/jobs`.
  A facade signature change in clinical/scheduling silently breaks archival (→ G4).

---

## Recommended Fix Order

1. **G5 (P3, ~15 min) FIRST — stop the misinformation.** Correct the "policy UI"
   comments to point at this gap plan. Cheap; prevents the wrong mental model while
   the rest is scoped. *Test:* none (comment-only).
2. **G4 (P2) — pin the live enforcement path BEFORE building any UI on top of it.**
   Add the `dryRun:false` real-registry integration test (RED→GREEN). This makes the
   mutation path trustworthy before G1/G2 expose it. *Test added: this is the test.*
3. **G1 (P1) — operator policy surface.** TDD: contract test for `GET /dental/retention-policies`
   (admin-only) RED → TypeSpec op + handler (calling this lib) GREEN → repeat for
   `PATCH`. Then the settings screen (frontend unit test asserting list renders +
   edit persists). *Tests before: contract RED, FE unit RED.*
4. **G2 (P1) — enforcement observability.** Surface last-run status + dry-run/live
   flag (read the `compliance` audit events). *Test:* handler test asserting the
   summary reflects seeded `retention.dry_run`/`enforced` audit rows.
5. **G3 (P2) — extend coverage** for `clinical` / `visit` / `prescription` only if
   product confirms it's in-scope now. Per type: facade (find-eligible + archive) +
   register target + flip default to enabled. *Test:* per-target eligibility +
   legal-hold-exclusion test, mirroring `retention-appointment.test.ts`.
6. **G6 (P3) — regenerate the KG** after the above so the flow node + edges are real.

---

## Dependencies on Other Modules

- **`dental-legalhold`** — `personsUnderLegalHold` (hard dependency; the exclusion
  invariant). Any change here is high blast-radius for retention safety.
- **`dental-clinical`** — `attachment-retention.facade` (archive target).
- **`dental-scheduling`** — `dental-appointment-retention.facade` (archive target).
- **`dental-audit`** — append-only audit writer (G2 reads these events).
- **`dental-org`** — both org-create paths call the seeder (provisioning dependency).
- **`@/core/jobs`** — cron scheduler.
- **G1/G2 new endpoints** would belong in a `dental-*` HTTP module that *calls* this
  lib (per the README rule: never add routes inside `retention/`).

## Existing Tests Found

`retention-engine.test.ts`, `retention-targets.test.ts`, `retention-defaults.test.ts`,
`retention-appointment.test.ts`, `retention-legalhold.test.ts`,
`retention-org-seeding.test.ts`, `repos/retention-policy.repo.test.ts`,
`jobs/jobs.test.ts`. (Prior cluster audit: 77 pass / 0 fail, gates green 2026-06-08.
Not re-executed this session — code unchanged since.)

## Missing Tests (by layer)

- **Backend/integration:** live `dryRun:false` real-registry archive assertion (G4);
  cron-callback end-to-end execution (currently registration-only).
- **Contract:** none today (no HTTP). **Add with G1/G2** (admin-only GET/PATCH, 403
  for non-admin, reject `delete` action at the edge).
- **Frontend:** none today (no UI). **Add with G1** (policy list renders, edit
  persists, disclaimer shown).
- **E2E:** none today. **Add with G1/G2** (admin opens retention settings → sees
  policies + last-run status).

## Items Needing Confirmation

- `[NEEDS CONFIRMATION]` Is an **operator-facing retention policy UI/API** in product
  scope for V1, or is DB-only management an accepted operational posture? (Drives
  whether G1/G2 are P1 or deferred.)
- `[NEEDS CONFIRMATION]` Are **clinical/visit/prescription** retention targets meant
  to be enforceable in V1 (G3), or intentionally deferred until those domains add
  facades?
- `[NEEDS CONFIRMATION]` Production **go-live posture** for `RETENTION_ENFORCEMENT_ENABLED`
  — stays OFF (dry-run) indefinitely with manual operator attestation, or enabled per
  tenant once policies are reviewed?
- `[NEEDS CONFIRMATION]` Cross-tenant **admin/DPO scope** for any future policy
  endpoints — same platform-admin model as erasure/legal-hold, or org-scoped
  compliance officer? (Tracked product decision per IDEAL standard §342.)
</content>
</invoke>
