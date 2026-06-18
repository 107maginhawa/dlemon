# Plan 006: Push dental-clinical list pagination into the database (stop loading all rows then slicing)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- services/api-ts/src/handlers/dental-clinical`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

The dental-clinical list endpoints load **every** matching row into memory and
then `Array.slice()` to the requested page. The base repository
(`DatabaseRepository.findMany(filters, options)`) already supports DB-level
`LIMIT`/`OFFSET` + ordering, but seven clinical repos `override findMany(filters)`
with a version that **drops the `options` parameter**, so the handlers can't ask
for a page and resort to slicing in memory. On a busy clinic's consent-form or
prescription history this is O(total rows) memory + transfer per request, for a
page of 50. The fix is mechanical and uses methods the base class already
exposes; the win is real at scale and the change removes code rather than adding
abstraction.

## Current state

**The seven offending repos** (each has an `override async findMany(filters?)`
that ignores pagination):

- `services/api-ts/src/handlers/dental-clinical/repos/consent-form.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/lab-order.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/amendment.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/prescription.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/medical-history.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/attachment.repo.ts`
- `services/api-ts/src/handlers/dental-clinical/repos/consent-refusal.repo.ts`

The override, verbatim, from `amendment.repo.ts:33-38`:

```ts
override async findMany(filters?: AmendmentFilters): Promise<Amendment[]> {
  const where = this.buildWhereConditions(filters);
  return where
    ? await this.db.select().from(amendments).where(where)
    : await this.db.select().from(amendments);
}
```

This is a **strict subset** of the base `DatabaseRepository.findMany`
(`services/api-ts/src/core/database.repo.ts:188-237`), which already does the
same `buildWhereConditions(filters)` plus default `createdAt` ordering and
`limit/offset` when `options.pagination` is present. The base also exposes
`count(filters)` (`database.repo.ts:164`). So the override can simply be deleted.

**The handler pattern** that slices in memory — from
`dental-clinical/consent/listConsentForms.ts:27-39`:

```ts
const repo = new ConsentFormRepository(db);

const items = await repo.findMany({ visitId });
const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
const totalCount = items.length;
const page = items.slice(offset, offset + limit);
// ...audit...
return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
```

**The list handlers in scope** (all do the same load-all-then-slice):

- `dental-clinical/consent/listConsentForms.ts`        → ConsentFormRepository
- `dental-clinical/lab-orders/listLabOrders.ts`        → LabOrderRepository
- `dental-clinical/amendments/listAmendments.ts`       → AmendmentRepository
- `dental-clinical/prescriptions/listPrescriptions.ts` → PrescriptionRepository
- `dental-clinical/medical-history/listMedicalHistory.ts` → MedicalHistoryRepository
- `dental-clinical/attachments/listAttachments.ts`     → AttachmentRepository

(`consent-refusal` repo is overridden too; include its list handler if one
exists — `grep -rln consent-refusal services/api-ts/src/handlers/dental-clinical`.
If it has no slice-style list handler, just delete its repo override.)

**Conventions**: `parsePagination` and `buildPaginationMeta` come from
`@/utils/query`. The response shape `{ data, pagination }` must NOT change —
clients depend on it. Backend tests are DB-backed and run through the
`test-with-db.ts` wrapper (see Commands).

## Commands you will need

| Purpose            | Command                                                                              | Expected on success     |
|--------------------|--------------------------------------------------------------------------------------|-------------------------|
| Backend typecheck  | `cd services/api-ts && bun run typecheck`                                            | exit 0                  |
| Backend lint       | `cd services/api-ts && bun run lint`                                                  | exit 0                  |
| Backend test (1+)  | `cd services/api-ts && bun run scripts/test-with-db.ts <FILE> [<FILE>...]`           | all pass                |
| Find slice sites   | `grep -rn "slice(offset" services/api-ts/src/handlers/dental-clinical`               | only out-of-scope ones  |

> **Critical**: the backend test wrapper takes explicit **FILE** paths, never a
> directory. Passing a directory runs against a shared DB clone and produces
> phantom failures. Always: `bun run scripts/test-with-db.ts src/handlers/dental-clinical/consent/listConsentForms.test.ts`.

## Suggested executor toolkit

- `superpowers:test-driven-development` — extend the consent-form list test to
  assert page-size and total *before* changing the repo (Step 1), watch it pass
  with the new code path (Step 3).
- `superpowers:verification-before-completion` — run every Done-criteria command.
- Project `/test-api` skill runs the DB-backed suite if you prefer it.

## Scope

**In scope**:
- The 7 repo files (delete the `override findMany`, keep everything else,
  including any `override findOneById`).
- The 6 (or 7) list handlers (replace load-all+slice with repo-level pagination).
- The matching list test files (assert pagination still works).

**Out of scope** (do NOT touch, even though they have the identical pattern —
they are a deliberate, separately-tracked follow-up):
- `dental-billing/listDentalInvoices.ts`, `dental-billing/listDentalPayments.ts`
  (the invoices N+1 is already documented in `docs/KNOWN_LIMITATIONS.md`).
