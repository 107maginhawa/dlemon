/**
 * J21 — Start a new clinical visit (the curated "must-never-break" New-Visit flow).
 *
 * THIS is the journey the incident exposed as untested. The live app "couldn't add
 * a New Visit" while CI was green because J01 clicked New Visit only
 * `if (count && isEnabled)` — and J01's patient (Juan) ALWAYS has an open visit in
 * the seed, so its New-Visit button is always disabled and the click was always
 * skipped. New-Visit *creation* was therefore never exercised end-to-end.
 *
 * J21 closes that hole with a HARD assertion. It can't lean on a seed patient: the
 * demo seed gives every patient an open visit (active, or — for Diego — a draft
 * with a signed consent that is intentionally NON-discardable), so none are in the
 * "no open visit" state New Visit requires. So J21 registers its OWN throwaway
 * patient (independent-read API write — the allowed pre-journey seeding) who has
 * zero visits, making the precondition deterministic regardless of seed drift:
 *   register patient (0 visits)  →  hard-assert New Visit ENABLED (no silent skip)
 *   →  click  →  require POST /dental/visits = 201  →  button flips DISABLED
 *   →  independent-read exactly 1 open visit (durable persistence).
 *
 * If New Visit breaks (button missing/disabled, or the create doesn't 201) the
 * asserts fail LOUDLY — never a silent pass. Obeys the harness Anti-Cheating Rules:
 * DOM-only drive, independent post-UI read, no state shortcut.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import type { APIRequestContext } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J21',
  name: 'Start a new clinical visit (New Visit → POST /dental/visits 201)',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-VIS-001'],
}

/**
 * List a patient's OPEN visits via the independent reader. The New-Visit gate
 * (timeline-carousel.tsx) treats BOTH `active` and `draft` as open — a visit is
 * created `draft` then transitioned `active`, and either disables New Visit — so
 * "open" here must match that definition exactly.
 */
async function openVisits(
  api: APIRequestContext,
  branchId: string,
  patientId: string,
): Promise<Array<{ id: string; status: string }>> {
  const r = await api.get(`/dental/visits?patientId=${patientId}&branchId=${branchId}`)
  if (!r.ok()) throw new Error(`list visits → ${r.status()}`)
  const body = await r.json()
  const items: Array<{ id: string; status: string }> = Array.isArray(body)
    ? body
    : (body.items ?? body.data ?? [])
  return items.filter((v) => v.status === 'active' || v.status === 'open' || v.status === 'draft')
}

/**
 * Register a throwaway patient with zero visits (pre-journey seeding — the allowed
 * non-DOM write). Guarantees the New-Visit precondition deterministically, free of
 * the demo seed's "every patient already has an open visit" state.
 */
async function registerFreshPatient(api: APIRequestContext, branchId: string): Promise<string> {
  const stamp = Date.now()
  const r = await api.post('/dental/patients', {
    data: {
      displayName: `J21 New-Visit Smoke ${stamp}`,
      dateOfBirth: '1990-01-01',
      gender: 'male',
      consentGiven: true,
      branchId,
    },
  })
  if (!r.ok()) throw new Error(`register patient → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  const created = await r.json()
  const id = created?.id ?? created?.data?.id
  if (!id) throw new Error('register patient: response carried no id')
  return id
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)

    // Setup: a brand-new patient has no visits → New Visit is enabled. Deterministic.
    const patientId = await registerFreshPatient(apiReader, branchId)
    expect(
      (await openVisits(apiReader, branchId, patientId)).length,
      'precondition: a freshly-registered patient has no open visit',
    ).toBe(0)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    const newVisitBtn = page.getByTestId('new-visit-btn')
    await expect(newVisitBtn, 'New Visit affordance must render in the workspace').toBeVisible({
      timeout: 10_000,
    })
    await expect(
      newVisitBtn,
      'New Visit must be ENABLED for a patient with no open visit (regression guard: this is the click the old probe-and-skip silently bypassed)',
    ).toBeEnabled()

    // DOM-only drive: click and REQUIRE the real create write to land 201.
    const [createResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/dental/visits') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      newVisitBtn.click(),
    ])
    expect(createResp.status(), 'POST /dental/visits must return 201 when starting a visit').toBe(
      201,
    )

    // User-visible reflection: starting a visit flips New Visit to DISABLED (an
    // open visit now exists — the same gating J01 relies on).
    await expect(
      newVisitBtn,
      'New Visit must become disabled once a visit is open',
    ).toBeDisabled({ timeout: 10_000 })

    // Independent read (durable persistence): exactly one open visit now exists.
    await expect
      .poll(async () => (await openVisits(apiReader, branchId, patientId)).length, {
        message: 'starting a visit must persist exactly one open visit (independent read)',
        timeout: 10_000,
      })
      .toBe(1)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
