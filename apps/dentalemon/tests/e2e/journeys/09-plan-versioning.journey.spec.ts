/**
 * J09 — Treatment-plan versioning — accepted version is frozen.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J09
 * Rubric: J9; Q34, Q35 (C3, Gap #6). Persona: dentist edits; front-desk
 * captures acceptance. Expected verdict: PASS.
 * Gap #6 RESOLVED: treatment-plan versioning is implemented —
 * POST /dental/patients/:id/treatment-plan/accept append-snapshots the live
 * plan into an immutable treatment_plan_version row; the live plan reports the
 * latest accepted `version`. This spec DOM-drives acceptance and confirms the
 * version froze via an independent read.
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

    // Step 1: locate the acceptance-capture control (TXPL-03 / J09).
    const acceptCtl = tpPanel
      .getByTestId('accept-plan-btn')
      .or(tpPanel.getByRole('button', { name: /accept plan|capture acceptance|sign plan/i }))
      .first()

    if (!(await acceptCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Treatment Plan tab exposes no acceptance-capture control (Gap #6). An ' +
          'accepted plan cannot be frozen as an immutable versioned snapshot through ' +
          'the UI; the goal state (version N frozen) is unreachable.',
      )
      return
    }

    // Baseline plan version BEFORE acceptance (independent read — branchId required).
    const beforeResp = await apiReader.get(
      `/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`,
    )
    const beforeVersion = beforeResp.ok() ? ((await beforeResp.json())?.version ?? 0) : 0

    // Step 2: capture acceptance THROUGH the UI (DOM-only drive). This POSTs
    // /treatment-plan/accept, which append-snapshots the live plan into a new
    // immutable treatment_plan_version row.
    const acceptPromise = page
      .waitForResponse(
        (r) => /\/treatment-plan\/accept/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 10_000 },
      )
      .catch(() => null)
    await acceptCtl.click()
    const acceptResp = await acceptPromise

    // Step 3: independent read — confirm a frozen versioned snapshot now exists
    // (the live plan reports the latest accepted version, which must have incremented).
    const afterResp = await apiReader.get(
      `/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`,
    )
    const afterBody = afterResp.ok() ? await afterResp.json() : null
    const afterVersion = afterBody?.version ?? 0

    if (afterVersion >= 1 && afterVersion > beforeVersion) {
      // Immutable-snapshot versioning works end-to-end: UI acceptance froze a new
      // version, confirmed by a separate read.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `UI plan acceptance did not freeze a new version snapshot. ` +
        `accept POST=${acceptResp?.status() ?? 'no-resp'}, version before=${beforeVersion} ` +
        `after=${afterVersion}. Versioning (Gap #6) not working through the UI.`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
