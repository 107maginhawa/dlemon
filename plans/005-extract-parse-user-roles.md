# Plan 005: Extract the duplicated `user.role` comma-split into a shared `parseUserRoles` helper

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- services/api-ts/src/handlers`
> If any in-scope file below changed since this plan was written, compare the
> "Current state" excerpt against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

The exact expression `user.role ? user.role.split(',').map(r => r.trim()) : []`
is copy-pasted into 16 handlers (and counting). `user.role` is a
comma-separated string of role tokens; every handler that needs the role list
re-implements the parse inline. There is no single source of truth, so the day
the role encoding changes (e.g. to a JSON array, or to add a normalization
step) is the day someone edits 15 of 16 sites and ships a bug in the one they
missed. This is a pure, behavior-preserving refactor: collapse the 16 copies to
one tested helper.

## Current state

The repeated expression, verbatim, appears in these 16 files (line numbers
approximate — the executor should re-grep, see Step 1). Two whitespace variants
exist: `map(r => r.trim())` and `map((r) => r.trim())`.

- `services/api-ts/src/handlers/emr/listEMRPatients.ts:67`
- `services/api-ts/src/handlers/emr/listConsultations.ts:64`
- `services/api-ts/src/handlers/emr/getConsultation.ts:73`
- `services/api-ts/src/handlers/email/cancelEmailQueueItem.ts:27`
- `services/api-ts/src/handlers/email/updateEmailTemplate.ts:27`
- `services/api-ts/src/handlers/email/testEmailTemplate.ts:30`
- `services/api-ts/src/handlers/email/createEmailTemplate.ts:26`
- `services/api-ts/src/handlers/email/getEmailTemplate.ts:25`
- `services/api-ts/src/handlers/email/listEmailTemplates.ts:26`
- `services/api-ts/src/handlers/email/getEmailQueueItem.ts:27`
- `services/api-ts/src/handlers/email/listEmailQueueItems.ts:26`
- `services/api-ts/src/handlers/email/retryEmailQueueItem.ts:28`
- `services/api-ts/src/handlers/billing/captureInvoicePayment.ts:56`
- `services/api-ts/src/handlers/billing/voidInvoice.ts:56`
- `services/api-ts/src/handlers/billing/refundInvoicePayment.ts:59`
- (re-grep will surface any others — there are exactly 16 at planning time)

Each site looks like:

```ts
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
```

The `User` type defines the field (`services/api-ts/src/types/auth.ts:23`):

```ts
role: UserRole | string;
```

**Conventions to match**: shared cross-handler helpers live in
`services/api-ts/src/handlers/shared/` as single-purpose files (see the sibling
`assert-branch-role.ts`, `assert-permission.ts`). Import via the `@/` alias,
e.g. `import { parseUserRoles } from '@/handlers/shared/parse-user-roles'`.
Tests sit next to the source as `*.test.ts`.

## Commands you will need

| Purpose            | Command                                                                 | Expected on success |
|--------------------|-------------------------------------------------------------------------|---------------------|
| Backend typecheck  | `cd services/api-ts && bun run typecheck`                               | exit 0, no errors   |
| Backend lint       | `cd services/api-ts && bun run lint`                                     | exit 0 (≤349 warns) |
| Unit test (pure)   | `cd services/api-ts && bun test src/handlers/shared/parse-user-roles.test.ts` | all pass        |
| Find all sites     | `grep -rn "\.role.*split(','" services/api-ts/src/handlers`             | 0 after Step 3      |

## Suggested executor toolkit

- Invoke the `superpowers:test-driven-development` skill: write the helper's
  test first (Step 2, RED), then the helper (Step 3, GREEN).
- Invoke `superpowers:verification-before-completion` before claiming done —
  run every command in "Done criteria" and confirm output.
- The project's `/typecheck` skill runs typecheck across workspaces if you
  prefer it over the raw command.

## Scope

**In scope**:
- `services/api-ts/src/handlers/shared/parse-user-roles.ts` (create)
- `services/api-ts/src/handlers/shared/parse-user-roles.test.ts` (create)
- The 16 handler files listed above (replace the inline expression only).

**Out of scope** (do NOT touch):
- The authorization logic that *consumes* `userRoles` in each handler — only
  the parse line changes; the variable name `userRoles` and everything after it
  stays identical.
- `services/api-ts/src/types/auth.ts` — the `role` type is correct as-is.
- Any handler not in the list. Do not "while I'm here" other files.

## Git workflow

- Branch: `advisor/005-parse-user-roles`
- One commit. Message style (conventional commits, matching `git log`):
  `refactor(handlers): extract parseUserRoles helper; dedupe 16 inline role splits`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the full site list

Run `grep -rn "\.role.*split(','" services/api-ts/src/handlers`. Confirm it
returns 16 matches. If it returns a different count, reconcile against the list
above — the helper must replace *every* match. (More matches = newer sites;
include them. Fewer = drift; STOP and report.)

**Verify**: grep returns exactly the set you intend to edit.

### Step 2: Write the helper test first (RED)

Create `services/api-ts/src/handlers/shared/parse-user-roles.test.ts`:

```ts
import { describe, test, expect } from 'bun:test';
import { parseUserRoles } from './parse-user-roles';

