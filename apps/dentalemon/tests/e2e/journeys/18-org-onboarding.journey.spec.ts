/**
 * J18 — A brand-new clinic owner self-onboards through the setup wizard.
 *
 * Covers the org-onboarding workflow end-to-end through the rendered DOM (the
 * coverage gap: the shipped OnboardingWizard — org → branch → member → set-pin
 * → patient — was only unit-tested; no journey ever proved a real owner can
 * REACH and COMPLETE it). Obeys the Anti-Cheating Rules: every wizard step is
 * driven DOM-only; the resulting clinic is then asserted via an INDEPENDENT API
 * session (the new owner's own context, separate from the browser) GETting
 * /dental/org/context.
 *
 * Persona: an admin-allowlisted owner with NO clinic yet. Org creation is an
 * admin-level operation (EM-ORG-002: only `user.role === 'admin'` may POST
 * /dental/organizations), and Better-Auth auto-promotes accounts whose email is
 * in AUTH_ADMIN_EMAILS to admin on creation. We therefore sign up the
 * allowlisted `admin@monobase.com` (present in .env, NOT created by the seed),
 * giving a fresh admin owner with no clinic — the exact persona the wizard
 * exists for. The seed owner is already onboarded, so this journey provisions
 * its own account as pre-journey infrastructure (equivalent to the seed) and
 * drives the wizard from a clean slate.
 *
 * Determinism: assumes a freshly-reseeded DB (the journey-harness contract via
 * `bun run db:reseed`) where only demo@dentalemon.com exists — so admin@monobase
 * .com signs up fresh, with no org, every run.
 *
 * Expected verdict: PASS — a new owner lands on the wizard and the 5-call chain
 * persists a usable clinic.
 */
import {
  test,
  expect,
  type JourneyMeta,
  API,
  APP,
  recordJourneyPass,
  recordJourneyError,
  pwRequest,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J18',
  name: 'New clinic owner self-onboards via the setup wizard',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-ORG-001'],
}

