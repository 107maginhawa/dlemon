/**
 * J28 — GDPR right-to-erasure: a platform admin approves a patient erasure request
 * through the Settings → Data Erasure queue (WF-088).
 *
 * JC-4: erasure is the highest-consequence destructive action and was backend-airtight
 * but UI-unverified live in the harness. This journey promotes the demo owner to the
 * platform `admin` role (dev-only /dev/promote-admin, mirrors AUTH_ADMIN_EMAILS), seeds
 * a real patient + erasure request via the API, then drives the real Approve control and
 * confirms the request is DURABLY `anonymized` via an independent read.
 *
 * Promotion is done via apiReader (the demo owner's OWN session) BEFORE the browser
 * signs in, so pinAuth's fresh sign-in already carries the admin role — no session-
 * refetch dance. Erasure is admin-gated platform-wide, not branch-scoped, so it does
 * not disturb the clinical (branch-role) journeys; the harness reseeds each run anyway.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  spaNavigate,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import type { APIRequestContext } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J28',
  name: 'Platform admin approves a patient erasure request → durably anonymized',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-088'],
}

async function erasureStatus(
  api: APIRequestContext,
  personId: string,
): Promise<string[]> {
  const r = await api.get(`/dental/erasure-requests?subjectPersonId=${personId}`)
  if (!r.ok()) throw new Error(`list erasure requests → ${r.status()}`)
  const rows = ((await r.json()).data ?? []) as Array<{ status: string }>
  return rows.map((x) => x.status)
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { orgId, branchId } = await readOrgContext(apiReader)

    // Promote the demo owner to the platform admin role (apiReader = demo owner's
    // session). Done before the browser signs in so pinAuth carries admin fresh.
    const promote = await apiReader.post('/dev/promote-admin')
    expect(promote.ok(), `/dev/promote-admin → ${promote.status()}`).toBe(true)

    // Seed the erasure subject (a real patient) + one erasure request for it.
    const patRes = await apiReader.post('/dental/patients', {
      data: {
        displayName: `J28 Erasure Subject ${Date.now()}`,
        dateOfBirth: '1985-06-15',
        gender: 'female',
        consentGiven: true,
        branchId,
      },
    })
    expect(patRes.ok(), `create patient → ${patRes.status()}`).toBe(true)
    const patient = await patRes.json()
    const personId: string = patient.person?.id ?? patient.personId
    const patientId: string = patient.id
    expect(personId, 'patient must expose a personId').toBeTruthy()

    const reqRes = await apiReader.post('/dental/erasure-requests', {
      data: {
        subjectPersonId: personId,
        subjectPatientId: patientId,
        tenantId: orgId,
        reason: 'J28 Art.17 erasure — approve leg',
      },
    })
    expect(reqRes.ok(), `create erasure request → ${reqRes.status()}: ${(await reqRes.text().catch(() => '')).slice(0, 200)}`).toBe(true)

    // ── DOM drive: admin opens Settings → Data Erasure and approves the request. ──
    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/settings')
    await page.getByRole('tab', { name: 'Data Erasure', exact: true }).click()
    await expect(page.getByTestId('data-erasure-table'), 'erasure queue must render for admin').toBeVisible({
      timeout: 15_000,
    })

    // Scope to THIS run's subject (the platform-wide queue may carry other rows).
    const shortId = personId.slice(0, 8)
    const myRow = page.getByTestId('data-erasure-row').filter({ hasText: shortId })
    await expect(myRow, 'the seeded erasure request must appear in the queue').toHaveCount(1, {
      timeout: 10_000,
    })

    const [approveResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/erasure-requests\/[^/?]+\/approve/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      myRow.getByTestId('data-erasure-approve').click(),
    ])
    expect(approveResp.status(), 'approve POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(approveResp.status(), 'approve POST must be 2xx').toBeLessThan(300)

    // Independent read: the request is durably `anonymized`.
    await expect
      .poll(async () => (await erasureStatus(apiReader, personId)).join(','), {
        message: 'WF-088: approving must durably anonymize the erasure request',
        timeout: 15_000,
      })
      .toBe('anonymized')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
