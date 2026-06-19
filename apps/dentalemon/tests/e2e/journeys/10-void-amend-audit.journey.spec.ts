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
      throw new Error(
        'No Notes affordance in the workspace top bar. UI step 1 impossible.',
      )
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
    // The locked-state footer (Close | Add Addendum) only renders once the
    // sign mutation completes AND the notes query refetches with `signed: true`
    // and React re-renders — that settles AFTER the sign POST response and can
    // lag past networkidle. A one-shot count() races that re-render (J10 flake),
    // so poll with an auto-retrying visibility wait instead. The crafted message
    // is preserved so a genuine missing-control regression still fails loudly.
    const addendumCtl = notesSheet
      .getByTestId('add-addendum-btn')
      .or(notesSheet.getByRole('button', { name: /add addendum|addendum|amend/i }))
      .first()
    try {
      await expect(addendumCtl).toBeVisible({ timeout: 15_000 })
    } catch {
      throw new Error(
        `Signed note exposes no addendum/amend control — the void/amend audit model ` +
          `(Gap #3 hard-delete, Gap #5 editable signed notes) is unreachable through the UI.`,
      )
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

      // ── FIX-002 (dental-audit Batch A): browser-level WF-028 compliance proof ──
      // The clinical-record amendment we just performed is a sensitive PHI write
      // (`visit_note.amended`, eventType=data-modification). An owner MUST be able
      // to see WHO amended the signed record, WHEN, and WHY — the HIPAA §164.312(b)
      // audit-control loop (write → trail → reviewer). Prove it end-to-end through
      // the real owner-only Settings → Audit Log viewer (getAuditEvents).
      //
      // SPA-navigate (history.pushState) — NOT page.goto: the PIN session minted by
      // pinAuth() lives ONLY in memory, so a hard reload bounces back to
      // /auth/pin-select. The org-context store (also in memory, branchId hydrated
      // on the dashboard mount) survives the SPA navigation, so the branch-scoped
      // viewer query runs. (Same constraint as openWorkspace.)
      await page.evaluate(() => {
        window.history.pushState({}, '', '/settings')
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForURL((u: URL) => u.pathname === '/settings', { timeout: 15_000 })
      await page.waitForLoadState('networkidle')

      // Open the owner-only Audit Log panel (pinAuth 'dentist' === dentist_owner).
      // Settings navigation is a tablist (the ux-ui-polish batch moved the panels
      // behind role="tab"); the audit viewer opens from the "Audit Log" tab.
      await page.getByRole('tab', { name: 'Audit Log', exact: true }).click()
      const auditPanel = page.getByTestId('audit-log-panel')
      await expect(auditPanel, 'owner must reach the Audit Log viewer').toBeVisible({
        timeout: 15_000,
      })

      // Filter the trail to the amendment action we just wrote.
      await page.getByLabel('Action').fill('visit_note.amended')

      // The amendment must surface in the viewer with its actor (WHO) and the
      // mandatory addendum reason (WHY = 'Correction', filled in step 4). A bare
      // action match is not enough — assert the attribution columns are populated,
      // so this fails loudly if the trail ever drops the actor or reason.
      const amendedRow = auditPanel
        .getByTestId('audit-log-row')
        .filter({ hasText: 'visit_note.amended' })
        .first()
      await expect(
        amendedRow,
        'the visit_note.amended event must appear in the audit viewer',
      ).toBeVisible({ timeout: 15_000 })
      await expect(amendedRow, 'audit row must record the reason (why)').toContainText(
        'Correction',
      )
      // Column order (audit-log.tsx): When=0, Actor=1, Role=2, Type=3, Action=4…
      const actorCell = amendedRow.locator('td').nth(1)
      await expect(actorCell, 'audit row must record the actor (who)').not.toHaveText('')
      await expect(actorCell).not.toHaveText('—')

      recordJourneyPass(META)
      return
    }

    throw new Error(
      `Void/amend audit trail not preserved: GET /dental/visits/${visitId ?? 'unknown'}/notes/history ` +
        `→ ${histResp?.status() ?? 'null'}, versions=${versions.length}, addendumVersion=${hasAddendumVersion}.`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
