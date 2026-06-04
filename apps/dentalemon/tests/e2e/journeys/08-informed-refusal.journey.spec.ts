/**
 * J08 — Informed refusal — declined treatment persisted with reason.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J08
 * Rubric: J4 decision point; Q20 (C4). Persona: dentist documents.
 * Expected verdict: PASS.
 * P0 ref: Gap #11 (informed-refusal capture) — now IMPLEMENTED (verified live):
 *         the Treatment Plan sheet renders a Decline control + refusal-reason
 *         field per pending treatment, wired to PATCH status='declined' +
 *         refusalReason. This spec drives that flow DOM-only and asserts the
 *         goal state via an INDEPENDENT read.
 *
 * Patient: Ana Reyes (P5) has a non-empty pending plan (diagnosed + planned).
 * The prior probe used Carlos, whose plan is empty, so the Decline control
 * never rendered — a seed-selection bug, not a missing feature.
 *
 * NOTE: the seed provisions no dedicated front-desk role; the dentist persona
 * documents the refusal.
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

const REFUSAL_REASON = 'Patient declined RCT — cost; opts for extraction.'

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.ana)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open the Treatment Plan sheet from the top bar.
    const tpBtn = page.getByRole('button', { name: /treatment plan/i }).first()
    await expect(tpBtn, 'workspace must expose a Treatment Plan affordance').toBeVisible({
      timeout: 10_000,
    })
    await tpBtn.click()

    // The plan sheet must mount with the patient's pending treatments.
    const tpPanel = page.getByTestId('treatment-plan-tab')
    await expect(tpPanel, 'Treatment Plan sheet must render the pending plan').toBeVisible({
      timeout: 10_000,
    })

    // Step 2: a Decline (informed-refusal) control must exist for a pending item.
    const declineCtl = tpPanel.getByTestId('decline-btn').first()
    await expect(
      declineCtl,
      'Treatment Plan must expose a Decline / informed-refusal control (Gap #11)',
    ).toBeVisible()
    await declineCtl.click()

    // A refusal-reason field is legally required (C4); document the reason.
    const reasonField = tpPanel.getByLabel(/refusal reason/i).first()
    await expect(reasonField, 'Decline must require a refusal-reason field').toBeVisible()
    await reasonField.fill(REFUSAL_REASON)

    // Step 3: confirm the refusal.
    await tpPanel.getByTestId('confirm-decline-btn').first().click()
    await page.waitForLoadState('networkidle')

    // ── Independent read: goal state persisted (declined status + reason) ──────
    const planResp = await apiReader.get(
      `/dental/patients/${patientId}/treatment-plan?branchId=${branchId}`,
    )
    expect(planResp.ok(), `treatment-plan read → ${planResp.status()}`).toBe(true)
    const plan = await planResp.json()
    const declined = (plan.treatments ?? []).find(
      (t: { status?: string }) => t.status === 'declined',
    )
    expect(
      declined,
      'a treatment must be persisted with status=declined after the refusal',
    ).toBeTruthy()
    expect(
      String(declined.reason ?? ''),
      'the declined treatment must persist the exact refusal reason entered in the UI',
    ).toContain('extraction')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
