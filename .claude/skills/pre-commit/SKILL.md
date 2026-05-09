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

### 0. Test Ratchet Check

> **WHY**: `bun test` exits 0 with zero test files (false green). This gate catches new/changed handlers shipping without ANY test coverage.

Check that NEW or MODIFIED handler files have test coverage. Only checks what you're about to commit — not all handlers.

```bash
# Check NEW or MODIFIED handler files have test coverage
# Uses git diff to scope — only checks what you're about to commit
for f in $(git diff --cached --name-only -- 'services/api-ts/src/handlers/**/*.ts' | \
  grep -v '/repos/' | grep -v '/generated/' | grep -v '.test.ts' | grep -v '/utils/'); do
  # Check for colocated test OR module-level test
  test_file="${f%.ts}.test.ts"
  module_dir=$(dirname "$f")
  module_tests=$(find "$module_dir" -name "*.test.ts" 2>/dev/null | head -1)
  if [ ! -f "$test_file" ] && [ -z "$module_tests" ]; then
    echo "MISSING TEST: No test file found for $f"
    echo "  Expected: $test_file OR any .test.ts in $module_dir/"
    exit 1
  fi
done
echo "Test ratchet: all changed handlers have test coverage"
```

Module-level test files are accepted (e.g., `booking.test.ts` covering create + get + list). Untouched legacy handlers are not blocked.

### 1. Type Check API

```bash
cd services/api-ts && bun run typecheck
```

### 2. Type Check Account App

```bash
cd apps/account && bun run typecheck
```

### 3. Run API Tests

```bash
cd services/api-ts && bun test
```

### 4. Type Check SDK

```bash
cd packages/sdk-ts && bun run typecheck
```

### 5. Build API

```bash
cd services/api-ts && bun run build
```

### 6. Build Account App

```bash
cd apps/account && bun run build
```

### 7. Lint per workspace

```bash
bun run --filter '*' lint
```

### 8. Cargo Check (if Rust touched)

If you modified `services/cadence/` or `apps/account/src-tauri/`:

```bash
cd services/cadence && cargo check --all-targets
cd apps/account/src-tauri && cargo check
```

### 9. Contract Suite (if API surface touched)

If you modified handlers or TypeSpec:

```bash
cd services/api-ts && bun dev &       # boot in background
sleep 3
bun run test:contract                  # 22 scenarios in ~5s
kill %1                                # stop dev server
```

## On Failure

- **Test ratchet**: Create test file(s) for the changed handler, then re-run from step 0
- **Type errors**: Fix the types, then re-run from step 1
- **Test failures**: Fix the failing test or handler, then re-run from step 3
- **Build errors**: Usually a type error or missing import — fix and re-run
