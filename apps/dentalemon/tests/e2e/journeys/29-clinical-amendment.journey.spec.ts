/**
 * J29 — File a clinical amendment against a completed visit's tooth record (WF-038).
 *
 * JC-6 de-aspirationalization: WF-038 (clinical amendment entity) was credited to J10,
 * but J10 only drives the SOAP-note ADDENDUM path (WF-028) — it never creates an
 * Amendment. This journey drives the real AmendmentForm (read-only completed visit →
 * open a charted tooth with a treatment → "Add Amendment" → reason + details → Save)
 * and confirms the amendment persisted via an independent read of the amendments list.
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
  id: 'J29',
  name: 'File a clinical amendment on a completed visit tooth record (UI) → persisted',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-038'],
}

const TOOTH = 11

async function post(api: APIRequestContext, path: string, data: unknown): Promise<any> {
  const r = await api.post(path, { data })
  if (!r.ok()) throw new Error(`POST ${path} → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}
async function patchStatus(api: APIRequestContext, path: string, data: unknown): Promise<any> {
  const r = await api.patch(path, { data })
  if (!r.ok()) throw new Error(`PATCH ${path} → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

/** Seed a COMPLETED visit with a charted, performed treatment on TOOTH (amendable record). */
async function seedAmendableVisit(
  api: APIRequestContext,
  branchId: string,
  memberId: string,
): Promise<{ patientId: string; visitId: string }> {
  const patient = await post(api, '/dental/patients', {
    displayName: `J29 Amendment Subject ${Date.now()}`,
    dateOfBirth: '1990-01-01',
    gender: 'male',
    consentGiven: true,
    branchId,
  })
  const patientId: string = patient.id
  const visit = await post(api, '/dental/visits', { patientId, branchId, dentistMemberId: memberId })
  const visitId: string = visit.id
  await patchStatus(api, `/dental/visits/${visitId}`, { status: 'active' })
  // Chart teeth so the completed card renders a clickable tooth.
  await post(api, `/dental/patients/${patientId}/dentition`, { dateOfBirth: '1990-01-01', visitId })
  // Signed consent (gate for performed + completion).
  const consent = await post(api, `/dental/visits/${visitId}/consents`, {
    visitId, patientId, templateId: 'j29-consent', templateName: 'J29 Consent', procedureNature: 'Routine',
  })
  const consentId = consent.id ?? consent.consent?.id
  await post(api, `/dental/visits/${visitId}/consents/${consentId}/sign`, {
    signatureData: 'data:image/png;base64,SIGNEDCONTENT',
  })
  // Treatment on TOOTH, performed.
  const tx = await post(api, `/dental/visits/${visitId}/treatments`, {
    visitId, patientId, cdtCode: 'D2330', description: 'Resin restoration', priceCents: 180000, toothNumber: TOOTH,
  })
  await patchStatus(api, `/dental/visits/${visitId}/treatments/${tx.id}`, { status: 'planned' })
  await patchStatus(api, `/dental/visits/${visitId}/treatments/${tx.id}`, { status: 'performed' })
  // Complete → the visit becomes read-only (amendment, not edit, is the only path).
  await patchStatus(api, `/dental/visits/${visitId}`, { status: 'completed' })
  return { patientId, visitId }
}

async function listAmendments(api: APIRequestContext, visitId: string): Promise<Array<Record<string, unknown>>> {
  const r = await api.get(`/dental/visits/${visitId}/amendments`)
  if (!r.ok()) throw new Error(`list amendments → ${r.status()}`)
  const body = await r.json()
  return Array.isArray(body) ? body : (body.data ?? body.items ?? [])
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)
    const { patientId, visitId } = await seedAmendableVisit(apiReader, branchId, memberId)

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Open the charted tooth on the (read-only) completed visit card.
    const tooth = page.locator(`[data-active-card="1"] [data-testid="tooth-${TOOTH}"]`)
    await expect(tooth, `tooth ${TOOTH} must render on the completed visit card`).toBeVisible({
      timeout: 15_000,
    })
    await tooth.click()
    const slideout = page.getByTestId('tooth-slideout')
    await expect(slideout, 'tooth slideout must open').toBeVisible({ timeout: 10_000 })

    // Drive the amendment: "Add Amendment" → reason + details → Save.
    await slideout.getByRole('button', { name: 'Add Amendment' }).click()
    const form = page.getByTestId('amendment-form')
    await expect(form, 'amendment form must open').toBeVisible({ timeout: 10_000 })
    const detail = `J29 corrected anesthetic dosage note ${Date.now()}`
    await page.locator('#amendment-reason').selectOption('correction')
    await page.locator('#amendment-content').fill(detail)

    const [amendResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+\/amendments/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      form.getByRole('button', { name: 'Save Amendment' }).click(),
    ])
    expect(amendResp.status(), 'amendment POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(amendResp.status(), 'amendment POST must be 2xx').toBeLessThan(300)

    // Independent read: the amendment entity persisted with our typed content + reason.
    const amendments = await listAmendments(apiReader, visitId)
    const mine = amendments.find((a) => a.content === detail && a.reason === 'correction')
    expect(
      mine,
      `WF-038: the UI-authored amendment must persist (got: ${JSON.stringify(amendments).slice(0, 300)})`,
    ).toBeTruthy()

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
