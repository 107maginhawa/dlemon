import { test, expect } from '@playwright/test'

/**
 * Helper: sign up a fresh user and complete onboarding (skip address).
 * Lands on /dashboard after completion.
 *
 * License and device pages use hardcoded mock data — no API setup needed.
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

test.describe('License & Devices', () => {
  test('license dashboard renders license information', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/licenses')
    await page.waitForLoadState('networkidle')

    // Main heading
    await expect(page.getByRole('heading', { name: /license/i })).toBeVisible()

    // Subtitle
    await expect(page.getByText(/manage your dentalemon subscription/i)).toBeVisible()
  })

  test('license dashboard shows tier information (Solo Practice)', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/licenses')
    await page.waitForLoadState('networkidle')

    // Mock data has tier: 'solo' → "Solo Practice"
    await expect(page.getByText(/solo practice/i)).toBeVisible()
  })

  test('license dashboard shows usage metrics', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/licenses')
    await page.waitForLoadState('networkidle')

    // Mock data renders usage items: Devices, Users, Branches
    await expect(page.getByText(/devices/i)).toBeVisible()
    await expect(page.getByText(/users/i)).toBeVisible()
    await expect(page.getByText(/branches/i)).toBeVisible()
  })

  test('license page does not crash or show error state', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/licenses')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
    await expect(page.getByText(/500|internal server error/i)).not.toBeVisible()
  })

  test('devices page renders device list', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/devices')
    await page.waitForLoadState('networkidle')

    // Main heading
    await expect(page.getByRole('heading', { name: /devices/i })).toBeVisible()

    // Subtitle
    await expect(page.getByText(/manage devices linked to your license/i)).toBeVisible()
  })

  test('devices page shows mock device entries', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/devices')
    await page.waitForLoadState('networkidle')

    // Mock data includes "MacBook Pro" and "iPad Pro"
    await expect(page.getByText(/macbook pro/i)).toBeVisible()
    await expect(page.getByText(/ipad pro/i)).toBeVisible()
  })

  test('devices page filter tabs render', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/devices')
    await page.waitForLoadState('networkidle')

    // DeviceManager renders filter buttons: all, active, inactive
    await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^active$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^inactive$/i })).toBeVisible()
  })

  test('device filter tabs are interactive', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/devices')
    await page.waitForLoadState('networkidle')

    // Click "active" filter — both mock devices are active so still visible
    await page.getByRole('button', { name: /^active$/i }).click()
    await expect(page.getByText(/macbook pro/i)).toBeVisible()

    // Click "inactive" filter — no inactive devices, list empties
    await page.getByRole('button', { name: /^inactive$/i }).click()
    await expect(page.getByText(/macbook pro/i)).not.toBeVisible()

    // Back to "all" — devices reappear
    await page.getByRole('button', { name: /^all$/i }).click()
    await expect(page.getByText(/macbook pro/i)).toBeVisible()
  })
})
