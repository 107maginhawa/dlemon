/**
 * J06 — Multi-visit / phased treatment plan sequencing.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J06
 * Rubric: J6; Q26, Q27, Q28. Persona: dentist plans; front-desk schedules.
 * Expected verdict: BROKEN (provisional). P0 ref: Gap #14 (no sequencing).
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
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J06',
  name: 'Multi-visit / phased treatment plan sequencing',
  set: 'A',
  expectedVerdict: 'BROKEN',
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

    // Step 2: a phase / sequence / priority assignment control must exist.
    const phaseCtl = tpPanel
      .getByRole('button', { name: /phase|sequence|priority/i })
      .or(tpPanel.locator('[data-testid*="phase"], [data-testid*="sequence"]'))
      .first()

    if (!(await phaseCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Treatment Plan tab exposes no phase/sequence/priority assignment ' +
          'controls (Gap #14). Phased sequencing cannot be expressed through ' +
          'the UI; the goal state (persisted phase/sequence fields) is ' +
          'unreachable. No out-of-order warning surface either.',
      )
      return
    }

    const planResp = await apiReader.get(`/dental/patients/${patientId}/treatment-plan`)
    const planStr = planResp.ok() ? JSON.stringify(await planResp.json()) : ''
    const hasPhase = /"(phase|sequence|priority)":/.test(planStr)

    await expectJourneyBroken(
      page,
      META,
      hasPhase
        ? 'Phase/sequence/priority fields persisted — sequencing may be implemented.'
        : 'Independent read shows treatment plan is a flat unordered list with no phase/sequence fields (Gap #14 confirmed).',
      { unexpectedlyOk: hasPhase },
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
