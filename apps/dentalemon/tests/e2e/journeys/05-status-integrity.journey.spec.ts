/**
 * J05 — Existing / Existing-Other / TP / Completed status integrity on the
 *        odontogram.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J05
 * Rubric: J5; Q8, Q24, Q25 (Gap #1, I1 invariant). Persona: dentist.
 * Expected verdict: BROKEN.
 * P0 ref: Gap #1 (status-collapse), Gap #2 (no Existing-Other),
 *         P0-001 (Completed unreachable through UI).
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
  id: 'J05',
  name: 'Status integrity on the odontogram (Existing/Existing-Other/TP/Completed)',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q8', 'Q24', 'Q25'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.carlos)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    const carousel = page.getByTestId('workspace-carousel-zone')
    const tooth = getActiveTooth(page)
    if (!(await tooth.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No tooth element to create per-status records. UI step 2 impossible.',
      )
      return
    }
    await tooth.click()

    const slideout = page.locator('[data-testid="tooth-slideout"], [role="dialog"]').first()
    if (!(await slideout.isVisible().catch(() => false))) {
      await expectJourneyBroken(page, META, 'ToothSlideout did not open. UI step 2 impossible.')
      return
    }

    // The slideout must offer DISTINCT status controls for Existing,
    // Existing-Other, TP, Condition. Gap #1/#2: it collapses status.
    const wanted = ['existing', 'existing[- ]other', 'treatment plan|^tp$', 'condition']
    const found = await Promise.all(
      wanted.map((re) =>
        slideout.getByRole('button', { name: new RegExp(re, 'i') }).count(),
      ),
    )
    const missing = wanted.filter((_, i) => found[i] === 0)

    if (missing.length > 0) {
      await expectJourneyBroken(
        page,
        META,
        `Status-collapse (Gap #1/#2): slideout lacks distinct status controls ` +
          `for: ${missing.join(', ')}. Distinct enumerated statuses ` +
          `(Existing ≠ Existing-Other ≠ TP ≠ Condition) are unreachable, and ` +
          `Completed depends on the dead revenue chain (P0-001).`,
      )
      return
    }

    // If all status controls unexpectedly exist, verify distinctness via the
    // independent read.
    const txResp = await apiReader.get(`/dental/patients/${patientId}/treatments`)
    const txStr = txResp.ok() ? JSON.stringify(await txResp.json()) : ''
    const distinct =
      /"status":"existing"/.test(txStr) &&
      /"status":"existing_other"/.test(txStr) &&
      /"status":"(planned|tp)"/.test(txStr)

    if (distinct) {
      // Distinct statuses confirmed via independent read — status-collapse is fixed.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      'Independent read shows statuses are not persisted as distinct enums (Gap #1/#2 confirmed).',
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
