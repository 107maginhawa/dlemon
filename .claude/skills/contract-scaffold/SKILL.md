---
name: contract-scaffold
description: Generate FAILING Hurl contract test scenarios from the OpenAPI spec for a module. RED phase for API contracts — scaffolds .hurl files with auth flows, happy paths, error codes, and multi-step journeys. Use after backend unit tests pass, "write contract tests", "scaffold hurl", "contract RED phase". Auto-dispatched by /develop after backend GREEN. Always use this skill before claiming contract tests are done.
---

# contract-scaffold

RED phase for API contracts. Generates failing Hurl scenarios from the OpenAPI spec, following established patterns in `specs/api/tests/contract/`.

## Triggers

- After backend passes unit tests (Step 5 of VERTICAL_TDD)
- "Write contract tests for {module}"
- "Scaffold hurl for {module}"
- "Contract RED phase"
- Auto-dispatched by `/develop` after backend GREEN

## Source Files

- `specs/api/dist/openapi/openapi.json` — canonical API spec
- `specs/api/tests/contract/*.hurl` — existing patterns to follow
- `scripts/run-contract-tests.ts` — test runner
- `specs/api/docs/standards/br-registry.json` — BR tags for scenarios

## Workflow

### Step 1: Read OpenAPI Spec for Module

From `specs/api/dist/openapi/openapi.json`, extract all paths for the target module:
- HTTP methods and paths
- Request body schemas (required fields, types, constraints)
- Response schemas (shape, status codes)
- Query parameters (pagination, filters)
- Security requirements

### Step 2: Study Existing Hurl Patterns

Read 2-3 existing `.hurl` files to understand:
- Auth setup pattern (get token, capture it)
- Variable configuration (`{{api}}`, `{{suffix}}`)
- Capture syntax for IDs from create responses
- Assert patterns for response shape
- Multi-step journey structure

### Step 3: Generate Hurl Scenarios

Create `specs/api/tests/contract/{module}.hurl` with these sections:

**A) Auth Setup**
```hurl
# === Auth Setup ===
POST {{api}}/auth/sign-in
Content-Type: application/json
{ "email": "test+{{suffix}}@example.com", "password": "Test1234!" }

HTTP 200
[Captures]
token: jsonpath "$.token"
```

**B) Happy Path CRUD**
- Create → capture ID
- Read by ID
- List (with pagination if supported)
- Update
- Delete (if applicable)

**C) Validation Errors (400)**
- Missing required fields
- Invalid field values
- Constraint violations

**D) Auth/Authz Errors (401/403)**
- No token → 401
- Wrong role → 403

**E) Not Found (404)**
- Non-existent ID → 404

**F) Multi-Step Journeys**
- Sequences that reflect real user workflows
- Status transitions (if module has a state machine)

**G) BR-Tagged Scenarios**
- One scenario per business rule in the BR registry
- Comment: `# [BR-001] description`

### Step 4: Configure Variables

At the top of the file:
```hurl
# Variables: api={{API_URL}} suffix={{TEST_SUFFIX}}
# Run: bun run scripts/run-contract-tests.ts --module={module}
```

### Step 5: Run and Confirm RED

```bash
API_URL=http://localhost:7213 TEST_SUFFIX=$(date +%s) hurl specs/api/tests/contract/{module}.hurl
```

All new scenarios must FAIL. If any pass unexpectedly, investigate — the endpoint may already exist with different behavior.

Report:
```
## Contract Scaffold: {module}
- Scenarios generated: N
- Auth setup: ✓
- Happy path: N scenarios
- Error cases: N scenarios (400: N, 401: N, 403: N, 404: N)
- Multi-step journeys: N
- BR-tagged: N
- Status: ALL FAILING (RED ✓)
```

## Hurl Syntax Reference

**Captures:**
```hurl
[Captures]
id: jsonpath "$.id"
token: header "Authorization"
```

**Asserts:**
```hurl
[Asserts]
jsonpath "$.status" == "active"
jsonpath "$.items" count > 0
header "Content-Type" contains "application/json"
```

**Query params:**
```hurl
GET {{api}}/bookings?page=1&limit=10
```

**File upload:**
```hurl
POST {{api}}/storage/upload
[MultipartFormData]
file: file,test.pdf; application/pdf
```

## Rules

- Always start with auth setup — never hardcode tokens
- Use `{{suffix}}` for unique test data (prevents collisions between runs)
- File naming: `{module}-flow.hurl` for main scenarios, `{module}-edge.hurl` for edge cases (only if file would exceed 200 lines)
- Include ALL error status codes declared in the OpenAPI spec
- Capture IDs from create responses — never hardcode UUIDs
- Test pagination query params if the endpoint supports them
- Never modify existing `.hurl` files — only add new ones
- Note any seed data prerequisites at the top of the file
