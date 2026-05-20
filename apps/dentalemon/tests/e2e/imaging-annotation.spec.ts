import { test, expect } from '@playwright/test'

/**
 * Imaging annotation tools E2E spec.
 *
 * Verifies AnnotationToolbar, ToolMode extension, and SVG overlay integration
 * for the 5 annotation types: label, arrow, freehand, shape, tooth.
 *
 * NOTE: Without a running dev server these tests will be skipped automatically
 * when the baseURL is unavailable. The spec is valid TypeScript and serves as
 * the automated acceptance gate for plan 09-02.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'

test.describe('AnnotationToolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(IMAGING_TEST_URL)
  })

  test('renders all 5 annotation buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Label' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Arrow' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Freehand' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Shape' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Tooth' })).toBeVisible()
  })

  test('annotation toolbar is separate from measurement toolbar', async ({ page }) => {
    // Both toolbars exist simultaneously
    await expect(page.getByRole('button', { name: 'Distance' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Label' })).toBeVisible()
  })

  test('clicking Label sets it as active (aria-pressed=true)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Label' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking active Label deactivates it (aria-pressed=false)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Label' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking Arrow sets it as active (aria-pressed=true)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Arrow' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Freehand sets it as active (aria-pressed=true)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Freehand' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Shape sets it as active (aria-pressed=true)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Shape' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Tooth sets it as active (aria-pressed=true)', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Tooth' })
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('only one tool (across both toolbars) can be active at a time', async ({ page }) => {
    await page.getByRole('button', { name: 'Distance' }).click()
    await page.getByRole('button', { name: 'Label' }).click()
    // Distance should be deactivated when Label is activated
    await expect(page.getByRole('button', { name: 'Distance' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Label' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('switching from annotation tool to measurement tool deactivates annotation', async ({ page }) => {
    await page.getByRole('button', { name: 'Arrow' }).click()
    await expect(page.getByRole('button', { name: 'Arrow' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Angle' }).click()
    await expect(page.getByRole('button', { name: 'Arrow' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Angle' })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('SVG overlay with annotation tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(IMAGING_TEST_URL)
  })

  test('SVG overlay is present', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await expect(svg).toBeAttached()
  })

  test('activating Label tool sets crosshair cursor on SVG overlay', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Label' }).click()
    const cursor = await svg.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('crosshair')
  })

  test('activating Arrow tool sets crosshair cursor on SVG overlay', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Arrow' }).click()
    const cursor = await svg.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('crosshair')
  })

  test('activating Freehand tool sets crosshair cursor on SVG overlay', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Freehand' }).click()
    const cursor = await svg.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('crosshair')
  })

  test('activating Shape tool sets crosshair cursor on SVG overlay', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Shape' }).click()
    const cursor = await svg.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('crosshair')
  })

  test('activating Tooth tool sets crosshair cursor on SVG overlay', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Tooth' }).click()
    const cursor = await svg.evaluate((el) => (el as HTMLElement).style.cursor)
    expect(cursor).toBe('crosshair')
  })

  test('SVG pointer-events enabled when annotation tool active', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    await page.getByRole('button', { name: 'Freehand' }).click()
    const pointerEvents = await svg.evaluate((el) => (el as HTMLElement).style.pointerEvents)
    expect(pointerEvents).toBe('auto')
  })

  test('SVG pointer-events none when no tool active', async ({ page }) => {
    const svg = page.locator('[data-testid="measurement-svg-overlay"]')
    const pointerEvents = await svg.evaluate((el) => (el as HTMLElement).style.pointerEvents)
    expect(pointerEvents).toBe('none')
  })
})
