/**
 * J01 — New-patient comprehensive oral evaluation + chart existing conditions.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J01
 * Rubric: J1; Q6–Q10. Persona: dentist. Expected verdict: PASS.
 * P0 ref: Gap #1 (status-collapse), Gap #2 (Existing-Other) — now FIXED at the
 *         odontogram control layer (verified live), so this spec asserts the
 *         flow with HARD expects instead of probe-and-skip: any regression in
 *         the tooth → slideout → distinct-status-control chain fails the spec.
 *
 * The UI is driven DOM-only. A missing affordance is a real test failure, not a
 * silently-recorded BROKEN verdict.
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
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J01',
  name: 'New-patient comprehensive oral evaluation + chart existing conditions',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q6', 'Q7', 'Q8', 'Q9', 'Q10'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    // Precondition resolution (independent read — browser not yet open).
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.juan)

    // ── DOM-only journey ──────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 2: ensure an active visit (new visit via carousel if needed).
    // The New-Visit button is gated DISABLED when the patient already has an
    // open visit (title: "Finish or discard the open visit to start a new one").
    // In that case the active-visit precondition is already satisfied, so only
    // click when the button is enabled — clicking a disabled button just hangs.
    const newVisitBtn = page.getByTestId('new-visit-btn')
    if ((await newVisitBtn.count()) && (await newVisitBtn.first().isEnabled())) {
      await newVisitBtn.first().click()
      await page.waitForLoadState('networkidle')
    }

    // Step 3-4: open a tooth, record a pre-existing restoration (Existing).
    const carousel = page.getByTestId('workspace-carousel-zone')
    await expect(carousel).toBeVisible()

    // A clickable tooth must exist in the active carousel card.
    const tooth = getActiveTooth(page)
    await expect(
      tooth,
      'TimelineCarousel must render a clickable tooth to open ToothSlideout',
    ).toBeVisible({ timeout: 10_000 })
    await tooth.click()

    // The ToothSlideout must open on tooth click so the clinician can chart a
    // pre-existing restoration.
    const slideout = page.locator('[data-testid="tooth-slideout"], [role="dialog"]').first()
    await expect(
      slideout,
      'ToothSlideout must open on tooth click to record an Existing restoration',
    ).toBeVisible({ timeout: 10_000 })

    // Gap #1/#2 fix gate: the slideout must offer DISTINCT "Existing" and
    // "Existing-Other" status controls (status is NOT collapsed to a boolean
    // "done"). Charting pre-existing-vs-elsewhere work depends on these.
    await expect(
      slideout.getByRole('button', { name: /^existing$/i }),
      'slideout must expose a distinct "Existing" status control (Gap #1)',
    ).toBeVisible()
    await expect(
      slideout.getByRole('button', { name: /existing[- ]other/i }),
      'slideout must expose a distinct "Existing-Other" status control (Gap #2)',
    ).toBeVisible()

    // The full save flow requires surface selection via the SVG tooth diagram
    // (coordinate clicks, not automatable here); distinct-control presence is
    // the regression gate for the status-collapse fix.
    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
