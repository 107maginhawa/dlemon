# Plan 010: acceptTreatmentPlan — validate the consent form *before* creating the version (don't orphan)

> **Executor instructions**: Follow step by step; run every verification command.
> Clinical write path — the "Review gate" is mandatory. Honor STOP conditions.
> When done, update the 010 status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- services/api-ts/src/handlers/dental-visit/treatments`
> If `acceptTreatmentPlan.ts` changed, compare the "Current state" excerpt to the
> live code; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

`acceptTreatmentPlan` performs two writes with no atomic boundary:
(1) create an append-only treatment-plan **version** snapshot, then
(2) if `consentFormId` is supplied, validate the form exists and `UPDATE` it to
point at the new version. Today the order is **create version → validate form →
update**. So a request with an invalid `consentFormId` creates a version row and
*then* throws 404 — leaving an orphan version for a request the caller intended
to fail. The cheap, safe fix is to **validate the consent form first**, so a bad
`consentFormId` is rejected before any write.

**Why not just wrap both writes in a transaction** (the pattern used elsewhere)?
Because `createSnapshotVersion` (`core/database.schema.ts:133-153`) computes the
next version via `select max(version)+1` then INSERT, with a **unique-violation
retry loop** for concurrent version creation. That loop is incompatible with
running inside a single transaction: in PostgreSQL the first failed INSERT aborts
the whole transaction ("current transaction is aborted"), so the retry cannot
recover. Wrapping it in `withTenantTx` would silently break concurrent-accept
version handling. The residual non-atomicity (version created, then the form
UPDATE fails on infra error) is low-impact: versions are append-only and valid
standalone; a failed link just leaves an unlinked version, and a retry creates a
new version and links that. So this plan does the safe reorder and **explicitly
does not** pursue full two-write atomicity.

## Current state

`services/api-ts/src/handlers/dental-visit/treatments/acceptTreatmentPlan.ts`,
lines 97-122:

```ts
const body = await ctx.req.json().catch(() => ({})) as { consentFormId?: string };

const snapshot = await buildLivePlan(db as unknown as NodePgDatabase, patientId);

const row = await createSnapshotVersion(
  db as unknown as NodePgDatabase,
  treatmentPlanVersions,
  treatmentPlanVersions.patientId,
  treatmentPlanVersions.version,
  patientId,
  { patientId, createdBy: user.id, snapshot },
) as typeof treatmentPlanVersions.$inferSelect;

// Link consent form if provided
if (body.consentFormId) {
  const { consentForms } = await import('../../dental-clinical/repos/consent-form.schema');
  const [form] = await db
    .select({ id: consentForms.id })
    .from(consentForms)
    .where(and(eq(consentForms.id, body.consentFormId), eq(consentForms.patientId, patientId)));
  if (!form) throw new NotFoundError('Consent form not found for this patient');   // ← thrown AFTER version created
  await db
    .update(consentForms)
    .set({ acceptedPlanVersionId: row.id, updatedBy: user.id })
    .where(eq(consentForms.id, body.consentFormId));
}
```

The entity-resolution + authz reads above (lines 88-95: `getPatientForDentalPatient`,
`assertPatientBranchAccess`, archived-patient guard) are correct — keep them.

## Commands you will need

| Purpose            | Command                                                                       | Expected   |
|--------------------|-------------------------------------------------------------------------------|------------|
| Backend typecheck  | `cd services/api-ts && bun run typecheck`                                     | exit 0     |
| Backend lint       | `cd services/api-ts && bun run lint`                                           | exit 0     |
| Backend test (file)| `cd services/api-ts && bun run scripts/test-with-db.ts <FILE>`                | all pass   |

> Test wrapper takes explicit **FILE** paths, never a directory.

## Suggested executor toolkit

- `superpowers:test-driven-development` — write the "invalid consentFormId
  creates no version" test first (Step 1, RED).
- `superpowers:requesting-code-review` — **mandatory** after GREEN (clinical path).
- `superpowers:verification-before-completion` — run all Done-criteria commands.

## Scope

**In scope**:
- `services/api-ts/src/handlers/dental-visit/treatments/acceptTreatmentPlan.ts`
  — reorder only: hoist the consent-form existence check above
  `createSnapshotVersion`.
- A test asserting an invalid `consentFormId` creates no version row.

**Out of scope** (do NOT touch):
- `createSnapshotVersion` and its retry loop — do NOT wrap it in a transaction
  (see "Why not" above).
- `buildLivePlan`, the authz reads, the response shape, the success behavior.
- The valid-form happy path (it must still link the version).

## Git workflow

- Branch: `advisor/010-accept-plan-validate-first`
- One commit: `fix(dental-visit): validate consent form before snapshotting accepted plan`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the failing test (RED)

Find the existing accept-plan test:
`grep -rln "acceptTreatmentPlan" services/api-ts/src --include='*.test.ts'`
(e.g. `dental-visit.treatment-plan-versioning.test.ts`). Add a case:

- Seed a patient with ≥1 pending treatment (so a snapshot would be non-trivial).
- POST accept with `consentFormId` set to a random UUID that does **not** exist
  for the patient.
- Assert the response is 404 (consent form not found) **and** that
  `treatment_plan_versions` has **no** new row for that patient (count before ==
  count after).

**Verify**: against current code the row-count assertion FAILS (a version *was*
created before the 404). Expected RED.

### Step 2: Hoist the validation above the write (GREEN)

Move the consent-form existence check to run **before** `createSnapshotVersion`,
keeping the UPDATE after the version is created:

```ts
const body = await ctx.req.json().catch(() => ({})) as { consentFormId?: string };

