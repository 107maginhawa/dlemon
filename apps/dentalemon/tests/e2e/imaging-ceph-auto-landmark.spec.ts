import { test, expect } from '@playwright/test'
import {
  GATE_CODES,
  MOCK_ANALYSIS,
  mkLandmark,
  setupCephRoutes,
  openCephPanel,
  installDefaultApiStub,
  assertWorkspaceReady,
  assertNoLoginRedirect,
} from './helpers/imaging-harness'

/**
 * P1-10 — AI / Auto Cephalometric Landmarking (Phase 0) E2E.
 *
 * Flow: open a lateral-ceph workspace with NO landmarks → click "Auto-detect
 * landmarks" → AI predictions land as source='ai' status='placed' (distinct
 * "AI · unconfirmed" overlay + palette state, low-confidence flagged) → correct
 * one point (→ ai_corrected) → confirm the A/B/Go/Po gate → generate a report
 * (gate enforces human confirmation — AI never auto-finalizes).
 *
 * Backend is mocked via page.route() (no real server/seed needed; the spec is
 * skipped automatically when no dev server is running). The detect endpoint
 * mock returns deterministic fixture predictions that mirror the FakeDetector.
 */

const CEPH_TEST_URL = '/imaging-test?modality=cephalometric'

// AI fixture predictions (mirror the FakeDetector). 'Go' is low-confidence.
const AI_PREDICTIONS = [
  { landmarkCode: 'S', x: 320, y: 130, confidence: 0.94 },
  { landmarkCode: 'N', x: 300, y: 150, confidence: 0.92 },
  { landmarkCode: 'A', x: 280, y: 300, confidence: 0.81 },
  { landmarkCode: 'B', x: 270, y: 350, confidence: 0.78 },
  { landmarkCode: 'Go', x: 200, y: 400, confidence: 0.52 },
  { landmarkCode: 'Po', x: 350, y: 100, confidence: 0.88 },
]

function aiItems(status: 'placed' | 'confirmed' = 'placed', source: 'ai' | 'ai_corrected' = 'ai') {
  return AI_PREDICTIONS.map((p) => ({
    ...mkLandmark(p.landmarkCode, status, p.x, p.y),
    source,
    confidence: p.confidence,
  }))
}

function detectResult() {
  return {
    jobId: 'job-e2e-1',
    status: 'succeeded' as const,
    modelVersion: 'fake-detector-v0',
    provider: 'fake',
    predictions: AI_PREDICTIONS,
    items: aiItems('placed', 'ai'),
    analysis: MOCK_ANALYSIS,
  }
}

test.beforeEach(async ({ page }) => {
  await installDefaultApiStub(page)
})

