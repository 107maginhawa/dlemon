/**
 * J33 — Continuous booking → check-in → draft visit, all through the DOM.
 *
 * Covers G7-1 (`G7-1-booking-to-checkin-to-visit-continuous-journey`): J17 books
 * and stops at `scheduled`; J31 checks in but on an API-SEEDED appointment. No
 * journey chained book → check-in → visit, so the scheduling↔visit hand-off was
 * never exercised from a UI-BOOKED appointment. This journey books a walk-in for
 * today via the New Appointment modal (the walk-in toggle bypasses the
 * working-hours gate, so the flow is robust on any weekday), then checks THAT
 * card in and proves a draft visit was created.
 *
 * Anti-Cheating Rules: both the booking (modal) and the check-in (calendar card)
 * are performed DOM-only; the goal state (a draft visit linked to the booked
 * appointment) is read back via a SEPARATE apiReader GET. A dedicated patient is
 * seeded so no parallel visit journey leaves it with an in-progress visit (409).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §DoD (all 4 clauses)
 * Persona: dentist (dentist_owner — book + check-in capable). Expected: PASS.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import type { APIRequestContext } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J33',
  name: 'Book a walk-in via the modal → check it in → a draft visit is created',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-007', 'WF-SCH-001'],
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function post(api: APIRequestContext, path: string, data: unknown): Promise<any> {
  const r = await api.post(path, { data })
  if (!r.ok()) throw new Error(`POST ${path} → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    // ── Precondition seeding (independent writes — browser not yet open) ──────
    const { branchId, memberId } = await readOrgContext(apiReader)

    // A DEDICATED patient (never the shared seed roster) so a parallel visit
    // journey can never strand it with an in-progress visit → check-in 409.
    const stamp = Date.now()
    const patient = await post(apiReader, '/dental/patients', {
      displayName: `J33 Continuous ${stamp}`,
      dateOfBirth: '1992-02-02',
      gender: 'female',
      consentGiven: true,
      branchId,
    })
    const patientId: string = patient.id ?? patient.data?.id
    if (!patientId) throw new Error('J33: patient response carried no id')

    const bookYmd = ymd(new Date())
    const marker = `J33 Booking ${stamp}`

    // ── DOM-only journey: BOOK via the New Appointment modal ──────────────────
    await pinAuth(page, 'dentist')
    await page.getByRole('button', { name: /new appointment/i }).first().click()
    await page.waitForURL(/\/calendar/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: /create new appointment/i }).click()
    const modal = page.getByTestId('appointment-modal')
    await expect(modal, 'appointment modal must open').toBeVisible({ timeout: 10_000 })

    await page.locator('#appt-patient-id').fill(patientId)
    await page.locator('#appt-dentist-id').fill(memberId)
    await page.locator('#appt-date').fill(bookYmd)
    await page.locator('#appt-time').fill('10:00')
    await page.locator('#appt-procedure').selectOption('checkup')
    await page.locator('#appt-notes').fill(marker)
    // Walk-in bypasses the working-hours gate so booking TODAY is robust whatever
    // day/time the harness runs (no weekend/closed-hours flake).
    await modal.getByText('Walk-in appointment').click()
    const branchField = page.locator('#appt-branch-id')
    await branchField.fill(branchId)
    await expect(branchField).toHaveValue(branchId)

    await page.getByRole('button', { name: /save appointment/i }).click()
    await expect(modal, 'modal should close after a successful save').toBeHidden({ timeout: 15_000 })

    // Resolve the booked appointment id via an independent read (today's window).
    const todayUtc = ymd(new Date())
    const listRes = await apiReader.get(
      `/dental/appointments?branchId=${branchId}&date_from=${todayUtc}&date_to=${todayUtc}`,
    )
    expect(listRes.ok(), `appointments list → ${listRes.status()}`).toBe(true)
    const listBody = await listRes.json()
    const listItems: any[] = Array.isArray(listBody) ? listBody : (listBody.items ?? listBody.data ?? [])
    const booked = listItems.find((a) => a.patientId === patientId && a.notes === marker)
    expect(booked, `the UI-booked appointment (notes "${marker}") must persist`).toBeTruthy()
    expect(booked.status, 'the booked appointment must be scheduled (check-in-eligible)').toBe('scheduled')
    const appointmentId: string = booked.id

    // ── DOM-only journey: CHECK IN that same card ─────────────────────────────
    const card = page.getByTestId(`appt-draggable-${appointmentId}`)
    await expect(card, 'the booked appointment must render on the calendar day grid').toBeVisible({
      timeout: 15_000,
    })
    await card.hover()
    const checkInBtn = card.getByRole('button', { name: /check in/i })
    await expect(checkInBtn, 'the Check In control must appear on the card').toBeVisible({ timeout: 5_000 })
    await checkInBtn.click()
    await expect(page.getByText('Patient checked in'), 'a success toast must confirm the check-in').toBeVisible({
      timeout: 10_000,
    })

    // ── Independent read: the check-in must have persisted a draft visit ──────
    const apptRes = await apiReader.get(
      `/dental/appointments?branchId=${branchId}&date_from=${todayUtc}&date_to=${todayUtc}`,
    )
    expect(apptRes.ok(), `appointments list → ${apptRes.status()}`).toBe(true)
    const body = await apptRes.json()
    const items: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
    const mine = items.find((a) => a.id === appointmentId)
    expect(mine, 'the checked-in appointment must be present in the durable read').toBeTruthy()
    expect(mine.status, 'appointment must be durably checked_in').toBe('checked_in')
    expect(mine.visitId, 'check-in must link a created visit to the booked appointment').toBeTruthy()

    const visitRes = await apiReader.get(`/dental/visits/${mine.visitId}`)
    expect(visitRes.ok(), `visit read → ${visitRes.status()}`).toBe(true)
    const visitBody = await visitRes.json()
    const visit = visitBody.data ?? visitBody
    expect(visit.status, 'the created visit must persist as a draft').toBe('draft')
    expect(visit.patientId, 'the created visit must belong to the booked patient').toBe(patientId)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
