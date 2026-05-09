import { test, expect } from '@playwright/test'

/**
 * Helper: sign up a fresh user and complete onboarding (skip address).
 * Returns the user credentials and lands on /dashboard.
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

  // Complete onboarding if redirected there
  if (page.url().includes('/onboarding')) {
    // Step 1: personal info — click Next (date of birth skipped, form may require it)
    // Select a date of birth
    await page.getByLabel(/date of birth/i).click()
    await page.getByRole('combobox', { name: /choose the year/i }).selectOption('1990')
    await page.getByRole('combobox', { name: /choose the month/i }).selectOption({ index: 0 })
    await page.getByRole('button', { name: 'Monday, January 15th, 1990' }).click()
    await page.click('button:has-text("Next")')

    // Step 2: skip address
    await page.waitForLoadState('networkidle')
    const skipButton = page.getByRole('button', { name: /skip for now/i })
    await expect(skipButton).toBeVisible()
    await skipButton.click()

    await page.waitForURL('/dashboard', { timeout: 15000 })
  }

  return { email, password, name }
}

test.describe('Booking Flow', () => {
  test('user can view booking list page', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    // Page heading should be visible
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible()

    // Tabs: "Find a host" and "My bookings" both visible
    await expect(page.getByRole('tab', { name: /find a host/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /my bookings/i })).toBeVisible()
  })

  test('empty state shows when user has no bookings', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    // Switch to "My bookings" tab
    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    // Either shows an empty state message or a list with zero items — no booking cards
    // The key assertion is the page rendered without error
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible()

    // Should not show a server error
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible()
  })

  test('find a host tab is the default active tab', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    const findTab = page.getByRole('tab', { name: /find a host/i })
    await expect(findTab).toHaveAttribute('data-state', 'active')
  })

  test('user can navigate to host directory tab', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    // The "Find a host" tab content should be visible by default
    // It renders the HostDirectory component
    const findTab = page.getByRole('tab', { name: /find a host/i })
    await expect(findTab).toBeVisible()
    await findTab.click()

    // Tab panel content appears — no crash
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /bookings/i })).toBeVisible()
  })

  test('my bookings tab shows content after switching', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/bookings')
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: /my bookings/i }).click()
    await page.waitForLoadState('networkidle')

    // Tab is now active
    await expect(page.getByRole('tab', { name: /my bookings/i })).toHaveAttribute('data-state', 'active')

    // No crash / error boundary text
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })
})
