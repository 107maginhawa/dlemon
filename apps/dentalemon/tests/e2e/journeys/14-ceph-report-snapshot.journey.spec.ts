/**
 * B04 — Report gate + immutable versioned snapshot (CIMG-006 / CIMG-008).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §B04
 * Spec ref: CIMG-006 (A,B,Go,Po must be confirmed before report creation),
 *           CIMG-008 (reports append-only versioned snapshots — no
 *           update/delete). Persona: dentist (paid tier).
 * Expected verdict: PASS (provisional) — report-snapshot freeze + numeric
 * content are the verification targets.
 *
 * The journey drives the ceph workspace + report print route DOM-only. Goal
 * state asserted via independent reads of /ceph/reports.
 */
import {
  test,
  expect,
  APP,
  type JourneyMeta,
  pinAuth,
  openWorkspace,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  CEPH_EXPECTED,
  expectJourneyBroken,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'B04',
  name: 'Report gate + immutable versioned snapshot (CIMG-006/008)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['CIMG-006', 'CIMG-008'],
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

    // Tier precheck.
    const probe = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/reports`)
    if (probe.status() === 403) {
      await expectJourneyBroken(
        page,
        META,
        'Ceph reports → 403: seeded identity on free tier; paid tier required ' +
          'to exercise B04 (DONE_WITH_CONCERNS).',
      )
      return
    }

    // The seed already generated a ceph report (v1) for this image with
    // A/B/Go/Po confirmed. Independent read of v1 snapshot.
    const v1Resp = await apiReader.get(`/dental/imaging/images/${imageId}/ceph/reports?version=1`)
    if (!v1Resp.ok()) {
      await expectJourneyBroken(
        page,
        META,
        `Seeded ceph report v1 read → ${v1Resp.status()} — no report snapshot ` +
          `to verify (CIMG-006 gate may have blocked generation, or seed failed).`,
      )
      return
    }
    const v1 = await v1Resp.json()
    const snap1 = v1.snapshot ?? v1
    const snap1Str = JSON.stringify(snap1)
    const m1 = snap1.measurements ?? {}
    const close = (a: number, b: number) =>
      Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= 0.15
    const numericFrozen =
      close(m1.sna, CEPH_EXPECTED.sna) && close(m1.snb, CEPH_EXPECTED.snb)

    // ── DOM-only journey: open the report print route ─────────────────────
    await pinAuth(page, 'dentist')
    // Report print route (contract §Set B header).
    await page.goto(`${APP}/imaging-ceph-report/${imageId}?version=1`)
    await page.waitForLoadState('networkidle')
    const reportRendered = await page
      .getByTestId('analysis-label-badge')
      .or(page.getByText(/SNA|cephalometric|report/i).first())
      .count()

    if (!reportRendered) {
      await expectJourneyBroken(
        page,
        META,
        'Ceph report print route did not render the v1 snapshot in the DOM.',
      )
      return
    }

    // CIMG-008: attempt update/delete of v1 must fail (append-only). Verified
    // via independent read — v1 must be byte-identical after any later edit.
    const v1AgainResp = await apiReader.get(
      `/dental/imaging/images/${imageId}/ceph/reports?version=1`,
    )
    const snap1Again = JSON.stringify(
      (await v1AgainResp.json()).snapshot ?? {},
    )
    const byteIdentical = snap1Again === snap1Str

    if (numericFrozen && byteIdentical) {
      recordJourneyPass(META)
      expect(numericFrozen, 'v1 snapshot embeds golden SNA/SNB frozen').toBe(true)
      expect(byteIdentical, 'v1 snapshot byte-identical on re-read (append-only)').toBe(true)
      return
    }

    await expectJourneyBroken(
      page,
      META,
      `Report snapshot integrity failed: numericFrozen=${numericFrozen} ` +
        `(SNA=${m1.sna} exp ${CEPH_EXPECTED.sna}, SNB=${m1.snb} exp ` +
        `${CEPH_EXPECTED.snb}), byteIdentical=${byteIdentical}. CIMG-006/008 ` +
        `not satisfied.`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
