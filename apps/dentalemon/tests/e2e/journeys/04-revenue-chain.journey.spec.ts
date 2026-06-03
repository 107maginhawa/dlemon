/**
 * J04 — Diagnosis → plan → present → accept → schedule → deliver → COMPLETE
 *        → BILL. The revenue chain. NOW PASSING.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J04
 * Rubric: J4; Q17, Q18, Q19 (all P0), Q20, Q22, Q23. Persona: dentist.
 * Expected verdict: PASS.
 *
 * Fix history:
 *   FIX-01 (use-mark-treatment-done.ts): Mark-Done now fires TWO sequential PATCHes:
 *     PATCH#1: diagnosed → planned  (200)
 *     PATCH#2: planned  → performed (200 — seed now has SIGNED consent for Maria Santos)
 *   FIX-02 (seed): Maria Santos (P1) active visit now carries a signed consent form.
 *
 * This spec drives the full revenue chain END-TO-END through the rendered DOM:
 *   1. pinAuth as dentist → openWorkspace(Maria Santos)
 *   2. Open tooth → confirm ToothSlideout renders
 *   3. Click "Mark Done" → wait for PATCH#1 (200) + PATCH#2 (200)
 *   4. Create invoice via apiReader.post (no invoice UI exists)
 *   5. Independent reads: anyPerformed=true AND hasInvoice=true → PASS
 *
 * Anti-Cheating Rules compliance:
 *   Rule 1 (DOM-only drive): Mark-Done is clicked through UI. Invoice created via
 *     apiReader.post (no invoice creation UI in the workspace — API-only is
 *     correct here, not a shortcut for a UI step that exists).
 *   Rule 2 (independent read): goal state asserted via separate GET after UI flow.
 *   Rule 3 (no shortcut): treatments reach `performed` ONLY because the UI drove
 *     Mark-Done — not via a direct PATCH from apiReader.
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
  recordJourneyPass,
  recordJourneyError,
  writeJourneyRecord,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J04',
  name: 'Revenue chain: two-step Mark-Done (diagnosed→planned→performed) + invoice — consent signed, full chain works',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q17', 'Q18', 'Q19', 'Q20', 'Q22', 'Q23'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)
    // Maria Santos (P1) has an active visit seeded with SIGNED consent.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.maria)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open a tooth and confirm ToothSlideout renders.
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

    // Step 2: close the slideout so the always-visible Treatment Breakdown
    // (treatment-table) is fully interactable. Do NOT open the Treatment Plan
    // sheet here: that overlay exposes only a Decline control (no Mark Done) and
    // it covers the breakdown's Mark Done button — a force-click would land on
    // the overlay and fire no PATCH. The revenue-chain Mark Done lives in the
    // breakdown, which is already on screen below the carousel.
    const closeBtn = slideout.getByRole('button', { name: /close|×|cancel/i }).first()
    if (await closeBtn.count()) await closeBtn.click().catch(() => {})

    // Step 3: locate "Mark Done" affordance in the breakdown.
    const markDone = page
      .getByRole('button', { name: /mark done|mark complete|complete treatment/i })
      .first()

    if (!(await markDone.count())) {
      // No Mark-Done affordance reachable — check if revenue chain already completed.
      const txResp = await apiReader.get(`/dental/patients/${patientId}/treatments`)
      const txBody = txResp.ok() ? await txResp.json() : null
      const anyPerformed = /"status":"performed"/.test(JSON.stringify(txBody))
      await expectJourneyBroken(
        page,
        META,
        anyPerformed
          ? 'A treatment reached performed (Mark-Done affordance not needed — may have been pre-done by seed).'
          : 'No "Mark Done" affordance reachable in the UI; independent read shows no treatment is `performed` (revenue chain dead).',
        { unexpectedlyOk: false },
      )
      return
    }

    // Step 4: register PATCH#1 listener BEFORE clicking, then click.
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

    // PATCH#1 must be 200 (diagnosed → planned).
    if (patch1Status !== 200) {
      await expectJourneyBroken(
        page,
        META,
        `PATCH#1 (diagnosed→planned) returned ${patch1Status ?? 'no-resp'} — expected 200. ` +
          `Body: ${String(patch1Body).slice(0, 120)}. Revenue chain blocked at step 1.`,
      )
      return
    }

    // Step 5: wait for PATCH#2 (planned → performed).
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

    // PATCH#2 must be 200 (planned → performed). Consent signed in seed — 422 = seed broke.
    if (patch2Status !== 200) {
      const consentBlocked =
        patch2Status === 422 && /TREATMENT_CONSENT_REQUIRED/i.test(String(patch2Body))
      await expectJourneyBroken(
        page,
        META,
        consentBlocked
          ? `PATCH#2 (planned→performed) returned 422 TREATMENT_CONSENT_REQUIRED — ` +
              `seed consent appears unsigned. Re-run \`bun run db:reseed\`. ` +
              `Body: ${String(patch2Body).slice(0, 120)}.`
          : `PATCH#2 (planned→performed) returned ${patch2Status ?? 'no-resp'} — expected 200. ` +
              `Body: ${String(patch2Body).slice(0, 120)}. Revenue chain blocked at step 2.`,
      )
      return
    }

    // Step 6: independent read — confirm treatment reached `performed`.
    const txResp = await apiReader.get(`/dental/patients/${patientId}/treatments`)
    const txBody = txResp.ok() ? await txResp.json() : null
    const txStr = JSON.stringify(txBody)
    const anyPerformed = /"status":"performed"/.test(txStr)

    if (!anyPerformed) {
      await expectJourneyBroken(
        page,
        META,
        `PATCH#1=${patch1Status}, PATCH#2=${patch2Status} both 200, but independent read ` +
          `shows no treatment in \`performed\` state. Persistence mismatch.`,
      )
      return
    }

    // Step 7: create invoice via API (no invoice creation UI exists in the workspace).
    // Resolve active visitId from patient visits list.
    const visitsResp = await apiReader.get(`/dental/patients/${patientId}/visits`)
    if (!visitsResp.ok()) {
      await expectJourneyBroken(
        page,
        META,
        `GET /dental/patients/${patientId}/visits → ${visitsResp.status()}. Cannot resolve visitId for invoice.`,
      )
      return
    }
    const visitsBody = await visitsResp.json()
    const visitItems: any[] = Array.isArray(visitsBody)
      ? visitsBody
      : (visitsBody.items ?? visitsBody.data ?? [])
    // Pick the active (open) visit, falling back to the most recent.
    const activeVisit =
      visitItems.find((v: any) => v.status === 'open' || v.status === 'active') ?? visitItems[0]
    if (!activeVisit?.id) {
      await expectJourneyBroken(
        page,
        META,
        `No active visit found for Maria Santos — cannot create invoice. Visits: ${JSON.stringify(visitItems.slice(0, 3))}`,
      )
      return
    }
    const visitId = activeVisit.id

    const invoiceResp = await apiReader.post('/dental/billing/invoices', {
      data: {
        visitId,
        patientId,
        branchId,
        dentistMemberId: memberId,
        taxRate: 0,
      },
    })

    if (!invoiceResp.ok()) {
      const invBody = await invoiceResp.text().catch(() => '')
      await expectJourneyBroken(
        page,
        META,
        `POST /dental/billing/invoices → ${invoiceResp.status()}. ` +
          `Body: ${invBody.slice(0, 200)}. Invoice creation failed — revenue chain incomplete.`,
      )
      return
    }

    // Step 8: independent read — confirm invoice exists for this patient.
    // Invoices are listed under /dental/billing/invoices (there is no
    // /dental/patients/:id/invoices route — that 404s).
    const invListResp = await apiReader.get(
      `/dental/billing/invoices?patientId=${patientId}&branchId=${branchId}`,
    )
    const invListBody = invListResp.ok() ? await invListResp.json() : null
    const hasInvoice = Array.isArray(invListBody)
      ? invListBody.length > 0
      : ((invListBody?.data?.length ?? invListBody?.items?.length) ?? 0) > 0

    if (!hasInvoice) {
      await expectJourneyBroken(
        page,
        META,
        `Invoice POST returned ${invoiceResp.status()} but independent read shows no invoices for patient. ` +
          `Revenue chain persistence mismatch.`,
      )
      return
    }

    // All checks passed: revenue chain works end-to-end.
    recordJourneyPass(META)
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
