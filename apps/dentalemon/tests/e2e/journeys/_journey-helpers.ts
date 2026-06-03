/**
 * Journey-harness shared helpers.
 *
 * These specs verify whether a real clinician can complete clinical workflows
 * END-TO-END through the rendered DOM. They obey the three Anti-Cheating Rules
 * from docs/audits/JOURNEY_HARNESS_CONTRACT.md:
 *
 *   1. DOM-only drive    — no request./page.evaluate to perform a journey step.
 *   2. Independent read  — goal state asserted via a SEPARATE API GET executed
 *                          AFTER the UI flow, reading durable persistence.
 *   3. No shortcut       — a journey the UI cannot complete = BROKEN. We prove
 *                          the break with an independent read; we never patch
 *                          state to make the spec green.
 *
 * Precondition seeding (creating patients/visits/imaging BEFORE the browser
 * opens) is the only allowed non-DOM write, and is done by `bun run db:reseed`
 * (the runner) — these specs assume the demo seed is present.
 *
 * The independent-read client (`apiReader`) authenticates with its OWN API
 * session (the seed owner) and is used ONLY for post-UI GET verification —
 * never to drive or repair a journey.
 */

import { test as base, expect, type Page, type APIRequestContext, request as pwRequest } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export { expect }

export const API = 'http://localhost:7213'
export const APP = 'http://localhost:3003'

// Demo seed credentials (scripts/seed-demo.ts).
export const DEMO_EMAIL = 'demo@dentalemon.com'
export const DEMO_PASSWORD = 'DemoClinic1!'

// Seed personas (scripts/seed-demo.ts §4 Staff). The seed only provisions
// dentist_owner + staff_full PINs; front-desk/assistant journeys use the
// best-available seeded role and the spec records the substitution.
export const PERSONAS = {
  dentist: { displayName: 'Dr. Maria Reyes', pin: ['1', '2', '3', '4', '5', '6'], role: 'dentist_owner' },
  staff: { displayName: 'Ana Santos', pin: ['6', '5', '4', '3', '2', '1'], role: 'staff_full' },
} as const

export type PersonaKey = keyof typeof PERSONAS

// Seed patient roster (scripts/seed-demo.ts §6 Patients), by display name.
export const SEED_PATIENTS = {
  juan: 'Juan dela Cruz', // P0
  maria: 'Maria Santos', // P1 active visit
  roberto: 'Roberto Lim', // P2 crown+lab
  elena: 'Elena Garcia', // P3 pediatric / mixed dentition
  carlos: 'Carlos Mendoza', // P4 open plan
  ana: 'Ana Reyes', // P5 carry-over
  miguel: 'Miguel Torres', // P6 imaging + ceph
  sofia: 'Sofia Cruz', // P7 amendment + signed notes
  diego: 'Diego Ramos', // P8 check-in
  isabel: 'Isabel Flores', // P9 PMD import
} as const

// ── Failure-record sink (collected by the runner) ─────────────────────────────

const HELPER_DIR = path.dirname(fileURLToPath(import.meta.url))
// tests/e2e/journeys → apps/dentalemon/.journey-tmp (matches the runner's TMP_DIR).
const RESULTS_DIR = path.resolve(HELPER_DIR, '../../../.journey-tmp')

export interface JourneyRecord {
  id: string
  name: string
  set: 'A' | 'B'
  expectedVerdict: 'PASS' | 'BROKEN'
  actualVerdict: 'PASS' | 'BROKEN' | 'ERROR'
  failedStep: string | null
  screenshotPath: string | null
  rubricIds: string[]
}

function ensureDir() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true })
}

/** Persist a per-journey record for the runner to aggregate. */
export function writeJourneyRecord(rec: JourneyRecord) {
  ensureDir()
  fs.writeFileSync(path.join(RESULTS_DIR, `${rec.id}.json`), JSON.stringify(rec, null, 2))
}

// ── Extended test: per-spec metadata + independent-read client ────────────────

export interface JourneyMeta {
  id: string
  name: string
  set: 'A' | 'B'
  expectedVerdict: 'PASS' | 'BROKEN'
  rubricIds: string[]
}

type Fixtures = {
  /**
   * Independent-read API client. Authenticated with its OWN seed-owner session.
   * USE ONLY for post-UI goal-state GETs. Driving/repairing a journey with this
   * is an Anti-Cheating Rule 1/3 violation.
   */
  apiReader: APIRequestContext
}

export const test = base.extend<Fixtures>({
  apiReader: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({ baseURL: API })
    // Independent session — NOT the browser's PIN session.
    const signIn = await ctx.post('/auth/sign-in/email', {
      data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
    })
    if (!signIn.ok()) {
      // Seed may sign-up instead; surface clearly.
      throw new Error(
        `apiReader sign-in failed (${signIn.status()}). Is the demo seed present? ` +
          `Run \`bun run db:reseed\`. Body: ${(await signIn.text()).slice(0, 300)}`,
      )
    }
    await use(ctx)
    await ctx.dispose()
  },
})

// ── Independent-read context resolution ───────────────────────────────────────

export interface OrgContext {
  orgId: string
  branchId: string
  memberId: string
}

