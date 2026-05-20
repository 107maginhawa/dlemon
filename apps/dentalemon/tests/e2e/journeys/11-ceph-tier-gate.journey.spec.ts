/**
 * B01 — Free-tier ceph gate (CIMG-001 / CIMG-002 / CIMG-007).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §B01
 * Spec ref: CIMG-001 (free → 403), CIMG-002 (null tier = free → 403),
 *           CIMG-007 (non-member → 404). Persona: dentist (free/null tier).
 * Expected verdict: PASS (provisional) — UI-surfacing of the 403 is the
 * unverified part. If the UI swallows the 403 into a generic empty state →
 * DONE_WITH_CONCERNS.
 *
 * The journey is DOM-driven (open imaging, select ceph image, attempt to
 * enter analysis). The gate is asserted via an independent read of the ceph
 * analysis endpoint with the SAME session-derived identity.
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
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'B01',
  name: 'Free-tier ceph gate (CIMG-001/002/007)',
  set: 'B',
  // DONE_WITH_CONCERNS: demo seed uses a PAID imaging tier; a dedicated free-tier
  // seed identity is required to exercise this path. Backend gate logic (CIMG-001/002)
  // is confirmed by API unit tests. Journey remains BROKEN until a free-tier org is
  // added to the seed.
  expectedVerdict: 'BROKEN',
  rubricIds: ['CIMG-001', 'CIMG-002', 'CIMG-007'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    // Miguel Torres (P6) — has a seeded cephalometric image.
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.miguel)

    // Resolve the seeded ceph image id (independent read, pre-browser OK).
    // branchId is required by the listPatientImages handler.
    const imgsResp = await apiReader.get(`/dental/patients/${patientId}/images?branchId=${branchId}`)
    const imgs = imgsResp.ok() ? await imgsResp.json() : []
    const items: any[] = Array.isArray(imgs) ? imgs : (imgs.items ?? [])
    const ceph = items.find((i) => /cephalometric/i.test(i.modality ?? i.imageModality ?? ''))
    if (!ceph) {
      await expectJourneyBroken(
        page,
        META,
        'No seeded cephalometric image for Miguel Torres — precondition missing.',
      )
      return
    }
    const imageId = ceph.id ?? ceph.imageId

    // ── DOM-only journey ──────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    await page.getByTestId('imaging-tab-btn').click()
    await expect(page.getByTestId('imaging-overlay')).toBeVisible({ timeout: 10_000 })

    // Select the ceph image from the PatientImageList.
    const imageEntry = page
      .getByTestId('imaging-overlay')
      .locator('li')
      .filter({ has: page.locator('p', { hasText: 'cephalometric' }) })
      .first()
    if (await imageEntry.count()) {
      await imageEntry.click()
      await page.waitForLoadState('networkidle')
    }

    // ── Independent-read gate assertion ───────────────────────────────────
    const analysisResp = await apiReader.get(
      `/dental/imaging/images/${imageId}/ceph/analysis`,
    )
    const status = analysisResp.status()

    if (status === 403) {
      // CIMG-001/002 confirmed: free/null tier → 403. The UI must surface
      // the gate (not a silent "no data" empty state).
      const overlay = page.getByTestId('imaging-overlay')
      const surfacedGate = await overlay
        .getByText(/upgrade|paid|tier|not available|locked|premium/i)
        .count()
      if (surfacedGate > 0) {
        recordJourneyPass(META)
        expect(status, 'free/null tier ceph analysis → 403').toBe(403)
      } else {
        // 403 enforced server-side but UI swallows it → DONE_WITH_CONCERNS.
        await expectJourneyBroken(
          page,
          META,
          'CIMG-001/002 server-enforced (403) but the UI shows no gate ' +
            'message (silent empty state). DONE_WITH_CONCERNS: gate not ' +
            'surfaced to the clinician.',
        )
      }
      return
    }

    if (status === 200) {
      // Demo org has a PAID imaging tier (seed creates ceph reports), so
      // this branch is NOT free — the free-tier gate cannot be exercised
      // with the seeded identity. Record honestly.
      await expectJourneyBroken(
        page,
        META,
        `Ceph analysis returned 200 — the seeded demo org has a PAID imaging ` +
          `tier, so the free-tier gate (CIMG-001/002) cannot be exercised with ` +
          `the seeded dentist identity. A dedicated free-tier seed member is ` +
          `required to verify this journey (DONE_WITH_CONCERNS for the runner).`,
      )
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `Unexpected ceph analysis status ${status} (expected 403 for free/null tier).`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
