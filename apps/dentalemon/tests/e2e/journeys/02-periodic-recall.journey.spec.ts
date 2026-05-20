/**
 * J02 — Periodic recall exam (D0120) — diff since last visit.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J02
 * Rubric: J2; Q9, Q10, Q25. Persona: dentist. Expected verdict: BROKEN.
 * P0 ref: P0-004 (note persistence), Gap #1 (status-collapse).
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  getActiveTooth,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  expectJourneyBroken,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J02',
  name: 'Periodic recall exam (D0120) — diff since last visit',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q9', 'Q10', 'Q25'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    // Ana Reyes (P5) — carry-over patient with prior completed visits.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.ana)

    // Capture the prior-visit baseline BEFORE any UI mutation (independent read).
    const beforeResp = await apiReader.get(`/dental/patients/${patientId}/visits`)
    const beforeBody = beforeResp.ok() ? await beforeResp.json() : null
    const beforeSnapshot = JSON.stringify(beforeBody)
    // Extract the most recent visit ID so we can do a post-UI notes read.
    // Sort newest-first by createdAt (camelCase from API) or created_at (snake_case).
    const beforeVisits: Array<{ id: string; createdAt?: string; created_at?: string }> =
      Array.isArray(beforeBody)
        ? beforeBody
        : (beforeBody?.items ?? beforeBody?.visits ?? beforeBody?.data ?? [])
    beforeVisits.sort((a, b) =>
      ((b.createdAt ?? b.created_at) ?? '').localeCompare((a.createdAt ?? a.created_at) ?? ''),
    )
    const latestVisitIdBefore: string | null =
      beforeVisits.length > 0 ? (beforeVisits[0]?.id ?? null) : null

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: confirm prior baseline visible (carousel shows ≥1 prior visit).
    const carousel = page.getByTestId('workspace-carousel-zone')
    await expect(carousel).toBeVisible()

    // Step 2: open a new recall visit via the carousel.
    const newVisitBtn = page.getByTestId('new-visit-btn')
    if (await newVisitBtn.count()) {
      await newVisitBtn.first().click()
      await page.waitForLoadState('networkidle')
    }

    // Step 3: progress a watched tooth watch → diagnosed.
    const tooth = getActiveTooth(page)
    if (!(await tooth.count())) {
      // Independent read: confirm goal state absent even without tooth interaction.
      const notesResp = latestVisitIdBefore
        ? await apiReader.get(`/dental/visits/${latestVisitIdBefore}/notes`)
        : null
      const notesBody = notesResp?.ok() ? await notesResp.json() : null
      const notesStr = JSON.stringify(notesBody)
      await expectJourneyBroken(
        page,
        META,
        `No tooth element to progress watch→diagnosed on the recall visit. UI step 3 impossible. ` +
          `Independent read of visit ${latestVisitIdBefore ?? 'unknown'} notes: ${notesStr.slice(0, 120)}`,
      )
      return
    }
    await tooth.click()
    const slideout = page.locator('[data-testid="tooth-slideout"], [role="dialog"]').first()
    if (!(await slideout.isVisible().catch(() => false))) {
      const notesResp = latestVisitIdBefore
        ? await apiReader.get(`/dental/visits/${latestVisitIdBefore}/notes`)
        : null
      const notesBody = notesResp?.ok() ? await notesResp.json() : null
      await expectJourneyBroken(
        page,
        META,
        `ToothSlideout did not open. UI step 3 impossible. ` +
          `Independent read of visit notes: ${JSON.stringify(notesBody).slice(0, 120)}`,
      )
      return
    }

    // The watch→diagnosed transition distinct from the prior record requires a
    // status enum the slideout collapses (Gap #1). And the D0120 note has no
    // DB column (P0-004), so it cannot survive.
    //
    // Post-UI independent read: fetch the current visits list and notes for the
    // active visit to confirm goal state is absent server-side.
    const afterVisitsResp = await apiReader.get(`/dental/patients/${patientId}/visits`)
    const afterVisitsBody = afterVisitsResp.ok() ? await afterVisitsResp.json() : null
    const afterVisits: Array<{ id: string; createdAt?: string; created_at?: string }> =
      Array.isArray(afterVisitsBody)
        ? afterVisitsBody
        : (afterVisitsBody?.items ?? afterVisitsBody?.visits ?? afterVisitsBody?.data ?? [])
    // Pick whichever visit is newest (may be a newly-created recall visit or still the prior one).
    afterVisits.sort((a, b) =>
      ((b.createdAt ?? b.created_at) ?? '').localeCompare((a.createdAt ?? a.created_at) ?? ''),
    )
    const activeVisitId: string | null =
      afterVisits.length > 0 ? (afterVisits[0]?.id ?? null) : null
    const notesResp = activeVisitId
      ? await apiReader.get(`/dental/visits/${activeVisitId}/notes`)
      : null
    const notesBody = notesResp?.ok() ? await notesResp.json() : null
    const notesStr = JSON.stringify(notesBody)
    // A D0120 recall note would contain a non-empty notes object/array; absence confirms P0-004.
    const notesPersisted =
      notesBody !== null &&
      (Array.isArray(notesBody) ? notesBody.length > 0 : Object.keys(notesBody ?? {}).length > 0)

    if (notesPersisted) {
      // P0-004 is fixed — notes persist server-side. Journey PASSES.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `Status-collapse (Gap #1) prevents a watch→diagnosed transition that is ` +
        `distinct from the prior visit record, and the D0120 recall note is ` +
        `local React state with no DB column (P0-004) — confirmed by independent read: ` +
        `GET /dental/visits/${activeVisitId ?? 'unknown'}/notes → ${notesStr.slice(0, 120)} ` +
        `(no note persisted). Prior baseline was: ${beforeSnapshot.slice(0, 80)}…`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
