/**
 * J22 — Complete a clinical visit (the closing half of the encounter).
 *
 * The triage behind UA_KG_UPGRADE found an embarrassing asymmetry: J21 hardened
 * *starting* a visit ("New Visit → active") after the incident, but *finishing* one
 * — the half that gates billing (only `completed`/performed treatments feed invoices)
 * — had no journey at all. The domain flow `complete-visit` was mapped with ZERO
 * covering journey. J22 closes that gap.
 *
 * The flow under test (pre-completion-checklist.tsx + workspace-top-bar.tsx):
 *   active visit  →  click "Complete visit" (top-bar, gated on status==='active')
 *   →  PreCompletionChecklist dialog runs 4 readiness checks  →  confirm
 *   ("Complete Visit", or "Complete anyway" when warnings exist)  →
 *   PATCH /dental/visits/:id {status:'completed'}.
 *
 * Goal-state, 4-clause DoD (CONTRIBUTING_FRONTEND.md / J21 reference):
 *   1. No silent error surface — EXCEPT the checklist's notes probe: a fresh visit
 *      has no SOAP notes, so getVisitNotes (GET /dental/visits/:id/notes) returns
 *      404 by design (checkSoapNotesPresent tolerates it as a warn). Declared
 *      explicitly via errorSurface.allowStatus(404, /notes/) rather than loosening
 *      the default — everything else must stay clean.
 *   2. Goal state, not existence — the visit must end `completed` (the durable,
 *      billing-gating state), not merely "the PATCH returned".
 *   3. Every step — the create (201) + activate (2xx) that set up an active visit,
 *      AND the completion PATCH (2xx) all asserted.
 *   4. Independent read — a SEPARATE apiReader session confirms status==='completed'
 *      from durable persistence, and that the patient has zero ACTIVE visits left.
 *
 * Like J21 it registers its OWN throwaway patient (allowed pre-journey API write) so
 * the precondition (no open visit) is deterministic regardless of demo-seed drift,
 * then drives the full start→complete arc through the DOM.
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
  id: 'J22',
  name: 'Complete a clinical visit (active → checklist → PATCH completed → one completed, zero active)',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-012'], // WORKFLOW_MAP.md §"Update (complete visit)" — active→completed (BR-002)
}

/** Register a throwaway patient with zero visits (allowed pre-journey seeding). */
async function registerFreshPatient(api: APIRequestContext, branchId: string): Promise<string> {
  const stamp = Date.now()
  const r = await api.post('/dental/patients', {
    data: {
      displayName: `J22 Complete-Visit Smoke ${stamp}`,
      dateOfBirth: '1990-01-01',
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
 * Make a visit completable. The backend gates completion of a non-empty visit on
 * a SIGNED consent form (VISIT_CONSENT_REQUIRED) + a notes row + no open treatments
 * (updateDentalVisit.ts). A fresh visit has none, so we seed a signed consent and
 * SOAP notes via the independent API (allowed pre-journey setup) — these are the
 * real clinical preconditions a clinician would have satisfied before completing.
 */
async function makeVisitCompletable(
  api: APIRequestContext,
  visitId: string,
  patientId: string,
): Promise<void> {
  const created = await api.post(`/dental/visits/${visitId}/consents`, {
    data: {
      visitId,
      patientId,
      templateId: 'j22-consent',
      templateName: 'J22 General Treatment Consent',
      procedureNature: 'Routine examination',
    },
  })
  if (!created.ok()) throw new Error(`create consent → ${created.status()}: ${(await created.text()).slice(0, 200)}`)
  const consentId = (await created.json())?.id
  if (!consentId) throw new Error('create consent: response carried no id')

  const signed = await api.post(`/dental/visits/${visitId}/consents/${consentId}/sign`, {
    data: { signatureData: 'data:image/png;base64,SIGNEDCONTENT' },
  })
  if (!signed.ok()) throw new Error(`sign consent → ${signed.status()}: ${(await signed.text()).slice(0, 200)}`)

  const notes = await api.post(`/dental/visits/${visitId}/notes`, {
    data: {
      visitId,
      subjective: 'Patient reports no pain.',
      objective: 'Soft tissues normal.',
      assessment: 'Healthy dentition.',
      plan: 'Routine recall in 6 months.',
    },
  })
  if (!notes.ok()) throw new Error(`upsert notes → ${notes.status()}: ${(await notes.text()).slice(0, 200)}`)
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

test(`${META.id} — ${META.name}`, async ({ page, apiReader, errorSurface }) => {
  try {
    // Clause 1, declared exception: the checklist probes SOAP notes on open; a
    // fresh visit has none, so GET /dental/visits/:id/notes is 404 by design.
    errorSurface.allowStatus(404, /\/dental\/visits\/[^/]+\/notes/)

    const { branchId } = await readOrgContext(apiReader)
    const patientId = await registerFreshPatient(apiReader, branchId)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // ── Setup arc: start a visit through the DOM (the proven New-Visit two-step).
    //    Asserted here only enough to satisfy clause 3 ("every step succeeded"); the
    //    creation flow itself is J21's charter. This puts the patient in the ACTIVE
    //    state J22's subject (completion) requires.
    const newVisitBtn = page.getByTestId('new-visit-btn')
    await expect(newVisitBtn, 'New Visit affordance must render').toBeVisible({ timeout: 10_000 })
    await expect(newVisitBtn, 'New Visit must be enabled for a patient with no open visit').toBeEnabled()

    const [createResp, activateResp] = await Promise.all([
      page.waitForResponse(
        (r) => /\/dental\/visits(\?|$)/.test(r.url().split('#')[0]!) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.waitForResponse(
        (r) => /\/dental\/visits\/[^/?]+/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 15_000 },
      ),
      newVisitBtn.click(),
    ])
    expect(createResp.status(), 'setup step 1: POST /dental/visits → 201 (draft)').toBe(201)
    expect(activateResp.status(), 'setup step 2: PATCH → active must be 2xx').toBeGreaterThanOrEqual(200)
    expect(activateResp.status(), 'setup step 2: activate PATCH must be 2xx').toBeLessThan(300)
    const visitId: string | undefined = (await createResp.json())?.id
    expect(visitId, 'create response must carry the visit id').toBeTruthy()

    // Satisfy the backend completion preconditions (signed consent + notes). These
    // are real clinical prerequisites, seeded via the independent API as setup so
    // the DOM-driven completion below exercises the genuine SUCCESS path.
    await makeVisitCompletable(apiReader, visitId!, patientId)

    // ── Subject under test: complete the visit.
    const completeBtn = page.getByRole('button', { name: 'Complete visit' })
    await expect(completeBtn, 'Complete-visit affordance must render in the top bar').toBeVisible({
      timeout: 10_000,
    })
    await expect(
      completeBtn,
      'Complete visit must be ENABLED once the visit is active (gated on status===active)',
    ).toBeEnabled({ timeout: 10_000 })
    await completeBtn.click()

    // The pre-completion checklist dialog opens and runs its readiness checks.
    const dialog = page.getByRole('dialog')
    await expect(dialog, 'pre-completion checklist dialog must open').toBeVisible({ timeout: 10_000 })
    // For a fresh visit the checks warn (no consent / no notes), so the confirm CTA
    // reads "Complete anyway"; a fully-ready visit would read "Complete Visit".
    const confirmBtn = dialog.getByRole('button', { name: /Complete (Visit|anyway)/i })
    await expect(
      confirmBtn,
      'checklist must finish loading and present the completion CTA',
    ).toBeEnabled({ timeout: 10_000 })

    // Clause 3: the completion PATCH must succeed. Disambiguate from the activate
    // PATCH above by requiring the request body to carry status:"completed".
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
    expect(
      completeResp.status(),
      'PATCH /dental/visits/:id {status:completed} must be 2xx',
    ).toBeGreaterThanOrEqual(200)
    expect(completeResp.status(), 'completion PATCH must be 2xx').toBeLessThan(300)

    // User-visible reflection: the dialog closes and Complete-visit goes disabled
    // (the visit is no longer active).
    await expect(dialog, 'checklist dialog closes on success').toBeHidden({ timeout: 10_000 })
    await expect(
      completeBtn,
      'Complete visit must become disabled once the visit is no longer active',
    ).toBeDisabled({ timeout: 10_000 })

    // Clause 2 + 4: independent read confirms the GOAL state (completed), and that
    // no ACTIVE visit remains for the patient.
    const goalRead = await apiReader.get(`/dental/visits/${visitId}`)
    expect(goalRead.ok(), `independent goal read GET /dental/visits/${visitId} → ${goalRead.status()}`).toBe(true)
    expect(
      (await goalRead.json())?.status,
      'the visit must be durably completed (status==="completed"), not stranded active',
    ).toBe('completed')

    await expect
      .poll(async () => (await visitsByStatus(apiReader, branchId, patientId, 'active')).length, {
        message: 'completing the visit must leave zero ACTIVE visits for the patient',
        timeout: 10_000,
      })
      .toBe(0)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
