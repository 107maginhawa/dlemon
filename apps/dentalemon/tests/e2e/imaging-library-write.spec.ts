import { test, expect, type Page } from '@playwright/test'

/**
 * G5 image-library write E2E — metadata edit + filter, and link create→filter→delete.
 *
 * Drives the real PatientImageList "Edit" affordance + ImageMetadataEditor in the
 * /imaging-test harness. The list renders from the seeded cache; each write
 * (PATCH metadata / POST link / DELETE link) is mocked with mutable state so the
 * post-write invalidation refetch reflects the change in the live list (badges,
 * tag filter, link filter). Proves the four idle G5 write endpoints are wired
 * end-to-end through the SDK — the running-app behaviour unit/contract can't show.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'
const TARGET = 'test-image-id-3' // periapical.jpg — a flat, editable list row
const PLAN_UUID = '11111111-2222-3333-4444-555555555555'

interface MutableImage {
  id: string
  isDiagnostic: boolean
  qualityStatus: 'ok' | 'retake'
  retakeReason: string | null
  tags: string[]
}
interface MutableLink {
  id: string
  imageId: string
  linkType: 'treatment_plan' | 'ortho_case' | 'report'
  targetId: string
}

/**
 * Install the G5 write mocks. The list GET reflects the live metadata + links
 * state so the post-mutation refetch updates the rendered rows.
 */
async function installWriteMocks(page: Page) {
  const meta: Record<string, MutableImage> = {
    [TARGET]: { id: TARGET, isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [] },
  }
  const links: MutableLink[] = []
  let linkSeq = 0

  const baseItem = (id: string, modality: string, fileName: string, idx: number) => ({
    id, source: 'imaging', modality, fileName, mimeType: 'image/jpeg',
    fileSizeBytes: 1000 + idx, studyId: `s-${id}`, visitId: null, toothNumbers: [],
    createdAt: `2026-01-0${idx + 1}T00:00:00.000Z`, downloadUrl: null,
    isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [] as string[],
    links: [] as MutableLink[],
  })

  // Patient image list — returns current mutable state for TARGET.
  await page.route('**/dental/patients/*/images*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const items = [
      baseItem('test-image-id', 'cephalometric', 'ceph-lateral.jpg', 0),
      baseItem('test-image-id-2', 'panoramic', 'panoramic.jpg', 1),
      {
        ...baseItem(TARGET, 'periapical', 'periapical.jpg', 2),
        isDiagnostic: meta[TARGET]!.isDiagnostic,
        qualityStatus: meta[TARGET]!.qualityStatus,
        retakeReason: meta[TARGET]!.retakeReason,
        tags: meta[TARGET]!.tags,
        links: links.filter((l) => l.imageId === TARGET),
      },
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, total: items.length }) })
  })

  await page.route('**/dental/imaging/images/*/metadata', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const body = route.request().postDataJSON() as Partial<MutableImage>
    const cur = meta[TARGET]!
    if (body.isDiagnostic !== undefined) cur.isDiagnostic = body.isDiagnostic
    if (body.qualityStatus !== undefined) cur.qualityStatus = body.qualityStatus
    if (body.retakeReason !== undefined) cur.retakeReason = body.retakeReason ?? null
    if (body.tags !== undefined) cur.tags = body.tags
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...cur }) })
  })

  await page.route('**/dental/imaging/images/*/links', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: links.filter((l) => l.imageId === TARGET) }) })
      return
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as { linkType: MutableLink['linkType']; targetId: string }
      const link: MutableLink = { id: `lk-${++linkSeq}`, imageId: TARGET, linkType: body.linkType, targetId: body.targetId }
      links.push(link)
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ...link, createdAt: '2026-01-01T00:00:00.000Z' }) })
      return
    }
    await route.continue()
  })

  await page.route('**/dental/imaging/links/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue()
    const id = route.request().url().split('/').pop()
    const idx = links.findIndex((l) => l.id === id)
    if (idx >= 0) links.splice(idx, 1)
    await route.fulfill({ status: 204 })
  })

  // Dev-only TanStack Devtools widget overlaps bottom-right controls.
  await page.addStyleTag({ content: 'button:has(> img[alt="TanStack Devtools"]) { display: none !important; }' }).catch(() => {})
}

test.describe('G5 metadata edit + filter', () => {
  test.beforeEach(async ({ page }) => {
    await installWriteMocks(page)
    await page.goto(IMAGING_TEST_URL)
  })

  test('editing diagnostic + tags updates the row badges, then the filter hides it', async ({ page }) => {
    await page.getByTestId(`edit-image-${TARGET}`).click()
    await expect(page.getByTestId('image-metadata-editor')).toBeVisible()

    // Mark non-diagnostic + add a tag, then save.
    await page.getByTestId('meta-diagnostic').uncheck()
    await page.getByTestId('meta-tags').fill('ortho')
    await page.getByTestId('meta-save').click()

    // Editor closes on save; the refetched row shows the new badges.
    await expect(page.getByTestId('image-metadata-editor')).toBeHidden()
    await expect(page.getByTestId(`badge-non-diagnostic-${TARGET}`)).toBeVisible()
    await expect(page.getByTestId(`tag-${TARGET}-ortho`)).toBeVisible()

    // Diagnostic-only filter hides the now non-diagnostic image.
    await page.getByTestId('filter-diagnostic-only').check()
    await expect(page.getByTestId(`edit-image-${TARGET}`)).toHaveCount(0)

    // Clearing the filter brings it back; tag filter narrows to just it.
    await page.getByTestId('filter-diagnostic-only').uncheck()
    await page.getByTestId('filter-tag').selectOption('ortho')
    await expect(page.getByText('periapical.jpg')).toBeVisible()
    await expect(page.getByText('ceph-lateral.jpg')).toHaveCount(0)
  })
})

test.describe('G5 context link — create → filter → delete', () => {
  test.beforeEach(async ({ page }) => {
    await installWriteMocks(page)
    await page.goto(IMAGING_TEST_URL)
  })

  test('add a treatment-plan link, filter by it, then remove it', async ({ page }) => {
    await page.getByTestId(`edit-image-${TARGET}`).click()
    await expect(page.getByTestId('image-metadata-editor')).toBeVisible()

    // Add is disabled until the target is a valid uuid.
    await expect(page.getByTestId('link-add')).toBeDisabled()
    await page.getByTestId('link-type').selectOption('treatment_plan')
    await page.getByTestId('link-target').fill(PLAN_UUID)
    await expect(page.getByTestId('link-add')).toBeEnabled()
    await page.getByTestId('link-add').click()

    // The new link surfaces in the editor with a remove control.
    await expect(page.getByTestId(/^link-remove-/)).toBeVisible()

    // Close the editor; the row carries a link badge + the link-type filter.
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('image-metadata-editor')).toBeHidden()
    await expect(page.getByTestId(`link-badge-${TARGET}-treatment_plan`)).toBeVisible()

    // Filter by link type → only the linked image remains.
    await page.getByTestId('filter-link-type').selectOption('treatment_plan')
    await expect(page.getByText('periapical.jpg')).toBeVisible()
    await expect(page.getByText('ceph-lateral.jpg')).toHaveCount(0)
    await page.getByTestId('filter-link-type').selectOption('')

    // Reopen the editor and remove the link.
    await page.getByTestId(`edit-image-${TARGET}`).click()
    await page.getByTestId(/^link-remove-/).click()
    await expect(page.getByTestId(/^link-remove-/)).toHaveCount(0)
    await expect(page.getByText('No links yet.')).toBeVisible()
  })
})
