/**
 * J23 — Dentist visit, day-in-the-life (the WF-074 keystone).
 *
 * The 2026-06-20 traceability audit found the doctor-visit chain "partially proven,
 * not end-to-end proven": coverage was stitched from fragments (J21 start, J01 chart,
 * J04 revenue, J22 complete), and the two clinical *authoring* acts a dentist performs
 * every single visit were the LEAST proven part of the chain:
 *   - WF-009 (chart a tooth) — J01 only asserts chart CONTROLS render; it never saves a
 *     chart entry and reads nothing back. The persistence of a UI-authored chart entry
 *     was untested.
 *   - WF-011 (write a SOAP note) — UNMAPPED. No journey typed a fresh note in the UI and
 *     read it back; J22 *seeds* notes via the API, J10 only covers the addendum path.
 *
 * J23 walks ONE continuous visit through the REAL UI, with an INDEPENDENT read-back at
 * every step (apiReader GET, never DOM presence / 2xx):
 *   1. register a fresh patient (0 visits → New Visit enabled, deterministic)
 *   2. New Visit (two-step POST draft 201 + PATCH active 2xx)         → read status active
 *   3. initialize dentition + CHART a tooth condition & treatment      → read the SPECIFIC
 *      treatment (cdtCode + toothNumber) persisted   ......................  WF-009
 *   4. type a fresh SOAP note in soap-notes-sheet and Save             → read the TYPED
 *      subjective text persisted   ...................................... .  WF-011
 *   5. mark the treatment performed (treatment table)                  → read status performed
 *   6. create the invoice (apiReader — no invoice-creation UI exists,    .  WF-013/WF-090
 *      same documented reality as J04)                                 → read invoice exists
 *   7. complete the visit (pre-completion checklist)                   → read status completed
 *
 * Allowed pre-/in-journey API setup (Anti-Cheating Rule: the only non-DOM writes are
 * seeding, never the act under test):
 *   - registerFreshPatient — the deterministic precondition (same as J21/J22).
 *   - seedSignedConsent — the backend gates BOTH planned→performed (WF-010) and
 *     completion (WF-012) on a SIGNED consent form. The in-visit consent gate is JC-6's
 *     charter; here a signed consent is a real clinical PRECONDITION, seeded via apiReader
 *     exactly as J22 (makeVisitCompletable) and J04 (seed) rely on it. The chart entry and
 *     the SOAP note — the two acts this journey PROVES — are authored through the DOM only.
 *   - the invoice POST (step 6) is API-only because the workspace has no invoice-creation
 *     UI (J04 documents this); it is read back independently, not asserted by a 2xx alone.
 *
 * If any step goes RED this flow is genuinely broken — root-cause and fix the app; do not
 * weaken the assertion. Obeys the harness Anti-Cheating Rules and the P2-A error-surface
 * firewall (any error toast / non-empty-state 4xx/5xx fails the run).
 *
 * Verify-on-pickup (2026-06-20): chart save = POST /dental/visits/:id/chart + POST
 * /dental/visits/:id/treatments (use-save-tooth-flow.ts); SOAP save = POST
 * /dental/visits/:id/notes (upsertVisitNotes, soap-notes-sheet.tsx, ids soap-subjective…);
 * a fresh visit's chart 404s → the active card shows "Initialize Dentition" (init-dentition-btn)
 * before any tooth renders (timeline-carousel.tsx).
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import type { APIRequestContext } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J23',
  name: 'Dentist visit day-in-the-life (new visit → chart+treatment → SOAP note → performed → invoice → complete, persistence read each step)',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-074', 'WF-009', 'WF-011', 'WF-021'],
}

// Deterministic chart entry: an anterior central incisor + an anterior resin code so the
// independent read-back can assert THIS specific entry persisted (not "a treatment exists").
const TOOTH = 11 // FDI upper-right central incisor (rendered in permanent dentition)
const CDT_CODE = 'D2330' // Resin-based composite — one surface, anterior (cdt-codes.json)

/** Register a throwaway patient with zero visits (allowed pre-journey seeding). */
async function registerFreshPatient(api: APIRequestContext, branchId: string): Promise<string> {
  const stamp = Date.now()
  const r = await api.post('/dental/patients', {
    data: {
      displayName: `J23 Day-in-the-Life ${stamp}`,
      dateOfBirth: '1990-01-01', // adult → permanent dentition (tooth 11 exists)
      gender: 'male',
      consentGiven: true,
      branchId,
    },
  })
  if (!r.ok()) throw new Error(`register patient → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  const id = (await r.json())?.id
  if (!id) throw new Error('register patient: response carried no id')
  return id
}

/**
 * Seed a SIGNED consent for the visit (allowed setup — NOT the act under test). The backend
 * gates planned→performed (WF-010) and visit completion (WF-012) on a signed consent; the
 * consent-capture UI is JC-6's charter. Mirrors J22.makeVisitCompletable's consent half.
 */
async function seedSignedConsent(
  api: APIRequestContext,
  visitId: string,
  patientId: string,
): Promise<void> {
  const created = await api.post(`/dental/visits/${visitId}/consents`, {
    data: {
      visitId,
      patientId,
      templateId: 'j23-consent',
      templateName: 'J23 General Treatment Consent',
      procedureNature: 'Routine restorative',
    },
  })
  if (!created.ok())
    throw new Error(`seed consent → ${created.status()}: ${(await created.text()).slice(0, 200)}`)
  const consentId = (await created.json())?.id
  if (!consentId) throw new Error('seed consent: response carried no id')
  const signed = await api.post(`/dental/visits/${visitId}/consents/${consentId}/sign`, {
    data: { signatureData: 'data:image/png;base64,SIGNEDCONTENT' },
  })
  if (!signed.ok())
    throw new Error(`sign consent → ${signed.status()}: ${(await signed.text()).slice(0, 200)}`)
}

/** Visits in a given status via the independent reader. */
async function visitsByStatus(
  api: APIRequestContext,
  branchId: string,
  patientId: string,
  status: string,
): Promise<Array<{ id: string; status: string }>> {
  const r = await api.get(`/dental/visits?patientId=${patientId}&branchId=${branchId}`)
  if (!r.ok()) throw new Error(`list visits → ${r.status()}`)
  const body = await r.json()
  const items: Array<{ id: string; status: string }> = Array.isArray(body)
    ? body
    : (body.items ?? body.data ?? [])
  return items.filter((v) => v.status === status)
}

/** All treatments for a patient via the independent reader (fresh patient → exactly ours). */
async function patientTreatments(
  api: APIRequestContext,
  patientId: string,
): Promise<Array<{ id: string; cdtCode?: string; toothNumber?: number; status?: string }>> {
  const r = await api.get(`/dental/patients/${patientId}/treatments`)
  if (!r.ok()) throw new Error(`list patient treatments → ${r.status()}`)
  const body = await r.json()
  return Array.isArray(body) ? body : (body.items ?? body.data ?? [])
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)

    // ── Step 1: deterministic precondition — a fresh patient with zero visits.
    const patientId = await registerFreshPatient(apiReader, branchId)
    expect(
      (await visitsByStatus(apiReader, branchId, patientId, 'active')).length,
      'precondition: a freshly-registered patient has no active visit',
    ).toBe(0)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // ── Step 2: start a visit through the DOM (the proven New-Visit two-step).
    const newVisitBtn = page.getByTestId('new-visit-btn')
    await expect(newVisitBtn, 'New Visit affordance must render').toBeVisible({ timeout: 10_000 })
    await expect(newVisitBtn, 'New Visit must be enabled for a patient with no open visit').toBeEnabled()

    const [createResp, activateResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits(\?|$)/.test(r.url().split('#')[0]!) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.waitForResponse(
        (r) => /\/dental\/visits\/[^/?]+/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      newVisitBtn.click(),
    ])
    expect(createResp.status(), 'step 2a: POST /dental/visits → 201 (draft)').toBe(201)
    expect(activateResp.status(), 'step 2b: activate PATCH must be 2xx').toBeGreaterThanOrEqual(200)
    expect(activateResp.status(), 'step 2b: activate PATCH must be 2xx').toBeLessThan(300)
    const visitId: string | undefined = (await createResp.json())?.id
    expect(visitId, 'create response must carry the visit id').toBeTruthy()

    // Independent read: the visit is durably active/chartable.
    const visitRead = await apiReader.get(`/dental/visits/${visitId}`)
    expect(visitRead.ok(), `GET /dental/visits/${visitId} → ${visitRead.status()}`).toBe(true)
    expect((await visitRead.json())?.status, 'started visit must be active').toBe('active')

    // Allowed setup: a signed consent (precondition for WF-010 performed + WF-012 complete).
    await seedSignedConsent(apiReader, visitId!, patientId)

    // ── Step 3: CHART a tooth condition + treatment through the UI (WF-009). ──────────
    // A brand-new visit has no chart row → the active card offers "Initialize Dentition"
    // before any tooth renders. Populate the dentition first (DOM-driven), then chart.
    const initBtn = page.getByTestId('init-dentition-btn')
    await expect(initBtn, 'fresh visit must offer Initialize Dentition').toBeVisible({ timeout: 15_000 })
    await initBtn.click()

    const tooth = page.locator(`[data-active-card="1"] [data-testid="tooth-${TOOTH}"]`)
    await expect(tooth, `tooth ${TOOTH} must render once dentition is initialized`).toBeVisible({
      timeout: 15_000,
    })
    await tooth.click()

    const slideout = page.getByTestId('tooth-slideout')
    await expect(slideout, 'tooth slideout must open on tooth click').toBeVisible({ timeout: 10_000 })

    // Overview step: focus a surface, then assign a condition (enables the wizard).
    const surfacePill = slideout.locator('[data-testid^="surface-"]').first()
    await expect(surfacePill, 'a tooth surface pill must render').toBeVisible({ timeout: 10_000 })
    await surfacePill.click()
    await slideout.getByTestId('condition-caries').click()
    await slideout.getByRole('button', { name: 'Next' }).click()

    // Treatment step: search + select the CDT code, then Continue → review.
    await slideout.getByLabel('Search CDT codes').fill(CDT_CODE)
    const cdtOption = slideout.getByRole('option').filter({ hasText: CDT_CODE }).first()
    await expect(cdtOption, `CDT code ${CDT_CODE} must be selectable`).toBeVisible({ timeout: 10_000 })
    await cdtOption.click()
    await slideout.getByTestId('cdt-continue-btn').click()

    // Review step: Save. One click fires POST /chart then POST /treatments (use-save-tooth-flow).
    const [chartResp, treatmentResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+\/chart(\?|$)/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+\/treatments(\?|$)/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      slideout.getByRole('button', { name: 'Save', exact: true }).click(),
    ])
    expect(chartResp.status(), 'chart save POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(chartResp.status(), 'chart save POST must be 2xx').toBeLessThan(300)
    expect(treatmentResp.status(), 'treatment POST /treatments must be 201').toBe(201)

    // Independent read-back: the SPECIFIC charted treatment persisted (cdtCode + tooth).
    const charted = (await patientTreatments(apiReader, patientId)).find(
      (t) => t.cdtCode === CDT_CODE && t.toothNumber === TOOTH,
    )
    expect(
      charted,
      `WF-009: the UI-charted treatment (${CDT_CODE} on tooth ${TOOTH}) must persist (independent read)`,
    ).toBeTruthy()
    const treatmentId = charted!.id

    // ── Step 4: type a fresh SOAP note in the UI and Save (WF-011). ──────────────────
    const subjectiveStamp = `J23 chief complaint ${Date.now()} — sensitivity on UR central incisor`
    await page.getByRole('button', { name: 'Notes / Medical History' }).click()
    const sheet = page.getByTestId('soap-notes-sheet')
    await expect(sheet, 'SOAP notes sheet must open').toBeVisible({ timeout: 10_000 })
    await page.locator('#soap-subjective').fill(subjectiveStamp)
    await page.locator('#soap-objective').fill('Caries noted, mesial aspect.')
    await page.locator('#soap-assessment').fill('Dental caries, tooth 11.')
    await page.locator('#soap-plan').fill('Composite restoration placed this visit.')

    const [notesResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+\/notes(\?|$)/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.getByRole('button', { name: 'Save SOAP notes' }).click(),
    ])
    expect(notesResp.status(), 'SOAP save POST /notes must be 2xx').toBeGreaterThanOrEqual(200)
    expect(notesResp.status(), 'SOAP save POST /notes must be 2xx').toBeLessThan(300)
    // The sheet closes itself on a successful save.
    await expect(sheet, 'SOAP sheet closes on successful save').toBeHidden({ timeout: 10_000 })

    // Independent read-back: the TYPED subjective content persisted (not a seeded note).
    const notesRead = await apiReader.get(`/dental/visits/${visitId}/notes`)
    expect(notesRead.ok(), `GET /dental/visits/${visitId}/notes → ${notesRead.status()}`).toBe(true)
    const notesBody = await notesRead.json()
    expect(
      notesBody?.subjective ?? notesBody?.data?.subjective,
      'WF-011: the SOAP note typed in the UI must persist verbatim (independent read)',
    ).toBe(subjectiveStamp)

    // ── Step 5: mark the treatment performed through the UI (WF-010). ────────────────
    // The treatment table's Mark-Done fires diagnosed→planned→performed (consent seeded).
    const markDone = page
      .getByRole('button', { name: /mark done|mark complete|complete treatment/i })
      .first()
    await expect(markDone, 'Mark-Done affordance must render in the treatment table').toBeVisible({
      timeout: 10_000,
    })
    const patchPromise = page.waitForResponse(
      (r) =>
        /\/dental\/visits\/[^/?]+\/treatments\/[^/?]+/.test(r.url()) &&
        r.request().method() === 'PATCH',
      { timeout: 15_000 },
    )
    await markDone.click({ force: true })
    const patchResp = await patchPromise
    expect(patchResp.status(), 'mark-performed PATCH must be 2xx').toBeGreaterThanOrEqual(200)
    expect(patchResp.status(), 'mark-performed PATCH must be 2xx').toBeLessThan(300)

    // Independent read-back: the charted treatment reaches `performed`.
    await expect
      .poll(
        async () =>
          (await patientTreatments(apiReader, patientId)).find((t) => t.id === treatmentId)?.status,
        {
          message: 'WF-010: the treatment must durably reach `performed` (independent read)',
          timeout: 15_000,
        },
      )
      .toBe('performed')

    // ── Step 6: bill the visit (WF-013). No invoice-creation UI exists (J04 documents
    //    this) → create via apiReader, then read it back independently. ──────────────
    const invoiceResp = await apiReader.post('/dental/billing/invoices', {
      data: { visitId, patientId, branchId, dentistMemberId: memberId, taxRate: 0 },
    })
    expect(
      invoiceResp.ok(),
      `POST /dental/billing/invoices → ${invoiceResp.status()}: ${(await invoiceResp.text()).slice(0, 200)}`,
    ).toBe(true)
    const invListResp = await apiReader.get(
      `/dental/billing/invoices?patientId=${patientId}&branchId=${branchId}`,
    )
    const invListBody = invListResp.ok() ? await invListResp.json() : null
    const invoices = Array.isArray(invListBody)
      ? invListBody
      : (invListBody?.data ?? invListBody?.items ?? [])
    expect(invoices.length, 'WF-013: the visit invoice must persist (independent read)').toBeGreaterThan(0)

    // ── Step 7: complete the visit through the pre-completion checklist (WF-012). ────
    const completeBtn = page.getByRole('button', { name: 'Complete visit' })
    await expect(completeBtn, 'Complete-visit affordance must render').toBeVisible({ timeout: 10_000 })
    await expect(completeBtn, 'Complete visit must be enabled while the visit is active').toBeEnabled({
      timeout: 10_000,
    })
    await completeBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog, 'pre-completion checklist must open').toBeVisible({ timeout: 10_000 })
    const confirmBtn = dialog.getByRole('button', { name: /Complete (Visit|anyway)/i })
    await expect(confirmBtn, 'checklist must present the completion CTA').toBeEnabled({ timeout: 10_000 })

    const [completeResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+/.test(r.url()) &&
          r.request().method() === 'PATCH' &&
          (r.request().postData() ?? '').includes('completed'),
        { timeout: 15_000 },
      ),
      confirmBtn.click(),
    ])
    expect(completeResp.status(), 'completion PATCH must be 2xx').toBeGreaterThanOrEqual(200)
    expect(completeResp.status(), 'completion PATCH must be 2xx').toBeLessThan(300)

    // Independent read-back: the visit is durably completed, zero active left.
    const finalRead = await apiReader.get(`/dental/visits/${visitId}`)
    expect(finalRead.ok(), `GET /dental/visits/${visitId} → ${finalRead.status()}`).toBe(true)
    expect((await finalRead.json())?.status, 'WF-012: visit must be durably completed').toBe('completed')
    await expect
      .poll(async () => (await visitsByStatus(apiReader, branchId, patientId, 'active')).length, {
        message: 'completing the visit must leave zero active visits',
        timeout: 10_000,
      })
      .toBe(0)

    // ── Step 8: PMD auto-generation (WF-021). Completing a visit auto-generates the
    //    Portable Medical Document (updateDentalVisit → generatePmdForVisit). Prove
    //    the immutable per-visit snapshot persisted with a checksum (independent read).
    await expect
      .poll(
        async () => {
          const r = await apiReader.get(`/dental/visits/${visitId}/pmd`)
          if (!r.ok()) return null
          const pmd = await r.json()
          return (pmd?.checksum ?? pmd?.data?.checksum) as string | null
        },
        {
          message: 'WF-021: completing the visit must auto-generate a PMD snapshot (checksum present)',
          timeout: 15_000,
        },
      )
      .toBeTruthy()

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
