/**
 * J10 — Void / amend a signed entry — no hard delete, audit preserved.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J10
 * Rubric: J10; Q36, Q37, Q38, Q39 (P0), C2, Gap #3, #5. Persona: dentist.
 * Expected verdict: PASS.
 * P0-004 RESOLVED: visit notes persist with a `signed` flag and an append-only
 * version history. POST /dental/visits/:id/notes/sign signs+locks the entry;
 * POST .../notes/addendum appends an immutable amendment; GET .../notes/history
 * exposes the audit trail. This spec DOM-drives Sign & Lock → Add Addendum and
 * confirms the original entry is preserved alongside the appended addendum.
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
  id: 'J10',
  name: 'Void / amend a signed entry — no hard delete, audit preserved',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q36', 'Q37', 'Q38', 'Q39'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    // Sofia Cruz (P7) — seeded amendment scenario + (intended) signed notes.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.sofia)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open the signed note in SoapNotesSheet.
    const notesBtn = page.getByRole('button', { name: /notes|soap/i }).first()
    if (!(await notesBtn.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No Notes affordance in the workspace top bar. UI step 1 impossible.',
      )
      return
    }
    await notesBtn.click()
    await page.waitForLoadState('networkidle')
    const notesSheet = page
      .getByTestId('soap-notes-sheet')
      .or(page.locator('[role="dialog"]'))
      .first()
    await expect(notesSheet).toBeVisible({ timeout: 10_000 })

    // Resolve the active visit the sheet operates on (currentVisitId), for the
    // independent read. Notes are per-visit (GET /dental/visits/:visitId/notes).
    const visitsResp = await apiReader.get(
      `/dental/visits?patientId=${patientId}&branchId=${branchId}`,
    )
    const visitsBody = visitsResp.ok() ? await visitsResp.json() : null
    const visitList: Array<{ id: string; status?: string }> = Array.isArray(visitsBody)
      ? visitsBody
      : (visitsBody?.data ?? visitsBody?.items ?? visitsBody?.visits ?? [])
    const activeVisit = visitList.find((v) => v.status === 'active') ?? visitList[0]
    const visitId = activeVisit?.id ?? null

    // Step 2: sign & lock the note (if still editable) — a signed entry is the
    // precondition for the void/amend audit model. Signing is immutable.
    const signBtn = notesSheet.getByTestId('sign-lock-btn')
    if (await signBtn.count()) {
      const signPost = page
        .waitForResponse(
          (r) => /\/notes\/sign/.test(r.url()) && r.request().method() === 'POST',
          { timeout: 10_000 },
        )
        .catch(() => null)
      await signBtn.click()
      await signPost
      await page.waitForLoadState('networkidle')
    }

    // Step 3: a signed/locked note must expose an addendum/amend control (you
    // amend by appending an addendum, never by editing the signed entry).
    const addendumCtl = notesSheet
      .getByTestId('add-addendum-btn')
      .or(notesSheet.getByRole('button', { name: /add addendum|addendum|amend/i }))
      .first()
    if (!(await addendumCtl.count())) {
      await expectJourneyBroken(
        page,
        META,
        `Signed note exposes no addendum/amend control — the void/amend audit model ` +
          `(Gap #3 hard-delete, Gap #5 editable signed notes) is unreachable through the UI.`,
      )
      return
    }
    await addendumCtl.click()

    // Step 4: document the amendment as an appended addendum (DOM-only).
    const reasonField = notesSheet.locator('#addendum-reason')
    if (await reasonField.count()) await reasonField.fill('Correction')
    await notesSheet.locator('#addendum-content').fill('Addendum: clarified anesthetic dosage.')
    const addendumPost = page
      .waitForResponse(
        (r) => /\/notes\/addendum/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 10_000 },
      )
      .catch(() => null)
    await notesSheet.getByRole('button', { name: /submit addendum/i }).first().click()
    await addendumPost
    await page.waitForLoadState('networkidle')

    // Independent read — the audit trail must show the original entry PRESERVED
    // (no hard delete) plus the appended addendum version.
    const histResp = visitId
      ? await apiReader.get(`/dental/visits/${visitId}/notes/history`)
      : null
    const histBody = histResp?.ok() ? await histResp.json() : null
    const versions: Array<{ snapshot?: unknown }> = Array.isArray(histBody)
      ? histBody
      : (histBody?.data ?? histBody?.versions ?? [])
    const hasAddendumVersion = versions.some((v) =>
      /correction|addendum|anesthetic/i.test(JSON.stringify(v?.snapshot ?? v)),
    )

    if (versions.length >= 2 && hasAddendumVersion) {
      // Signed entry preserved + addendum appended via a separate version row =
      // no hard delete, audit trail intact.
      recordJourneyPass(META)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `Void/amend audit trail not preserved: GET /dental/visits/${visitId ?? 'unknown'}/notes/history ` +
        `→ ${histResp?.status() ?? 'null'}, versions=${versions.length}, addendumVersion=${hasAddendumVersion}.`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
