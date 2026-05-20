/**
 * J03 — Periodontal charting linked to odontogram.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J03
 * Rubric: J3; Q11–Q14, Q16 (I2 invariant). Persona: dentist.
 * Expected verdict: BROKEN (provisional → resolve against rendered DOM).
 * P0 ref: Gap #7 (perio decoupled / probing missing teeth).
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
  id: 'J03',
  name: 'Periodontal charting linked to odontogram',
  set: 'A',
  expectedVerdict: 'BROKEN',
  rubricIds: ['Q11', 'Q12', 'Q13', 'Q14', 'Q16'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.roberto)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open the perio entry surface for the patient.
    const perioEntry = page
      .getByRole('button', { name: /perio|periodontal|probing/i })
      .or(page.getByTestId('perio-tab-btn'))
      .first()

    if (!(await perioEntry.count())) {
      // Anti-Cheating Rule 3: required UI surface absent ⇒ BROKEN.
      await expectJourneyBroken(
        page,
        META,
        'No dedicated periodontal capture surface found in the workspace route ' +
          '(no perio/probing affordance in the rendered DOM). Gap #7 confirmed: ' +
          'the journey cannot complete through the UI — no shortcut taken.',
      )
      return
    }

    await perioEntry.click()
    await page.waitForLoadState('networkidle')

    const perioGrid = page.locator('[data-testid="perio-grid"], [data-testid="perio-chart"]').first()
    if (!(await perioGrid.isVisible().catch(() => false))) {
      await expectJourneyBroken(
        page,
        META,
        'Perio entry control exists but no perio grid/chart renders — capture ' +
          'surface unusable. UI step 2-5 impossible (Gap #7).',
      )
      return
    }

    // If the perio surface unexpectedly exists, verify the I2 invariant via
    // independent read: a missing tooth must have NO perio rows.
    const perioResp = await apiReader.get(`/dental/patients/${patientId}/perio`)
    const perioStr = perioResp.ok() ? JSON.stringify(await perioResp.json()) : ''
    const hasTooth19 = /"tooth(Id|Number)?":\s*"?19"?/.test(perioStr)

    await expectJourneyBroken(
      page,
      META,
      hasTooth19
        ? 'Perio surface present and a row exists for missing tooth #19 — I2 invariant violated (data-integrity failure).'
        : 'Perio surface unexpectedly present; independent read shows no rows yet — provisional break held pending full perio-flow verification (Gap #7).',
      { unexpectedlyOk: !hasTooth19 && perioResp.ok() },
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
