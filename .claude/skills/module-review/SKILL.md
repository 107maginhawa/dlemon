---
name: module-review
description: Validate module completeness, consistency, test coverage, and boilerplate integrity. Use after implementing a module and before committing. Wired into /develop Phase 3 as mandatory gate.
---

# module-review

Quality gate that validates a module is truly complete before moving to the next.

## Triggers

- After completing a module's backend + frontend implementation
- Before `/commit` — final check
- When `/develop` finishes a module's vertical pass (mandatory)
- Manual: user says "review this module"

## Workflow

### 1. Determine Scope

Identify the module under review. Check git diff to find changed files:

```bash
git diff --name-only HEAD | grep -E 'handlers/|modules/|features/' | head -20
```

### 2. Completeness Check

For the module under review, verify all artifacts exist:

- [ ] TypeSpec definition in `specs/api/src/modules/{module}.tsp`
- [ ] Handler files in `services/api-ts/src/handlers/{module}/`
- [ ] Repository in `services/api-ts/src/handlers/{module}/repos/`
- [ ] Test file(s) exist for this module's handlers (colocated or module-level)
- [ ] Frontend route exists (if applicable) in `apps/account/src/routes/`

```bash
# Quick existence check
ls specs/api/src/modules/{module}.tsp
ls services/api-ts/src/handlers/{module}/
ls services/api-ts/src/handlers/{module}/repos/
find services/api-ts/src/handlers/{module}/ -name "*.test.ts"
```

### 3. Consistency Check

- [ ] TypeSpec operation IDs match handler function names
- [ ] Generated SDK types exist for all endpoints
- [ ] Frontend imports use SDK hooks (no hand-rolled fetch calls)

```bash
# Compare TypeSpec ops with handler files
grep -r 'op ' specs/api/src/modules/{module}.tsp | sed 's/.*op //' | sed 's/(.*//'
ls services/api-ts/src/handlers/{module}/*.ts | grep -v test | grep -v repo
```

### 4. Test Coverage

- [ ] Tests cover response paths declared in TypeSpec (not a universal checklist — derive from contract)
- [ ] All tests pass:

```bash
cd services/api-ts && bun test src/handlers/{module}/
```

- [ ] No skipped tests (`test.skip`, `xtest`)

```bash
grep -rn 'test.skip\|xtest\|xit\|xdescribe' services/api-ts/src/handlers/{module}/
```

### 5. Boilerplate Integrity

Scan for incomplete implementation:

```bash
# Check for stubs and code smells
grep -rn 'throw new Error.*Not implemented' services/api-ts/src/handlers/{module}/
grep -rn 'TODO\|FIXME\|HACK\|XXX' services/api-ts/src/handlers/{module}/
grep -rn ' as any' services/api-ts/src/handlers/{module}/ | grep -v '.test.ts'
```

- [ ] No `throw new Error('Not implemented')` remains
- [ ] No unresolved TODOs in handler code (TODOs in tests are acceptable if tracked)
- [ ] No unsafe `as any` casts in handler/repo code (test files exempt)
- [ ] Audit logging present for data-modification handlers (create/update/delete)
- [ ] No placeholder text in frontend (if applicable)
- [ ] No `console.log` in frontend (if applicable)

```bash
# Frontend checks (if applicable)
grep -rn 'TODO\|FIXME\|placeholder\|lorem' apps/account/src/features/{module}/ 2>/dev/null
grep -rn 'console\.log' apps/account/src/features/{module}/ 2>/dev/null
```

## Output

Report in this format:

```
## Module Review: {module}

**Completeness**: PASS/FAIL — [details]
**Consistency**: PASS/FAIL — [details]
**Test Coverage**: PASS/FAIL — [details]
**Boilerplate**: PASS/FAIL — [details]

### Issues Found
1. [issue + fix suggestion]

### Verdict: READY / NOT READY
```

Do not pass a module with any FAIL. Fix issues before proceeding to the next module.
