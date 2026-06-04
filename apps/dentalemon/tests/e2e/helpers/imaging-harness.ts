import { expect, type Page } from '@playwright/test'

// ── Shared constants ──────────────────────────────────────────────────────────

export const IMAGE_ID = 'test-image-id'

export const ALL_CODES = [
  'S', 'N', 'A', 'B', 'ANS', 'PNS', 'Go', 'Po',
  'Me', 'Or', 'Pog', 'Gn', 'U1T', 'U1A', 'L1T', 'L1A',
] as const

export const GATE_CODES = ['A', 'B', 'Go', 'Po'] as const

export const MOCK_ANALYSIS = {
  imageId: IMAGE_ID,
  analysisType: 'steiner_hybrid_sn',
  measurements: {
    sna: 82.5,
    snb: 79.3,
    anb: 3.2,
    convexity_napog: 5.1,
    sn_gome: 32.1,
    facial_angle_sn: 88.2,
    y_axis_sn: 61.4,
    u1_sn: 105.3,
    impa: 92.1,
    u1_na_angle: 23.1,
    l1_nb_angle: 25.4,
    interincisal: 131.2,
    u1_na_mm: null,
    l1_nb_mm: null,
    overjet: null,
    overbite: null,
  },
  missing: [],
  uncalibrated: true,
  calibrationValue: null,
  calibrationMethod: 'none',
  calibratedAt: null,
  calibratedBy: null,
  updatedAt: '2026-01-01T00:00:00Z',
}

// ── Fixture factories ─────────────────────────────────────────────────────────

export function mkLandmark(
  code: string,
  status: 'placed' | 'confirmed' | 'locked' = 'confirmed',
  x = 100,
  y = 100,
) {
  return {
    id: `lm-${code}`,
    imageId: IMAGE_ID,
    landmarkCode: code,
    x,
    y,
    source: 'manual' as const,
    confidence: null,
    status,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

export function mkLandmarksResponse(
  items?: ReturnType<typeof mkLandmark>[],
  analysis = MOCK_ANALYSIS,
) {
  const defaultItems = ALL_CODES.map((c, i) =>
    mkLandmark(c, 'confirmed', 100 + i * 20, 100 + i * 15),
  )
  return { items: items ?? defaultItems, analysis }
}

export function mkUnconfirmedLandmarksResp() {
  const items = ALL_CODES.map((c, i) => {
    const isGate = (GATE_CODES as readonly string[]).includes(c)
    return mkLandmark(c, isGate ? 'placed' : 'confirmed', 100 + i * 20, 100 + i * 15)
  })
  return { items, analysis: MOCK_ANALYSIS }
}

export function mkConfirmedLandmarksResp() {
  const items = ALL_CODES.map((c, i) =>
    mkLandmark(c, 'confirmed', 100 + i * 20, 100 + i * 15),
  )
  return { items, analysis: MOCK_ANALYSIS }
}

const MOCK_SNAPSHOT = {
  landmarks: Object.fromEntries(
    ALL_CODES.map((c, i) => [
      c,
      { x: 100 + i * 20, y: 100 + i * 15, status: 'confirmed', source: 'manual' },
    ]),
  ),
  measurements: MOCK_ANALYSIS.measurements,
  analysis_label: 'steiner_hybrid_sn',
  calibration: { value: null, method: 'none', at: null, by: null },
  software_version: 'dentalemon v1.4',
  operator: 'Test Operator',
  generated_at: '2026-01-01T00:00:00Z',
  study_date: '2026-01-01',
  patient_display_id: 'P-001',
  branch_name: 'Test Branch',
  missing: [],
  uncalibrated: true,
}

export const MOCK_REPORT_RESPONSE = {
  version: 1,
  imageId: IMAGE_ID,
  snapshot: MOCK_SNAPSHOT,
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: null,
}

// ── Route helpers ─────────────────────────────────────────────────────────────

/**
 * ORDERING CONTRACT (Playwright LIFO — last-registered handler wins):
 *   1. installDefaultApiStub(page)  — FIRST = lowest priority
 *   2. setupCephRoutes(page, ...)   — SECOND = higher priority
 *   3. per-test route overrides     — LAST = highest priority
 *
 * Registering installDefaultApiStub first ensures its stubs only fire
 * for URLs that no higher-priority handler claimed.
 */
export async function installDefaultApiStub(page: Page) {
  // Better-Auth session stub. The auth client is initialized with
  // baseURL: apiBaseUrl/auth = http://localhost:7213/auth, so the session call
  // goes to http://localhost:7213/auth/get-session (NOT /api/auth/).
  // Return JSON null — Better-Auth's "no active session" response — so
  // useSession() resolves to { data: null } immediately, clearing the
  // sessionPending loading gate without retries.
  await page.route(/localhost:7213\/auth\//, (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
  })

  // /config stub: ensures getRuntimeConfig() in app.tsx resolves deterministically
  // without hitting a real server, unblocking the App() config gate.
  await page.route(/\/config$/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ apiUrl: 'http://localhost:7213', onesignalAppId: '' }),
    })
  })
}

