import { test, expect, type Page } from '@playwright/test'
import { installDefaultApiStub } from './helpers/imaging-harness'

/**
 * Annotation EDIT / MOVE E2E (task #3).
 *
 * Proves a selected overlay can be dragged to a new position (PATCH on pointer-up)
 * and a label re-typed via the prefilled dialog (PATCH on confirm). The measurements
 * API is stubbed via Playwright routes — no backend required.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

/** Mutable measurements stub with PATCH (update) support; records the last PATCH body. */
function stubMeasurements(page: Page, seed: Record<string, unknown>[] = []) {
  const items = [...seed]
  const state = { lastPatch: null as Record<string, unknown> | null }

  // PATCH / DELETE /dental/imaging/measurements/:id
  void page.route(/\/imaging\/measurements\/[^/]+$/, async (route) => {
    const req = route.request()
    const id = req.url().split('/').pop()!
    if (req.method() === 'DELETE') {
      const idx = items.findIndex((m) => m.id === id)
      if (idx >= 0) items.splice(idx, 1)
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as Record<string, unknown>
      state.lastPatch = body
      const it = items.find((m) => m.id === id)
      if (it) Object.assign(it, body)
      await route.fulfill({ json: it ?? {} })
      return
    }
    await route.fallback()
  })

  // GET / POST /dental/imaging/images/:id/measurements
  void page.route(/\/images\/[^/]+\/measurements(\?|$)/, async (route) => {
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

  return state
}

async function ready(page: Page) {
  await page.goto(IMAGING_TEST_URL)
  await expect(page.getByRole('button', { name: 'Distance' })).toBeVisible({ timeout: 15_000 })
}

test.describe('Annotation edit & move', () => {
  test('drag a selected shape to move it → PATCHes new geometry', async ({ page }) => {
    await installDefaultApiStub(page)
    const state = stubMeasurements(page, [
      { id: 'seed-1', imageId: 'test', type: 'shape', geometry: { type: 'shape', shapeType: 'rect', x: 60, y: 60, width: 120, height: 80 }, measurementValue: null, measurementUnit: null, toothNumber: null, visible: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ])
    await ready(page)

    // Overlays render at transform-mapped screen positions, so target the rendered
    // element (center of its box) rather than guessed coordinates.
    const shapeRect = page.locator('[data-testid="annotation-shape"] rect')

    // Select the rect (no draw tool armed).
    await page.getByTestId('tool-select').click()
    await shapeRect.click()
    await expect(page.getByTestId('annotation-delete')).toBeVisible()

    // Drag the selected body from its center → down/right → up.
    const rb = (await shapeRect.boundingBox())!
    const cx = rb.x + rb.width / 2
    const cy = rb.y + rb.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 50, cy + 40, { steps: 6 })
    await page.mouse.up()

    // PATCH fired with a shifted geometry (moved right + down from x/y = 60).
    await expect.poll(() => state.lastPatch).not.toBeNull()
    const geo = state.lastPatch!.geometry as { x: number; y: number }
    expect(geo.x).toBeGreaterThan(60)
    expect(geo.y).toBeGreaterThan(60)
  })

  test('re-type a label via the prefilled Edit dialog → PATCHes new text', async ({ page }) => {
    await installDefaultApiStub(page)
    const state = stubMeasurements(page, [
      { id: 'seed-lbl', imageId: 'test', type: 'label', geometry: { type: 'label', point: { x: 100, y: 100 }, text: 'Old' }, measurementValue: null, measurementUnit: null, toothNumber: null, visible: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ])
    await ready(page)

    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    const box = (await svg.boundingBox())!

    await page.getByTestId('tool-select').click()
    // Click the label text to select it.
    await page.locator('[data-testid="measurement-svg-overlay"] text', { hasText: 'Old' }).click()
    await expect(page.getByTestId('annotation-edit')).toBeVisible()

    // Open the prefilled dialog, replace the text, confirm.
    await page.getByTestId('annotation-edit').click()
    const input = page.locator('input[type="text"]')
    await expect(input).toHaveValue('Old')
    await input.fill('Revised')
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect.poll(() => state.lastPatch).not.toBeNull()
    const geo = state.lastPatch!.geometry as { text: string }
    expect(geo.text).toBe('Revised')
    await expect(page.locator('[data-testid="measurement-svg-overlay"] text', { hasText: 'Revised' })).toBeVisible()
  })
})
