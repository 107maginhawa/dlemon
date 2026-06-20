/**
 * J17 — Front-desk books an appointment through the calendar UI.
 *
 * Covers the dental-scheduling create flow end-to-end through the rendered DOM
 * (the coverage gap: scheduling UI was never driven by an E2E journey — only
 * backend units + component logic). Obeys the Anti-Cheating Rules: the booking
 * is performed DOM-only via the New Appointment modal; the goal state is then
 * asserted via an INDEPENDENT apiReader GET of /dental/appointments.
 *
 * Persona: dentist (seed only provisions dentist_owner + staff_full PINs; a
 * dentist_owner can book). Expected verdict: PASS.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J17',
  name: 'Front-desk books an appointment via the calendar UI',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-SCH-001'],
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    // Precondition resolution (independent read — browser not yet open).
    const { branchId, memberId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.diego)

    // visitType is an enum (checkup/treatment/emergency/recall); use a valid one
    // and carry a distinctive marker in NOTES so the independent read can match
    // THIS booking unambiguously (not a seeded appointment).
    const marker = `E2E Booking ${Date.now()}`
    const bookDate = new Date()
    bookDate.setDate(bookDate.getDate() + 7)
    // Land on a weekday: seeded branch hours close Sunday and shorten Saturday, so a
    // weekend 10:00 slot can 422 OUTSIDE_WORKING_HOURS depending on the calendar date
    // CI runs on — which leaves the modal open and flakes the close assertion below.
    while (bookDate.getDay() === 0 || bookDate.getDay() === 6) {
      bookDate.setDate(bookDate.getDate() + 1)
    }
    const bookYmd = ymd(bookDate)

    // ── DOM-only journey ──────────────────────────────────────────────────
    // dentist lands on /dashboard. The _dashboard guard requires an IN-MEMORY
    // pinSession that a hard page.goto would wipe → reach /calendar via the
    // dashboard's "New Appointment" quick action (client-side nav, no reload).
    await pinAuth(page, 'dentist')
    await page.getByRole('button', { name: /new appointment/i }).first().click()
    await page.waitForURL(/\/calendar/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    // Open the New Appointment modal from the calendar toolbar.
    await page.getByRole('button', { name: /create new appointment/i }).click()
    const modal = page.getByTestId('appointment-modal')
    await expect(modal, 'appointment modal must open').toBeVisible({ timeout: 10_000 })

    // Fill the form (IDs are plain text inputs in this build). The modal resets
    // branchId from the (un-hydrated) org-context store on open, so fill the
    // branch field LAST and assert it stuck before saving — an empty branchId is
    // dropped by the SDK and the backend then rejects it.
    await page.locator('#appt-patient-id').fill(patientId)
    await page.locator('#appt-dentist-id').fill(memberId)
    await page.locator('#appt-date').fill(bookYmd)
    await page.locator('#appt-time').fill('10:00')
    // #appt-procedure is a constrained <select> (QA-009: serviceType enum
    // checkup|treatment|emergency|recall), not a free-text input — selectOption.
    await page.locator('#appt-procedure').selectOption('checkup')
    await page.locator('#appt-notes').fill(marker)
    const branchField = page.locator('#appt-branch-id')
    await branchField.fill(branchId)
    await expect(branchField).toHaveValue(branchId)

    await page.getByRole('button', { name: /save appointment/i }).click()

    // Modal closes on success. 15s (not 10s): it only closes after the create POST
    // resolves, and under CI load that round-trip + re-render can exceed a 10s budget
    // (same flake class as the J10 hardening).
    await expect(modal, 'modal should close after a successful save').toBeHidden({ timeout: 15_000 })

    // ── Independent read: the appointment must have persisted ──────────────
    const from = ymd(new Date())
    const to = new Date()
    to.setDate(to.getDate() + 25) // keep the window ≤ 31 days (API constraint)
    const res = await apiReader.get(
      `/dental/appointments?branchId=${branchId}&date_from=${from}&date_to=${ymd(to)}`,
    )
    expect(res.ok(), `appointments list → ${res.status()}`).toBe(true)
    const body = await res.json()
    const items: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
    const mine = items.find((a) => a.patientId === patientId && a.notes === marker)
    expect(
      mine,
      `the booked appointment (patient ${patientId}, notes "${marker}") must persist`,
    ).toBeTruthy()
    expect(mine.status).toBe('scheduled')
    expect(mine.visitType).toBe('checkup')

    // WF-024: assert the booked appointment actually RENDERS on the calendar grid —
    // not just that listAppointments returns it. Navigate the day view from today to
    // the booked date (deterministic # of "Next day" clicks) and find its card.
    const deltaDays = Math.round((Date.parse(bookYmd) - Date.parse(ymd(new Date()))) / 86_400_000)
    for (let i = 0; i < deltaDays; i++) {
      await page.getByRole('button', { name: 'Next day' }).click()
    }
    await expect(
      page.getByTestId(`appt-draggable-${mine.id}`),
      'the booked appointment must render on the calendar day grid (WF-024)',
    ).toBeVisible({ timeout: 10_000 })

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
