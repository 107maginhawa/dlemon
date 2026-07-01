import { test, expect } from '@playwright/test'
import {
  ALL_CODES,
  MOCK_ANALYSIS,
  mkLandmark,
  mkLandmarksResponse,
  setupCephRoutes,
  openCephPanel,
  installDefaultApiStub,
  assertWorkspaceReady,
  assertNoLoginRedirect,
} from './helpers/imaging-harness'
import { enableWorkspaceFlags } from './helpers/feature-flags'

/**
 * Cephalometric workspace E2E spec — CEPH-01 through CEPH-05.
 *
 * Tests CephWorkspacePanel integration: panel open/close, landmark palette,
 * measurements display, and layer controls.
 *
 * Uses page.route() to mock all ceph API calls (no real backend needed).
 * NOTE: Without a running dev server these tests are skipped automatically.
 */

const CEPH_TEST_URL = '/imaging-test?modality=cephalometric'

// Install the catch-all stub first (lowest LIFO priority) so any unmocked
// backend request fails loudly rather than hitting a real server.
// setupCephRoutes / per-test overrides are registered after this and win.
test.beforeEach(async ({ page }) => {
  // Cephalometric analysis is v2 (workspace.ceph) — opt in before navigating.
  await enableWorkspaceFlags(page, 'workspace.ceph')
  await installDefaultApiStub(page)
})

// ─── CEPH-01: Button visibility ───────────────────────────────────────────────

test.describe('CEPH-01: Ceph button visibility', () => {
  test('Ceph button visible for cephalometric modality', async ({ page }) => {
    await setupCephRoutes(page)
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await expect(page.getByRole('button', { name: 'Toggle ceph panel' })).toBeVisible()
  })

  test('Ceph button absent for non-cephalometric modality', async ({ page }) => {
    await page.goto('/imaging-test?modality=panoramic')
    await assertWorkspaceReady(page, 'workspace')
    assertNoLoginRedirect(page)
    await expect(
      page.getByRole('button', { name: 'Toggle ceph panel' }),
    ).not.toBeAttached()
  })
})

// ─── CEPH-02: Panel open/close ────────────────────────────────────────────────

test.describe('CEPH-02: Panel open/close', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page)
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
  })

  test('clicking Ceph opens the panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle ceph panel' }).click()
    await expect(page.getByRole('button', { name: 'Close ceph panel' })).toBeVisible()
  })

  test('Close button dismisses the panel', async ({ page }) => {
    await openCephPanel(page)
    await page.getByRole('button', { name: 'Close ceph panel' }).click()
    await expect(page.getByRole('button', { name: 'Close ceph panel' })).not.toBeVisible()
  })
})

// ─── CEPH-03: Landmark palette ───────────────────────────────────────────────

test.describe('CEPH-03: Landmark palette', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page)
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
  })

  test('all 16 landmark codes present in palette', async ({ page }) => {
    await openCephPanel(page)
    for (const code of ALL_CODES) {
      // Scope to button — data-landmark-code is also on SVG landmark dots
      await expect(page.locator(`button[data-landmark-code="${code}"]`)).toBeAttached()
    }
  })

  test('confirmed landmark shows confirmed badge', async ({ page }) => {
    await openCephPanel(page)
    await expect(page.locator('button[data-landmark-code="S"]')).toContainText('confirmed')
  })

  test('locked landmark palette button is disabled', async ({ page }) => {
    const lockedItems = ALL_CODES.map((c, i) =>
      mkLandmark(c, c === 'A' ? 'locked' : 'confirmed', 100 + i * 20, 100 + i * 15),
    )
    // Register locked override BEFORE re-navigating so the canvas initial fetch
    // picks it up (the describe beforeEach already navigated with confirmed data).
    await page.route(/\/ceph\/landmarks/, (route) => {
      route.fulfill({ json: mkLandmarksResponse(lockedItems) })
    })
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    await openCephPanel(page)
    await expect(page.locator('button[data-landmark-code="A"]')).toBeDisabled()
  })
})

// ─── CEPH-04: Measurements display ───────────────────────────────────────────

test.describe('CEPH-04: Measurements display', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page)
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)
  })

  test('Measurements section heading visible', async ({ page }) => {
    await expect(page.getByText('Measurements')).toBeVisible()
  })

  test('SNA, SNB, ANB metric labels visible', async ({ page }) => {
    await expect(page.getByText('SNA')).toBeVisible()
    await expect(page.getByText('SNB')).toBeVisible()
    await expect(page.getByText('ANB')).toBeVisible()
  })

  test('SNA value renders as 82.50', async ({ page }) => {
    // exact: true avoids matching the SVG arc label "82.50°"
    await expect(page.getByText('82.50', { exact: true })).toBeVisible()
  })

  test('analysis type badge shows steiner_hybrid_sn', async ({ page }) => {
    // Two badges exist (panel header + measurements section); either is sufficient
    await expect(page.getByText('steiner_hybrid_sn').first()).toBeVisible()
  })

  test('uncalibrated mm metrics show "calibrate for mm"', async ({ page }) => {
    // U1-NA (mm), L1-NB (mm), Overjet, Overbite are null + uncalibrated=true
    await expect(page.getByText('calibrate for mm').first()).toBeVisible()
  })
})

// ─── CEPH-05: Layer controls ──────────────────────────────────────────────────

test.describe('CEPH-05: Layer controls', () => {
  test.beforeEach(async ({ page }) => {
    await setupCephRoutes(page)
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)
  })

  test('Landmarks, Tracing, Arcs buttons present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Landmarks', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tracing' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Arcs' })).toBeVisible()
  })

  test('Landmarks button defaults to aria-pressed=true', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Landmarks', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('clicking Landmarks toggles aria-pressed to false', async ({ page }) => {
    await page.getByRole('button', { name: 'Landmarks', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Landmarks', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('toggling Landmarks off hides ceph-landmark-layer SVG', async ({ page }) => {
    // Wait for canvas transform to be applied and overlays to mount
    await expect(page.getByTestId('ceph-landmark-layer')).toBeAttached({ timeout: 5000 })
    await page.getByRole('button', { name: 'Landmarks', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Landmarks', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.getByTestId('ceph-landmark-layer')).not.toBeAttached({ timeout: 3000 })
  })
})

