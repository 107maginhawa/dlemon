import { test, expect, type Page } from '@playwright/test'
import { installDefaultApiStub } from './helpers/imaging-harness'

/**
 * Imaging DRAW-GESTURE E2E spec.
 *
 * The existing imaging-annotation / imaging-measurement specs only prove tool
 * ACTIVATION (aria-pressed, crosshair cursor, pointer-events). They never drive
 * the on-canvas gesture, so nothing verified that a tool actually PRODUCES an
 * annotation — which is exactly what a user cannot discover by trial ("how do I
 * draw a line?"). This spec closes that gap for the two two-click tools:
 *
 *   • Arrow    → click start, click end  → a solid <line marker-end=arrowhead>
 *   • Distance → click start, click end  → a saved measurement labelled in mm
 *                (the harness seeds calibration, so mm units prove the
 *                 calibrate → measure pipeline end-to-end)
 *
 * A drag does NOT work (the SVG overlay wires only onClick), which is the whole
 * source of the confusion; these tests encode the correct two-click gesture.
 *
 * Without a running dev server the tests skip automatically when baseURL is
 * unavailable (same contract as the sibling imaging specs).
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

/**
 * Stub GET/POST /dental/imaging/images/:id/measurements so a drawn annotation
 * survives the optimistic write + onSettled refetch. GET returns [] until a POST
 * has landed, then returns the created record — so a rendered annotation proves
 * the GESTURE created it (it did not pre-exist) and the onSettled invalidate
 * refetch does not clobber it back to empty.
 */
async function stubMeasurements(page: Page) {
  const created: Record<string, unknown>[] = []
  await page.route(/\/images\/[^/]+\/measurements(\?|$)/, async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      const record = {
        id: `m-${created.length + 1}`,
        imageId: 'test',
        type: body.type,
        geometry: body.geometry,
        measurementValue: body.measurementValue ?? null,
        measurementUnit: body.measurementUnit ?? null,
        toothNumber: null,
        visible: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      created.push(record)
      await route.fulfill({ json: record })
      return
    }
    await route.fulfill({ json: { items: created } })
  })
}

async function drawTwoClicks(page: Page, tool: string) {
  const svg = page.locator('[data-testid="measurement-svg-overlay"]')
  await expect(svg).toBeAttached()
  await page.getByRole('button', { name: tool }).click()
  const box = (await svg.boundingBox())!
  // Two discrete clicks — NOT a drag.
  await page.mouse.click(box.x + 60, box.y + 60)
  await page.mouse.click(box.x + 180, box.y + 120)
}

test.describe('Draw gesture produces a persisted annotation', () => {
  test.beforeEach(async ({ page }) => {
    await installDefaultApiStub(page)
    await stubMeasurements(page)
    await page.goto(IMAGING_TEST_URL)
    await expect(page.getByRole('button', { name: 'Distance' })).toBeVisible({ timeout: 15_000 })
  })

  test('Arrow: two clicks draw a solid arrow line (marker-end=arrowhead)', async ({ page }) => {
    await drawTwoClicks(page, 'Arrow')
    const arrow = page.locator('[data-testid="measurement-svg-overlay"] line[marker-end="url(#arrowhead)"]')
    await expect(arrow.first()).toBeVisible()
    // The committed arrow is solid; the dashed in-progress preview is gone once
    // the second click commits and the draw points reset.
    await expect(arrow.first()).not.toHaveAttribute('stroke-dasharray', '6 3')
  })

  test('Distance: two clicks on a calibrated image produce a saved mm measurement', async ({ page }) => {
    await drawTwoClicks(page, 'Distance')
    const saved = page.locator('[data-testid="saved-measurement"]')
    await expect(saved.first()).toBeVisible()
    // Harness seeds pixelSpacingMm=0.1, so the value is reported in mm, not px.
    await expect(saved.first().locator('text')).toContainText('mm')
  })
})