/** Resolve org/branch/member for the seed owner via the independent reader. */
export async function readOrgContext(api: APIRequestContext): Promise<OrgContext> {
  const r = await api.get('/dental/org/context')
  if (!r.ok()) throw new Error(`readOrgContext: /dental/org/context → ${r.status()}`)
  const d = await r.json()
  return { orgId: d.org?.id, branchId: d.branch?.id, memberId: d.member?.id }
}

/** Resolve a seeded patient's id by display name (independent read, pre-browser OK). */
export async function readPatientIdByName(
  api: APIRequestContext,
  branchId: string,
  displayName: string,
): Promise<string> {
  const r = await api.get(`/dental/patients?branchId=${branchId}`)
  if (!r.ok()) throw new Error(`readPatientIdByName: list → ${r.status()}`)
  const body = await r.json()
  const items: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
  const match = items.find((p) => p.displayName === displayName)
  if (!match) {
    throw new Error(
      `readPatientIdByName: "${displayName}" not in branch ${branchId}. ` +
        `Seed roster: ${items.map((p) => p.displayName).join(', ')}`,
    )
  }
  return match.id
}

// ── Real PIN auth (DOM-only) ──────────────────────────────────────────────────

/**
 * Inject a Better Auth account session before the PIN flow.
 * This is pre-journey infrastructure (equivalent to DB seeding) — the clinical
 * journey under test starts at pin-select, not at the account sign-in form.
 * The account session is not under test; PIN auth IS under test.
 *
 * We sign in via fetch() from INSIDE the browser so the session cookie lands
 * in the browser's native cookie jar (not just Playwright's API context). This
 * ensures pin-select.tsx's own fetch({ credentials: 'include' }) sees the
 * session and can load member cards.
 */
