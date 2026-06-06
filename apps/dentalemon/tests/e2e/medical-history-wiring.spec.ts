/**
 * medical-history-wiring.spec.ts — regression for the medical-history mis-wire.
 *
 * BUG (fixed): the SoapNotesSheet "View Medical History" affordance was wired in
 * _workspace/$patientId.tsx to setPmdImportOpen(true) — i.e. it opened the PMD
 * (Portable Medical Document) *import* sheet, NOT the medical-history intake form
 * (conditions / meds / allergies / ASA). Result: medical-history editing was
 * unreachable for every user. This spec proves the button opens the real
 * MedicalHistorySheet (data-testid="medical-history-sheet").
 */
import {
  test,
  expect,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
} from './journeys/_journey-helpers'

test('Notes → "View Medical History" opens the medical-history intake sheet (not PMD import)', async ({
  page,
  apiReader,
}) => {
  const { branchId } = await readOrgContext(apiReader)
  // Maria Santos (P1) — seeded with an active (unsigned → unlocked) visit, so the
  // SoapNotesSheet renders the "View Medical History" affordance (!isLocked gate).
  const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.maria)

  await pinAuth(page, 'dentist')
  await openWorkspace(page, patientId)

  // Open the SoapNotesSheet from the top bar ("Notes / Medical History").
  await page.getByRole('button', { name: /notes|medical/i }).first().click()
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByTestId('soap-notes-sheet').or(page.locator('[role="dialog"]')).first(),
  ).toBeVisible({ timeout: 10_000 })

  // Click the in-sheet "View Medical History" affordance.
  const mhButton = page.getByRole('button', { name: /view medical history/i })
  await expect(mhButton, 'SoapNotesSheet must expose the View Medical History affordance').toBeVisible()
  await mhButton.click()

  // REGRESSION ASSERTION: the medical-history intake sheet opens — not PMD import.
  await expect(
    page.getByTestId('medical-history-sheet'),
    'medical-history intake sheet must open (regression: it used to open PMD import)',
  ).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('heading', { name: /medical history/i })).toBeVisible()
})
