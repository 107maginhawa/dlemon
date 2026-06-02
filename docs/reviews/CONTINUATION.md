# Continuation — Standards-Review Backlog Execution

> Handoff for resuming work on branch `fix/standards-review-batch`. Last session ended mid-Wave-4. Read this top-to-bottom, then follow "RESUME HERE".

## Where things are

Branch `fix/standards-review-batch` (off the `feat/ceph-demoable-and-manual-ux` tip). HEAD = household-card fix.

**Shipped & green on the branch (54+ commits):**
- All auto-fix backlog items (Waves 0–2: 23 items) + the P2/medium-P1 tail (Wave 3: ~13 items). Backend suite 3158 pass, FE typecheck clean.
- 9 L-feature **design plans** in `docs/reviews/plans/01–09`.

**Wave 4 (L-features) — partially done, NOT yet integrated into the branch:**
| Branch | Feature | Status |
|--------|---------|--------|
| `fix/w4-imgsuper` | P1-11 ceph superimposition v1 | ✅ 3 commits, done |
| `fix/w4-casepres` | P1-20 case-presentation (Phase 1, staff-auth) | ✅ 2 commits, done |
| `fix/w4-booking` | P1-25 online booking | ✅ 2 commits, done |
| `fix/w4-perio` | P0-1 perio frontend | ❌ INCOMPLETE (0 commits, WIP lost on exit) — must re-run |

These 3 done branches contain **hand-written source only** (no generated files / no migrations committed — the agents left those uncommitted in their worktrees by design). They must be integrated via central regen (below).

## Hard-won learnings / gotchas (DO NOT relearn these)
1. **Single-agent mode now** (per user): work DIRECTLY on `fix/standards-review-batch` in the main checkout. No worktrees, no parallel agents. The agent runs the full pipeline + gate itself.
2. **Spec-first**: edit TypeSpec in `specs/api/src/modules/*.tsp` → regenerate → implement → NEVER hand-edit generated files.
3. **Central regen pipeline** (run after any TypeSpec/schema change):
   - `cd specs/api && bun run build`
   - `cd ../../services/api-ts && bun run generate`
   - `cd ../../packages/sdk-ts && bun run generate`  ← regenerate the client SDK (FE depends on it)
   - `cd ../../services/api-ts && bun run db:generate`
4. **Test DB**: `bun run test` requires `DATABASE_URL` to point at `monobase_test`. If you see column-not-found errors, the template drifted — recreate it:
   `PGPASSWORD=password dropdb -h localhost -U postgres --force monobase_test && createdb -h localhost -U postgres monobase_test && (cd services/api-ts && DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun run db:migrate)`
   Then run the suite with that DATABASE_URL prefixed.
