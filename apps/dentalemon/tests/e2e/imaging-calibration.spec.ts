import { test, expect } from '@playwright/test'

/**
 * G6 calibration E2E — 2-point ruler end-to-end.
 *
 * Drives the real ImagingWorkspace in the /imaging-test harness: select the
 * Calibrate tool, draw the two ruler points on the SVG overlay, enter the known
 * distance, and confirm. Asserts the PATCH /images/{id}/calibration request
 * carries the versioned-record payload (pointA, pointB, knownDistanceMm) plus a
 * server-derivable pixelSpacingMm — the contract unit/contract tests can't prove
 * is actually wired through the canvas → dialog → SDK path.
 *
 * History: BUG-IMG-001/002 were FE↔BE contract drifts unit tests missed, so the
 * live wiring is verified here.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

interface CalibrationBody {
  pixelSpacingMm?: number
  pointA?: { x: number; y: number }
  pointB?: { x: number; y: number }
  knownDistanceMm?: number
}

test.describe('G6 calibration — 2-point ruler', () => {
  test('drawing the ruler and confirming PATCHes a versioned calibration record', async ({ page }) => {
    let calibrationBody: CalibrationBody | null = null

    await page.route('**/dental/imaging/images/*/calibration', async (route) => {
      if (route.request().method() === 'PATCH') {
        calibrationBody = route.request().postDataJSON() as CalibrationBody
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-image-id',
            pixelSpacingMm: calibrationBody.pixelSpacingMm,
            calibrationMethod: 'ruler',
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto(IMAGING_TEST_URL)

    // Select the calibration tool and draw the two ruler endpoints.
    await page.getByRole('button', { name: 'Calibrate' }).click()
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await svg.click({ position: { x: 100, y: 150 } })
    await svg.click({ position: { x: 200, y: 150 } })

    // Dialog opens with the measured pixel distance; enter the known mm + confirm.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('spinbutton').fill('10')
    await dialog.getByRole('button', { name: 'Confirm' }).click()

    // The 2-point ruler payload reached the API.
    await expect.poll(() => calibrationBody !== null).toBe(true)
    expect(calibrationBody!.knownDistanceMm).toBe(10)
    expect(calibrationBody!.pointA).toBeTruthy()
    expect(calibrationBody!.pointB).toBeTruthy()
    expect(typeof calibrationBody!.pointA!.x).toBe('number')
    expect(typeof calibrationBody!.pointB!.x).toBe('number')
    // Server derives mm/px from the ruler; client still sends a positive estimate.
    expect(calibrationBody!.pixelSpacingMm).toBeGreaterThan(0)

    // The dialog closes and the toolbar reflects a calibrated image.
    await expect(dialog).not.toBeVisible()
  })
})
