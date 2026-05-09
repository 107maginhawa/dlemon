---
name: e2e-scaffold
description: Generate a Playwright E2E test spec for a module's critical user journey. Step 9 of VERTICAL_TDD — creates apps/account/tests/e2e/{module}.spec.ts following established patterns. Use after frontend implementation passes unit tests, "write e2e test", "scaffold e2e for {module}", "E2E step 9". Auto-dispatched by /develop after frontend GREEN. Never claim a module is complete without an E2E spec.
---

# e2e-scaffold

Generate a failing (then passing) Playwright E2E test for the critical user journey of a module. This is Step 9 of VERTICAL_TDD — the final validation that the full stack works end-to-end in a real browser.

## Triggers

- After frontend implementation passes unit tests (Step 9 of VERTICAL_TDD)
- "Write E2E test for {module}"
- "Scaffold E2E for {module}"
- "Step 9 for {module}"
- Auto-dispatched by `/develop` Phase 3 after `/frontend-module`

## Source Files

- `apps/account/tests/e2e/onboarding.spec.ts` — reference pattern (read this first)
- `apps/account/src/routes/` — routes for the module being tested
- `docs/context/wireframes/` — wireframes showing the expected user journey
- `specs/api/docs/standards/business-rules.md` — rules that the journey must satisfy

## Workflow

### Step 1: Read the Reference Pattern

Read `apps/account/tests/e2e/onboarding.spec.ts` to understand the established conventions:
- How users are created/authenticated via UI
- How network responses are captured and inspected
- Wait strategies (`waitForURL`, `waitForResponse`, `networkidle`)
- Assertion patterns (`toHaveURL`, `getByRole`, `getByLabel`)
- Helper function structure

### Step 2: Identify the Critical Journey

The critical journey is the single most important user flow for the module — the one a real user would follow to accomplish the module's primary purpose.

**How to identify it:**
1. Check wireframes in `docs/context/wireframes/{module}*.html`
2. Look at the module's primary route in `apps/account/src/routes/`
3. Ask: "What is the one thing a user MUST be able to do in this module?"

**One journey per spec file.** If there are secondary journeys, add them as additional `test()` blocks in the same `test.describe` block.

### Step 3: Write the Spec

Create `apps/account/tests/e2e/{module}.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

// Helper: authenticate as a new test user
async function signUpTestUser(page) {
  const suffix = Date.now().toString()
  const email = `test+${suffix}@example.com`
  await page.goto('/auth/sign-in')
  await page.getByRole('link', { name: /sign up/i }).click()
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill('Test1234!')
  
  const signUpResponse = page.waitForResponse(
    r => r.url().includes('/auth/sign-up') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: /sign up/i }).click()
  const res = await signUpResponse
  if (!res.ok()) throw new Error(`Sign-up failed: ${res.status()} ${await res.text()}`)
  
  return { email, suffix }
}

// Helper: complete module-specific setup if required
async function complete{ModuleSetup}(page) {
  // e.g., complete onboarding, create prerequisite data
}

test.describe('{Module} Flow', () => {
  test('primary journey: {describe what the user accomplishes}', async ({ page }) => {
    const { email } = await signUpTestUser(page)
    await complete{ModuleSetup}(page)
    
    // Navigate to module
    await page.goto('/{module-route}')
    await page.waitForLoadState('networkidle')
    
    // Step 1: {describe action}
    await expect(page.getByRole('heading', { name: /{module title}/i })).toBeVisible()
    
    // Step 2: {describe action}
    await page.getByRole('button', { name: /create/i }).click()
    // ... fill form ...
    
    const createResponse = page.waitForResponse(
      r => r.url().includes('/{module}') && r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: /save/i }).click()
    const res = await createResponse
    if (!res.ok()) throw new Error(`Create failed: ${res.status()} ${await res.text()}`)
    
    // Step 3: Verify result
    await page.waitForURL('/{module}/**')
    await expect(page.getByText(/{expected content}/i)).toBeVisible()
  })

  test('empty state: shows CTA when no {entities} exist', async ({ page }) => {
    await signUpTestUser(page)
    await page.goto('/{module-route}')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/{empty state text}/i)).toBeVisible()
  })

  test('validation: shows error when required field missing', async ({ page }) => {
    await signUpTestUser(page)
    await page.goto('/{module-route}')
    await page.getByRole('button', { name: /create/i }).click()
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(/{validation error text}/i)).toBeVisible()
  })
})
```

**Fill in the template** by reading:
- The route file to understand what components render
- The wireframe to understand the flow
- The business rules for what validations should appear

### Step 4: Run the Spec

```bash
cd apps/account && bunx playwright test tests/e2e/{module}.spec.ts
```

The spec should initially FAIL if the frontend is in RED state, or PASS if already in GREEN. Either is fine — the goal is that the spec correctly describes the journey.

Report:
```
## E2E Scaffold: {module}

### Journey Covered
Primary: {description of what the test does end-to-end}

### Test Cases
- Primary journey: ✓/✗
- Empty state: ✓/✗
- Validation: ✓/✗

### File Created
apps/account/tests/e2e/{module}.spec.ts

### Status
{PASS / FAIL — expected at this stage}
```

## Rules

- One `test.describe` block per module, one spec file per module
- Always capture network responses on mutations — diagnose API failures explicitly (not just "button didn't work")
- Use `waitForLoadState('networkidle')` after navigation for hydration safety
- Use `getByRole` and `getByLabel` — never CSS selectors or test IDs unless unavoidable
- Each test must create its own user — never share state between tests
- Helper functions go above the `test.describe` block
- Tests must be independently runnable (no ordering dependencies)
- Cover: happy path + empty state + at least one validation error