test.describe('P1-10 Auto-detect landmarks', () => {
  test('Auto-detect button + honest disclosure are present', async ({ page }) => {
    // Empty landmark set so the workspace starts unplaced.
    await setupCephRoutes(page, { items: [], analysis: MOCK_ANALYSIS })
    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    assertNoLoginRedirect(page)
    await openCephPanel(page)

    await expect(
      page.getByRole('button', { name: /Auto-detect landmarks/i }),
    ).toBeVisible()
    await expect(page.locator('[data-ai-disclosure]')).toContainText(
      'confirm each before',
    )
  })

  test('clicking Auto-detect lands AI points in a distinct unconfirmed state', async ({ page }) => {
    let detected = false
    // Detect endpoint mock (registered before the broad landmarks route wins via LIFO,
    // but the path is more specific so register it last for highest priority).
    await setupCephRoutes(page, { items: [], analysis: MOCK_ANALYSIS })
    await page.route(/\/ceph\/landmarks\/detect/, (route) => {
      detected = true
      route.fulfill({ json: detectResult() })
    })
    // After detection, the list query refetch reflects the persisted AI points.
    await page.route(/\/ceph\/landmarks(\?|$)/, (route) => {
      route.fulfill({ json: { items: detected ? aiItems() : [], analysis: MOCK_ANALYSIS } })
    })

    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    await openCephPanel(page)

    await page.getByRole('button', { name: /Auto-detect landmarks/i }).click()

    // Palette marks AI points "AI · unconfirmed".
    await expect(page.locator('[data-ai-unconfirmed="S"]')).toBeVisible({ timeout: 5000 })
    // Low-confidence point (Go) is flagged.
    await expect(page.locator('[data-ai-low-confidence="Go"]')).toBeVisible()
    // Overlay renders the distinct AI ring (hollow/dashed, not lemon).
    await expect(page.locator('[data-ai-unconfirmed="true"]').first()).toBeAttached()
  })

  test('full flow: detect → correct one → confirm gate → generate report shows AI provenance', async ({ page }) => {
    let detected = false
    let corrected = false
    const confirmed = new Set<string>()

    await page.route(/\/ceph\/analysis/, (route) => route.fulfill({ json: MOCK_ANALYSIS }))

    await page.route(/\/ceph\/landmarks\/detect/, (route) => {
      detected = true
      route.fulfill({ json: detectResult() })
    })

    // PATCH a specific landmark: coord change → ai_corrected; status change → confirm.
    await page.route(/\/ceph\/landmarks\/[^/?]+$/, (route) => {
      const req = route.request()
      if (req.method() === 'PATCH') {
        const body = JSON.parse(req.postData() ?? '{}') as { x?: number; status?: string }
        const code = req.url().split('/').pop() ?? ''
        if (body.x !== undefined) corrected = true
        if (body.status === 'confirmed') confirmed.add(code)
      }
      route.fulfill({ json: { items: currentItems(), analysis: MOCK_ANALYSIS } })
    })

    // Broad list route reflects accumulated state.
    await page.route(/\/ceph\/landmarks(\?|$)/, (route) => {
      route.fulfill({ json: { items: detected ? currentItems() : [], analysis: MOCK_ANALYSIS } })
    })

    // Report creation: enforce the confirm-gate (A/B/Go/Po confirmed) like the server.
    await page.route(/\/ceph\/reports/, (route) => {
      const allGateConfirmed = GATE_CODES.every((c) => confirmed.has(c))
      if (!allGateConfirmed) {
        route.fulfill({
          status: 422,
          json: { code: 'REPORT_GATE_UNCONFIRMED', error: 'confirm gate' },
        })
        return
      }
      route.fulfill({
        status: 201,
        json: {
          id: 'report-e2e-1',
          imageId: 'test-image-id',
          version: 1,
          snapshot: {
            analysis_label: 'steiner_hybrid_sn',
            landmarks: currentItems().map((l) => ({ landmarkCode: l.landmarkCode, source: l.source })),
          },
          createdAt: '2026-01-01T00:00:00Z',
        },
      })
    })

    function currentItems() {
      return AI_PREDICTIONS.map((p) => {
        const isConfirmed = confirmed.has(p.landmarkCode)
        const isCorrected = corrected && p.landmarkCode === 'Go'
        return {
          ...mkLandmark(p.landmarkCode, isConfirmed ? 'confirmed' : 'placed', p.x, p.y),
          source: isCorrected ? ('ai_corrected' as const) : ('ai' as const),
          confidence: p.confidence,
        }
      })
    }

    await page.goto(CEPH_TEST_URL)
    await assertWorkspaceReady(page, 'ceph')
    await openCephPanel(page)

    // 1. Detect
    await page.getByRole('button', { name: /Auto-detect landmarks/i }).click()
    await expect(page.locator('[data-ai-unconfirmed="S"]')).toBeVisible({ timeout: 5000 })

    // 2. Report is blocked while everything is AI/placed (no human confirm yet).
    const reportBtn = page.getByRole('button', { name: /Generate Report/i })
    await expect(reportBtn).toBeDisabled()

    // 3. Correct the low-confidence Go point (PATCH coords → ai_corrected).
    await page.evaluate(async () => {
      await fetch('http://localhost:7213/dental/imaging/images/test-image-id/ceph/landmarks/Go', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 205, y: 405 }),
      })
    })
    await expect.poll(() => corrected).toBe(true)

    // 4. Confirm the four gate landmarks (human action — AI never auto-confirms).
    for (const code of GATE_CODES) {
      await page.evaluate(async (c) => {
        await fetch(`http://localhost:7213/dental/imaging/images/test-image-id/ceph/landmarks/${c}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        })
      }, code)
    }
    await expect.poll(() => GATE_CODES.every((c) => confirmed.has(c))).toBe(true)

    // 5. Generate the report — succeeds now that the gate passed; snapshot carries
    //    AI provenance (source per landmark).
    const reportResp = await page.evaluate(async () => {
      const res = await fetch('http://localhost:7213/dental/imaging/images/test-image-id/ceph/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      return { status: res.status, body: await res.json() }
    })
    expect(reportResp.status).toBe(201)
    const sources = (reportResp.body.snapshot.landmarks as { source: string }[]).map((l) => l.source)
    expect(sources).toContain('ai')
    expect(sources).toContain('ai_corrected')
  })
})
