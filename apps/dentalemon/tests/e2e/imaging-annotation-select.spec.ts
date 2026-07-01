import { test, expect, type Page } from '@playwright/test'
import { installDefaultApiStub } from './helpers/imaging-harness'

/**
 * Annotation SELECT / REMOVE E2E.
 *
 * Proves the redesigned edit/remove UX: annotations are selectable and removable
 * via a real ≥44px control (not the old 12px dot), reachable without arming a
 * draw tool, with keyboard support and an autosave affordance.
 *
 * Skips automatically when the dev server / baseURL is unavailable.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

/** Mutable measurements stub: list reflects create + delete so the UI round-trips. */
async function stubMeasurements(page: Page, seed: Record<string, unknown>[] = []) {
  const items = [...seed]
  // DELETE /dental/imaging/measurements/:id  (must be registered so it wins LIFO for that shape)
  await page.route(/\/imaging\/measurements\/[^/]+$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      const id = route.request().url().split('/').pop()!
      const idx = items.findIndex((m) => m.id === id)
      if (idx >= 0) items.splice(idx, 1)
      await route.fulfill({ status: 204, body: '' })
      return
    }
    await route.fallback()
  })
  // GET / POST /dental/imaging/images/:id/measurements
  await page.route(/\/images\/[^/]+\/measurements(\?|$)/, async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const body = req.postDataJSON() as Record<string, unknown>
      const rec = {
        id: `m-${items.length + 1}`, imageId: 'test', type: body.type,
        geometry: body.geometry, measurementValue: body.measurementValue ?? null,
        measurementUnit: body.measurementUnit ?? null, toothNumber: null,
        visible: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }
      items.push(rec)
      await route.fulfill({ json: rec })
      return
    }
    await route.fulfill({ json: { items } })
  })
}

async function ready(page: Page) {
  await page.goto(IMAGING_TEST_URL)
  await expect(page.getByRole('button', { name: 'Distance' })).toBeVisible({ timeout: 15_000 })
}

test.describe('Annotation select & remove', () => {
  test('drawing an arrow auto-selects it and exposes a ≥44px delete control', async ({ page }) => {
    await installDefaultApiStub(page)
    await stubMeasurements(page)
    await ready(page)

    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    const box = (await svg.boundingBox())!
    await page.getByRole('button', { name: 'Arrow' }).click()
    await page.mouse.click(box.x + 60, box.y + 60)
    await page.mouse.click(box.x + 180, box.y + 120)

    // Auto-select drops into Select mode with the fresh overlay picked.
    await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')
    const del = page.getByTestId('annotation-delete')
    await expect(del).toBeVisible()
    const delBox = (await del.boundingBox())!
    expect(delBox.width).toBeGreaterThanOrEqual(44)
    expect(delBox.height).toBeGreaterThanOrEqual(44)

    // Remove it → the arrow line is gone.
    await del.click()
    await expect(page.locator('[data-testid="measurement-svg-overlay"] line[marker-end="url(#arrowhead)"]')).toHaveCount(0)
  })

  test('Select tool picks an existing annotation; Escape deselects; Delete key removes', async ({ page }) => {
    await installDefaultApiStub(page)
    await stubMeasurements(page, [
      { id: 'seed-1', imageId: 'test', type: 'shape', geometry: { type: 'shape', shapeType: 'rect', x: 60, y: 60, width: 140, height: 90 }, measurementValue: null, measurementUnit: null, toothNumber: null, visible: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ])
    await ready(page)
    // Overlays render at transform-mapped screen positions (they store image-space
    // geometry), so target the rendered element rather than guessed coordinates.
    const rect = page.locator('[data-testid="annotation-shape"] rect')

    // No delete control until we select. Enter Select mode (no draw tool armed).
    await expect(page.getByTestId('annotation-delete')).toHaveCount(0)
    await page.getByTestId('tool-select').click()
    await rect.click()
    await expect(page.getByTestId('annotation-delete')).toBeVisible()

    // Escape deselects (control disappears).
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('annotation-delete')).toHaveCount(0)

    // Reselect, then remove with the keyboard.
    await rect.click()
    await expect(page.getByTestId('annotation-delete')).toBeVisible()
    await page.keyboard.press('Delete')
    await expect(page.locator('[data-testid="measurement-svg-overlay"] rect')).toHaveCount(0)
  })

  test('shows a persistent autosave hint and no Save button', async ({ page }) => {
    await installDefaultApiStub(page)
    await stubMeasurements(page)
    await ready(page)
    await expect(page.getByTestId('autosave-hint')).toContainText('Saved automatically')
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0)
  })
})
