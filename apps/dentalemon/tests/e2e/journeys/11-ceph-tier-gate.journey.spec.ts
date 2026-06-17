/**
 * B01 — Free-tier ceph gate (CIMG-001 / CIMG-002 / CIMG-007).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §B01
 * Spec ref: CIMG-001 (free → 403), CIMG-002 (null tier = free → 403).
 * Persona: free-clinic dentist. Expected verdict: PASS.
 *
 * Exercised against a DEDICATED free-tier clinic (seed §8.7): "Budget Dental
 * Clinic" (free@dentalemon.com / PIN 111111) on the FREE imaging tier, holding a
 * downgrade-seeded cephalometric image (uploaded while briefly on addon, then the
 * org reverted to free). Ceph ANALYSIS on that image must 403, and the UI must
 * surface the tier gate rather than a silent empty state.
 *
 * DOM-driven: sign in as the free dentist → open imaging → select the ceph image
 * → the ceph panel surfaces the add-on/tier gate. The 403 is asserted via an
 * independent read with the free clinic's OWN session.
 */
import {
  test,
  expect,
  type JourneyMeta,
  API,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  FREE_EMAIL,
  FREE_PASSWORD,
  pwRequest,
  recordJourneyPass,
  recordJourneyError,
  recordJourneySkipped,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'B01',
  name: 'Free-tier ceph gate (CIMG-001/002/007)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['CIMG-001', 'CIMG-002', 'CIMG-007'],
}

test(`${META.id} — ${META.name}`, async ({ page, errorSurface }) => {
  // P2-A: NEGATIVE journey — the free-tier ceph gate MUST return 403 on
  // landmarks/analysis. Declare it as the expected error surface so the firewall
  // does not flag the deliberate gate response.
  errorSurface.allowStatus(403, /\/ceph\//)
  // Independent-read client authenticated as the FREE clinic owner (its own org,
  // not the demo seed owner). Used for the post-UI gate assertion.
  const freeApi = await pwRequest.newContext({ baseURL: API })

  // Environment precondition (hoisted before try/catch so an honest skip is not
  // swallowed and re-recorded as ERROR). No seeded free-tier ceph image ⇒
  // storage/MinIO is absent in this environment (e.g. CI has no MinIO) ⇒ skip
  // honestly. A genuine sign-in/read failure here throws uncaught (real RED).
  const signIn = await freeApi.post('/auth/sign-in/email', {
    data: { email: FREE_EMAIL, password: FREE_PASSWORD },
  })
  if (!signIn.ok()) {
    throw new Error(
      `Free-tier clinic sign-in failed (${signIn.status()}). Is the demo seed present? Run \`bun run db:reseed\`.`,
    )
  }

  const { branchId } = await readOrgContext(freeApi)
  const patientId = await readPatientIdByName(freeApi, branchId, 'Free Patient')

  // Resolve the seeded free-tier cephalometric image (independent read).
  const imgsResp = await freeApi.get(`/dental/patients/${patientId}/images?branchId=${branchId}`)
  const imgs = imgsResp.ok() ? await imgsResp.json() : []
  const items: any[] = Array.isArray(imgs) ? imgs : (imgs.items ?? imgs.data ?? [])
  const ceph = items.find((i) => /cephalometric/i.test(i.modality ?? i.imageModality ?? ''))
  if (!ceph) {
    const reason = 'No seeded free-tier ceph image (storage/MinIO unavailable in this environment).'
    recordJourneySkipped(META, reason)
    await freeApi.dispose()
    test.skip(true, reason)
    return
  }
  const imageId = ceph.id ?? ceph.imageId

  try {
    // ── DOM-only journey (as the free-tier dentist) ───────────────────────────
    await pinAuth(page, 'freeDentist', { email: FREE_EMAIL, password: FREE_PASSWORD })
    await openWorkspace(page, patientId)

    await page.getByTestId('imaging-tab-btn').click()
    await expect(page.getByTestId('imaging-overlay')).toBeVisible({ timeout: 10_000 })

    // Select the ceph image FOR VIEWING. The row's <li> also holds a comparison
    // checkbox, and clicking the <li> centre can land off the view-select region
    // (PatientImageList: the `onSelectImage` handler is on the inner cursor-pointer
    // div, NOT the <li>), leaving the viewer on "Select an image to view" and the
    // ceph panel un-mounted. Click the modality/filename text inside that div, and
    // fail loudly (no silent `if (count)` skip) if the row is missing.
    const cephRow = page
      .getByTestId('imaging-overlay')
      .locator('li')
      .filter({ hasText: /cephalometric/i })
      .first()
    await expect(cephRow, 'seeded free-tier cephalometric image must appear in the list').toBeVisible({ timeout: 10_000 })
    await cephRow.getByText(/cephalometric/i).click()

    // The ceph toggle only renders once an image is loaded into the viewer — its
    // appearance confirms the selection actually registered.
    const cephToggle = page.getByRole('button', { name: /toggle ceph panel/i }).first()
    await expect(cephToggle, 'image must be selected (viewer toolbar present) before opening the ceph panel').toBeVisible({ timeout: 15_000 })
    await cephToggle.click()
    await page.waitForLoadState('networkidle')

    // ── Independent-read gate assertion (free clinic's own session) ───────────
    // CORE (CIMG-001/002): free/null-tier ceph analysis must be server-gated → 403.
    const analysisResp = await freeApi.get(`/dental/imaging/images/${imageId}/ceph/analysis`)
    expect(
      analysisResp.status(),
      'free/null-tier ceph analysis must be gated → 403 (CIMG-001/002)',
    ).toBe(403)

    // The gate must be SURFACED to the clinician (not a silent empty state). The
    // ceph panel's analysis query retries the 403 before its error state flips, so
    // wait for the add-on message rather than sampling once.
    const gateMessage = page
      .getByText(/add-?on tier|requires the addon|requires an imaging add-?on|upgrade your plan/i)
      .first()
    await expect(
      gateMessage,
      'the ceph panel must surface the imaging add-on / tier gate (not a silent empty state)',
    ).toBeVisible({ timeout: 15_000 })

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  } finally {
    await freeApi.dispose()
  }
})
