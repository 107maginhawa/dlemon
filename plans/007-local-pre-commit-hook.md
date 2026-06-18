# Plan 007: Add a native git pre-commit hook that runs typecheck + lint (no new dependency)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> STOP condition occurs, stop and report. When done, update the 007 status row
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c3d93891..HEAD -- package.json`
> If `package.json` scripts changed since this plan was written, re-read the
> "Current state" excerpt before proceeding.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c3d93891`, 2026-06-18

## Why this matters

Type and lint failures are only caught in CI today — there is no local git hook
(`ls -la .husky` → absent; no `prepare` script; `.git/hooks` has only samples).
A developer can commit code that fails `bun run typecheck` / `bun run lint` and
not find out until after pushing and burning a CI cycle. A pre-commit hook gives
that feedback in seconds. We add it the lazy way: a committed hook script wired
via git's native `core.hooksPath` from a `prepare` script — **no husky, no new
dependency**.

## Current state

`package.json` (root) defines the gate commands already (excerpt):

```jsonc
"scripts": {
  "typecheck": "bun run --filter dentalemon --filter '@monobase/api-ts' typecheck",
  "lint": "bun run --filter dentalemon --filter '@monobase/api-ts' lint && bun run check:fsm-tokens",
  // ... no "prepare" script exists yet
}
```

There is **no** `.husky/` directory, **no** `prepare` script, and `.git/hooks`
contains only `*.sample` files. `package.json` uses `"packageManager": "bun@1.2.21"`.

**Conventions**: this is a Bun monorepo; `prepare` runs automatically on
`bun install`. Git's `core.hooksPath` lets us keep the hook committed under a
tracked directory instead of the untracked `.git/hooks`.

## Commands you will need

| Purpose             | Command                                  | Expected on success            |
|---------------------|------------------------------------------|--------------------------------|
| Apply prepare wiring| `cd <repo root> && bun run prepare`      | sets `core.hooksPath`, exit 0  |
| Show hooks path     | `git config core.hooksPath`              | prints `.githooks`             |
| Hook contents run   | `bun run typecheck && bun run lint`      | both exit 0 (on clean tree)    |

## Suggested executor toolkit

- `superpowers:verification-before-completion` — actually trigger the hook
  (Step 4) and confirm it blocks a bad commit and allows a good one; do not
  claim it works from inspection alone.

## Scope

**In scope**:
- `.githooks/pre-commit` (create, executable)
- `package.json` (add one `prepare` script line)

**Out of scope** (do NOT touch):
- The `typecheck` / `lint` scripts themselves.
- CI workflow files under `.github/` — CI stays the source of truth; this hook
  is a fast local pre-filter, not a replacement.
- Do NOT add husky, lefthook, simple-git-hooks, or any dependency.

## Git workflow

- Branch: `advisor/007-pre-commit-hook`
- One commit: `chore(dx): add native pre-commit hook (typecheck + lint) via core.hooksPath`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the hook script

Create `.githooks/pre-commit` with this content:

```sh
#!/bin/sh
# Pre-commit gate: fast local mirror of the CI typecheck + lint gates.
# Bypass with `git commit --no-verify` when intentionally committing WIP.
set -e
echo "pre-commit: typecheck…"
bun run typecheck
echo "pre-commit: lint…"
bun run lint
```

Make it executable: `chmod +x .githooks/pre-commit`.

**Verify**: `test -x .githooks/pre-commit && echo OK` → prints `OK`.

### Step 2: Wire it via a `prepare` script

In root `package.json`, add to `"scripts"`:

```json
"prepare": "git config core.hooksPath .githooks || true"
```

The `|| true` keeps `bun install` from failing in environments without git
(CI shallow checkouts, tarball installs).

**Verify**: `cat package.json | grep prepare` shows the line.

### Step 3: Activate

Run `bun run prepare`, then confirm:

**Verify**: `git config core.hooksPath` → prints `.githooks`.

### Step 4: Prove it gates (RED→GREEN behavior)

- Good path: on the current clean tree, `bun run typecheck && bun run lint` →
  both exit 0. A `git commit` would therefore succeed.
- Bad path (temporary): introduce a deliberate type error in a scratch file
  (e.g. `const x: number = 'nope'` in a new throwaway `.ts` under
  `apps/dentalemon/src`), `git add` it, attempt `git commit -m "test"`. The
  hook must abort the commit with a non-zero exit. Then delete the scratch file
  and unstage it. **Do not leave the scratch file behind.**

**Verify**: the bad-path commit is blocked; the scratch file is removed
afterward (`git status` clean except the in-scope two files).

## Test plan

No unit test (this is tooling). The Step 4 manual RED→GREEN check *is* the test:
a failing typecheck must block the commit, a clean tree must allow it.

## Done criteria

ALL must hold:

- [ ] `.githooks/pre-commit` exists and is executable
- [ ] `package.json` has the `prepare` script
- [ ] `git config core.hooksPath` prints `.githooks`
- [ ] A staged type error blocks `git commit`; a clean tree does not (Step 4)
- [ ] No scratch/test file left in the tree (`git status`)
- [ ] Only `.githooks/pre-commit` and `package.json` are added/modified
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report if:
- `bun run typecheck` or `bun run lint` does NOT pass on the current clean tree
  before you start (a pre-existing failure means the hook would block all
  commits — report it; do not weaken the hook to work around it).
- `core.hooksPath` cannot be set (non-git environment) — then the `prepare`
  approach is moot; report so the operator can decide on husky instead.

## Maintenance notes

- If typecheck+lint ever grow too slow for a per-commit gate, the lazy trim is
  to drop `typecheck` from the hook and keep `lint` (CI still runs both). Note
  that in the hook comment if you do.
- New contributors get the hook automatically on their next `bun install` (via
  `prepare`). Existing clones need one `bun run prepare`. Mention this in
  `CONTRIBUTING.md` setup if you touch that doc later (out of scope here).
- A reviewer should confirm no dependency was added to `package.json`.
