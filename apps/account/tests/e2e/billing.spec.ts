import { test, expect } from '@playwright/test'

/**
 * Helper: sign up a fresh user and complete onboarding (skip address).
 * Lands on /dashboard after completion.
 */
async function signUpAndOnboard(page: any) {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 10000)
  const email = `test-${timestamp}-${random}@example.com`
  const password = 'TestPass123!'
  const name = `TestUser ${timestamp}`

  await page.goto('/auth/sign-up')
  await page.waitForLoadState('networkidle')

  const submit = page.getByRole('button', { name: /create an account/i })
  await expect(submit).toBeVisible()

  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Email', { exact: true }).fill(email)
  const passwordInput = page.getByLabel('Password', { exact: true })
  await passwordInput.click()
  await passwordInput.pressSequentially(password, { delay: 10 })

  const signupResponse = page.waitForResponse(
    (resp: any) => /\/auth\/sign-up\b/.test(resp.url()) && resp.request().method() === 'POST',
    { timeout: 10000 },
  ).catch(() => null)

  await submit.click()

  const response = await signupResponse
  if (response && response.status() >= 400) {
    const body = await response.text().catch(() => '<unreadable>')
    throw new Error(`Sign-up POST returned ${response.status()}: ${body.slice(0, 500)}`)
  }

  await page.waitForURL((url: URL) => !url.pathname.includes('/auth/sign-up'), { timeout: 15000 })

  if (page.url().includes('/onboarding')) {
    await page.getByLabel(/date of birth/i).click()
    await page.getByRole('combobox', { name: /choose the year/i }).selectOption('1990')
    await page.getByRole('combobox', { name: /choose the month/i }).selectOption({ index: 0 })
    await page.getByRole('button', { name: 'Monday, January 15th, 1990' }).click()
    await page.click('button:has-text("Next")')

    await page.waitForLoadState('networkidle')
    const skipButton = page.getByRole('button', { name: /skip for now/i })
    await expect(skipButton).toBeVisible()
    await skipButton.click()

    await page.waitForURL('/dashboard', { timeout: 15000 })
  }

  return { email, password, name }
}

test.describe('Billing Settings', () => {
  test('billing page loads and shows merchant account section', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/billing')
    await page.waitForLoadState('networkidle')

    // Page heading
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()

    // Subtitle text
    await expect(page.getByText(/connect a stripe account/i)).toBeVisible()
  })

  test('shows connect stripe button for new accounts', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/billing')
    await page.waitForLoadState('networkidle')

    // New users won't have a merchant account. After the query resolves (404 → null),
    // the component renders the "none" state with a "Set Up Payment Account" button.
    // Wait for loading spinners to disappear.
    await expect(page.locator('[aria-label="Set up merchant account"]')).toBeVisible({ timeout: 15000 })

    // The setup button should be interactive (not disabled during idle state)
    const setupBtn = page.getByRole('button', { name: /set up merchant account/i })
    await expect(setupBtn).toBeVisible()
    await expect(setupBtn).toBeEnabled()
  })

  test('merchant account section renders without crashing', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/billing')
    await page.waitForLoadState('networkidle')

    // Page should not show an error boundary
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible()

    // MerchantAccountSetup renders in one of three states:
    // loading (spinner), none (Set Up button), incomplete (Continue Setup), complete (Connected)
    // All three have the billing heading present
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()
  })

  test('skip for now button navigates away from billing page', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/billing')
    await page.waitForLoadState('networkidle')

    // Wait for page to settle (merchant account fetch resolves)
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()

    // "Skip for now" button is always rendered (showButtons=true by default)
    const skipBtn = page.getByRole('button', { name: /skip for now/i })
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    // Should navigate to /dashboard
    await page.waitForURL('/dashboard', { timeout: 15000 })
  })
})
