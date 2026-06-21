/**
 * J24 — Patient magic-link sign-in (WF-003), the SOLE patient login path.
 *
 * The 2026-06-20 audit found Authentication a genuine paper tiger: magic-link
 * (WF-003) and passkey (WF-002) had ZERO tests of any kind. JC-2 also revealed the
 * flow was in fact BROKEN — the `auth.magic-link` email template was missing, so the
 * queue processor threw "No active template found" and the link was never delivered.
 * That fix (the template) is guarded deterministically by the auth-magic-link.hurl
 * contract; THIS journey adds the screen-level proof that the patient-facing UI
 * actually drives the flow end-to-end.
 *
 * DOM-driven (Anti-Cheating Rule 1): sign-in page → "Sign in with Magic Link" →
 * /auth/magic-link → type email → "Send magic link" (fires POST /auth/sign-in/magic-link).
 * The token is then consumed the way a real user does — by opening the link from their
 * inbox: the test reads the email from Mailpit (the local SMTP catcher, standing in for
 * the patient's inbox — the allowed equivalent of "the user received the email") and
 * navigates to the verify URL. Independent read (Rule 2): GET /auth/get-session via the
 * browser's OWN cookie jar proves a durable session for THIS email — the goal state.
 *
 * Set B / skipAllowed: needs Mailpit (the email transport). In the journey CI job there
 * is no Mailpit → honest environment SKIP, exactly like the ceph (MinIO) journeys. Run
 * locally / in the contract Mailpit lane it executes to PASS.
 */
import {
  test,
  expect,
  type JourneyMeta,
  API,
  APP,
  recordJourneyPass,
  recordJourneyError,
  recordJourneySkipped,
} from './_journey-helpers'

const MAILPIT = process.env.MAILPIT_API ?? 'http://localhost:8025'

const META: JourneyMeta = {
  id: 'J24',
  name: 'Patient magic-link sign-in (request via UI → consume emailed link → durable session)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-003'],
}

/** Poll Mailpit (the patient's "inbox") for the magic-link email and return the verify URL. */
async function pollMailpitForMagicLink(email: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}&limit=1`)
    if (r.ok) {
      const d = (await r.json()) as { count?: number; messages?: Array<{ ID: string }> }
      if ((d.count ?? 0) >= 1 && d.messages?.[0]?.ID) {
        const m = await fetch(`${MAILPIT}/api/v1/message/${d.messages[0].ID}`)
        if (m.ok) {
          const mb = (await m.json()) as { Text?: string }
          const match = String(mb.Text ?? '').match(
            /https?:\/\/[^\s"<]*?\/auth\/magic-link\/verify\?[^\s"<]+/,
          )
          if (match) return match[0]
        }
      }
    }
    await new Promise((res) => setTimeout(res, 1000))
  }
  throw new Error('magic-link email did not arrive in Mailpit within 60s')
}

test(`${META.id} — ${META.name}`, async ({ page, errorSurface }) => {
  // Environment gate: the email transport (Mailpit) must be present. Absent (CI
  // journey job) → honest SKIP, not a false red — mirrors the ceph/MinIO journeys.
  let mailpitUp = false
  try {
    mailpitUp = (await fetch(`${MAILPIT}/api/v1/messages?limit=1`)).ok
  } catch {
    mailpitUp = false
  }
  if (!mailpitUp) {
    recordJourneySkipped(META, `Mailpit not reachable at ${MAILPIT} — email transport absent`)
    test.skip(true, 'Mailpit absent (email transport) — environment skip')
    return
  }

  // A brand-new magic-link user has no clinic/org, so the post-sign-in app bootstrap
  // reads org/branch context that isn't there yet — those empty-state reads are
  // expected and are NOT what WF-003 is about. Allow only those specific surfaces.
  errorSurface.allowUrl(/\/dental\/org\/context/)
  errorSurface.allowUrl(/\/dental\/.*\/(context|members|branches)/)

  try {
    const email = `j24-magic-${Date.now()}@example.org`

    // ── DOM drive: request the magic link through the patient-facing UI. ──────────
    await page.goto(`${APP}/auth/sign-in`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Sign in with Magic Link' }).click()
    await page.waitForURL(/\/auth\/magic-link/, { timeout: 10_000 })
    await page.fill('input[name="email"]', email)

    const [reqResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/auth\/sign-in\/magic-link/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.getByRole('button', { name: /Send magic link/i }).click(),
    ])
    expect(reqResp.status(), 'POST /auth/sign-in/magic-link must be 200').toBe(200)

    // ── Consume the link the way the patient does: open it from their inbox. ──────
    const verifyUrl = await pollMailpitForMagicLink(email)
    await page.goto(verifyUrl)
    await page.waitForLoadState('networkidle')

    // ── Independent read (Rule 2): a durable session exists for THIS patient. ─────
    // page.request shares the browser's cookie jar, so this reads the session the
    // UI-driven magic-link flow actually established (not apiReader's seed session).
    const sess = await page.request.get(`${API}/auth/get-session`)
    expect(sess.ok(), `GET /auth/get-session → ${sess.status()}`).toBe(true)
    const body = (await sess.json()) as { user?: { email?: string } } | null
    expect(
      body?.user?.email,
      'WF-003: the magic-link sign-in must establish a durable session for the patient email',
    ).toBe(email)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
