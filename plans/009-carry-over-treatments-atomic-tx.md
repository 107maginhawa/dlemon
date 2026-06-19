# Plan 009: Make carry-over treatment writes atomic (route through `withTenantTx`)

> **Executor instructions**: Follow step by step. Run every verification command
> and confirm before moving on. This is a clinical write path — the
> "Review gate" step is mandatory. Honor STOP conditions. When done, update the
> 009 status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- services/api-ts/src/handlers/dental-visit/treatments`
> If `carryOverTreatments.ts` changed since this plan was written, compare the
> "Current state" excerpt to the live code; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (clinical write path — requires code review before merge)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

`carryOverTreatments` copies N pending treatments from a previous visit into the
current visit via `Promise.all(pendingTreatments.map(t => repo.createOne(t)))`,
with **no transaction**. Each `createOne` is its own auto-committed INSERT, so a
partial failure (one insert rejects mid-batch — constraint, connection drop)
leaves the visit with *some* of the carried treatments committed and the request
erroring. The handler's sibling write paths in this same module
(`createDentalVisit`, `updateDentalVisit`, `discardVisit`) already route writes
through `withTenantTx({branchIds:[visit.branchId]})` per ADR-010 — this brings
carry-over to parity, giving **both** atomicity (all-or-nothing) and the RLS
second-wall. (Content-idempotency softens *retries*, but not the partial-commit
state itself.)

## Current state

`services/api-ts/src/handlers/dental-visit/treatments/carryOverTreatments.ts`.

Reads + authz already resolve the entities on `db` (keep these as-is):
- `currentVisit = await visitRepo.findOneById(visitId)` (line 51)
- `await assertBranchRole(db, user.id, currentVisit.branchId, [...])` (line 54)
- `pendingTreatments` query (lines 93-101) — the rows to copy
- the `dismissedTreatments` query (lines 125-134) — inside the `if` block today

The **writes** that are not atomic (lines 103-152):

```ts
const carriedOver = await Promise.all(
  pendingTreatments.map(t =>
    treatmentRepo.createOne({ visitId, patientId: currentVisit.patientId, /* …fields… */
      status: t.status, carriedOver: true, sourceVisitId: t.visitId })
  )
);

