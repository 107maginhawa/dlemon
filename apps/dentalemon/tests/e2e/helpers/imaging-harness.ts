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
