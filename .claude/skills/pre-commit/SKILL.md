---
name: pre-commit
description: Run the full pre-commit verification checklist (typecheck + tests + build). Use before committing any changes to ensure everything passes.
---

# pre-commit

Full pre-commit verification checklist.

## Triggers

- Before committing changes
- Before creating a PR
- After completing a feature implementation

## Workflow

Run all checks in order. Stop on first failure.

### 1. Type Check API

```bash
cd services/api && bun run typecheck
```

### 2. Type Check Account App

```bash
cd apps/account && bun run typecheck
```

### 3. Run API Tests

```bash
cd services/api && bun test
```

### 4. Build API

```bash
cd services/api && bun run build
```

### 5. Build Account App

```bash
cd apps/account && bun run build
```

### 6. Lint (if configured)

```bash
bun run lint
```

## On Failure

- **Type errors**: Fix the types, then re-run from step 1
- **Test failures**: Fix the failing test or handler, then re-run from step 3
- **Build errors**: Usually a type error or missing import — fix and re-run
