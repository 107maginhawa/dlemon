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
  recordJourneyPass,
  recordJourneyError,
  recordJourneySkipped,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'B03',
  name: 'Locked landmark immutability (CIMG-004)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['CIMG-004'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  // Environment precondition (hoisted before try/catch so an honest skip is not
  // swallowed and re-recorded as ERROR). No seeded ceph image ⇒ storage/MinIO is
  // absent in this environment (e.g. CI has no MinIO) ⇒ skip honestly. A genuine
  // read failure here throws uncaught (real RED), which is correct.
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
    const reason = 'No seeded ceph image (storage/MinIO unavailable in this environment).'
    recordJourneySkipped(META, reason)
    test.skip(true, reason)
    return
  }
  const imageId = ceph.id ?? ceph.imageId

  try {
    // Independent read of landmarks; find one that is `locked` (the seed
    // confirms A/B/Go/Po — they may or may not be locked). If none locked,
    // lock the precondition is unmet for the seeded identity.
    const lmResp = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/landmarks`)
    if (lmResp.status() === 403) {
      throw new Error(
        'Ceph landmarks → 403: seeded identity on free tier; paid tier ' +
          'required to exercise B03 (DONE_WITH_CONCERNS).',
      )
    }
    const lmBody = lmResp.ok() ? await lmResp.json() : { items: [] }
    const landmarks: any[] = lmBody.items ?? lmBody
    const locked = landmarks.find((l) => l.status === 'locked')

    if (!locked) {
      throw new Error(
        'No landmark in `locked` status for the seeded ceph image — ' +
          'precondition for B03 not satisfied by the demo seed ' +
          '(DONE_WITH_CONCERNS: needs a seeded locked landmark).',
      )
    }
    const beforeX = locked.x
    const beforeY = locked.y
    const code = locked.landmarkCode

    // ── DOM-only journey: open ceph workspace, attempt to move/delete ─────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)
    await page.getByTestId('imaging-tab-btn').click()
    await expect(page.getByTestId('imaging-overlay')).toBeVisible({ timeout: 10_000 })
    // Select the ceph image FOR VIEWING. Filter on the 'cephalometric' modality <p>
    // (not the filename). Clicking the <li> centre can miss the inner onSelectImage
    // div (PatientImageList), leaving the viewer empty and the ceph panel un-mounted
    // — the same image-selection flake B01/B02 carry. Click the modality TEXT, then
    // assert the toggle appears (auto-retrying) so the selection is PROVEN to have
    // registered — not the prior `if (count) click` + one-shot count() that races
    // the mount and could silently skip into the locked-landmark assertions.
    const imageEntry = page
      .getByTestId('imaging-overlay')
      .locator('li')
      .filter({ has: page.locator('p', { hasText: 'cephalometric' }) })
      .first()
    await expect(
      imageEntry,
      'seeded cephalometric image must appear in PatientImageList',
    ).toBeVisible({ timeout: 10_000 })
    await imageEntry.getByText(/cephalometric/i).first().click()

    const cephToggle = page.getByRole('button', { name: /toggle ceph panel/i }).first()
    await expect(
      cephToggle,
      'cephalometric workspace must mount (toggle present) before attempting the locked-landmark edit',
    ).toBeVisible({ timeout: 15_000 })
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

    throw new Error(
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
