/**
 * J08 — Informed refusal — declined treatment persisted with reason.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J08
 * Rubric: J4 decision point; Q20 (C4). Persona: front-desk presents;
 * dentist documents. Expected verdict: BROKEN (provisional).
 * P0 ref: Gap #11 (no informed-refusal capture).
 *
 * NOTE: the seed provisions no dedicated front-desk role; this spec uses the
 * `staff` persona (staff_full) as the closest seeded role and records the
 * substitution.
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
  id: 'J08',
  name: 'Informed refusal — declined treatment persisted with reason',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q20'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.carlos)

    // Persona substitution note (no front-desk role seeded).
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    const tpBtn = page.getByRole('button', { name: /treatment plan/i }).first()
    if (!(await tpBtn.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No Treatment Plan affordance — cannot present a plan to decline. Step 1 impossible.',
      )
      return
    }
    await tpBtn.click()
    await page.waitForLoadState('networkidle')
    const tpPanel = page.locator('[data-testid="treatment-plan-tab"], [role="dialog"]').first()

    // Step 2: mark an item declined + enter a refusal reason.
    const declineCtl = tpPanel
      .getByRole('button', { name: /decline|refuse|reject/i })
      .or(tpPanel.locator('[data-testid*="decline"], [data-testid*="refus"]'))
      .first()

    if (!(await declineCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Treatment Plan tab exposes no decline/refusal control with a reason ' +
          'field (Gap #11). Informed refusal cannot be captured through the ' +
          'UI — legally-critical C4 requirement unmet. Goal state (persisted ' +
          'declined status + reason) unreachable.',
      )
      return
    }

    await declineCtl.click()
    const reason = tpPanel.getByRole('textbox').first()
    if (await reason.count()) await reason.fill('Patient declined RCT — cost; opts for extraction.')
    const save = tpPanel.getByRole('button', { name: /save|confirm|done/i }).first()
    if (await save.count()) await save.click()
    await page.waitForLoadState('networkidle')

    const planResp = await apiReader.get(`/dental/patients/${patientId}/treatment-plan`)
    const planStr = planResp.ok() ? JSON.stringify(await planResp.json()) : ''
    const hasDeclined = /"status":"declined"/.test(planStr) && /reason/i.test(planStr)

    if (hasDeclined) {
      // Informed-refusal capture is implemented — declined status + reason persist.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      'Independent read shows no persisted declined status with reason (Gap #11 confirmed).',
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
