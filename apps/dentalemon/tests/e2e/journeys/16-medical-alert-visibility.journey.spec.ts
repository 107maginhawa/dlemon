/**
 * J16 — Medical alert (allergy) visible before/during clinical encounter.
 *
 * Contract: ENC-BR-004, PAT-BR-003
 * Rubric: J16; ENC-BR-004 (clinical alerts visible before/during treatment),
 *         PAT-BR-003 (medical alerts visible in encounter).
 * Persona: dentist. Expected verdict: PASS.
 *
 * API pre-check: GET /dental/patients/:id/safety-floor must return hasAlerts=true
 * and at least one allergy for Juan dela Cruz (penicillin allergy seeded on P0).
 * DOM step: navigate to the patient workspace and look for any alert indicator.
 */
import {
  test,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  expectJourneyBroken,
  recordJourneyPass,
  recordJourneyError,
  API,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J16',
  name: 'Medical alert (allergy) visible before/during clinical encounter',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['ENC-BR-004', 'PAT-BR-003'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    // ── Precondition resolution (independent read, no browser yet) ─────────
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.juan)

    // ── API pre-check: safety floor must show hasAlerts=true ───────────────
    // This is a seed precondition check, not part of the journey verdict.
    // If the seed is broken the spec throws (ERROR, not BROKEN).
    const sfResp = await apiReader.get(`${API}/dental/patients/${patientId}/safety-floor`)
    if (!sfResp.ok()) {
      throw new Error(
        `Safety-floor API returned ${sfResp.status()} for patient ${patientId}. ` +
          `Expected 200. Ensure the seed is present: bun run db:reseed`,
      )
    }
    const sfBody = await sfResp.json()
    if (!sfBody.hasAlerts) {
      throw new Error(
        `Safety-floor API returned hasAlerts=false for Juan dela Cruz (${patientId}). ` +
          `The penicillin allergy seed is missing. Run: bun run db:reseed`,
      )
    }
    if (!Array.isArray(sfBody.allergies) || sfBody.allergies.length < 1) {
      throw new Error(
        `Safety-floor API returned no allergies for Juan dela Cruz (${patientId}). ` +
          `Expected at least one allergy (penicillin). Seed may be incomplete.`,
      )
    }

    // ── DOM journey ────────────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // ENC-BR-004 / PAT-BR-003: look for any medical alert indicator in the UI.
    // We try multiple selectors; stop at the first visible match.
    const alertLocators = [
      page.locator('[data-testid="safety-alert"]'),
      page.locator('[data-testid="allergy-alert"]'),
      page.locator('[data-testid="medical-alert"]'),
      page.getByText(/penicillin/i),
      page.getByText(/allergy/i).first(),
      page.getByRole('alert').first(),
    ]

    let alertVisible = false
    for (const loc of alertLocators) {
      try {
        if (await loc.isVisible({ timeout: 3_000 })) {
          alertVisible = true
          break
        }
      } catch {
        /* locator not found — try next */
      }
    }

    if (alertVisible) {
      recordJourneyPass(META)
    } else {
      await expectJourneyBroken(
        page,
        META,
        'Safety floor alert not visible in workspace UI. ' +
          'API returns hasAlerts=true (penicillin allergy) for Juan dela Cruz but no UI indicator found. ' +
          'ENC-BR-004 / PAT-BR-003 gap: medical alerts must be displayed in the clinical workspace.',
      )
    }
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
