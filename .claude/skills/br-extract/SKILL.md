---
name: br-extract
description: Extract business rules for a module from specs/api/docs/standards/business-rules.md, derive failing test specs with edge cases, and update br-registry.json. Use before writing any tests, when starting a module, or when asked to "extract BRs", "what rules apply to {module}", "derive test cases". Auto-dispatched by /develop before /handler. ALWAYS use this before writing backend or frontend tests for any module.
---

# br-extract

Parse business rules for a specific module, derive failing test case specifications, and update the BR registry. This is Step 3 of VERTICAL_TDD — the bridge between requirements and RED phase tests.

## Triggers

- Before `/handler` or `/component-test`
- "Extract BRs for {module}"
- "Derive test cases for {module}"
- "What rules apply to {module}"
- Auto-dispatched by `/develop` Phase 3 before test writing

## Source Files

- `specs/api/docs/standards/business-rules.md` — canonical rule definitions
- `specs/api/docs/standards/br-registry.json` — coverage registry (create if missing: `{"modules": {}}`)
- `scripts/br-coverage.ts` — coverage report script

## Workflow

### Step 1: Read and Filter Business Rules

Read `specs/api/docs/standards/business-rules.md` and filter for the target module. Extract:
- BR ID (e.g., `BR-001`)
- Rule text
- Validation boundaries (min/max values, allowed enums, date constraints)
- Error conditions (what triggers 400, 409, 422, etc.)
- Edge cases (null inputs, boundary values, state transitions)
- Cross-cutting rules that apply to ALL modules (mark explicitly)

### Step 2: Derive Test Specifications

For each business rule, produce concrete test case descriptions — one per assertion. Group by test layer:

**Backend unit tests** (`services/api-ts/src/handlers/{module}/`):
- Repo tests: CRUD operations, field validation, constraint violations, status machine transitions
- Handler tests: HTTP status codes per rule, auth enforcement, error response shapes

**Contract tests** (`specs/api/tests/contract/{module}.hurl`):
- Happy path flows, error codes, auth/authz paths, multi-step sequences

**Frontend tests** (`apps/account/src/features/{module}/`):
- UI states that reflect rule enforcement (disabled buttons, validation messages, empty states)

Tag every test case with its BR ID: `[BR-001] returns 409 when duplicate entry exists`

### Step 3: Check Existing Coverage

Run: `bun run scripts/br-coverage.ts --module={module}` (if the script exists)

- **COVERED**: skip
- **PARTIAL**: note which cases are missing, generate only the gaps
- **UNTESTED**: generate full test spec

If the script doesn't exist yet, scan the test files manually for BR ID tags.

### Step 4: Update BR Registry

Write to `specs/api/docs/standards/br-registry.json`:

```json
{
  "modules": {
    "{module}": {
      "BR-001": {
        "rule": "short rule description",
        "status": "UNTESTED",
        "test_paths": [],
        "edge_cases": ["null input", "boundary value X"],
        "affected_layers": ["backend", "contract", "frontend"]
      }
    }
  }
}
```

Status values: `UNTESTED` | `PARTIAL` | `COVERED`

### Step 5: Output Test Spec

Produce a test spec summary:

```
## BR Extraction: {module}

### Coverage Summary
- Total rules: N
- Covered: N
- Partial: N
- Untested: N

### Test Cases to Write

#### Backend Unit Tests
- [BR-001] repo: returns null when {entity} not found (edge: deleted record)
- [BR-002] handler: returns 409 when duplicate {field}

#### Contract Tests
- [BR-001] GET /{module}/{id} → 404 when not found
- [BR-002] POST /{module} → 409 on duplicate

#### Frontend Tests
- [BR-003] form: shows validation error when {field} exceeds max length
- [BR-003] list: renders empty state when no records

### Ambiguous Rules (needs clarification)
- BR-XXX: [description of ambiguity]
```

## Rules

- Never invent business rules — only extract from `business-rules.md`
- Always include edge cases (null inputs, boundary values, error states, status transitions)
- Tag every test case with `[BR-##]`
- Cross-cutting rules apply to ALL modules — include them unless already covered
- Flag ambiguous rules as needing clarification before proceeding
- Update the registry after extraction, not before
