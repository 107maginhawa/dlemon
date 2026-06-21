/**
 * J30 — The in-visit consent gate BLOCKS marking a treatment performed without a
 * signed consent (WF-018 / BR-014).
 *
 * JC-6 de-aspirationalization: J19 proves the case-presentation e-sign, not the
 * in-visit consent gate on WF-010/WF-012. This journey proves the gate's TEETH:
 * with NO signed consent, driving "Mark Done" through the UI must be REJECTED
 * (422 TREATMENT_CONSENT_REQUIRED) and the treatment must stay un-performed — proven
 * by an independent read. A negative/expected-error journey (the 422 + consent toast
 * are the asserted outcome, declared to the error-surface firewall).
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
  id: 'J30',
  name: 'Consent gate blocks mark-performed without a signed consent (BR-014)',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-018'],
}

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

async function treatmentStatus(api: APIRequestContext, visitId: string, treatmentId: string): Promise<string | undefined> {
  const r = await api.get(`/dental/visits/${visitId}/treatments`)
  if (!r.ok()) throw new Error(`list treatments → ${r.status()}`)
  const body = await r.json()
  const items: Array<{ id: string; status?: string }> = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
  return items.find((t) => t.id === treatmentId)?.status
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader, errorSurface }) => {
  try {
    // Declared expected outcome: the gate rejects mark-performed with a 422 on the
    // treatment PATCH + a "consent required" toast. Everything else stays clean.
    errorSurface.allowStatus(422, /\/dental\/visits\/[^/]+\/treatments\//)
    errorSurface.allow(/consent/i)

    const { branchId, memberId } = await readOrgContext(apiReader)
    // Seed: active visit + a PLANNED treatment, and crucially NO signed consent.
    const patient = await post(apiReader, '/dental/patients', {
      displayName: `J30 Consent Gate ${Date.now()}`, dateOfBirth: '1990-01-01', gender: 'male', consentGiven: true, branchId,
    })
    const patientId: string = patient.id
    const visit = await post(apiReader, '/dental/visits', { patientId, branchId, dentistMemberId: memberId })
    const visitId: string = visit.id
    await patchStatus(apiReader, `/dental/visits/${visitId}`, { status: 'active' })
    const tx = await post(apiReader, `/dental/visits/${visitId}/treatments`, {
      visitId, patientId, cdtCode: 'D2330', description: 'Resin restoration', priceCents: 180000, toothNumber: 11,
    })
    // diagnosed → planned (no consent needed); the performed transition is the gated one.
    await patchStatus(apiReader, `/dental/visits/${visitId}/treatments/${tx.id}`, { status: 'planned' })

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Drive "Mark Done" in the treatment table — the planned→performed PATCH must 422.
    const markDone = page
      .getByRole('button', { name: /mark done|mark complete|complete treatment/i })
      .first()
    await expect(markDone, 'Mark-Done affordance must render for the planned treatment').toBeVisible({
      timeout: 10_000,
    })
    const [patchResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/visits\/[^/?]+\/treatments\/[^/?]+/.test(r.url()) &&
          r.request().method() === 'PATCH' &&
          (r.request().postData() ?? '').includes('performed'),
        { timeout: 15_000 },
      ),
      markDone.click({ force: true }),
    ])
    expect(
      patchResp.status(),
      'BR-014: marking performed WITHOUT a signed consent must be rejected (422)',
    ).toBe(422)
    const body = (await patchResp.json()) as { code?: string }
    expect(body.code, 'rejection must be TREATMENT_CONSENT_REQUIRED').toBe('TREATMENT_CONSENT_REQUIRED')

    // Independent read: the treatment did NOT reach performed — it stayed planned.
    await expect
      .poll(async () => treatmentStatus(apiReader, visitId, tx.id), {
        message: 'the gate must leave the treatment un-performed (still planned)',
        timeout: 8_000,
      })
      .not.toBe('performed')
    expect(await treatmentStatus(apiReader, visitId, tx.id)).toBe('planned')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
