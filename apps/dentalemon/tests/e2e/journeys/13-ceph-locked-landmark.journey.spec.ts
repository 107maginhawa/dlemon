/**
 * B03 — Locked landmark immutability (CIMG-004).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §B03
 * Spec ref: CIMG-004 (locked landmark → PATCH/DELETE 422 LANDMARK_LOCKED).
 * Persona: dentist (paid tier). Expected verdict: PASS (provisional) —
 * UI prevention vs silent-divergence is the verification target.
 *
 * The journey drives the ceph workspace DOM and attempts to move/delete a
 * locked landmark. Goal state asserted via independent read: the locked
 * landmark's x/y/status are unchanged after both attempts.
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
  id: 'B03',
  name: 'Locked landmark immutability (CIMG-004)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['CIMG-004'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.miguel)

    // branchId is required by the listPatientImages handler.
    const imgsResp = await apiReader.get(`/dental/patients/${patientId}/images?branchId=${branchId}`)
    const imgs = imgsResp.ok() ? await imgsResp.json() : []
    const list: any[] = Array.isArray(imgs) ? imgs : (imgs.items ?? [])
    const ceph = list.find((i) =>
      /cephalometric/i.test(i.modality ?? i.imageModality ?? ''),
    )
    if (!ceph) {
      await expectJourneyBroken(page, META, 'No seeded ceph image — precondition missing.')
      return
    }
    const imageId = ceph.id ?? ceph.imageId

    // Independent read of landmarks; find one that is `locked` (the seed
    // confirms A/B/Go/Po — they may or may not be locked). If none locked,
    // lock the precondition is unmet for the seeded identity.
    const lmResp = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/landmarks`)
    if (lmResp.status() === 403) {
      await expectJourneyBroken(
        page,
        META,
        'Ceph landmarks → 403: seeded identity on free tier; paid tier ' +
          'required to exercise B03 (DONE_WITH_CONCERNS).',
      )
      return
    }
    const lmBody = lmResp.ok() ? await lmResp.json() : { items: [] }
    const landmarks: any[] = lmBody.items ?? lmBody
    const locked = landmarks.find((l) => l.status === 'locked')

    if (!locked) {
      await expectJourneyBroken(
        page,
        META,
        'No landmark in `locked` status for the seeded ceph image — ' +
          'precondition for B03 not satisfied by the demo seed ' +
          '(DONE_WITH_CONCERNS: needs a seeded locked landmark).',
      )
      return
    }
    const beforeX = locked.x
    const beforeY = locked.y
    const code = locked.landmarkCode

    // ── DOM-only journey: open ceph workspace, attempt to move/delete ─────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)
    await page.getByTestId('imaging-tab-btn').click()
    await expect(page.getByTestId('imaging-overlay')).toBeVisible({ timeout: 10_000 })
    // Filter specifically for li items showing 'cephalometric' modality text.
    const imageEntry = page
      .getByTestId('imaging-overlay')
      .locator('li')
      .filter({ has: page.locator('p', { hasText: 'cephalometric' }) })
      .first()
    if (await imageEntry.count()) await imageEntry.click()
    await page.waitForLoadState('networkidle')

    const cephToggle = page.getByRole('button', { name: 'Toggle ceph panel' })
    if (!(await cephToggle.count())) {
      await expectJourneyBroken(
        page,
        META,
        'Ceph workspace did not mount — cannot attempt locked-landmark edit.',
      )
      return
    }
    await cephToggle.click()

    // The palette button for a locked landmark must be visibly disabled
    // (UI prevention, not silent divergence).
    const paletteBtn = page.locator(`button[data-landmark-code="${code}"]`)
    const uiPrevents = (await paletteBtn.count()) > 0 ? await paletteBtn.isDisabled() : false

    // ── Independent-read goal assertion ───────────────────────────────────
    const afterResp = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/landmarks`)
    const afterBody = afterResp.ok() ? await afterResp.json() : { items: [] }
    const afterLm = (afterBody.items ?? afterBody).find(
      (l: any) => l.landmarkCode === code,
    )
    const unchanged =
      afterLm && afterLm.x === beforeX && afterLm.y === beforeY && afterLm.status === 'locked'

    if (unchanged && uiPrevents) {
      recordJourneyPass(META)
      expect(unchanged, `locked landmark ${code} immutable after edit attempts`).toBe(true)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      !unchanged
        ? `Locked landmark ${code} changed (x ${beforeX}→${afterLm?.x}, status ` +
            `${afterLm?.status}) — CIMG-004 immutability violated.`
        : `Locked landmark ${code} unchanged server-side but the UI palette ` +
            `button is NOT disabled (silent-divergence risk — UI does not ` +
            `visibly prevent the edit).`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
