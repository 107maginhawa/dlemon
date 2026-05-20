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

test.describe('Person Profile', () => {
  test('account settings page loads with user profile', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    // Main heading
    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    // Personal information card
    await expect(page.getByText('Personal Information', { exact: true })).toBeVisible()
  })

  test('personal info form renders with first name and last name fields', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    // Wait for loading state to resolve
    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    // Fields should be present (PersonalInfoForm renders First Name + Last Name)
    const firstNameLabel = page.getByLabel(/first name/i)
    const lastNameLabel = page.getByLabel(/last name/i)

    await expect(firstNameLabel).toBeVisible({ timeout: 15000 })
    await expect(lastNameLabel).toBeVisible({ timeout: 15000 })
  })

  test('user can update display name', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    const firstNameInput = page.getByLabel(/first name/i).first()
    await expect(firstNameInput).toBeVisible({ timeout: 15000 })

    const newFirstName = `Updated${Date.now()}`
    await firstNameInput.clear()
    await firstNameInput.fill(newFirstName)
    await expect(firstNameInput).toHaveValue(newFirstName)

    // Capture the update network response for diagnostics
    const updateResponse = page.waitForResponse(
      (resp: any) => /\/persons\//.test(resp.url()) && resp.request().method() === 'PATCH',
      { timeout: 15000 },
    ).catch(() => null)

    // Click Save Changes button within the Personal Information card
    const saveBtn = page.getByRole('button', { name: /save changes/i }).first()
    await expect(saveBtn).toBeVisible()
    await saveBtn.click()

    const res = await updateResponse
    if (res && res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      throw new Error(`PATCH /persons returned ${res.status()}: ${body.slice(0, 500)}`)
    }

    // After save, success toast or no crash
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
  })

  test('form shows validation error for empty first name', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    const firstNameInput = page.getByLabel(/first name/i).first()
    await expect(firstNameInput).toBeVisible({ timeout: 15000 })

    // Clear the required first name field
    await firstNameInput.clear()

    // Submit the form
    const saveBtn = page.getByRole('button', { name: /save changes/i }).first()
    await saveBtn.click()

    // Should show validation error for required field
    await expect(page.getByText(/first name is required/i)).toBeVisible({ timeout: 10000 })
  })

  test('changes persist after save and page reload', async ({ page }) => {
    await signUpAndOnboard(page)

    await page.goto('/settings/account')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /account settings/i })).toBeVisible()

    const firstNameInput = page.getByLabel(/first name/i).first()
    await expect(firstNameInput).toBeVisible({ timeout: 15000 })

    const newFirstName = `Persist${Date.now()}`
    await firstNameInput.clear()
    await firstNameInput.fill(newFirstName)

    // Need last name too (required field)
    const lastNameInput = page.getByLabel(/last name/i).first()
    const existingLastName = await lastNameInput.inputValue()
    if (!existingLastName) {
      await lastNameInput.fill('Testlast')
    }

    const updateResponse = page.waitForResponse(
      (resp: any) => /\/persons\//.test(resp.url()) && resp.request().method() === 'PATCH',
      { timeout: 15000 },
    ).catch(() => null)

    await page.getByRole('button', { name: /save changes/i }).first().click()

    const res = await updateResponse
    if (res && res.status() >= 400) {
      const body = await res.text().catch(() => '<unreadable>')
      throw new Error(`PATCH /persons returned ${res.status()}: ${body.slice(0, 500)}`)
    }

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // First name should reflect the saved value
    const reloadedInput = page.getByLabel(/first name/i).first()
    await expect(reloadedInput).toHaveValue(newFirstName, { timeout: 15000 })
  })
})
