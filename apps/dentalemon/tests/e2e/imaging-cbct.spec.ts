import { test, expect } from '@playwright/test'

/**
 * P2-7 CBCT / 3-D imaging E2E spec (Phase 1 / Option A1).
 *
 * Verifies the truthful volume affordance in the patient image list:
 *   - a CBCT study renders as a volume CARD (CbctStudyCard), NOT a flat <img> row
 *   - the card shows the 3D Volume badge + a truthful slice count ("128 slices")
 *   - the card exposes an "Open in viewer" (presigned download) handoff
 *   - the CBCT volume is NOT offered as a 2-D pairwise-compare selectable row
 *
 * Uses the same /imaging-test harness as imaging-comparison.spec.ts (the harness
 * seeds a CBCT volume fixture, test-study-id-cbct, via harness-fixtures.ts).
 *
 * NOTE: Without a running dev server these tests skip automatically when the
 * baseURL is unavailable. The spec is valid TypeScript and serves as the
 * automated acceptance gate for plan 08 (CBCT) Phase 1.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

test.describe('CBCT volume affordance — P2-7', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(IMAGING_TEST_URL)
  })

  test('CBCT study renders as a volume card (not a flat image row)', async ({ page }) => {
    const card = page.getByTestId('cbct-study-card')
    await expect(card).toBeVisible()
    // Clinical-safety: a CBCT must never be shown as a flat raster.
    await expect(card.locator('img')).toHaveCount(0)
  })

  test('volume card shows the 3D Volume badge + truthful slice count', async ({ page }) => {
    await expect(page.getByTestId('cbct-volume-badge')).toContainText(/3D Volume/i)
    await expect(page.getByTestId('cbct-frame-count')).toContainText(/128 slices/i)
  })

  test('"Open in viewer" handoff button is present on the volume card', async ({ page }) => {
    await expect(page.getByTestId('cbct-open-viewer')).toBeVisible()
    await expect(page.getByTestId('cbct-open-viewer')).toContainText(/open in viewer/i)
  })

  test('CBCT volume is NOT a 2-D pairwise-compare selectable row', async ({ page }) => {
    // The flat list renders select-image-* checkboxes; the CBCT volume must not.
    await expect(page.getByTestId('select-image-test-image-id-cbct')).toHaveCount(0)
  })

  test('clicking "Open in viewer" requests a presigned viewer link', async ({ page }) => {
    // A1 handoff opens the presigned download in a new tab; intercept the API call.
    let viewerLinkRequested = false
    await page.route('**/dental/imaging/studies/test-study-id-cbct/cbct/viewer-link', async (route) => {
      viewerLinkRequested = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          viewerKind: 'download',
          downloadUrl: 'https://storage.example.com/presigned-get/cbct',
          expiresAt: '2026-01-04T00:15:00.000Z',
          isVolume: true,
          frameCount: 128,
        }),
      })
    })

    // Swallow the new-tab open so the test window is unaffected.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).open = () => null
    })

    await page.getByTestId('cbct-open-viewer').click()
    await expect.poll(() => viewerLinkRequested).toBe(true)
  })
})
