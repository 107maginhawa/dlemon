import { test, expect, type Page } from '@playwright/test'

/**
 * §capture-date E2E — the patient image list leads with when an image was TAKEN
 * (capturedAt), showing "Added …" only when the upload date differs, and the
 * metadata editor corrects the capture date via PATCH /images/{id}/metadata.
 *
 * Drives the real PatientImageList + ImageMetadataEditor in the /imaging-test
 * harness against a mocked list GET (so capturedAt is deterministic) and a mocked
 * metadata PATCH that records the request body.
 */

const IMAGING_TEST_URL = process.env.IMAGING_TEST_URL ?? '/imaging-test'
// test-image-id: TAKEN 2025-11-15, UPLOADED 2026-01-01 → divergent (Taken/Added).
const DIVERGENT = 'test-image-id'
// test-image-id-3: periapical, editable, capture == upload (no "Added" caption).
const EDITABLE = 'test-image-id-3'

let lastMetadataPatch: Record<string, unknown> | null = null

async function installMocks(page: Page) {
  lastMetadataPatch = null
  const captured: Record<string, string> = {
    [DIVERGENT]: '2025-11-15T00:00:00.000Z',
    [EDITABLE]: '2026-01-03T00:00:00.000Z',
  }

  const item = (id: string, modality: string, fileName: string, createdAt: string, capturedAtSource: string) => ({
    id, source: 'imaging', modality, fileName, mimeType: 'image/jpeg',
    fileSizeBytes: 1000, studyId: `s-${id}`, visitId: null, toothNumbers: [],
    createdAt, capturedAt: captured[id] ?? createdAt, capturedAtSource,
    downloadUrl: null, isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [], links: [],
  })

  await page.route('**/dental/patients/*/images*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const items = [
      item(DIVERGENT, 'cephalometric', 'ceph-lateral.jpg', '2026-01-01T00:00:00.000Z', 'dicom_tag'),
      item('test-image-id-2', 'panoramic', 'panoramic.jpg', '2026-01-02T00:00:00.000Z', 'defaulted_upload'),
      item(EDITABLE, 'periapical', 'periapical.jpg', '2026-01-03T00:00:00.000Z', 'defaulted_upload'),
    ]
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, total: items.length }) })
  })

  await page.route('**/dental/imaging/images/*/metadata', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    const body = route.request().postDataJSON() as Record<string, unknown>
    lastMetadataPatch = body
    if (typeof body.capturedAt === 'string') captured[EDITABLE] = new Date(body.capturedAt).toISOString()
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: EDITABLE, isDiagnostic: true, qualityStatus: 'ok', retakeReason: null, tags: [], capturedAt: captured[EDITABLE], capturedAtSource: 'manual' }),
    })
  })

  await page.route('**/dental/imaging/images/*/links', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
      return
    }
    await route.continue()
  })

  await page.addStyleTag({ content: 'button:has(> img[alt="TanStack Devtools"]) { display: none !important; }' }).catch(() => {})
}

test.describe('§capture-date — list display', () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page)
    await page.goto(IMAGING_TEST_URL)
  })

  test('leads with "Taken" and shows "Added" only when the upload date differs', async ({ page }) => {
    // Divergent row: capture (Nov 2025) precedes upload (Jan 2026).
    await expect(page.getByTestId(`capture-date-${DIVERGENT}`)).toContainText('Taken')
    await expect(page.getByTestId(`upload-date-${DIVERGENT}`)).toContainText('Added')

    // Same-day row: no "Added" caption.
    await expect(page.getByTestId('upload-date-test-image-id-2')).toHaveCount(0)
    await expect(page.getByTestId('capture-date-test-image-id-2')).not.toContainText('Taken')
  })
})

test.describe('§capture-date — correct the date via the metadata editor', () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page)
    await page.goto(IMAGING_TEST_URL)
  })

  test('editing the capture date sends capturedAt and the row reflects it', async ({ page }) => {
    await page.getByTestId(`edit-image-${EDITABLE}`).click()
    await expect(page.getByTestId('image-metadata-editor')).toBeVisible()

    // Correct the capture date to an earlier day, then save.
    await page.getByTestId('meta-capture-date').fill('2025-09-20')
    await page.getByTestId('meta-save').click()

    await expect(page.getByTestId('image-metadata-editor')).toBeHidden()
    // The PATCH carried the corrected capturedAt (midnight UTC).
    expect(lastMetadataPatch?.capturedAt).toBeTruthy()
    expect(new Date(lastMetadataPatch!.capturedAt as string).toISOString()).toBe('2025-09-20T00:00:00.000Z')
    // The refetched row now leads with "Taken" (capture 2025-09-20 ≠ upload 2026-01-03).
    await expect(page.getByTestId(`upload-date-${EDITABLE}`)).toContainText('Added')
  })
})
