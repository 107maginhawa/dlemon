# Backend Handler Coverage Topology

**TL;DR**: the "≈38% of handler files have a test" figure (from the per-file
knowledge-graph `tested_by` edge) is a **measurement artifact, not a real gap**.
Backend handlers are predominantly covered by **module/route-level** tests — one
test file boots the real app and exercises many handlers via `app.request(...)`,
which a per-file edge can't see.

## Evidence

Counts under `services/api-ts/src/handlers/` (impl = handler files excluding
tests/repos/jobs/utils/index/schema):

- **436** handler impl files, **264** test files, **168** of which use the
  real-server pattern (`buildApp`/`app.request`/route-registration) — each exercises
  many handlers, not one.
- Example probe — `dental-imaging` (the dental module with the weakest *file* ratio,
  55 impl / 12 test files): running just those 12 files executes **357 passing test
  cases** against per-file clones of `monobase_test`. The handlers without a
  same-named test are still hit through the imaging route/business-rule suites.

## Per-module file ratios

The **dental product modules** (where the product lives) are well covered:
`dental-clinical` 35/31, `dental-org` 40/36, `dental-patient` 70/39,
`dental-scheduling` 27/21, `dental-visit` 27/21, `dental-billing` 28/21,
`dental-pmd` 9/8, `dental-perio` 5/6. Lower *file* ratios (e.g. `dental-imaging`
55/12) are route-level-test-heavy, not untested.

The lower-ratio modules that remain are mostly the **generic upstream-template
primitives** (`comms`, `notifs`, `reviews`, `email`, `storage`, `provider`) inherited
from `mono-js-lf` — not dental product surface.

## How to get a real per-file number

The test runner isolates each file in its own DB clone (see
`scripts/test-with-db.ts`), so coverage must be read per file rather than from one
merged report:

```bash
cd services/api-ts
DATABASE_URL=postgres://<creds>@localhost:5432/monobase_test \
  bun run scripts/test-with-db.ts --coverage src/handlers/<module>/<file>.test.ts
```

(Never `bun test <path>` directly — it pollutes the clone template.)

## Recommendation

No mass backfill is warranted. If you add a handler, follow the per-module 10-step
Vertical TDD sequence ([VERTICAL_TDD.md](../development/VERTICAL_TDD.md)) — backend
unit/route test before impl — and the route-level suite keeps coverage honest without
relying on the per-file graph metric.