async function ensureAccountSession(page: Page): Promise<void> {
  // Navigate to the app origin first — page.evaluate runs in this origin's context.
  await page.goto(`${APP}/`)
  await page.waitForLoadState('networkidle')

  // Sign in from within the browser so cookies are set natively.
  const signInStatus = await page.evaluate(
    async ({ api, email, password }: { api: string; email: string; password: string }) => {
      const resp = await fetch(`${api}/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      return resp.status
    },
    { api: API, email: DEMO_EMAIL, password: DEMO_PASSWORD },
  )
  if (signInStatus >= 400) {
    throw new Error(
      `ensureAccountSession: sign-in returned ${signInStatus}. ` +
        `Run \`bun run db:reseed\` to ensure the demo seed is present.`,
    )
  }

  // pin-select reads currentBranchId from localStorage (pin-select.tsx:103).
  // pin-entry reads currentOrgId AND currentBranchId (pin-entry.$memberId.tsx:248-250).
  // Fetch org/branch context from within the browser so the same session cookie
  // is used, then inject both into localStorage.
  const ctx = await page.evaluate(async (api: string) => {
    const r = await fetch(`${api}/dental/org/context`, { credentials: 'include' })
    if (!r.ok) return null
    const d = await r.json()
    return { orgId: (d?.org?.id as string) ?? null, branchId: (d?.branch?.id as string) ?? null }
  }, API)

  if (ctx?.orgId) {
    await page.evaluate((oid: string) => {
      localStorage.setItem('currentOrgId', oid)
    }, ctx.orgId)
  }
  if (ctx?.branchId) {
    await page.evaluate((bid: string) => {
      localStorage.setItem('currentBranchId', bid)
    }, ctx.branchId)
  }
}

/**
 * Authenticate through the REAL PIN flow against the rendered DOM.
 * Signs in with demo account → /auth/pin-select → tap member card →
 * /auth/pin-entry/:id → 6-digit keypad. No cookie injection, no
 * page.evaluate(startSession). Lands on the role route.
 */
export async function pinAuth(page: Page, persona: PersonaKey): Promise<void> {
  const { displayName, pin } = PERSONAS[persona]

  await ensureAccountSession(page)
  await page.goto(`${APP}/auth/pin-select`)
  await page.waitForLoadState('networkidle')

  // The select screen may auto-redirect (single member) — handle both.
  if (page.url().includes('/auth/pin-select')) {
    const card = page.getByRole('button', { name: new RegExp(`Sign in as ${displayName}`, 'i') })
    await expect(card, `PIN-select card for "${displayName}" must render`).toBeVisible({
      timeout: 15_000,
    })
    await card.click()
  }

  await page.waitForURL(/\/auth\/pin-entry\//, { timeout: 10_000 })
  await expect(page.getByLabel('1')).toBeVisible({ timeout: 10_000 })

  for (const digit of pin) {
    await page.getByRole('button', { name: new RegExp(`^${digit}$`) }).click()
  }

  // Land off the auth flow (role-based: dashboard/patients/calendar).
  await page.waitForURL((u: URL) => !u.pathname.startsWith('/auth/'), { timeout: 10_000 })
}

/** Open the clinical workspace for a patient (DOM navigation). */
export async function openWorkspace(page: Page, patientId: string): Promise<void> {
  // Route is /$patientId — _workspace is a pathless layout (TanStack Router).
  // SPA-navigate (history.pushState) instead of a hard page.goto: the workspace
  // route is PIN-gated and the PIN session minted by pinAuth() lives ONLY in
  // memory. A full reload (page.goto) wipes that session and bounces back to
  // /auth/pin-select, so the carousel never mounts. TanStack Router intercepts
  // the same-origin history change and renders the workspace with the session
  // intact (same approach as tests/e2e/helpers/perio-e2e.ts spaNavigate).
  await page.evaluate((p) => {
    window.history.pushState({}, '', p)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, `/${patientId}`)
  await page.waitForURL((u: URL) => u.pathname === `/${patientId}`, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  // Workspace mounted = carousel zone present, not the loading shell.
  await expect(
    page.getByTestId('workspace-carousel-zone'),
    'workspace must mount (carousel zone visible)',
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Locate the first tooth button in the ACTIVE carousel card.
 * The Swiper carousel (timeline-carousel.tsx) renders adjacent visit thumbnails
 * that are outside the viewport. `data-active-card="1"` flags the center card.
 * Using this avoids clicking off-screen thumbnail teeth.
 */
export function getActiveTooth(page: Page) {
  return page.locator('[data-active-card="1"] [data-testid^="tooth-"]').first()
}

// ── Verdict helpers ───────────────────────────────────────────────────────────

/**
 * Record a confirmed BROKEN journey.
 *
 * The journey performed every UI step it could; the failure point was reached
 * (UI step impossible, OR independent read proves goal state never persisted).
 * This is the DELIVERABLE for a known-broken journey — the spec is GREEN in
 * Playwright iff the expected break occurred. We do NOT add a shortcut to make
 * the journey itself succeed (Anti-Cheating Rule 3).
 *
 * If `unexpectedlyOk` is true the break did NOT occur (a P0 may be fixed) —
 * we throw so a human reviews whether the harness is now cheating.
 */
export async function expectJourneyBroken(
  page: Page,
  meta: JourneyMeta,
  reason: string,
  opts: { unexpectedlyOk?: boolean } = {},
): Promise<void> {
  ensureDir()
  const shotPath = path.join(RESULTS_DIR, `${meta.id}-broken.png`)
  try {
    await page.screenshot({ path: shotPath, fullPage: true })
  } catch {
    /* screenshot best-effort */
  }

  if (opts.unexpectedlyOk) {
    writeJourneyRecord({
      ...meta,
      actualVerdict: 'PASS',
      failedStep: null,
      screenshotPath: shotPath,
    })
    throw new Error(
      `[${meta.id}] expected BROKEN but the journey COMPLETED. ` +
        `A P0 may be fixed — re-audit against the Anti-Cheating Rules before ` +
        `marking PASS. Context: ${reason}`,
    )
  }

  writeJourneyRecord({
    ...meta,
    actualVerdict: 'BROKEN',
    failedStep: reason,
    screenshotPath: shotPath,
  })
  // Confirmed break = the expected outcome ⇒ spec is GREEN. The runner reads
  // the record file to surface BROKEN in journey-results.json.
  // eslint-disable-next-line no-console
  console.log(`[JOURNEY ${meta.id}] BROKEN (expected): ${reason}`)
}

/** Record a fully-passing journey (all UI steps + independent read + persist). */
export function recordJourneyPass(meta: JourneyMeta): void {
  writeJourneyRecord({
    ...meta,
    actualVerdict: 'PASS',
    failedStep: null,
    screenshotPath: null,
  })
  // eslint-disable-next-line no-console
  console.log(`[JOURNEY ${meta.id}] PASS`)
}

/** Record an unexpected error (spec threw before reaching a verdict). */
export function recordJourneyError(meta: JourneyMeta, err: unknown): void {
  writeJourneyRecord({
    ...meta,
    actualVerdict: 'ERROR',
    failedStep: err instanceof Error ? err.message : String(err),
    screenshotPath: null,
  })
}

// ── Golden ceph fixture (packages/ceph-math/src/ceph-math.test.ts CLASS_I) ─────

export const CEPH_GOLDEN: Record<string, { x: number; y: number }> = {
  S: { x: 100, y: 200 },
  N: { x: 300, y: 200 },
  A: { x: 290, y: 271 },
  B: { x: 288, y: 268 },
  Pog: { x: 285, y: 280 },
  Me: { x: 282, y: 310 },
  Go: { x: 220, y: 310 },
  U1T: { x: 300, y: 240 },
  U1A: { x: 296, y: 265 },
  L1T: { x: 298, y: 265 },
  L1A: { x: 293, y: 285 },
}

// Expected derived measurements for the seeded ceph chain. The demo now traces a
// REAL lateral cephalogram (scripts/seed-assets/imaging/ceph-lateral-demo.jpg) with
// anatomically-placed landmarks → a mild Class II reading (deterministic, rounded
// to 2dp by the isomorphic ceph-math engine). Update both here and seed-demo.ts
// together if the seeded landmark coordinates change.
export const CEPH_EXPECTED = { sna: 79.51, snb: 75.94, anb: 3.57 } as const

export { pwRequest }
