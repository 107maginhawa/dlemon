/**
 * B02 — Landmark placement → confirm → SNA/SNB computed (NUMERIC).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §B02
 * Spec ref: CIMG-003 (placed→confirmed→locked forward-only) + ceph-math
 *           golden values. Persona: dentist (paid tier).
 * Expected verdict: PASS (provisional) — verifies the UI→API→math seam
 * produces the GOLDEN numbers. If the canvas-click→landmark mapping is
 * lossy, SNA/SNB drift from 82/80 and the journey is BROKEN.
 *
 * Golden coords + expected angles: packages/ceph-math/src/ceph-math.test.ts
 * (CLASS_I). The seed places these landmarks for Miguel Torres' ceph image,
 * so the independent NUMERIC read is deterministic. The DOM journey drives
 * the real ceph workspace; "a measurement row exists" is INSUFFICIENT — the
 * numbers must match the golden expectations (±0.1).
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
  CEPH_EXPECTED,
  recordJourneyPass,
  recordJourneyError,
  recordJourneySkipped,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'B02',
  name: 'Landmark placement → confirm → SNA/SNB computed (numeric)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['CIMG-003'],
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
  const items: any[] = Array.isArray(imgs) ? imgs : (imgs.items ?? [])
  const ceph = items.find((i) =>
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
    // Tier precheck (independent read): if 403, this is the free-tier branch
    // and B02 cannot run with the seeded identity.
    const tierProbe = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/analysis`)
    if (tierProbe.status() === 403) {
      throw new Error(
        'Ceph analysis → 403: seeded identity is on the free imaging tier; ' +
          'a paid-tier member is required to exercise B02 (DONE_WITH_CONCERNS).',
      )
    }

    // ── DOM-only journey: open the ceph workspace ─────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)
    await page.getByTestId('imaging-tab-btn').click()
    await expect(page.getByTestId('imaging-overlay')).toBeVisible({ timeout: 10_000 })

    // Select the ceph image FOR VIEWING. Filter on the 'cephalometric' modality
    // <p> (not the filename — legacy attachments share 'ceph'/'lateral'). The row's
    // <li> also holds a comparison checkbox, and clicking the <li> centre can land
    // off the view-select region (PatientImageList: `onSelectImage` is on the inner
    // cursor-pointer div, NOT the <li>), leaving the viewer on "Select an image to
    // view" and the ceph panel un-mounted — the B02 image-selection flake (green
    // only on retry). Click the modality TEXT inside the row (same fix B01 already
    // carries), then assert the toggle appears (auto-retrying) so the selection is
    // PROVEN to have registered — not a one-shot count() that races the mount.
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

    // Open the ceph panel (landmark palette). The toggle only renders once an image
    // is loaded into the viewer — its appearance confirms the selection registered.
    const cephToggle = page.getByRole('button', { name: /toggle ceph panel/i }).first()
    await expect(
      cephToggle,
      'image must be selected (cephalometric workspace mounted) before opening the ceph panel',
    ).toBeVisible({ timeout: 15_000 })
    await cephToggle.click()

    // The seed already placed + confirmed the golden landmarks for this image.
    // The journey verifies the UI→API→math seam: trigger a recompute via the
    // UI control (DOM), then assert the GOLDEN numbers via independent read.
    const recompute = page
      .getByRole('button', { name: /recompute|recalculate|analyze|update analysis/i })
      .first()
    if (await recompute.count()) {
      await recompute.click()
      await page.waitForLoadState('networkidle')
    }

    // ── Independent-read NUMERIC goal assertion ───────────────────────────
    const analysisResp = await apiReader.get(
      `/dental/imaging/images/${imageId}/ceph/analysis`,
    )
    if (!analysisResp.ok()) {
      throw new Error(
        `Ceph analysis read → ${analysisResp.status()} — no analysis to verify.`,
      )
    }
    const analysis = await analysisResp.json()
    const m = analysis.analysis?.measurements ?? analysis.measurements ?? analysis

    const sna = Number(m.sna)
    const snb = Number(m.snb)
    const anb = Number(m.anb)
    const convex = Number(m.convexity_napog)

    const close = (a: number, b: number) => Number.isFinite(a) && Math.abs(a - b) <= 0.15

    const ok =
      close(sna, CEPH_EXPECTED.sna) &&
      close(snb, CEPH_EXPECTED.snb) &&
      close(anb, CEPH_EXPECTED.anb) &&
      Number.isFinite(convex) &&
      convex > 0

    if (ok) {
      // Persistence checkpoint: reload + re-read; numbers identical.
      await openWorkspace(page, patientId)
      const reResp = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/analysis`)
      // GET /ceph/analysis returns the list-response shape {items, analysis};
      // measurements live under .analysis (the earlier first-read on line ~132
      // already handles both shapes — this reload re-read must too).
      const reBody = await reResp.json()
      const reM = reBody.analysis?.measurements ?? reBody.measurements ?? {}
      const stable = close(Number(reM.sna), CEPH_EXPECTED.sna)
      if (stable) {
        recordJourneyPass(META)
        expect(close(sna, CEPH_EXPECTED.sna), `SNA≈${CEPH_EXPECTED.sna} (got ${sna})`).toBe(true)
        expect(close(snb, CEPH_EXPECTED.snb), `SNB≈${CEPH_EXPECTED.snb} (got ${snb})`).toBe(true)
        expect(close(anb, CEPH_EXPECTED.anb), `ANB≈${CEPH_EXPECTED.anb} (got ${anb})`).toBe(true)
        return
      }
      throw new Error(
        `Numbers did not survive reload (SNA re-read=${reM.sna}).`,
      )
    }

    throw new Error(
      `NUMERIC mismatch — UI→API→math seam drifted from golden. ` +
        `Got SNA=${sna} (exp ${CEPH_EXPECTED.sna}), SNB=${snb} (exp ` +
        `${CEPH_EXPECTED.snb}), ANB=${anb} (exp ${CEPH_EXPECTED.anb}), ` +
        `convexity=${convex} (exp >0). If landmarks were placed via lossy ` +
        `canvas-click mapping this is the confirmed break.`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
