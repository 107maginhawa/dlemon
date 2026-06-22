/**
 * J34 — Front-desk fills a short-notice slot from the waitlist.
 *
 * Covers G7-2 (`G7-2-waitlist-promotion-to-appointment-e2e`): promoteWaitlistEntry
 * atomically books an appointment and flips the entry to `scheduled`, and the
 * WaitlistPanel drives Fill-slot → Book-slot → promote — but no journey/E2E ever
 * drove that DOM flow (coverage was BE-unit + FE-unit predicate only).
 *
 * Anti-Cheating Rules: the promotion is performed DOM-only (open the waitlist
 * panel, Fill slot, pick date/time, Book slot); the goal state is read back via a
 * SEPARATE apiReader GET — (a) the entry has left the ACTIVE waitlist and (b) a
 * scheduled appointment now exists for that patient. Precondition seeding (a fresh
 * patient + an active waitlist entry) is the only allowed non-DOM write.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §DoD
 * Persona: dentist (dentist_owner — booking-capable). Expected: PASS.
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
  id: 'J34',
  name: 'Fill a short-notice slot from the waitlist → entry promoted to a scheduled appointment',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-SCH-001'],
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

    const stamp = Date.now()
    const marker = `J34 Waitlist ${stamp}`
    const patient = await post(apiReader, '/dental/patients', {
      displayName: `J34 Waiting ${stamp}`,
      dateOfBirth: '1995-03-03',
      gender: 'female',
      consentGiven: true,
      branchId,
    })
    const patientId: string = patient.id ?? patient.data?.id
    if (!patientId) throw new Error('J34: patient response carried no id')

    // An ACTIVE waitlist entry the front desk can fill. notes carries the marker so
    // the promoted appointment (promote copies the entry notes) is matchable.
    const entry = await post(apiReader, `/dental/branches/${branchId}/waitlist`, {
      patientId,
      preferredProviderId: memberId,
      visitType: 'checkup',
      urgency: 'asap',
      notes: marker,
    })
    const entryId: string = entry.id ?? entry.data?.id
    if (!entryId) throw new Error('J34: waitlist entry response carried no id')

    // promoteWaitlistEntry has no working-hours gate (front-desk override), so any
    // future date/time books cleanly. Use a far-future date to dodge a soft
    // double-booking overlap with the dense seed schedule.
    const fillDate = new Date()
    fillDate.setDate(fillDate.getDate() + 12)
    const fillYmd = ymd(fillDate)

    // ── DOM-only journey ─────────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/calendar')

    // Open the waitlist slide-over.
    await page.getByRole('button', { name: /toggle waitlist/i }).click()
    await expect(page.getByTestId('waitlist-panel'), 'the waitlist panel must open').toBeVisible({
      timeout: 10_000,
    })

    // Our seeded entry must be in the active list; open its fill form.
    const fillBtn = page.getByTestId(`waitlist-fill-${entryId}`)
    await expect(fillBtn, 'the seeded waitlist entry must render with a Fill slot control').toBeVisible({
      timeout: 10_000,
    })
    await fillBtn.click()

    // Pick date + time (provider is pre-filled from the entry's preferredProviderId).
    await page.getByTestId('waitlist-date').fill(fillYmd)
    await page.getByTestId('waitlist-time').fill('10:00')
    await expect(page.getByTestId('waitlist-provider'), 'provider must be pre-filled from the entry').toHaveValue(
      memberId,
    )

    const bookBtn = page.getByTestId(`waitlist-book-${entryId}`)
    await expect(bookBtn, 'the Book slot control must be enabled').toBeEnabled()
    await bookBtn.click()

    // UI completion signal — handlePromote toasts only after the promote resolves.
    await expect(
      page.getByText('Slot filled from the waitlist'),
      'a success toast must confirm the promotion',
    ).toBeVisible({ timeout: 10_000 })

    // ── Independent read 1: the entry has left the ACTIVE waitlist ────────────
    const activeRes = await apiReader.get(`/dental/branches/${branchId}/waitlist?status=active`)
    expect(activeRes.ok(), `active waitlist → ${activeRes.status()}`).toBe(true)
    const activeBody = await activeRes.json()
    const activeItems: any[] = Array.isArray(activeBody) ? activeBody : (activeBody.items ?? activeBody.data ?? [])
    expect(
      activeItems.some((e) => e.id === entryId),
      'the promoted entry must no longer appear in the ACTIVE waitlist',
    ).toBe(false)

    // ── Independent read 2: a scheduled appointment now exists for the patient ─
    const from = ymd(new Date())
    const apptRes = await apiReader.get(
      `/dental/appointments?branchId=${branchId}&date_from=${from}&date_to=${fillYmd}`,
    )
    expect(apptRes.ok(), `appointments list → ${apptRes.status()}`).toBe(true)
    const apptBody = await apptRes.json()
    const apptItems: any[] = Array.isArray(apptBody) ? apptBody : (apptBody.items ?? apptBody.data ?? [])
    const booked = apptItems.find((a) => a.patientId === patientId && a.notes === marker)
    expect(booked, `the promotion must have booked a scheduled appointment (notes "${marker}")`).toBeTruthy()
    expect(booked.status, 'the booked appointment must be scheduled').toBe('scheduled')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
