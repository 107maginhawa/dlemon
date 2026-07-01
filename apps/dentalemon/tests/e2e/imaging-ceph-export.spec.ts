import { test, expect } from '@playwright/test'
import {
  IMAGE_ID,
  MOCK_REPORT_RESPONSE,
  mkUnconfirmedLandmarksResp,
  mkConfirmedLandmarksResp,
  setupCephRoutes,
  openCephPanel,
  installDefaultApiStub,
  assertWorkspaceReady,
  assertNoLoginRedirect,
} from './helpers/imaging-harness'
import { enableWorkspaceFlags } from './helpers/feature-flags'

/**
 * Cephalometric export & report E2E spec — CEPH-06 through CEPH-10.
 *
 * Tests: Generate Report gate enforcement, report creation flow, PNG export
 * button, and the print report route (CephReportView).
 *
 * Uses page.route() to mock all ceph API calls (no real backend needed).
 * NOTE: Without a running dev server these tests are skipped automatically.
 */

const CEPH_TEST_URL = '/imaging-test?modality=cephalometric'
const REPORT_ROUTE_URL = `/imaging-ceph-report/${IMAGE_ID}?version=1`

// Install the catch-all stub first (lowest LIFO priority) so any unmocked
// backend request fails loudly rather than hitting a real server.
// setupCephRoutes / per-test overrides are registered after this and win.
test.beforeEach(async ({ page }) => {
  // Cephalometric analysis is v2 (workspace.ceph) — opt in before navigating.
  await enableWorkspaceFlags(page, 'workspace.ceph')
  await installDefaultApiStub(page)
})

// ─── CEPH-06: Gate enforcement ────────────────────────────────────────────────

test.describe('CEPH-06: Generate Report gate enforcement', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page, mkUnconfirmedLandmarksResp())
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)
  })

  test('Generate Report button is disabled when gate landmarks not confirmed', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Generate Report/i }),
    ).toBeDisabled()
  })

  test('panel shows "Report requires A, B, Go, Po confirmed" text', async ({ page }) => {
    await expect(
      page.getByText('Report requires A, B, Go, Po confirmed'),
    ).toBeVisible()
  })

  test('unconfirmed gate landmarks are listed', async ({ page }) => {
    await expect(page.getByText(/Unconfirmed:/)).toBeVisible()
  })
})

// ─── CEPH-07: Gate passes ─────────────────────────────────────────────────────

test.describe('CEPH-07: Gate landmarks confirmed', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page, mkConfirmedLandmarksResp())
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)
  })

  test('Generate Report button is enabled when all gate landmarks confirmed', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Generate Report/i }),
    ).toBeEnabled()
  })

  test('"Gate landmarks confirmed" text is visible', async ({ page }) => {
    await expect(page.getByText('Gate landmarks confirmed')).toBeVisible()
  })
})

// ─── CEPH-08: Report generation flow ─────────────────────────────────────────

test.describe('CEPH-08: Report generation', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page, mkConfirmedLandmarksResp())
    // Mock POST /ceph/report → version 1 (registered after setupCephRoutes = higher priority)
    await page.route(/\/ceph\/report/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: { version: 1 } })
      } else {
        route.continue()
      }
    })
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)
  })

  test('clicking Generate Report shows View Report button', async ({ page }) => {
    await page.getByRole('button', { name: /Generate Report/i }).click()
    await expect(page.getByRole('button', { name: /View Report/i })).toBeVisible({
      timeout: 5000,
    })
  })

  test('View Report button includes version number', async ({ page }) => {
    await page.getByRole('button', { name: /Generate Report/i }).click()
    await expect(page.getByRole('button', { name: /View Report.*v1/i })).toBeVisible({
      timeout: 5000,
    })
  })

  test('PNG button visible after report creation', async ({ page }) => {
    await page.getByRole('button', { name: /Generate Report/i }).click()
    await expect(page.getByRole('button', { name: /View Report/i })).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByRole('button', { name: 'PNG' })).toBeVisible({ timeout: 3000 })
  })
})

// ─── CEPH-09: Snapshot immutability ──────────────────────────────────────────

test.describe('CEPH-09: Snapshot immutability (D-I)', () => {
  test('generating a second report creates version 2, not overwriting version 1', async ({
    page,
  }) => {
    let reportVersion = 1
    await setupCephRoutes(page, mkConfirmedLandmarksResp())
    await page.route(/\/ceph\/report/, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: { version: reportVersion++ } })
      } else {
        route.continue()
      }
    })
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)

    // First report
    await page.getByRole('button', { name: /Generate Report/i }).click()
    await expect(page.getByRole('button', { name: /View Report.*v1/i })).toBeVisible({
      timeout: 5000,
    })

    // Second report (simulate re-edit by clicking again)
    await page.getByRole('button', { name: /Generate Report/i }).click()
    await expect(page.getByRole('button', { name: /View Report.*v2/i })).toBeVisible({
      timeout: 5000,
    })
  })
})

// ─── CEPH-10: Report route rendering ─────────────────────────────────────────

test.describe('CEPH-10: Report route (CephReportView)', () => {
  test.beforeEach(async ({ page }) => {
    // /ceph/report stub registered after installDefaultApiStub = higher priority
    await page.route(/\/ceph\/report/, (route) => {
      route.fulfill({ json: MOCK_REPORT_RESPONSE })
    })
    await page.goto(REPORT_ROUTE_URL)
    await assertWorkspaceReady(page, 'report')
    assertNoLoginRedirect(page)
  })

  test('analysis label badge shows steiner_hybrid_sn', async ({ page }) => {
    await expect(page.getByTestId('analysis-label-badge')).toContainText(
      'steiner_hybrid_sn',
    )
  })

  test('measurements table renders SNA label', async ({ page }) => {
    await expect(page.getByText('SNA')).toBeVisible()
  })

  test('SNA value renders as 82.50', async ({ page }) => {
    await expect(page.getByText('82.50')).toBeVisible()
  })

  test('does NOT contain "scale bar" text (D-N metrology)', async ({ page }) => {
    const content = await page.content()
    expect(content).not.toContain('scale bar')
  })

  test('"No normative comparison" disclaimer visible (D-H)', async ({ page }) => {
    await expect(page.getByText(/No normative comparison/)).toBeVisible()
  })

  test('out-of-scope block visible (D-O)', async ({ page }) => {
    await expect(page.getByText(/Not included in this report/)).toBeVisible()
  })

  test('version number shown in report header', async ({ page }) => {
    // Use specific pattern — /v1/ is too broad and matches "v1.4", "v1.5/v2." etc.
    await expect(page.getByText(/Version:\s*1/).first()).toBeVisible()
  })
})

