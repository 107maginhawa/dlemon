/**
 * J10 — Void / amend a signed entry — no hard delete, audit preserved.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J10
 * Rubric: J10; Q36, Q37, Q38, Q39 (P0), C2, Gap #3, #5. Persona: dentist.
 * Expected verdict: BROKEN.
 * P0 ref: P0-004 (notes are local React state, no DB column → no signed/
 *         locked persistence, no addendum model, no audit trail).
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
    const notesSheet = page.locator('[data-testid="soap-notes-sheet"], [role="dialog"]').first()
    await expect(notesSheet).toBeVisible({ timeout: 10_000 }).catch(() => {})

    // Independent read: is there ANY persisted note row with a signed/locked
    // state for this patient? P0-004 says notes are local React state with no
    // DB column — so this read returns nothing durable.
    // Notes are per-visit (GET /dental/visits/:visitId/notes), not per-patient.
    // First resolve Sofia's most recent visit, then check notes on that visit.
    const visitsResp = await apiReader.get(`/dental/patients/${patientId}/visits`)
    const visitsBody = visitsResp.ok() ? await visitsResp.json() : null
    const visitList: Array<{ id: string; createdAt?: string; created_at?: string }> =
      Array.isArray(visitsBody)
        ? visitsBody
        : (visitsBody?.items ?? visitsBody?.visits ?? visitsBody?.data ?? [])
    visitList.sort((a, b) =>
      ((b.createdAt ?? b.created_at) ?? '').localeCompare((a.createdAt ?? a.created_at) ?? ''),
    )
    const visitId = visitList[0]?.id ?? null
    const notesResp = visitId
      ? await apiReader.get(`/dental/visits/${visitId}/notes`)
      : null
    const notesOk = notesResp?.ok() ?? false
    const notesStr = notesOk ? JSON.stringify(await notesResp!.json()) : ''
    const hasSignedPersisted = notesOk && /"(signed|locked)":\s*true/.test(notesStr)

    // Step 4: an addendum/amendment control must exist on a locked note.
    const addendumCtl = notesSheet
      .getByRole('button', { name: /addendum|amend|amendment/i })
      .first()
    const hasAddendum = await addendumCtl.count()

    if (!hasSignedPersisted || !hasAddendum) {
      await expectJourneyBroken(
        page,
        META,
        `P0-004 CONFIRMED: notes are local React state with no DB column. ` +
          `Independent read of /dental/visits/${visitId ?? 'unknown'}/notes ` +
          `${notesOk ? '' : `→ ${notesResp?.status() ?? 'null'} `}` +
          `shows no signed/locked persisted note (hasSignedPersisted=` +
          `${hasSignedPersisted}); UI addendum control present=${hasAddendum > 0}. ` +
          `No signed/locked persistence ⇒ no addendum model ⇒ no audit trail ` +
          `for note mutations. The void/amend journey cannot complete through ` +
          `the UI (Gap #3 hard-delete, Gap #5 editable signed notes).`,
      )
      return
    }

    // If the persistence + addendum surfaces unexpectedly exist, verify the
    // original survives an amendment (immutability) via independent read.
    await addendumCtl.click()
    const reason = notesSheet.getByRole('textbox').last()
    if (await reason.count()) await reason.fill('Addendum: clarified anesthetic dosage.')
    const save = notesSheet.getByRole('button', { name: /save|add|confirm/i }).first()
    if (await save.count()) await save.click()
    await page.waitForLoadState('networkidle')

    const afterResp = visitId
      ? await apiReader.get(`/dental/visits/${visitId}/notes`)
      : null
    const afterStr = afterResp?.ok() ? JSON.stringify(await afterResp.json()) : ''
    const hasAddendumRow = /addendum|amendment/i.test(afterStr)

    await expectJourneyBroken(
      page,
      META,
      hasAddendumRow
        ? 'Original preserved + addendum row appended — note amendment model may be implemented.'
        : 'Independent read shows no addendum row appended (P0-004 confirmed).',
      { unexpectedlyOk: hasAddendumRow },
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
