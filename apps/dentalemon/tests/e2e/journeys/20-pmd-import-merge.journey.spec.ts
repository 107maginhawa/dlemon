/**
 * J20 — Importing an external PMD merges its safety floor into the patient record.
 *
 * Contract: FR12.5 (import/accept external PMD), BR-022 (imported PMD read-only),
 *           FIX-003 / decision #20 (append-only safety-floor merge — the imported
 *           penicillin-allergy class that was previously clinically INERT).
 * Rubric: J20. Persona: dentist. Expected verdict: PASS.
 *
 * This is the honest replacement for the old API-only pmd-import.spec.ts: it drives
 * the REAL rendered workspace UI — top-bar PMD button → viewer sheet → import form →
 * preview → confirm — and then proves, via an INDEPENDENT read, that the imported
 * allergy actually surfaced in the patient's Safety Floor (no longer inert).
 *
 * Mutation note: if the confirm step imported the PMD but did NOT merge it (the
 * pre-fix behaviour), the independent safety-floor read below would not contain the
 * unique allergen → the journey fails. So the assertion is non-vacuous.
 */
import {
  test,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  recordJourneyPass,
  recordJourneyError,
  API,
} from './_journey-helpers'
import { expect } from '@playwright/test'
import { enableWorkspaceFlags } from '../helpers/feature-flags'

const META: JourneyMeta = {
  id: 'J20',
  name: 'Imported external PMD merges its safety floor into the patient record',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['FR12.5', 'BR-022'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  // PMD is a v2-deferred tool (workspace.pmd) — opt back in for this journey.
  await enableWorkspaceFlags(page, 'workspace.pmd')
  try {
    // ── Precondition resolution (independent read, no browser yet) ─────────
    const { branchId } = await readOrgContext(apiReader)
    // Maria Santos (P1) has an ACTIVE visit, so the workspace mounts a currentVisit
    // and the top-bar PMD button + import sheet are reachable.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.maria)

    // A unique allergen so the assertion can't be satisfied by pre-seeded data and
    // re-runs don't collide (append-only merge — each run adds its own row).
    const allergen = `Cephalexin-J20-${Date.now()}`

    // Sanity: the allergen is not already in the floor before the journey runs.
    const pre = await apiReader.get(`${API}/dental/patients/${patientId}/safety-floor`)
    if (!pre.ok()) {
      throw new Error(`safety-floor pre-read ${pre.status()} for ${patientId}. Run: bun run db:reseed`)
    }
    const preBody = await pre.json()
    const preNames: string[] = (preBody.allergies ?? []).map((a: { displayName: string }) => a.displayName)
    expect(preNames, 'unique allergen must not pre-exist').not.toContain(allergen)

    // ── DOM journey ────────────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Top-bar PMD button → PMD viewer sheet.
    await page.getByRole('button', { name: 'Portable medical document' }).click()
    // Viewer sheet → "Import External PMD" (opens the import form after a short delay).
    await page.getByRole('button', { name: /import external pmd/i }).click()
    await expect(page.getByTestId('pmd-import')).toBeVisible({ timeout: 10_000 })

    // Fill the import form. `fill` sets the value directly so the JSON braces don't
    // trip keystroke parsing.
    await page.locator('#pmd-facility').fill('Transfer Dental Clinic')
    await page.locator('#pmd-source-description').fill('Open Dental v21.1')
    await page.locator('#pmd-content').fill(JSON.stringify({ allergies: [allergen] }))

    await page.getByRole('button', { name: /^preview$/i }).click()
    // Preview surfaces the exact item that will be merged (previewed == merged).
    await expect(page.getByText(allergen)).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: /confirm import/i }).click()
    await expect(page.getByText(/imported successfully/i)).toBeVisible({ timeout: 15_000 })

    // ── Goal-state proof (independent read) ─────────────────────────────────
    // The import flow's whole reason to exist: the imported allergy must now protect
    // the patient by appearing in the Safety Floor. Poll briefly to allow the write.
    await expect
      .poll(
        async () => {
          const r = await apiReader.get(`${API}/dental/patients/${patientId}/safety-floor`)
          if (!r.ok()) return []
          const b = await r.json()
          return (b.allergies ?? []).map((a: { displayName: string }) => a.displayName)
        },
        { timeout: 10_000, message: 'imported allergen must surface in the Safety Floor' },
      )
      .toContain(allergen)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
