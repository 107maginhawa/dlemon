/**
 * J03 — Periodontal charting linked to odontogram.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J03
 * Rubric: J3; Q11–Q14, Q16 (I2 invariant). Persona: dentist.
 * Expected verdict: PASS.
 * Gap #7 RESOLVED: the per-visit periodontal capture surface is implemented —
 * the Perio tab opens an overlay; "Start perio exam" (POST /dental/perio-charts)
 * creates the visit-anchored chart and the 6-site probing grid (perio-grid)
 * renders. This spec DOM-drives that flow and confirms the chart persisted for
 * the visit via an independent read (the perio chart is anchored to the visit,
 * i.e. linked to the odontogram session).
 *
 * @AC-PERIO-01 — "Start perio exam" POSTs /dental/perio-charts and the chart
 *   persists for the visit (end-to-end, real API).
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
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J03',
  name: 'Periodontal charting linked to odontogram',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q11', 'Q12', 'Q13', 'Q14', 'Q16'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId } = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, branchId, SEED_PATIENTS.roberto)

    // Resolve the active visit the perio chart will anchor to (independent read).
    const visitsResp = await apiReader.get(
      `/dental/visits?patientId=${patientId}&branchId=${branchId}`,
    )
    const visitsBody = visitsResp.ok() ? await visitsResp.json() : null
    const visitList: Array<{ id: string; status?: string }> = Array.isArray(visitsBody)
      ? visitsBody
      : (visitsBody?.data ?? visitsBody?.items ?? [])
    const activeVisit = visitList.find((v) => v.status === 'active') ?? visitList[0]
    const visitId = activeVisit?.id ?? null

    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // Step 1: open the per-visit perio capture surface.
    const perioEntry = page.getByTestId('perio-tab-btn')
    if (!(await perioEntry.count())) {
      throw new Error(
        'No periodontal capture affordance (perio-tab-btn) in the workspace. Gap #7.',
      )
    }
    await perioEntry.click()
    await expect(page.getByTestId('perio-overlay')).toBeVisible({ timeout: 10_000 })

    // Step 2: the harness runs against a freshly-reseeded DB where Roberto's
    // active visit has NO perio chart (seed-demo never creates one; only Claudia
    // gets a seeded chart in seed-supplement). So "Start perio exam" MUST render
    // and its POST MUST succeed — that is the @AC-PERIO-01 core behavior under
    // test. The earlier `if (startBtn.count())` GATE let a leftover chart (e.g. a
    // residue of a prior run on a non-reseeded DB) hide the start button and
    // SILENTLY SKIP the start flow while still passing on the stale chart — the
    // J01-class blind spot. Hard-assert the affordance and its POST instead.
    const startBtn = page.getByTestId('perio-start-btn')
    await expect(
      startBtn,
      '"Start perio exam" must render for a fresh visit (run `bun run db:reseed` if this fails locally — a leftover chart hides it)',
    ).toBeVisible({ timeout: 10_000 })
    const startPost = page
      .waitForResponse(
        (r) => /\/dental\/perio-charts$/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 10_000 },
      )
      .catch(() => null)
    await startBtn.click()
    const startResp = await startPost
    expect(
      startResp?.ok(),
      `Start perio exam must POST /dental/perio-charts → 2xx (got ${startResp?.status() ?? 'no response'})`,
    ).toBe(true)

    // Step 3: the 6-site probing grid must render — the capture surface is usable.
    await expect(
      page.getByTestId('perio-grid'),
      'perio capture grid must render after starting the exam (Gap #7)',
    ).toBeVisible({ timeout: 10_000 })

    // Step 4 (WF-P02): DRIVE a real tooth-level reading. The earlier J03 only proved
    // the chart row EXISTS — it never entered a probing depth, so "record perio
    // readings" was credited but unproven. Type a probing depth into the first depth
    // cell (the cell commits on each keystroke → PUT …/readings/:toothNumber).
    const depthCell = page.getByLabel(/ depth$/i).first()
    await expect(depthCell, 'a probing-depth cell must render in the grid').toBeVisible({
      timeout: 10_000,
    })
    const cellTooth = await depthCell.getAttribute('data-perio-tooth')
    const [readingPut] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/perio-charts\/[^/?]+\/readings\/[^/?]+/.test(r.url()) &&
          r.request().method() === 'PUT',
        { timeout: 10_000 },
      ),
      depthCell.fill('4'),
    ])
    expect(
      readingPut.status(),
      `entering a depth must PUT the reading (got ${readingPut.status()})`,
    ).toBeGreaterThanOrEqual(200)
    expect(readingPut.status(), 'reading PUT must be 2xx').toBeLessThan(300)

    // Step 5: independent read — the chart persists for THIS visit AND carries the
    // probing depth we just typed (visit-anchored ⇒ linked to the odontogram session).
    if (!visitId) throw new Error('could not resolve the active visit id for the read-back')
    const chartResp = await apiReader.get(`/dental/visits/${visitId}/perio-chart`)
    expect(
      chartResp.ok(),
      `GET /dental/visits/${visitId}/perio-chart → ${chartResp.status()}`,
    ).toBe(true)
    const chartBody = await chartResp.json()
    const readings: Array<Record<string, unknown>> = chartBody?.readings ?? chartBody?.data?.readings ?? []
    const persisted = readings.some(
      (rd) =>
        (cellTooth == null || String(rd.toothNumber) === cellTooth) &&
        Object.entries(rd).some(([k, v]) => k.startsWith('depth') && v === 4),
    )
    expect(
      persisted,
      `WF-P02: the UI-entered probing depth (4mm on tooth ${cellTooth ?? '?'}) must persist (readings: ${JSON.stringify(readings).slice(0, 300)})`,
    ).toBe(true)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
