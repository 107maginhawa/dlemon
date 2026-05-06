---
name: component-test
description: Generate FAILING frontend component and hook tests for a module using bun:test + @testing-library/react. Step 7 of VERTICAL_TDD — writes RED tests before frontend implementation. Use before /frontend-module, "write frontend tests", "component RED phase", "frontend Step 7". Auto-dispatched by /develop before frontend implementation. NEVER implement frontend components without writing these tests first.
---

# component-test

RED phase for frontend. Write failing component and hook tests before implementing the UI. This is Step 7 of VERTICAL_TDD — the test spec defines the contract the UI must satisfy.

## Triggers

- Before `/frontend-module` (Step 7 of VERTICAL_TDD)
- "Write frontend tests for {module}"
- "Component RED phase for {module}"
- "Frontend Step 7"
- Auto-dispatched by `/develop` Phase 3 before frontend implementation

## Source Files

- `apps/account/src/features/person/components/contact-info-form.test.tsx` — reference pattern
- `apps/account/src/features/booking/lib/partition-bookings.test.ts` — pure logic test pattern
- `apps/account/src/hooks/use-detect-language.test.ts` — hook test pattern
- `specs/api/docs/standards/business-rules.md` — rules to derive test cases from
- `docs/context/wireframes/{module}*.html` — wireframes showing expected UI states
- `specs/api/docs/standards/br-registry.json` — BR tags for test case comments

## Workflow

### Step 1: Identify Test Targets

For the target module, identify what needs tests:

| Target | File Pattern | Test Pattern |
|--------|-------------|--------------|
| Components | `src/features/{module}/components/*.tsx` | Render, interaction, validation |
| Hooks | `src/features/{module}/hooks/*.ts` | renderHook, state transitions |
| Pure lib functions | `src/features/{module}/lib/*.ts` | Input/output, edge cases |
| Form schemas | `src/features/{module}/schemas/*.ts` | Zod parse, error messages |

Read wireframes and business rules to understand what each component should do before writing a single test.

### Step 2: Write Component Tests

Create colocated test file: `{component-name}.test.tsx` next to `{component-name}.tsx`

**Required imports:**
```typescript
import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
```

**Required structure:**
```typescript
afterEach(() => cleanup())

describe('{ComponentName}', () => {
  // 1. Render states
  test('renders loading state while data is fetching', () => { ... })
  test('renders empty state when no {entities} exist', () => { ... })
  test('renders {entities} list when data is loaded', () => { ... })
  test('renders error state when fetch fails', () => { ... })

  // 2. User interactions
  test('calls onSubmit with form values when submitted', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn() // or a bun mock
    render(<{Component} onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/{field}/i), 'value')
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ field: 'value' }))
  })

  // 3. Validation
  test('shows error when required field is empty', async () => {
    const user = userEvent.setup()
    render(<{Component} onSubmit={() => {}} />)
    await user.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(screen.getByText(/{validation message}/i)).toBeInTheDocument()
    })
  })

  // 4. BR-tagged business rule enforcement
  // [BR-001] {rule description}
  test('[BR-001] rejects {value} below minimum', async () => { ... })
})
```

**Key query methods** (in order of preference):
1. `screen.getByRole('button', { name: /text/i })` — buttons, links, headings
2. `screen.getByLabelText(/label/i)` — form inputs
3. `screen.getByText(/text/i)` — content assertions
4. `screen.queryByText(/text/i)` — assert absence (returns null, not throws)
5. `screen.getByDisplayValue('value')` — current input value

### Step 3: Write Hook Tests

For custom hooks, use `renderHook`:

```typescript
import { renderHook, cleanup } from '@testing-library/react'

afterEach(() => cleanup())

describe('use{HookName}', () => {
  test('returns initial state', () => {
    const { result } = renderHook(() => use{HookName}())
    expect(result.current.{value}).toBe({expected})
  })

  test('updates state when {action}', () => {
    const { result, rerender } = renderHook(
      ({ input }) => use{HookName}(input),
      { initialProps: { input: 'initial' } }
    )
    rerender({ input: 'updated' })
    expect(result.current.{value}).toBe({expected})
  })
})
```

### Step 4: Write Pure Logic Tests

For utility functions and Zod schemas, skip rendering entirely:

```typescript
import { describe, test, expect } from 'bun:test'
import { {utilFn} } from './{util}'

// Factory for test fixtures
function build(overrides = {}) {
  return { field: 'default', ...overrides }
}

describe('{utilFn}', () => {
  test('handles null input', () => {
    expect({utilFn}(null)).toBe({expected})
  })
  test('handles boundary value', () => {
    expect({utilFn}(build({ field: 0 }))).toBe({expected})
  })
})
```

### Step 5: Run Tests (Confirm RED)

```bash
cd apps/account && bun test src/features/{module}/
```

All tests must FAIL at this stage — the implementation doesn't exist yet. If any test passes without implementation, it's testing nothing useful.

Report:
```
## Component Tests: {module}

### Files Created
- src/features/{module}/components/{component}.test.tsx (N tests)
- src/features/{module}/hooks/use-{hook}.test.ts (N tests)
- src/features/{module}/lib/{util}.test.ts (N tests)

### Test Coverage Plan
| BR | Rule | Test |
|----|------|------|
| BR-001 | {rule} | {test name} |

### Status: ALL FAILING (RED ✓)
```

## What Tests Should Cover (derive from these sources)

**From wireframes** (`docs/context/wireframes/`):
- What renders in each state (loading, empty, loaded, error)
- What buttons/links are visible and when
- What form fields exist and their labels

**From business rules** (`specs/api/docs/standards/business-rules.md`):
- Field validation bounds (min/max, required, format)
- Status machine transitions (what actions are allowed in each state)
- Role-based visibility (what a patient sees vs. a provider)

**From the OpenAPI spec** (via `@monobase/sdk-ts` generated types):
- Response shapes the component will receive
- Mutation input shapes the form must produce

## Rules

- `cleanup()` in `afterEach` — required, prevents test pollution
- Use `userEvent.setup()` for all user interactions — not `fireEvent` (too low-level)
- `waitFor` for async assertions — never assert on async state synchronously
- Derive test cases from wireframes + business rules, not from the implementation
- Every component needs: loading state, empty state, error state, happy path
- Tag BR-related tests with `// [BR-##]` comments
- Tests must fail before the implementation exists — that's the point