5. **NEVER `bun test <path>`** for api-ts — it pollutes the clone template (phantom regressions). Use `bun run test`. (Single FE-app test files are safe to run individually since FE tests don't touch the DB.)
6. **`EXCLUDE USING gist` constraint** (online-booking double-booking backstop): drizzle-kit does NOT auto-generate `EXCLUDE` constraints. The booking agent wrote it as a hand-authored migration (`0084_dental_appointment_no_overlap.sql`, currently uncommitted in `.claude/worktrees/w4-booking/services/api-ts/src/generated/migrations/`). When integrating booking, you MUST preserve this hand-written migration + its `scheduled_end` column/trigger — `db:generate` will not recreate it. The full SQL is in that file; copy it forward.
7. **minimatch/eslint worktree bug**: fresh `bun install` in a worktree sometimes resolves `brace-expansion@5` for `minimatch@3` → `eslint` crashes "expand is not a function". The MAIN checkout is fine. Single-agent on the main checkout avoids this entirely.
8. **Lemon TOKEN classes only** (`bg-lemon`, `text-lemon-foreground`) — never raw hex `#FFE97D`. ₱/en-PH currency (use `formatCents`/`formatCurrency`).
9. **SDK version drift** (absorbed in Wave 2): the `chore(regen)` commit there carries a large `@hey-api/openapi-ts` reshuffle. Subsequent SDK regens are small. Optional follow-up: pin the generator version for a tidier diff.

## RESUME HERE — step by step

### Step 1 — Integrate the 3 finished Wave-4 branches
```
cd /Users/eladventures/Desktop/dentalemon
git checkout fix/standards-review-batch
# merge the 3 done source-only branches (expect clean or minor main.tsp unions)
for b in fix/w4-imgsuper fix/w4-casepres fix/w4-booking; do git -c commit.gpgsign=false merge --no-edit "$b"; done
```
Then run the **central regen pipeline** (learning #3). For the booking gist constraint, copy the hand-written `0084_*no_overlap*.sql` (+ its journal entry) from the `w4-booking` worktree into `services/api-ts/src/generated/migrations/` AFTER `db:generate`, renumbering if needed so it applies last (learning #6).
Recreate the test DB (learning #4). Then run the **FULL GATE**:
```
cd services/api-ts && bun run typecheck && bun run lint && bun run check:boundaries && \
  DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun run test
cd ../../apps/dentalemon && bun run typecheck && bun run lint && bun run test
```
Fix any FE↔SDK drift (new endpoints) and any stale guard tests. Then commit the regenerated artifacts + migrations in ONE `chore(regen): Wave 4` commit. Clean up: `git worktree remove --force .claude/worktrees/w4-{imgsuper,casepres,booking,perio}` and `git branch -D fix/w4-{imgsuper,casepres,booking,perio}`.

### Step 2 — Re-run perio-FE (P0-1), single agent
It's FE-only on an existing tested backend (SDK hooks exist) — NO codegen needed. Use the single-agent prompt below with plan `docs/reviews/plans/01-perio-frontend.md`.

### Step 3 — Remaining L-features, ONE at a time (single agent)
Order: **P1-10 landmarking → P1-24 reminders/recall → P1-26 PH insurance → P2-4 voice-perio (needs perio-FE) → P2-7 CBCT.** Plans in `docs/reviews/plans/02,05,07,09,08`.

### Step 4 — When all done
Run the full gate once more, then this branch (NOT pushed/merged) is ready for review/PR via `/ship`.

## Single-agent prompt (use per feature)
```
You are implementing ONE L-feature for the dentalemon dental app, working DIRECTLY on
branch `fix/standards-review-batch` in the main checkout at /Users/eladventures/Desktop/dentalemon
(no worktree — single agent). Confirm `git branch --show-current` = `fix/standards-review-batch`
before editing; if not, STOP and report.

FEATURE: <name> — follow its plan in docs/reviews/plans/<NN>-<slug>.md (read it fully first).

Rules: spec-first (TypeSpec → regenerate → implement → never hand-edit generated). Vertical TDD
(failing tests first). Lemon TOKEN classes, never raw hex. ₱/en-PH currency.

Pipeline (you run it all): specs/api `bun run build` → services/api-ts `bun run generate` &&
`bun run db:generate` → packages/sdk-ts `bun run generate`. If test DB is stale, recreate
monobase_test (drop/create/db:migrate). NEVER `bun test <path>` for api-ts — use `bun run test`.

GATE (all must pass before commit): services/api-ts typecheck + lint + check:boundaries +
`DATABASE_URL=postgresql://postgres:password@localhost:5432/monobase_test bun run test`;
apps/dentalemon typecheck + lint + test.

COMMIT atomically (include regenerated generated/ + SDK + migration in the same commit as source,
since single-agent). Conventional messages ending with:
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
HALT-ON-RED: if a gate fails after 2 honest attempts, STOP, leave the tree clean, report what's blocking.
```

## Backlog reference
Full ranked backlog: `docs/reviews/IMPROVEMENT_BACKLOG.md`. Module scorecards: `docs/reviews/modules/`. L-plans: `docs/reviews/plans/`.