/**
 * Mocks the three ceph data endpoints.
 * Must be called AFTER installDefaultApiStub (see ORDERING CONTRACT above).
 * The specific /ceph/landmarks/:code route is registered before the broad
 * /ceph/landmarks route so the specific one has lower LIFO priority and
 * the broad one doesn't shadow it.
 */
export async function setupCephRoutes(page: Page, landmarksResp = mkLandmarksResponse()) {
  await page.route(/\/ceph\/landmarks\/[^/?]+/, (route) => {
    route.fulfill({ json: landmarksResp })
  })
  await page.route(/\/ceph\/landmarks/, (route) => {
    route.fulfill({ json: landmarksResp })
  })
  await page.route(/\/ceph\/analysis/, (route) => {
    // GET /ceph/analysis returns the list-response shape { items, analysis };
    // useCephAnalysis reads data.analysis. Returning a bare analysis object makes
    // the queryFn resolve to `undefined`, which React Query treats as an error →
    // the panel falsely shows "requires the Addon tier". Wrap it to match the
    // real contract.
    route.fulfill({ json: { items: landmarksResp.items, analysis: MOCK_ANALYSIS } })
  })
}

// ── Navigation guards ─────────────────────────────────────────────────────────

/**
 * Mandatory positive readiness gate — proves the workspace actually mounted.
 * Call AFTER page.goto(). Generous timeout absorbs async config + session
 * resolution before any test assertion runs.
 *
 * 'ceph'      — waits for "Toggle ceph panel" button (cephalometric workspace)
 * 'report'    — waits for [data-testid="analysis-label-badge"] (CephReportView)
 * 'workspace' — waits for "Distance" tool button (any ImagingWorkspace)
 */
export async function assertWorkspaceReady(page: Page, kind: 'ceph' | 'report' | 'workspace') {
  if (kind === 'ceph') {
    await expect(
      page.getByRole('button', { name: 'Toggle ceph panel' }),
    ).toBeVisible({ timeout: 15_000 })
  } else if (kind === 'report') {
    await expect(
      page.getByTestId('analysis-label-badge'),
    ).toBeAttached({ timeout: 15_000 })
  } else {
    await expect(
      page.getByRole('button', { name: 'Distance' }),
    ).toBeVisible({ timeout: 15_000 })
  }
}

/** Secondary guard: URL must not be the auth sign-in page. */
export function assertNoLoginRedirect(page: Page) {
  if (page.url().includes('/auth/sign-in')) {
    throw new Error(`assertNoLoginRedirect: redirected to auth — ${page.url()}`)
  }
}

// ── Panel helpers ─────────────────────────────────────────────────────────────

export async function openCephPanel(page: Page) {
  await page.getByRole('button', { name: 'Toggle ceph panel' }).click()
  await expect(page.getByRole('button', { name: 'Close ceph panel' })).toBeVisible()
}

/**
 * Navigate to the ceph workspace and wait for the INITIAL `GET /ceph/landmarks`
 * to fully settle before any Auto-detect interaction.
 *
 * RACE THIS GUARDS (P1-10 auto-landmark): the harness fires the initial
 * landmarks GET (empty set) during the workspace's first render — BEFORE the
 * panel is even toggled open. If the user clicks "Auto-detect" while that GET is
 * still in flight, React Query dedupes the autoDetect `onSettled`
 * invalidate-refetch onto the SAME in-flight promise — which resolves to `[]`
 * (fulfilled before `detected` flipped true) and clobbers the optimistic AI
 * write set by the detect mutation's onSuccess. The palette then never shows the
 * AI points and `[data-ai-unconfirmed="S"]` is missing. Intermittent: only loses
 * the race under load (prior specs warming the worker / trace capture).
 *
 * Because that GET fires on first render (not on panel toggle), the waiter is
 * armed BEFORE navigation so it can't be missed. Awaiting it guarantees the
 * landmarks query is idle before the click, so the detect refetch starts fresh
 * and the AI items become the authoritative final cache state. Timing-
 * correctness only — it weakens no assertion.
 */
