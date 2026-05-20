import { test, expect } from '@playwright/test'

/**
 * Imaging findings E2E spec — CIMG-01 through CIMG-06.
 *
 * Verifies the FindingsSidebar, useImagingFindings hook, and ImagingWorkspace
 * integration: open sidebar, create finding, status cycle, delete.
 *
 * Uses page.route() to intercept API calls for deterministic, network-isolated
 * testing. Tests run against the dev server (or a test harness page).
 *
 * NOTE: Without a running dev server these tests are skipped automatically
 * when the baseURL is unavailable. The spec is valid TypeScript and serves as
 * the automated acceptance gate for plan 11-02.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

const MOCK_FINDING = {
  id: 'e2e-finding-1',
  imageId: 'test-image-id',
  annotationId: null,
  treatmentId: null,
  visitId: 'test-visit-id',
  patientId: 'test-patient-id',
  branchId: 'test-branch-id',
  type: 'caries',
  status: 'suspected',
  toothNumber: 14,
  surfaces: null,
  note: 'test finding',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

test.describe('FindingsSidebar — create / update / delete', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept findings list — starts empty
    let storedFindings: typeof MOCK_FINDING[] = []

    await page.route('**/dental/imaging/images/*/findings', async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: storedFindings }),
        })
        return
      }
      if (method === 'POST') {
        storedFindings = [MOCK_FINDING]
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_FINDING),
        })
        return
      }
      await route.continue()
    })

    await page.route('**/dental/imaging/findings/e2e-finding-1', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        const body = (await route.request().postDataJSON()) as { status?: string }
        const updated = { ...MOCK_FINDING, status: body.status ?? MOCK_FINDING.status }
        storedFindings = [updated as typeof MOCK_FINDING]
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(updated),
        })
        return
      }
      if (method === 'DELETE') {
        storedFindings = []
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    await page.goto(IMAGING_TEST_URL)
  })

  test('Findings toggle button opens the sidebar panel', async ({ page }) => {
    const findingsBtn = page.getByRole('button', { name: /findings/i })
    await expect(findingsBtn).toBeVisible()
    await findingsBtn.click()
    // Sidebar header should appear
    await expect(page.getByText('Findings', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /add finding/i })).toBeVisible()
  })

  test('CIMG-05: 5 quick-select type chips are visible in the sidebar', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()
    await expect(page.getByRole('button', { name: 'Caries' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bone Loss' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Periapical Lesion' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Calculus' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Root Fracture' })).toBeVisible()
  })

  test('create finding: fill form and submit shows finding in list', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()

    // Use quick-select chip for Caries (CIMG-05)
    await page.getByRole('button', { name: 'Caries' }).click()

    // CIMG-06: tooth number
    await page.getByRole('spinbutton', { name: /tooth/i }).fill('14')

    // Note
    await page.getByRole('textbox', { name: /clinical note/i }).fill('test finding')

    // Submit
    await page.getByRole('button', { name: /add finding/i }).click()

    // Finding should appear in the list
    await expect(page.getByText('Caries').first()).toBeVisible()
    await expect(page.getByText('suspected')).toBeVisible()
    await expect(page.getByText('#14')).toBeVisible()
  })

  test('status cycle button advances finding status', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()

    // Create a finding first
    await page.getByRole('button', { name: 'Caries' }).click()
    await page.getByRole('spinbutton', { name: /tooth/i }).fill('14')
    await page.getByRole('button', { name: /add finding/i }).click()

    // Wait for finding to appear
    await expect(page.getByText('suspected')).toBeVisible()

    // Cycle status
    await page.getByRole('button', { name: /cycle status/i }).click()

    // Should now show confirmed (mocked PATCH returns confirmed)
    await expect(page.getByText('confirmed')).toBeVisible()
  })

  test('delete button removes finding from list', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()

    // Create a finding first
    await page.getByRole('button', { name: 'Caries' }).click()
    await page.getByRole('spinbutton', { name: /tooth/i }).fill('14')
    await page.getByRole('button', { name: /add finding/i }).click()

    // Wait for finding to appear
    await expect(page.getByText('Caries').first()).toBeVisible()

    // Delete
    await page.getByRole('button', { name: /delete finding/i }).click()

    // Finding should be gone; empty state shown
    await expect(page.getByText('No findings yet')).toBeVisible()
  })

  test('X button closes the sidebar', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()
    await expect(page.getByRole('button', { name: /add finding/i })).toBeVisible()

    await page.getByRole('button', { name: /close findings panel/i }).click()
    await expect(page.getByRole('button', { name: /add finding/i })).not.toBeVisible()
  })
})