const restoredDismissed: DentalTreatment[] = [];
if (Array.isArray(body?.restoreDismissedIds) && body.restoreDismissedIds.length > 0) {
  const dismissedTreatments = await db.select().from(dentalTreatments).where(/* … */);
  for (const t of dismissedTreatments) {
    const restored = await treatmentRepo.createOne({ /* …fields…, status: 'planned' */ });
    restoredDismissed.push(restored);
  }
}
```

`treatmentRepo` is `new TreatmentRepository(db)` (line 49). `TreatmentRepository`
takes its db/tx in the constructor and `createOne` is a plain INSERT with no
internal transaction (`repos/treatment.repo.ts:40-46`) — safe to re-bind to a tx.

**The exemplar to follow** — `withTenantTx` usage and the ADR-010 split (authz +
entity-resolution reads stay on `db`; only terminal writes are scoped):
- `services/api-ts/src/handlers/dental-visit/visits/updateDentalVisit.ts`
- `withTenantTx` signature: `withTenantTx(db, { branchIds: string[] }, async (tx) => {...})`
  (`services/api-ts/src/core/tenant-tx.ts:67`).

Import: `import { withTenantTx } from '@/core/tenant-tx';`

## Commands you will need

| Purpose            | Command                                                                       | Expected   |
|--------------------|-------------------------------------------------------------------------------|------------|
| Backend typecheck  | `cd services/api-ts && bun run typecheck`                                     | exit 0     |
| Backend lint       | `cd services/api-ts && bun run lint`                                           | exit 0     |
| Backend test (file)| `cd services/api-ts && bun run scripts/test-with-db.ts <FILE>`                | all pass   |

> The test wrapper takes explicit **FILE** paths, never a directory.

## Suggested executor toolkit

- `superpowers:test-driven-development` — write the activation test (Step 1, RED)
  before touching the handler.
- `superpowers:requesting-code-review` — **mandatory** after GREEN (Step 4),
  before marking done. This is a clinical write path.
- `superpowers:verification-before-completion` — run all Done-criteria commands.

## Scope

**In scope**:
- `services/api-ts/src/handlers/dental-visit/treatments/carryOverTreatments.ts`
  (wrap the two write loops in one `withTenantTx`; keep reads/authz on `db`).
- A new test:
  `services/api-ts/src/handlers/dental-visit/treatments/carryOverTreatments.rls-tx.test.ts`.

**Out of scope** (do NOT touch):
- The read queries and `assertBranchRole` authz — they stay on `db`. Do NOT move
  the `pendingTreatments` / `previousVisits` reads into the tx (a patient's prior
  visits may legitimately span branches; scoping the read to the current branch
  could hide source rows). Only the **writes** move.
- The response shape and the `logger.info` call.
- Any other handler in the module.

## Git workflow

- Branch: `advisor/009-carry-over-atomic-tx`
- One commit: `fix(dental-visit): make carry-over treatment writes atomic via withTenantTx`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the activation test (RED)

Create `carryOverTreatments.rls-tx.test.ts`, modeled closely on
`services/api-ts/src/handlers/dental-visit/dental-visit.rls-activation-writes.test.ts`
(same `createDatabase` + suite-unique-id fixtures + `spyOn` approach). Assert:

1. **Routing (structural RED→GREEN)**: `spyOn(db, 'transaction')`; POST a
   carry-over that copies ≥1 treatment; assert `db.transaction` was called
   (before this change it is never called — carry-over writes go straight to
   `db`). On the current code this assertion FAILS = the expected RED.
2. **Happy path preserved**: the response still returns the carried treatments,
   and the current visit now contains them (proves the tx scope is the right
   branch — an empty/wrong scope would make the app_rls INSERT touch zero rows
   or fail).

**Verify**: `cd services/api-ts && bun run scripts/test-with-db.ts src/handlers/dental-visit/treatments/carryOverTreatments.rls-tx.test.ts`
→ the routing assertion fails (RED) against current code.

### Step 2: Move the dismissed-treatments READ out of the write path

Before the writes, compute `dismissedTreatments` on `db` (lift the existing
`db.select()...where(...)` out of the `if` block so the read stays on `db`):

```ts
let dismissedTreatments: DentalTreatment[] = [];
if (Array.isArray(body?.restoreDismissedIds) && body.restoreDismissedIds.length > 0) {
  dismissedTreatments = await db.select().from(dentalTreatments).where(
    and(
      inArray(dentalTreatments.id, body.restoreDismissedIds),
      eq(dentalTreatments.status, 'dismissed'),
      eq(dentalTreatments.patientId, currentVisit.patientId),
    ),
  );
}
```

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0.

### Step 3: Wrap both write loops in one `withTenantTx` (GREEN)

```ts
const { carriedOver, restoredDismissed } = await withTenantTx(
  db,
  { branchIds: [currentVisit.branchId] },
  async (tx) => {
    const txRepo = new TreatmentRepository(tx);
    const carried = await Promise.all(
      pendingTreatments.map(t => txRepo.createOne({
        visitId, patientId: currentVisit.patientId,
        cdtCode: t.cdtCode, description: t.description,
        toothNumber: t.toothNumber ?? undefined, surfaces: t.surfaces ?? undefined,
        conditionCode: t.conditionCode ?? undefined, priceCents: t.priceCents,
        status: t.status, carriedOver: true, sourceVisitId: t.visitId,
      })),
    );
    const restored: DentalTreatment[] = [];
    for (const t of dismissedTreatments) {
      restored.push(await txRepo.createOne({
        visitId, patientId: currentVisit.patientId,
        cdtCode: t.cdtCode, description: t.description,
        toothNumber: t.toothNumber ?? undefined, surfaces: t.surfaces ?? undefined,
        conditionCode: t.conditionCode ?? undefined, priceCents: t.priceCents,
        status: 'planned', carriedOver: true, sourceVisitId: t.visitId,
      }));
    }
    return { carriedOver: carried, restoredDismissed: restored };
  },
);
```

Keep the field mapping IDENTICAL to the current code (copy the existing object
literals exactly — do not change which fields are copied or the `status` values:
carried keeps `t.status`, restored uses `'planned'`).

**Verify**: the Step 1 test now passes (routing assertion GREEN, happy path
preserved).

### Step 4: Gates + mandatory review

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun run lint` → exit 0
- The new test passes; run the existing carry-over / treatment tests too
  (find them: `grep -rln "carryOverTreatments\|carry-over" services/api-ts/src --include='*.test.ts'`)
  through the wrapper — all pass.
- **Invoke `superpowers:requesting-code-review`** on the diff. Address findings
  before marking the plan done.

## Test plan

- New `carryOverTreatments.rls-tx.test.ts`: (1) writes route through a tenant tx
  (`db.transaction` called), (2) happy path still carries the treatments into
  the current visit. Model: `dental-visit.rls-activation-writes.test.ts`.
- All pre-existing carry-over tests must remain green (no behavior change beyond
  atomicity + RLS scoping).

## Done criteria

ALL must hold:

- [ ] Both write loops execute inside a single `withTenantTx(db, { branchIds: [currentVisit.branchId] }, ...)`
- [ ] Reads + `assertBranchRole` still run on `db` (not inside the tx)
- [ ] New `carryOverTreatments.rls-tx.test.ts` passes (routing + happy path)
- [ ] All pre-existing carry-over/treatment tests pass
- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] Code review (`superpowers:requesting-code-review`) completed and findings resolved
- [ ] Only the handler + the new test changed (`git status`)
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report (do not improvise) if:
- Moving the dismissed-treatments read or wrapping the writes changes which rows
  are returned (e.g. RLS hides the current-branch INSERTs — wrong branch scope).
- `currentVisit.branchId` is ever null/undefined (the tx scope would be empty →
  app_rls writes touch zero rows). The authz on line 54 implies it's set; if a
  test shows otherwise, STOP.
- A pre-existing carry-over test fails for any reason other than the expected
  routing change.
- The happy-path assertion shows zero rows carried after wrapping (means the
  branch scope or the RLS policy on `dental_treatment` doesn't permit the write).

## Maintenance notes

- This follows the dental-visit module's established ADR-010 activation pattern;
  a reviewer should confirm only the terminal writes were scoped and the
  field-mapping object literals are unchanged from the originals.
- If carry-over ever needs to copy across branches (a patient transferred
  branches), the single-branch tx scope must be revisited.
