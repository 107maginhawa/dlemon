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

    // Step 4: independent read — a perio chart now persists for THIS visit
    // (visit-anchored ⇒ linked to the odontogram session, not a free-floating row).
    const chartResp = visitId
      ? await apiReader.get(`/dental/visits/${visitId}/perio-chart`)
      : null
    if (chartResp?.ok()) {
      recordJourneyPass(META)
      return
    }

    throw new Error(
      `Perio grid rendered but no persisted chart for visit ${visitId ?? 'unknown'} ` +
        `(GET /dental/visits/${visitId ?? 'unknown'}/perio-chart → ${chartResp?.status() ?? 'null'}).`,
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
