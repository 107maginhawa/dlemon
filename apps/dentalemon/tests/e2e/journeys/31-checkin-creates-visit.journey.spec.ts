/**
 * J31 — Front-desk checks a patient in from the calendar → a clinical visit is created.
 *
 * Covers WF-007 (the last tracked core doctor-visit WF gap) end-to-end through the
 * rendered DOM: the Check-In control on a calendar appointment card is a hover
 * action, and until now only a fetch-driven spec (patient-checkin.spec.ts, not in
 * this harness) exercised it. This journey DRIVES the real hover→click on the card
 * and proves the goal state via an INDEPENDENT read:
 *   - the appointment is durably 'checked_in' with a linked visitId, and
 *   - that visit persisted as a 'draft' for this patient.
 *
 * Anti-Cheating Rules: the check-in is performed DOM-only (hover the card, click
 * "Check In"); the goal state is read back via a SEPARATE apiReader GET after the
 * UI flow. Precondition seeding (a fresh patient + a walk-in appointment for today)
 * is the only allowed non-DOM write — a DEDICATED patient so a parallel visit
 * journey (J21/J22/J23 on the shared seed patient) can never make this check-in
 * 409 with CHECKIN_ACTIVE_VISIT.
 *
 * Persona: dentist (dentist_owner — a check-in-capable role). Expected: PASS.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  spaNavigate,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import type { APIRequestContext } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J31',
  name: 'Check a patient in from the calendar card → a draft visit is created',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-007'],
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

    // A dedicated patient — never the shared seed roster — so no parallel visit
    // journey leaves this patient with an in-progress visit (which would 409).
    const stamp = Date.now()
    const patient = await post(apiReader, '/dental/patients', {
      displayName: `J31 Walk-In ${stamp}`,
      dateOfBirth: '1990-01-01',
      gender: 'female',
      consentGiven: true,
      branchId,
    })
    const patientId: string = patient.id ?? patient.data?.id
    if (!patientId) throw new Error('J31: patient response carried no id')

    // A walk-in appointment for TODAY so it lands on the calendar's default day
    // view. walkIn:true bypasses the working-hours gate (BR-SCH-002) so the seed
    // is robust whatever day/time the harness runs. 03:00Z = 11:00 in the
    // browser's pinned Asia/Manila TZ → renders mid-grid (07:00–22:00); the day's
    // list window is [today,today] in UTC, which contains 03:00Z.
    const todayUtc = new Date().toISOString().slice(0, 10)
    const appt = await post(apiReader, '/dental/appointments', {
      patientId,
      branchId,
      providerId: memberId,
      startAt: `${todayUtc}T03:00:00.000Z`,
      endAt: `${todayUtc}T03:30:00.000Z`,
      visitType: 'checkup',
      walkIn: true,
      notes: `J31 ${stamp}`,
    })
    const appointmentId: string = appt.id
    if (!appointmentId) throw new Error('J31: appointment response carried no id')
    expect(appt.status, 'seeded appointment must be scheduled (check-in-eligible)').toBe('scheduled')

    // ── DOM-only journey ─────────────────────────────────────────────────────
    // dentist lands on /dashboard. SPA-navigate to /calendar (history.pushState)
    // so the in-memory PIN session survives — a hard goto would bounce to pin-select.
    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/calendar')

    // The day view (default = today) renders our appointment card.
    const card = page.getByTestId(`appt-draggable-${appointmentId}`)
    await expect(card, 'the seeded appointment must render on the calendar day grid').toBeVisible({
      timeout: 15_000,
    })

    // The Check-In control is a hover action on the card.
    await card.hover()
    const checkInBtn = card.getByRole('button', { name: /check in/i })
    await expect(checkInBtn, 'the Check In control must appear on the card').toBeVisible({ timeout: 5_000 })
    await checkInBtn.click()

    // UI completion signal (the action resolved without surfacing an error toast).
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
    expect(mine.visitId, 'check-in must link a created visit to the appointment').toBeTruthy()

    const visitRes = await apiReader.get(`/dental/visits/${mine.visitId}`)
    expect(visitRes.ok(), `visit read → ${visitRes.status()}`).toBe(true)
    const visitBody = await visitRes.json()
    const visit = visitBody.data ?? visitBody
    expect(visit.status, 'the created visit must persist as a draft').toBe('draft')
    expect(visit.patientId, 'the created visit must belong to the checked-in patient').toBe(patientId)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
