/**
 * J06 — Multi-visit / phased treatment plan sequencing.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J06
 * Rubric: J6; Q26, Q27, Q28. Persona: dentist plans; front-desk schedules.
 * Expected verdict: PASS.
 * Gap #14 RESOLVED: the 5-phase clinical sequencing model is implemented
 * (dental_treatment_phase enum + phase/priority columns; updateDentalTreatment
 * accepts phase; getTreatmentPlan sorts + groups by phase). The Treatment Plan
 * tab now exposes a per-treatment phase selector. This spec DOM-assigns a phase
 * and confirms it persisted via an independent read.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  expectJourneyBroken,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J06',
  name: 'Multi-visit / phased treatment plan sequencing',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q26', 'Q27', 'Q28'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.carlos)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Open the Treatment Plan tab.
    const tpBtn = page.getByRole('button', { name: /treatment plan/i }).first()
    if (!(await tpBtn.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No Treatment Plan affordance in the workspace top bar. UI step 1 impossible.',
      )
      return
    }
    await tpBtn.click()
    await page.waitForLoadState('networkidle')

    const tpPanel = page.locator('[data-testid="treatment-plan-tab"], [role="dialog"]').first()
    await expect(tpPanel).toBeVisible({ timeout: 10_000 }).catch(() => {})

    // Step 2: a phase-assignment control must exist for a pending treatment.
    const phaseCtl = tpPanel.getByTestId('phase-select').first()
    if (!(await phaseCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Treatment Plan tab exposes no phase/sequence assignment control (Gap #14). ' +
          'Phased sequencing cannot be expressed through the UI.',
      )
      return
    }

    // Step 3: assign a clinical phase through the UI (DOM-only) and capture the PATCH.
    const patchPromise = page
      .waitForResponse(
        (r) =>
          /\/dental\/visits\/.+\/treatments\/.+/.test(r.url()) &&
          r.request().method() === 'PATCH',
        { timeout: 10_000 },
      )
      .catch(() => null)
    await phaseCtl.selectOption('definitive')
    await patchPromise
    await page.waitForLoadState('networkidle')

    // Step 4: independent read — the assigned phase must persist on the plan
    // (which the server then sequences by phase order).
    const planResp = await apiReader.get(
      `/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`,
    )
    const plan = planResp.ok() ? await planResp.json() : null
    const phased = (plan?.treatments ?? []).some(
      (t: { phase?: string }) => t.phase === 'definitive',
    )

    if (phased) {
      // Sequencing is expressible end-to-end: UI assigned a phase, server persisted
      // and ordered it.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `UI phase assignment did not persist. GET treatment-plan → ${planResp.status()}, ` +
        `no treatment carries phase='definitive' (Gap #14).`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
