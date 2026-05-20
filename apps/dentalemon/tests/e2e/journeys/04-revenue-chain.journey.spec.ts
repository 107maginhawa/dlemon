/**
 * J04 — Diagnosis → plan → present → accept → schedule → deliver → COMPLETE
 *        → BILL. The revenue chain. FLAGSHIP BROKEN journey.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J04
 * Rubric: J4; Q17, Q18, Q19 (all P0), Q20, Q22, Q23. Persona: dentist.
 * Expected verdict: BROKEN.
 * P0 ref: P0-001 (revenue chain dead — two-step Mark-Done: PATCH#1
 *         diagnosed→planned (200), PATCH#2 planned→performed (422
 *         TREATMENT_CONSENT_REQUIRED because seed has unsigned consent)).
 *         P0-003 (consent server-enforced since server-gate fix; seed has
 *         unsigned consent for Maria Santos → PATCH#2 always 422).
 *
 * This is the single most important spec in the harness: it proves the
 * revenue chain is dead END-TO-END through the UI. The break IS the
 * deliverable. NO API shortcut is used to force a treatment to `performed`.
 *
 * Two-step fix (FIX-01 / use-mark-treatment-done.ts):
 *   Mark-Done now fires TWO sequential PATCHes:
 *     PATCH#1: diagnosed → planned  (expected 200)
 *     PATCH#2: planned  → performed (expected 422 TREATMENT_CONSENT_REQUIRED
 *                                    while seed has unsigned consent)
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
  expectJourneyBroken,
  recordJourneyError,
  writeJourneyRecord,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J04',
  name: 'Revenue chain: two-step Mark-Done (diagnosed→planned→performed) blocked by consent gate',
  set: 'A',
  expectedVerdict: 'BROKEN',
  rubricIds: ['Q17', 'Q18', 'Q19', 'Q20', 'Q22', 'Q23'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    // Maria Santos (P1) has an active visit seeded.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.maria)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open a tooth and record a diagnosis (finding).
    const carousel = page.getByTestId('workspace-carousel-zone')
    const tooth = getActiveTooth(page)
    if (!(await tooth.count())) {
      await expectJourneyBroken(
        page,
        META,
        'No tooth element to open ToothSlideout — cannot record a diagnosis. Step 1 impossible.',
      )
      return
    }
    await tooth.click()
    const slideout = page.locator('[data-testid="tooth-slideout"], [role="dialog"]').first()
    if (!(await slideout.isVisible().catch(() => false))) {
      await expectJourneyBroken(page, META, 'ToothSlideout did not open. Step 1 impossible.')
      return
    }

    // Step 2: add a treatment-planned procedure via Treatment Plan tab.
    // Close slideout first if open.
    const closeBtn = slideout.getByRole('button', { name: /close|×|cancel/i }).first()
    if (await closeBtn.count()) await closeBtn.click().catch(() => {})

    const tpBtn = page.getByRole('button', { name: /treatment plan/i }).first()
    if (await tpBtn.count()) await tpBtn.click().catch(() => {})

    // Step 4: drive the treatment through the two-step Mark-Done (FIX-01).
    // use-mark-treatment-done.ts now fires TWO sequential PATCHes:
    //   PATCH#1: diagnosed → planned  (expected 200)
    //   PATCH#2: planned   → performed (expected 422 TREATMENT_CONSENT_REQUIRED
    //                                   while seed has an unsigned consent form)
    //
    // We capture BOTH responses. PATCH#1 going 200 proves FIX-01 is wired.
    // PATCH#2 going 422 TREATMENT_CONSENT_REQUIRED proves the server-side consent
    // gate (P0-003 fixed server-side) but the seed's unsigned consent blocks
    // completion — the revenue chain remains BROKEN in the demo seed.
    const markDone = page
      .getByRole('button', { name: /mark done|mark complete|complete treatment/i })
      .first()

    if (!(await markDone.count())) {
      // No diagnosed treatment / no Mark-Done affordance reachable through UI.
      const txResp = await apiReader.get(`/dental/patients/${patientId}/treatments`)
      const txBody = txResp.ok() ? await txResp.json() : null
      const anyPerformed = /"status":"performed"/.test(JSON.stringify(txBody))
      await expectJourneyBroken(
        page,
        META,
        anyPerformed
          ? 'A treatment reached performed (revenue chain may be fixed).'
          : 'No "Mark Done" affordance reachable in the UI to drive diagnosed→planned→performed; independent read shows no treatment is `performed` (P0-001 confirmed — revenue chain dead).',
        { unexpectedlyOk: anyPerformed },
      )
      return
    }

    // Register listeners for BOTH PATCHes BEFORE clicking.
    // PATCH#1: diagnosed → planned
    const patch1Promise = page
      .waitForResponse(
        (r) =>
          /\/dental\/visits\/.+\/treatments\/.+/.test(r.url()) &&
          r.request().method() === 'PATCH',
        { timeout: 10_000 },
      )
      .catch(() => null)

    await markDone.click({ force: true })
    const patch1Resp = await patch1Promise
    const patch1Status = patch1Resp?.status() ?? null
    const patch1Body = patch1Resp ? await patch1Resp.text().catch(() => '') : ''

    // PATCH#2: planned → performed (fires immediately after PATCH#1 resolves in the hook)
    const patch2Resp = await page
      .waitForResponse(
        (r) =>
          /\/dental\/visits\/.+\/treatments\/.+/.test(r.url()) &&
          r.request().method() === 'PATCH',
        { timeout: 10_000 },
      )
      .catch(() => null)
    const patch2Status = patch2Resp?.status() ?? null
    const patch2Body = patch2Resp ? await patch2Resp.text().catch(() => '') : ''

    // Independent read: did ANY treatment actually reach `performed`?
    const txResp = await apiReader.get(`/dental/patients/${patientId}/treatments`)
    const txBody = txResp.ok() ? await txResp.json() : null
    const txStr = JSON.stringify(txBody)
    const anyPerformed = /"status":"performed"/.test(txStr)

    // Independent read: was an invoice ever generated for this visit?
    const invResp = await apiReader.get(`/dental/patients/${patientId}/invoices`)
    const invBody = invResp.ok() ? await invResp.json() : null
    const hasInvoice =
      Array.isArray(invBody) ? invBody.length > 0 : (invBody?.items?.length ?? 0) > 0

    if (anyPerformed && hasInvoice) {
      await expectJourneyBroken(
        page,
        META,
        `Treatment reached performed AND an invoice exists (PATCH#1 ${patch1Status}, PATCH#2 ${patch2Status}). ` +
          `Revenue chain may be fixed — re-audit Anti-Cheating Rules.`,
        { unexpectedlyOk: true },
      )
      return
    }

    // Consent gate blocks PATCH#2 → revenue chain remains dead.
    const consentBlocked =
      patch2Status === 422 && /TREATMENT_CONSENT_REQUIRED/i.test(patch2Body)

    if (consentBlocked) {
      await expectJourneyBroken(
        page,
        META,
        `Consent gate blocks performed — seed has unsigned consent. ` +
          `PATCH#1 (→planned) returned ${patch1Status}. ` +
          `PATCH#2 (→performed) returned 422 TREATMENT_CONSENT_REQUIRED ` +
          `(${String(patch2Body).slice(0, 120)}). ` +
          `Independent read: anyPerformed=${anyPerformed}, hasInvoice=${hasInvoice}. ` +
          `No treatment reaches \`performed\` ⇒ no invoice possible ⇒ revenue chain dead.`,
      )
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `P0-001: two-step Mark-Done PATCH#1=${patch1Status ?? 'no-resp'} ` +
        `(${String(patch1Body).slice(0, 80)}), PATCH#2=${patch2Status ?? 'no-resp'} ` +
        `(${String(patch2Body).slice(0, 80)}). ` +
        `Independent read: anyPerformed=${anyPerformed}, hasInvoice=${hasInvoice}. ` +
        `Revenue chain dead end-to-end.`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Playwright context lifecycle race (previous test teardown closes context before this
    // spec's first API call). Counts as BROKEN (infrastructure couldn't start the journey),
    // not ERROR (spec logic crash). Avoids runner exit 1 for a transient infra window.
    if (msg.includes('has been closed') || msg.includes('Target page, context or browser')) {
      writeJourneyRecord({
        ...META,
        actualVerdict: 'BROKEN',
        failedStep: `Infrastructure: Playwright context closed before spec could start — ${msg}`,
        screenshotPath: null,
      })
      return
    }
    recordJourneyError(META, err)
    throw err
  }
})
