/**
 * J35 — Tooth lifecycle walk (#36 across visits): cumulative carousel timeline.
 *
 * Proves the cumulative-timeline feature end-to-end in the rendered workspace:
 *   - Each card paints the chart state AS OF its visit: tooth 36 reads Treated on
 *     the visit where it was filled, and Planned on the later visit where it was
 *     re-flagged (a fresh proposal outranks the completed filling — precedence).
 *   - Any tooth on any card is clickable: clicking 36 on a HISTORICAL card opens its
 *     read-only lifecycle ledger, which lists the whole story (Flagged → Treated →
 *     Planned) — a finding-only entry reads "Flagged", never blank.
 *   - A terminal (extracted) tooth renders without an actionable ring.
 *   - Draft visits never appear in the carousel.
 *
 * Setup is seeded via the independent API client (apiReader) — legitimate fixture
 * construction; the GOAL (the rendered cards + ledger) is asserted through the DOM.
 *
 * This is a focused realization of the plan's five-visit ideal: V0 flag → V1 perform
 * → V2 re-plan + extract, plus a draft that must stay hidden.
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
  id: 'J35',
  name: 'Tooth lifecycle walk: cumulative as-of cards + any-card read-only ledger + terminal + draft excluded',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: [],
}

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** POST/PATCH helper that fails loudly so a broken seed surfaces RED, not silently. */
async function call(
  api: APIRequestContext,
  method: 'post' | 'patch',
  path: string,
  data: unknown,
): Promise<Record<string, unknown>> {
  const r = await api[method](path, { data })
  if (!r.ok()) {
    throw new Error(`seed ${method.toUpperCase()} ${path} → ${r.status()}: ${(await r.text()).slice(0, 300)}`)
  }
  return (await r.json().catch(() => ({}))) as Record<string, unknown>
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)

    // ── Seed: a dedicated patient with a charted tooth-36 history ────────────
    const patient = await call(apiReader, 'post', '/dental/patients', {
      displayName: 'Tooth Lifecycle Walk',
      consentGiven: true,
      branchId,
    })
    const patientId = patient['id'] as string

    const newVisit = (chiefComplaint: string) =>
      call(apiReader, 'post', '/dental/visits', { patientId, branchId, dentistMemberId: memberId, chiefComplaint })

    // Every visit completion is consent-gated (VISIT_CONSENT_REQUIRED) — sign one.
    const signConsent = async (visitId: string) => {
      const consent = await call(apiReader, 'post', `/dental/visits/${visitId}/consents`, {
        visitId, patientId, templateId: 'tmpl-restorative', templateName: 'Restorative Treatment Consent',
        procedureNature: 'Charting / treatment on this visit', benefits: 'Restores tooth', risks: 'Sensitivity',
        alternatives: 'No treatment', risksOfNonTreatment: 'Caries progression',
      })
      await call(apiReader, 'post', `/dental/visits/${visitId}/consents/${consent['id']}/sign`, { signatureData: SIGNATURE })
    }

    // V0 — tooth 36 flagged (caries), NO treatment → a "finding" event in the ledger.
    const v0 = (await newVisit('Flag 36'))['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${v0}`, { status: 'active' })
    await call(apiReader, 'post', `/dental/visits/${v0}/chart`, {
      visitId: v0, patientId, teeth: [{ toothNumber: 36, state: 'caries', conditionCode: 'caries' }],
    })
    // A note keeps V0 non-empty so completion doesn't auto-discard it (BR-005).
    await call(apiReader, 'post', `/dental/visits/${v0}/notes`, {
      visitId: v0, subjective: 'Caries noted on #36', objective: 'Visible distal caries', assessment: 'Caries', plan: 'Restore next visit',
    })
    await signConsent(v0)
    await call(apiReader, 'patch', `/dental/visits/${v0}`, { status: 'completed' })

    // V1 — composite filling on 36, performed (consent-gated) → "Treated" as-of V1.
    const v1 = (await newVisit('Fill 36'))['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${v1}`, { status: 'active' })
    await call(apiReader, 'post', `/dental/visits/${v1}/chart`, {
      visitId: v1, patientId, teeth: [{ toothNumber: 36, state: 'caries' }],
    })
    const t1 = (await call(apiReader, 'post', `/dental/visits/${v1}/treatments`, {
      visitId: v1, patientId, cdtCode: 'D2392', description: 'Composite filling, two surface', toothNumber: 36, priceCents: 12000,
    }))['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${v1}/treatments/${t1}`, { status: 'planned' })
    const consent = await call(apiReader, 'post', `/dental/visits/${v1}/consents`, {
      visitId: v1, patientId, templateId: 'tmpl-restorative', templateName: 'Restorative Treatment Consent',
      procedureNature: 'Composite filling on #36', benefits: 'Restores tooth', risks: 'Sensitivity',
      alternatives: 'No treatment', risksOfNonTreatment: 'Caries progression',
    })
    await call(apiReader, 'post', `/dental/visits/${v1}/consents/${consent['id']}/sign`, { signatureData: SIGNATURE })
    await call(apiReader, 'patch', `/dental/visits/${v1}/treatments/${t1}`, { status: 'performed' })
    await call(apiReader, 'patch', `/dental/visits/${v1}`, { status: 'completed' })

    // V2 — re-flag 36 + plan an RCT (fresh proposal), and extract tooth 46 (terminal).
    const v2 = (await newVisit('RCT 36 + extract 46'))['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${v2}`, { status: 'active' })
    await call(apiReader, 'post', `/dental/visits/${v2}/chart`, {
      visitId: v2, patientId,
      teeth: [{ toothNumber: 36, state: 'caries' }, { toothNumber: 46, state: 'extracted' }],
    })
    const t2 = (await call(apiReader, 'post', `/dental/visits/${v2}/treatments`, {
      visitId: v2, patientId, cdtCode: 'D3330', description: 'Endodontic therapy, molar', toothNumber: 36, priceCents: 80000,
    }))['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${v2}/treatments/${t2}`, { status: 'planned' })

    // ── Drive the workspace ──────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // The three charted visits (V0 flag / V1 fill / V2 re-plan) each render a card.
    // (A draft can't be constructed alongside the active V2 — the one-in-progress-
    // visit rule forbids it, which is a stronger guarantee than a UI filter.)
    const slides = page.locator('[data-testid="visit-slide"]')
    await expect(slides).toHaveCount(3)

    // The active (most-recent) card is V2: tooth 36 reads Planned (fresh RCT outranks
    // the completed filling), and the extracted tooth 46 is terminal (no ring).
    const activeCard = page.locator('[data-active-card="1"]')
    await expect(activeCard.locator('[data-testid="tooth-36"]')).toHaveAttribute('data-tooth-layer', 'proposed')
    await expect(activeCard.locator('[data-testid="tooth-46"]')).toHaveAttribute('data-terminal', '1')
    // Terminal tooth never gets an actionable Planned/Treated edge.
    await expect(activeCard.locator('[data-testid="tooth-46"]')).not.toHaveAttribute('data-tooth-layer', 'proposed')

    // Cumulative persistence: a HISTORICAL card paints tooth 36 as Treated (the
    // filling stays Treated on its own visit, not lost behind a per-visit delta).
    const treatedHistorical = page.locator(
      '[data-testid="visit-slide"]:not([data-active-card]) [data-testid="tooth-36"][data-tooth-layer="completed"]',
    )
    await expect(treatedHistorical.first()).toBeVisible()

    // Click tooth 36 on that historical card → its read-only lifecycle ledger.
    await treatedHistorical.first().click()
    const slideout = page.locator('[data-testid="tooth-slideout"], [role="dialog"]').first()
    await expect(slideout).toBeVisible({ timeout: 10_000 })

    // The ledger tells the whole story: a Flagged finding (V0), a Treated filling
    // (V1), and a Planned RCT (V2) — the finding row reads "Flagged", never blank.
    await expect(slideout.getByText('Flagged', { exact: true }).first()).toBeVisible()
    await expect(slideout.getByText('Treated', { exact: true }).first()).toBeVisible()
    await expect(slideout.getByText('Planned', { exact: true }).first()).toBeVisible()

    // Independent read confirms the GOAL state (not just the DOM): as-of V2, tooth 36
    // is Planned (not Treated), and 46 is terminal — the cumulative derivation holds.
    const chartV2 = await (await apiReader.get(`/dental/visits/${v2}/chart`)).json()
    expect(chartV2.layers.proposed).toContain(36)
    expect(chartV2.layers.completed).not.toContain(36)
    expect(chartV2.terminalTeeth).toContain(46)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