describe('parseUserRoles', () => {
  test('returns [] when user is undefined', () => {
    expect(parseUserRoles(undefined)).toEqual([]);
  });
  test('returns [] when role is empty/absent', () => {
    expect(parseUserRoles({ role: '' })).toEqual([]);
    expect(parseUserRoles({ role: undefined as unknown as string })).toEqual([]);
  });
  test('parses a single role', () => {
    expect(parseUserRoles({ role: 'dentist_owner' })).toEqual(['dentist_owner']);
  });
  test('splits and trims a comma-separated list', () => {
    expect(parseUserRoles({ role: 'dentist_owner, front_desk ,admin' }))
      .toEqual(['dentist_owner', 'front_desk', 'admin']);
  });
});
```

**Verify**: `cd services/api-ts && bun test src/handlers/shared/parse-user-roles.test.ts`
→ fails to compile / run (helper does not exist yet). This is the expected RED.

### Step 3: Write the helper (GREEN) and replace all 16 sites

Create `services/api-ts/src/handlers/shared/parse-user-roles.ts`:

```ts
import type { User } from '@/types/auth';

/**
 * Split the comma-separated `user.role` string into trimmed role tokens.
 * Returns [] when the user or role is absent. Behavior-preserving extraction
 * of the inline expression previously copy-pasted across handlers.
 */
export function parseUserRoles(user: Pick<User, 'role'> | undefined | null): string[] {
  if (!user?.role) return [];
  return user.role.split(',').map((r) => r.trim());
}
```

Then in each of the 16 files: add the import and replace the inline line.

Before (either whitespace variant):
```ts
const userRoles = user.role ? user.role.split(',').map(r => r.trim()) : [];
```
After:
```ts
const userRoles = parseUserRoles(user);
```
Add at the top with the other `@/handlers/shared/...` imports:
```ts
import { parseUserRoles } from '@/handlers/shared/parse-user-roles';
```

Do NOT change the `userRoles` variable name or any line that uses it.

**Verify**:
- `cd services/api-ts && bun test src/handlers/shared/parse-user-roles.test.ts` → all pass (GREEN).
- `grep -rn "\.role.*split(','" services/api-ts/src/handlers` → **0 matches**.

### Step 4: Typecheck and lint

**Verify**:
- `cd services/api-ts && bun run typecheck` → exit 0.
- `cd services/api-ts && bun run lint` → exit 0 (warning count must not increase).

## Test plan

- New: `parse-user-roles.test.ts` — covers undefined user, empty role, single
  role, comma+space list (the four cases above). Pure function, no DB.
- No existing handler test should change behavior; if any handler test fails
  after the swap, the replacement altered semantics — STOP (see conditions).

## Done criteria

ALL must hold:

- [ ] `cd services/api-ts && bun test src/handlers/shared/parse-user-roles.test.ts` passes (4 tests)
- [ ] `grep -rn "\.role.*split(','" services/api-ts/src/handlers` returns 0 matches
- [ ] `cd services/api-ts && bun run typecheck` exits 0
- [ ] `cd services/api-ts && bun run lint` exits 0, warning count not higher than before
- [ ] `git status` shows only the helper, its test, and the 16 handlers modified
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report (do not improvise) if:
- Step 1 grep returns a count that you cannot reconcile to a clear superset of
  the 16 listed files.
- Replacing a site requires changing anything other than the single parse line
  + the import (e.g. a handler reads `user.role` again separately).
- Any pre-existing handler test fails after the swap (semantics changed).
- `bun run lint` warning count *increases* (the helper or an import tripped a rule).

## Maintenance notes

- Future: if role encoding ever moves off comma-separated strings, this helper
  is the single edit point — keep it that way; reject new inline splits in review.
- A reviewer should confirm the diff is purely mechanical: 16 one-line swaps +
  one import each, plus the new helper + test. No logic lines moved.
