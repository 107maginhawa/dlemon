/**
 * J37 — Per-tooth panel never fabricates a clinical condition (P3-D).
 *
 * Proves, through the rendered DOM, that the per-tooth slideout's Treatment
 * Breakdown NEVER prints a clinical diagnosis ("Caries"/"Filled") in the
 * Condition cell for a treatment row that was not charted with that condition —
 * while keeping the row INFORMATIVE (status badge + treatment description).
 *
 * Two seeded treatment rows exercise both P3-D fabrication sources:
 *   - Tooth 16 — snapshot-PRESENT, non-condition state: the visit charts
 *     state='filled' with NO conditionCode, plus a treatment on 16. Pre-P3-D the
 *     FE mapped the bare odontogram state ('filled') into the Condition column →
 *     "Condition: Filled". Post-P3-D: Condition "—" (a restoration is not a
 *     diagnosis), State "—" ('filled' is not in the watchlist State axis). The
 *     restoration still surfaces via the colored odontogram + the status badge.
 *   - Tooth 17 — snapshot-LESS: a treatment on 17 with NO chart snapshot at all.
 *     getToothHistory carries no `state`; the row must render fully (date +
 *     "Planned" badge + description) with both axes "—" and must not throw
 *     (titleCase(undefined) hazard). Pre-P3-D this synthesised state='caries' →
 *     "Condition: Caries".
 *
 * Anti-cheating: the seed is built via the independent apiReader client; the GOAL
 * (the rendered Condition/State cells + the informative row) is asserted purely
 * through the DOM. Independent apiReader GETs confirm the wire OMITS `state` for
 * the snapshot-less row.
 */
import type { APIRequestContext } from '@playwright/test'
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

const META: JourneyMeta = {
  id: 'J37',
  name: 'Per-tooth panel never fabricates a Condition: snapshot-present non-condition state + snapshot-less row read "—", stay informative',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: [],
}

async function call(
  api: APIRequestContext,
  method: 'post' | 'patch' | 'get',
  path: string,
  data?: unknown,
): Promise<Record<string, unknown>> {
  const r = await api[method](path, data === undefined ? {} : { data })
  if (!r.ok()) {
    throw new Error(`seed ${method.toUpperCase()} ${path} → ${r.status()}: ${(await r.text()).slice(0, 300)}`)
  }
  return (await r.json().catch(() => ({}))) as Record<string, unknown>
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)

    // ── Seed: a patient with an ACTIVE visit carrying two treatment rows that
    //    exercise both P3-D fabrication sources (no charted condition on either). ──
    const patient = await call(apiReader, 'post', '/dental/patients', {
      displayName: 'No Fabricated Condition',
      consentGiven: true,
      branchId,
    })
    const patientId = patient['id'] as string

    const visit = await call(apiReader, 'post', '/dental/visits', {
      patientId,
      branchId,
      dentistMemberId: memberId,
      chiefComplaint: 'P3-D #16/#17',
    })
    const visitId = visit['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${visitId}`, { status: 'active' })

    // Chart ONLY tooth 16 with a non-condition restoration state ('filled') and
    // NO conditionCode. Tooth 17 is intentionally NOT charted (snapshot-less).
    await call(apiReader, 'post', `/dental/visits/${visitId}/chart`, {
      visitId,
      patientId,
      teeth: [{ toothNumber: 16, state: 'filled' }],
    })

    const plan = async (toothNumber: number, cdtCode: string, description: string, priceCents: number) => {
      const t = await call(apiReader, 'post', `/dental/visits/${visitId}/treatments`, {
        visitId,
        patientId,
        cdtCode,
        description,
        toothNumber,
        priceCents,
      })
      const id = t['id'] as string
      await call(apiReader, 'patch', `/dental/visits/${visitId}/treatments/${id}`, { status: 'planned' })
      return id
    }
    // Tooth 16: snapshot-present restoration ('filled', no condition) treatment.
    await plan(16, 'D2740', 'Crown, porcelain/ceramic', 80000)
    // Tooth 17: snapshot-less treatment (no chart row for 17).
    await plan(17, 'D2392', 'Composite filling, two surface', 12000)

    // ── Independent wire proof: snapshot-less row OMITS `state` ────────────────
    const hist17 = await call(apiReader, 'get', `/dental/visits/history/${patientId}/teeth/17`)
    const rows17 = (hist17['data'] as Array<Record<string, unknown>>) ?? []
    const treat17 = rows17.find((r) => r['eventKind'] === 'treatment')
    expect(treat17, 'snapshot-less treatment row 17 present').toBeTruthy()
    expect(treat17!['state'], 'snapshot-less row omits state at the wire').toBeUndefined()
    expect(treat17!['conditionCode'], 'snapshot-less row carries no fabricated condition').toBeUndefined()

    // ── Drive the workspace ──────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    const activeCard = page.locator('[data-active-card="1"]')

    // ----- Tooth 16: snapshot-PRESENT 'filled' (non-condition) -----------------
    await activeCard.locator('[data-testid="tooth-16"]').click()
    const slideout = page.locator('[data-testid="tooth-slideout"]').first()
    await expect(slideout).toBeVisible({ timeout: 10_000 })

    const card16 = slideout.locator('[data-testid^="breakdown-card-"]').first()
    await expect(card16).toBeVisible()
    const text16 = (await card16.innerText()).replace(/\s+/g, ' ')
    // No fabricated diagnosis: a restoration is NOT a Condition.
    expect(text16, 'tooth-16 treatment row must not fabricate a Condition').not.toContain('Condition: Filled')
    expect(text16).not.toContain('Condition: Caries')
    // Both axes read "—"; the row stays INFORMATIVE (Planned badge + description).
    expect(text16).toContain('Condition: —')
    expect(text16).toContain('State: —')
    expect(text16).toContain('Planned')
    expect(text16).toContain('Crown, porcelain/ceramic')

    // Close, then open tooth 17.
    await slideout.locator('[aria-label="Close slideout"]').click()
    await expect(slideout).toBeHidden({ timeout: 5_000 })

    // ----- Tooth 17: snapshot-LESS treatment row -------------------------------
    await activeCard.locator('[data-testid="tooth-17"]').click()
    await expect(slideout).toBeVisible({ timeout: 10_000 })
    const card17 = slideout.locator('[data-testid^="breakdown-card-"]').first()
    await expect(card17).toBeVisible() // renders (does not throw on state: undefined)
    const text17 = (await card17.innerText()).replace(/\s+/g, ' ')
    expect(text17, 'snapshot-less row must not fabricate a Condition').not.toContain('Condition: Caries')
    expect(text17).not.toContain('Condition: Filled')
    // Informative: date + Planned badge + description + both axes "—".
    expect(text17).toContain('Condition: —')
    expect(text17).toContain('State: —')
    expect(text17).toContain('Planned')
    expect(text17).toContain('Composite filling, two surface')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
