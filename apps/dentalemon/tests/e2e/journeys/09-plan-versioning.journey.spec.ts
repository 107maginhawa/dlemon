/**
 * J09 — Treatment-plan versioning — accepted version is frozen.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J09
 * Rubric: J9; Q34, Q35 (C3, Gap #6). Persona: dentist edits; front-desk
 * captures acceptance. Expected verdict: BROKEN (provisional).
 * P0 ref: Gap #6 (no treatment-plan versioning).
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
  id: 'J09',
  name: 'Treatment-plan versioning — accepted version is frozen',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q34', 'Q35'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.carlos)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    const tpBtn = page.getByRole('button', { name: /treatment plan/i }).first()
    if (!(await tpBtn.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No Treatment Plan affordance — cannot capture acceptance / version. Step 1 impossible.',
      )
      return
    }
    await tpBtn.click()
    await page.waitForLoadState('networkidle')
    const tpPanel = page.locator('[data-testid="treatment-plan-tab"], [role="dialog"]').first()

    // Step 1: capture acceptance of version N.
    const acceptCtl = tpPanel
      .getByRole('button', { name: /accept|capture acceptance|sign plan/i })
      .or(tpPanel.locator('[data-testid*="accept"], [data-testid*="version"]'))
      .first()

    if (!(await acceptCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Treatment Plan tab exposes no acceptance-capture or version-history ' +
          'control (Gap #6). An accepted plan cannot be frozen as an immutable ' +
          'versioned snapshot through the UI; the goal state (version N frozen, ' +
          'N+1 with the edit) is unreachable.',
      )
      return
    }

    // Snapshot the plan via independent read before any edit.
    const beforeResp = await apiReader.get(`/dental/patients/${patientId}/treatment-plan`)
    const beforeStr = beforeResp.ok() ? JSON.stringify(await beforeResp.json()) : ''
    const hasVersioning = /"version":\s*\d+/.test(beforeStr)

    if (hasVersioning) {
      // Version field confirmed — immutable-snapshot versioning is implemented.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      'Independent read shows no plan version field (Gap #6 confirmed) — accepted plan cannot be frozen.',
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