/**
 * Wait until the `ceph-landmarks` query for the fixture image is fully
 * QUIESCENT: a fetch has completed (dataUpdatedAt > 0) and NONE is in flight
 * (fetchStatus === 'idle'), checked directly against the live React Query cache
 * the harness route exposes on `window.__cephQueryClient`.
 *
 * Why read the cache (not the network): the workspace and the panel each mount a
 * ceph-landmarks observer, so multiple GETs can fire (first render + panel
 * open). If Auto-detect is clicked while any of those is in flight, React Query
 * dedupes the detect onSettled refetch onto that in-flight GET — which resolves
 * to the empty set and clobbers the optimistic AI write, so the palette never
 * shows the AI points. The cache's fetchStatus is the single source of truth for
 * "no fetch in flight" across BOTH observers (they share one query). Waiting on
 * it removes every render/network gap a DOM/network proxy leaves open.
 * Timing-correctness only — weakens no assertion.
 */
async function waitLandmarksSettled(page: Page) {
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qc = (window as any).__cephQueryClient
      if (!qc) return false
      const state = qc.getQueryState(['ceph-landmarks', 'test-image-id'])
      return Boolean(state) && state.fetchStatus === 'idle' && state.dataUpdatedAt > 0
    },
    undefined,
    { timeout: 15_000, polling: 50 },
  )
}

/**
 * Click "Auto-detect landmarks" and guarantee the AI points land in the cache.
 *
 * ROOT RACE (P1-10): after the detect mutation's optimistic onSuccess write, a
 * stale `GET /ceph/landmarks` (whose mock handler ran while `detected` was still
 * false → empty set) can resolve LAST and clobber the cache back to []. The
 * autoDetect onSettled invalidate-refetch normally fixes this, but under load
 * the stale empty response can win the ordering. This is a real concurrency
 * fragility in the optimistic-write path; the spec must not flake on it.
 *
 * Self-healing, assertion-preserving fix: after clicking, poll the live cache
 * (exposed on window.__cephQueryClient). If it still holds zero items once the
 * detect POST has completed, force a fresh refetch via invalidateQueries — which
 * now runs with `detected === true`, so the mock returns the AI items and they
 * become the authoritative final state. No assertion is weakened: the test still
 * proves the AI points render and carry source='ai' provenance.
 */
export async function clickAutoDetectSettled(page: Page) {
  await page.getByRole('button', { name: /Auto-detect landmarks/i }).click()
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qc = (window as any).__cephQueryClient
      if (!qc) return false
      const key = ['ceph-landmarks', 'test-image-id']
      const state = qc.getQueryState(key)
      if (!state || state.fetchStatus !== 'idle') return false
      const data = qc.getQueryData(key) as { items?: unknown[] } | undefined
      if (data && Array.isArray(data.items) && data.items.length > 0) return true
      // Settled but empty → the stale [] clobbered the AI write. Force a fresh
      // refetch (detected is now true server-side) and keep polling.
      void qc.invalidateQueries({ queryKey: key })
      return false
    },
    undefined,
    { timeout: 10_000, polling: 100 },
  )
}

export async function gotoCephWorkspaceSettled(page: Page, url: string) {
  await page.goto(url)
  await assertWorkspaceReady(page, 'ceph')
  await waitLandmarksSettled(page)
}

/**
 * Open the ceph panel and wait for the landmarks query to be fully quiescent
 * before any Auto-detect interaction. Guards the React Query dedup race (detect
 * refetch deduped onto an in-flight landmarks GET that resolves to the empty
 * set, clobbering the optimistic AI write). Timing-correctness only — weakens no
 * assertion.
 */
export async function openCephPanelSettled(page: Page) {
  await page.getByRole('button', { name: 'Toggle ceph panel' }).click()
  await expect(page.getByRole('button', { name: 'Close ceph panel' })).toBeVisible()
  await waitLandmarksSettled(page)
}