test(`${META.id} — ${META.name}`, async ({ page, errorSurface }) => {
  // P2-A: the wizard sign-up uses the fixed admin email; if the account already
  // exists (org wiped but Better-Auth account retained, see below) sign-up returns
  // 422 and the journey falls back to sign-in. That 422 is an expected control-flow
  // branch, not a failure.
  errorSurface.allowStatus(422, /\/auth\/sign-up/)
  // Admin-allowlisted owner (auto-promoted to admin on sign-up) — the only
  // persona permitted to create an org (EM-ORG-002). Fresh on a reseeded DB.
  const stamp = Date.now()
  const email = 'admin@monobase.com'
  const password = 'J18Owner1!pw'
  const clinicName = `J18 Smile Clinic ${stamp}`
  const dentistName = `Dr. J18 Owner ${stamp}`
  const patientName = `J18 First Patient ${stamp}`
  const pin = '482913'

  try {
    // ── Pre-journey infrastructure: an authenticated admin owner with no clinic ─
    // Account creation is not the journey under test (clinic onboarding is), so
    // it is pre-journey infrastructure (like the seed). We sign up the
    // allowlisted admin, then ALWAYS sign in explicitly: db:reseed clears the
    // dental tables but NOT Better-Auth users, so on repeat runs the account
    // already exists (sign-up 4xx) but the org was wiped — sign-in still yields
    // a fresh no-clinic admin. Doing this from inside the browser lands the
    // session cookie in the native jar (the wizard's fetch needs it).
    await page.goto(`${APP}/`)
    await page.waitForLoadState('networkidle')
    const authStatus = await page.evaluate(
      async ({ api, email, password }: { api: string; email: string; password: string }) => {
        // Best-effort create (ignored if the account already exists).
        await fetch(`${api}/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, name: 'J18 Owner' }),
        }).catch(() => {})
        // Authoritative: sign in to guarantee a native session cookie.
        const r = await fetch(`${api}/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        })
        return r.status
      },
      { api: API, email, password },
    )
    expect(authStatus, 'admin owner sign-in must succeed').toBeLessThan(400)

    // ── DOM-only journey ──────────────────────────────────────────────────────
    // A no-clinic owner who opens the app must be guided to the setup wizard.
    // (The app redirects /dashboard → pin-select → /dental-onboarding for an
    // authenticated owner with no clinic.)
    await page.goto(`${APP}/dashboard`)
    await page.waitForURL(/\/dental-onboarding/, { timeout: 15_000 })
    // Each step label appears twice (step indicator + <h2>); target the heading.
    await expect(
      page.getByRole('heading', { name: 'Clinic Setup' }),
      'a no-clinic owner must land on the onboarding wizard',
    ).toBeVisible({ timeout: 10_000 })

    // Step 1 — Clinic (Country defaults to PH).
    await page.getByLabel('Clinic Name').fill(clinicName)
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 2 — Dentist profile + login PIN.
    await expect(page.getByRole('heading', { name: 'Dentist Profile' })).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Full Name').fill(dentistName)
    await page.getByLabel('6-digit PIN').fill(pin)
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 3 — Fees (optional, accept defaults).
    await expect(page.getByRole('heading', { name: 'Fee Schedule' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /^next$/i }).click()

    // Step 4 — Register the first patient (drives the full org → branch → member
    // → set-pin → patient chain; consent is captured server-side by the wizard).
    await expect(page.getByRole('heading', { name: 'First Patient' })).toBeVisible({ timeout: 10_000 })
    await page.getByLabel('Full Name').fill(patientName)
    await page.getByLabel('Date of Birth').fill('1990-06-15')
    await page.getByRole('button', { name: /get started/i }).click()

    // On success the wizard removes its draft and navigates away (→ dashboard,
    // which bounces an as-yet-PIN-authenticated owner to the PIN flow). Leaving
    // the wizard route is the DOM signal that the org→branch→member→pin chain
    // resolved.
    await page.waitForURL((u: URL) => !u.pathname.includes('dental-onboarding'), {
      timeout: 20_000,
    })

    // ── Independent read: the clinic must exist for the NEW owner ──────────────
    // A SEPARATE API session (not the browser's cookie) authenticated as the new
    // owner — proves durable persistence, not UI optimism. The owner-member link
    // (member.id present for THIS owner) is the load-bearing assertion: it proves
    // set-pin succeeded, which only works if the bootstrap membership was linked
    // to the owner's account.
    const reader = await pwRequest.newContext({ baseURL: API })
    const signIn = await reader.post('/auth/sign-in/email', { data: { email, password } })
    expect(signIn.ok(), `independent owner sign-in → ${signIn.status()}`).toBe(true)

    const ctxRes = await reader.get('/dental/org/context')
    expect(ctxRes.ok(), `org context → ${ctxRes.status()}`).toBe(true)
    const ctx = await ctxRes.json()
    expect(ctx.org?.name, 'the wizard must have created the org').toBe(clinicName)
    expect(ctx.branch?.id, 'the wizard must have created a branch').toBeTruthy()
    expect(ctx.member?.id, 'the owner must hold the bootstrap membership').toBeTruthy()
    expect(ctx.member?.role, 'the owner member must be dentist_owner').toBe('dentist_owner')

    // The first patient must have persisted too (no silent drop).
    const branchId = ctx.branch.id as string
    const patientsRes = await reader.get(`/dental/patients?branchId=${branchId}`)
    expect(patientsRes.ok(), `patients list → ${patientsRes.status()}`).toBe(true)
    const pBody = await patientsRes.json()
    const items: any[] = Array.isArray(pBody) ? pBody : (pBody.items ?? pBody.data ?? [])
    expect(
      items.some((p) => p.displayName === patientName),
      `the first patient "${patientName}" must persist`,
    ).toBe(true)
    await reader.dispose()

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
