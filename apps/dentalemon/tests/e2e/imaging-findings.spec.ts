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
  // SM-01 finding lifecycle is draft → confirmed → resolved (see
  // use-imaging-findings.ts ImagingFindingStatus). 'suspected' is not a valid
  // status; starting at 'draft' so the cycle button advances to 'confirmed'.
  status: 'draft',
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
        // GET /findings returns { items: ImagingFinding[] } — useImagingFindings
        // reads data.items (use-imaging-findings.ts), matching the real handler
        // (listFindings.ts, post-BUG-IMG-002). Returning { data } would make the
        // list resolve to undefined so created findings never surface.
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

    // The TanStack Devtools trigger is a position:fixed, z-index:99999 button
    // pinned bottom-right (dev-only widget, never ships). It overlaps the
    // FindingsSidebar's per-row cycle/delete buttons (also bottom-right of the
    // panel) and intercepts pointer events, so clicks on those actions time out.
    // Hide the dev widget so the real product affordances are clickable. This is
    // a test-environment artifact, not a product defect.
    await page.addStyleTag({
      content: 'button:has(> img[alt="TanStack Devtools"]) { display: none !important; }',
    })
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

    // Finding should appear in the list. The status badge renders the raw
    // lowercase status ('draft') with a CSS `capitalize`; use exact: true so we
    // match the badge span, not the case-different <option>Draft</option>.
    await expect(page.getByText('Caries').first()).toBeVisible()
    await expect(page.getByText('draft', { exact: true })).toBeVisible()
    await expect(page.getByText('#14')).toBeVisible()
  })

  test('status cycle button advances finding status', async ({ page }) => {
    await page.getByRole('button', { name: /findings/i }).click()

    // Create a finding first
    await page.getByRole('button', { name: 'Caries' }).click()
    await page.getByRole('spinbutton', { name: /tooth/i }).fill('14')
    await page.getByRole('button', { name: /add finding/i }).click()

    // Wait for finding to appear (badge shows raw lowercase status 'draft')
    await expect(page.getByText('draft', { exact: true })).toBeVisible()

    // Cycle status
    await page.getByRole('button', { name: /cycle status/i }).click()

    // Cycling draft → confirmed (SM-01). The PATCH mock echoes the sent status;
    // the badge re-renders 'confirmed'. exact:true matches the badge span, not
    // the case-different <option>Confirmed</option>.
    await expect(page.getByText('confirmed', { exact: true })).toBeVisible()
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
