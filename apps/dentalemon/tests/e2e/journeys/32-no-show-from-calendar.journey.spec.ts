/**
 * J32 — Front-desk marks a patient as a no-show from the calendar card.
 *
 * Covers G7-3 (production-readiness gap `G7-3-no-show-to-recall-reengagement-journey`):
 * the "No Show" control on a calendar appointment card was never DOM-driven by a
 * journey — only fsm-matrix + BE-unit + FE-unit predicates touched the transition.
 * No-show → recall is a HUMAN workflow (there is no automated coupling), so the
 * clinically-meaningful goal state here is that the No-Show card action durably
 * transitions the appointment to `no_show`.
 *
 * Anti-Cheating Rules: the no-show is performed DOM-only (hover the card, click
 * "No Show"); the goal state is read back via a SEPARATE apiReader GET after the
 * UI flow. Precondition seeding (a fresh patient + a walk-in appointment for
 * today) is the only allowed non-DOM write — a DEDICATED patient so no parallel
 * journey contends for it.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §DoD
 * Persona: dentist (dentist_owner — a status-transition-capable role). Expected: PASS.
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
  id: 'J32',
  name: 'Mark a patient as no-show from the calendar card → durably no_show',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-SCH-001'],
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

    const stamp = Date.now()
    // NB: keep "no-show" OUT of the patient name — it would pollute the button
    // selector below (every action button's aria-label embeds the patient name).
    const patient = await post(apiReader, '/dental/patients', {
      displayName: `J32 Walkout ${stamp}`,
      dateOfBirth: '1988-05-05',
      gender: 'male',
      consentGiven: true,
      branchId,
    })
    const patientId: string = patient.id ?? patient.data?.id
    if (!patientId) throw new Error('J32: patient response carried no id')

    // A walk-in appointment for TODAY (walkIn bypasses the working-hours gate so
    // the seed is robust whatever day the harness runs). 03:00Z = 11:00 in the
    // pinned Asia/Manila TZ → renders mid-grid; the day window [today,today] in
    // UTC contains 03:00Z. Same recipe as J31.
    const todayUtc = new Date().toISOString().slice(0, 10)
    const appt = await post(apiReader, '/dental/appointments', {
      patientId,
      branchId,
      providerId: memberId,
      startAt: `${todayUtc}T03:00:00.000Z`,
      endAt: `${todayUtc}T03:30:00.000Z`,
      visitType: 'checkup',
      walkIn: true,
      notes: `J32 ${stamp}`,
    })
    const appointmentId: string = appt.id
    if (!appointmentId) throw new Error('J32: appointment response carried no id')
    expect(appt.status, 'seeded appointment must be scheduled (no-show-eligible)').toBe('scheduled')

    // ── DOM-only journey ─────────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/calendar')

    const card = page.getByTestId(`appt-draggable-${appointmentId}`)
    await expect(card, 'the seeded appointment must render on the calendar day grid').toBeVisible({
      timeout: 15_000,
    })

    // The "No Show" control is a hover action on the card.
    await card.hover()
    // The button's accessible name is its aria-label "Mark <name> as no-show";
    // anchor on the suffix so it can't collide with the card or sibling buttons.
    const noShowBtn = card.getByRole('button', { name: /as no-show$/i })
    await expect(noShowBtn, 'the No Show control must appear on the card').toBeVisible({ timeout: 5_000 })
    await noShowBtn.click()

    // UI completion signal — handleNoShow uses throwOnError, so this success toast
    // only renders if the PATCH actually returned 2xx.
    await expect(
      page.getByText('Marked as no-show'),
      'a success toast must confirm the no-show',
    ).toBeVisible({ timeout: 10_000 })

    // ── Independent read: the appointment must persist as no_show ─────────────
    const apptRes = await apiReader.get(
      `/dental/appointments?branchId=${branchId}&date_from=${todayUtc}&date_to=${todayUtc}`,
    )
    expect(apptRes.ok(), `appointments list → ${apptRes.status()}`).toBe(true)
    const body = await apptRes.json()
    const items: any[] = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
    const mine = items.find((a) => a.id === appointmentId)
    expect(mine, 'the no-show appointment must be present in the durable read').toBeTruthy()
    expect(mine.status, 'appointment must be durably no_show').toBe('no_show')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