- `dental-pmd/*`, `dental-patient/identity/*`, `dental-visit/*`,
  `dental-org/*`, `dental-audit/getAuditEvents.ts`, and the clinical
  `inventory/`, `occlusion/`, `postop/` list handlers whose repos do **not**
  override `findMany` (those need their own analysis).
- The `{ data, pagination }` response shape.

## Git workflow

- Branch: `advisor/006-clinical-list-pagination`
- Commit per repo+handler pair is fine, or one commit for the sweep. Message
  style: `perf(dental-clinical): paginate consent/lab/amendment/... lists at the DB layer`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Pin current behavior with a test (consent-form first)

Find the existing list test:
`grep -rln "listConsentForms" services/api-ts/src/handlers/dental-clinical`.
If a `.test.ts` exists, add a case that seeds e.g. 3 consent forms for a visit
and requests `?limit=2&offset=0`, asserting `data.length === 2` and
`pagination.totalCount === 3`. If no test exists, create
`listConsentForms.pagination.test.ts` modeled on an existing DB-backed handler
test (e.g. `dental-visit/createDentalTreatment.idempotency.test.ts` shows the
`createDatabase` + suite-unique-id fixture pattern).

**Verify**: `cd services/api-ts && bun run scripts/test-with-db.ts <that file>` →
passes against the *current* in-memory-slice code (this is your baseline; it
must keep passing after the change).

### Step 2: Delete the redundant `findMany` overrides

In each of the 7 repos, delete the `override async findMany(filters?) { ... }`
method entirely. Leave the class, constructor, `buildWhereConditions`, and any
`override findOneById` untouched. The base `findMany(filters, options)` now
applies.

**Verify**: `cd services/api-ts && bun run typecheck` → exit 0 (the base
signature `findMany(filters?, options?)` is a superset, so existing single-arg
calls still compile).

### Step 3: Switch handlers to DB-level pagination

In each list handler, replace the load-all + slice block. Using
`listConsentForms.ts` as the worked example, the new body is:

```ts
const repo = new ConsentFormRepository(db);

const { limit, offset } = parsePagination(ctx.req.query(), { limit: 50 });
const totalCount = await repo.count({ visitId });
const page = await repo.findMany({ visitId }, { pagination: { limit, offset } });
// ...audit (unchanged; if it logged items.length, use totalCount)...
return ctx.json({ data: page, pagination: buildPaginationMeta(page, totalCount, limit, offset) });
```

Notes:
- Use the **same filter object** the handler already passes (`{ visitId }`,
  `{ patientId }`, etc.) for both `count` and `findMany`.
- If the handler's audit log referenced `items.length`, replace with
  `totalCount` (same meaning: number of matching rows).
- Apply the identical transform to all 6 (or 7) handlers.

**Verify**:
- `grep -rn "slice(offset" services/api-ts/src/handlers/dental-clinical` no
  longer lists any of the 6/7 in-scope handlers.
- Re-run the Step 1 test: still passes (page size 2, total 3).

### Step 4: Run the affected suites + gates

Run each in-scope module's existing tests through the wrapper (list the actual
test files; do NOT pass a directory). Then:

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0
- `cd services/api-ts && bun run lint` → exit 0
- All in-scope list tests pass.

## Test plan

- Per list endpoint: one pagination test (seed N rows, request a sub-page,
  assert `data.length === page` and `pagination.totalCount === N`). At minimum
  do this for consent-form (Step 1); add the same for the others if a test file
  already exists, otherwise rely on the existing list tests still passing.
- Structural pattern: model new tests on
  `dental-visit/createDentalTreatment.idempotency.test.ts`.

## Done criteria

ALL must hold:

- [ ] All 7 repos no longer declare `override ... findMany` (`grep -rn "override async findMany" services/api-ts/src/handlers/dental-clinical/repos` → 0)
- [ ] None of the 6/7 in-scope handlers call `.slice(offset` (grep confirms)
- [ ] The consent-form pagination test passes (page size respected, total correct)
- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun run lint` exits 0
- [ ] No out-of-scope file modified (`git status`)
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report (do not improvise) if:
- A repo override's body is **not** a strict subset of the base (e.g. it does
  extra in-memory filtering, joins, or maps the rows) — deleting it would change
  results. Report which repo.
- A handler does in-memory work on the full list *after* fetching but *before*
  slicing (e.g. aggregates a total, dedups, sorts on a computed field). DB-level
  pagination would break that. Report which handler.
- Removing default-`createdAt` ordering assumptions breaks a test that asserts a
  specific order the old unordered query happened to produce.
- Any in-scope test fails after the change and the cause isn't an obvious test
  fixture expecting the whole list.

## Maintenance notes

- The same load-all+slice pattern exists in ~15 other handlers (billing, pmd,
  patient, visit, org, audit — see "Out of scope"). This plan deliberately
  fixes only the uniform dental-clinical cluster; the rest are a follow-up that
  needs per-handler analysis (some may aggregate over the full set).
- A reviewer should confirm `count` + `findMany(..., {pagination})` use the
  identical filter object, and that the `{ data, pagination }` response shape is
  byte-for-byte unchanged.