// Validate the consent form (if supplied) BEFORE creating an append-only version,
// so an invalid consentFormId can't orphan a version row.
if (body.consentFormId) {
  const { consentForms } = await import('../../dental-clinical/repos/consent-form.schema');
  const [form] = await db
    .select({ id: consentForms.id })
    .from(consentForms)
    .where(and(eq(consentForms.id, body.consentFormId), eq(consentForms.patientId, patientId)));
  if (!form) throw new NotFoundError('Consent form not found for this patient');
}

const snapshot = await buildLivePlan(db as unknown as NodePgDatabase, patientId);

const row = await createSnapshotVersion(/* …unchanged… */) as typeof treatmentPlanVersions.$inferSelect;

if (body.consentFormId) {
  const { consentForms } = await import('../../dental-clinical/repos/consent-form.schema');
  await db
    .update(consentForms)
    .set({ acceptedPlanVersionId: row.id, updatedBy: user.id })
    .where(eq(consentForms.id, body.consentFormId));
}
```

(The dynamic `import` of `consent-form.schema` appears twice — acceptable, it's a
cached module import. If you prefer, hoist it to a single `const { consentForms }`
above the validation and reuse it; either is fine.)

**Verify**: the Step 1 test passes (404 with no version created). The valid-form
happy-path test still passes (version created + linked).

### Step 3: Gates + mandatory review

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun run lint` → exit 0
- The accept-plan test file passes through the wrapper; run any sibling
  versioning tests too — all pass.
- **Invoke `superpowers:requesting-code-review`**; resolve findings before done.

## Test plan

- New case in the accept-plan test: invalid `consentFormId` → 404 **and** zero
  new version rows.
- Keep/confirm an existing case: valid `consentFormId` → version created and the
  form's `acceptedPlanVersionId` points at it.
- Confirm the no-consent path (no `consentFormId`) is unchanged: version created,
  no form touched.

## Done criteria

ALL must hold:

- [ ] Consent-form existence check runs BEFORE `createSnapshotVersion`
- [ ] `createSnapshotVersion` is NOT wrapped in a transaction (retry loop intact)
- [ ] New test: invalid `consentFormId` yields 404 with no new version row
- [ ] Valid-form and no-form paths still pass their tests
- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Code review completed and findings resolved
- [ ] Only the handler + test changed (`git status`)
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report if:
- You discover `createSnapshotVersion` has been changed to manage its own
  transaction/savepoints (then full atomicity may become safe — re-plan).
- Hoisting the validation changes the success-path response or the
  no-`consentFormId` behavior in any way.
- A sibling versioning test fails for a reason other than the intended reorder.

## Maintenance notes

- The residual non-atomic window (version created, then the form UPDATE fails on
  infra error) is intentionally accepted: versions are append-only and valid
  standalone. If a future requirement demands the version + link be truly atomic,
  it must first make `createSnapshotVersion`'s version-collision retry
  transaction-safe (e.g. savepoints, or an advisory lock instead of retry) — do
  not just wrap it.
- A reviewer should confirm no transaction was introduced around the snapshot.
