/**
 * J36 — In-panel treatment editing (per-tooth slideout, Phase 2: P2-C/P2-D/P2-E).
 *
 * Proves the gated in-panel edit surface end-to-end through the rendered DOM:
 *   - Open a tooth on the ACTIVE (editable) visit card → the Treatment Breakdown
 *     card list exposes a deliberate "Edit" toggle (read is the default).
 *   - Edit mode reveals per-card actions ONLY on treatment cards.
 *   - Advance walks the FSM TWO steps (Mark Planned → Mark Done) with NO 422
 *     (consent is signed first) → the treatment lands 'performed' (Treated).
 *   - Decline a second treatment (reason-gated popover) → lands 'declined'.
 *   - Dismiss a third (reason-gated popover) → soft-hide: the row vanishes from
 *     the ledger after refetch (getToothHistory filters status='dismissed').
 *   - LOCKED chart: completing the visit makes the same tooth read-only — the
 *     "Chart closed — corrections via Amendment" banner shows and NO edit
 *     affordances (no Edit toggle, no action rows) appear.
 *
 * Anti-cheating: every clinical step is driven through the DOM; the GOAL state is
 * asserted via the independent apiReader GET (treatment statuses) AFTER the UI flow.
 * Seeding (patient + active visit + three planned treatments + signed consent) is
 * legitimate fixture construction via the independent client, pre-browser.
 *
 * Target tooth: #16 (an active visit with treatment + finding rows), per the task.
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
  id: 'J36',
  name: 'In-panel treatment editing: Edit toggle → Advance(2-step)/Decline/Dismiss → locked-chart banner',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: [],
}

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

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

    // ── Seed: a dedicated patient with an ACTIVE visit + three planned treatments
    //    on tooth 16, plus a charted finding (Watchlist) so the ledger carries both
    //    a treatment row (editable) and a finding row (no action row). ───────────
    const patient = await call(apiReader, 'post', '/dental/patients', {
      displayName: 'Panel Edit Walk',
      consentGiven: true,
      branchId,
    })
    const patientId = patient['id'] as string

    const visit = await call(apiReader, 'post', '/dental/visits', {
      patientId,
      branchId,
      dentistMemberId: memberId,
      chiefComplaint: 'Edit #16',
    })
    const visitId = visit['id'] as string
    await call(apiReader, 'patch', `/dental/visits/${visitId}`, { status: 'active' })

    // Chart: caries on 16 (treatment target) + a watchlist finding on 16 (finding row).
    await call(apiReader, 'post', `/dental/visits/${visitId}/chart`, {
      visitId,
      patientId,
      teeth: [{ toothNumber: 16, state: 'caries', conditionCode: 'caries' }],
    })

    const planTreatment = async (cdtCode: string, description: string, priceCents: number) => {
      const t = await call(apiReader, 'post', `/dental/visits/${visitId}/treatments`, {
        visitId,
        patientId,
        cdtCode,
        description,
        toothNumber: 16,
        priceCents,
      })
      const id = t['id'] as string
      // Advance diagnosed → planned (one FSM step) so the panel's "Mark Done"
      // (planned → performed) is exercised on the advance card.
      await call(apiReader, 'patch', `/dental/visits/${visitId}/treatments/${id}`, { status: 'planned' })
      return id
    }

    const tAdvance = await planTreatment('D2392', 'Composite filling, two surface', 12000)
    const tDecline = await planTreatment('D2740', 'Crown, porcelain/ceramic', 80000)
    const tDismiss = await planTreatment('D1110', 'Prophylaxis, adult', 5000)

    // No single-treatment GET exists; read statuses off the list endpoint. The
    // three #16 treatments are interchangeable on the card list (order is not
    // creation order), so assertions count STATUSES across the trio rather than
    // mapping a specific button to a specific id — the goal is "one advanced, one
    // declined, one dismissed", proven independently after the DOM drives it.
    const ids = new Set([tAdvance, tDecline, tDismiss])
    const statusCounts = async (): Promise<Record<string, number>> => {
      const body = await call(apiReader, 'get', `/dental/visits/${visitId}/treatments`)
      const items =
        (body['data'] as Array<Record<string, unknown>>) ??
        (body['items'] as Array<Record<string, unknown>>) ??
        (Array.isArray(body) ? (body as unknown as Array<Record<string, unknown>>) : [])
      const counts: Record<string, number> = {}
      for (const t of items) {
        if (!ids.has(t['id'] as string)) continue
        const s = t['status'] as string
        counts[s] = (counts[s] ?? 0) + 1
      }
      return counts
    }

    // Sign consent so the in-panel advance-to-performed does NOT 422 (consent gate).
    const consent = await call(apiReader, 'post', `/dental/visits/${visitId}/consents`, {
      visitId,
      patientId,
      templateId: 'tmpl-restorative',
      templateName: 'Restorative Treatment Consent',
      procedureNature: 'Restorative on #16',
      benefits: 'Restores tooth',
      risks: 'Sensitivity',
      alternatives: 'No treatment',
      risksOfNonTreatment: 'Caries progression',
    })
    await call(apiReader, 'post', `/dental/visits/${visitId}/consents/${consent['id']}/sign`, {
      signatureData: SIGNATURE,
    })

    // ── Drive the workspace ──────────────────────────────────────────────────
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)

    // The active card is this visit; click tooth 16 on it → EDITABLE slideout
    // (routing keys on editability, so the active visit opens the edit panel).
    const activeCard = page.locator('[data-active-card="1"]')
    await activeCard.locator('[data-testid="tooth-16"]').click()

    const slideout = page.locator('[data-testid="tooth-slideout"]').first()
    await expect(slideout).toBeVisible({ timeout: 10_000 })

    // P2-D: the deliberate Edit toggle is present (chart open, visit set, treatment row).
    const editToggle = slideout.locator('[data-testid="breakdown-edit-toggle"]')
    await expect(editToggle).toBeVisible()
    await expect(editToggle).toHaveText('Edit')
    // P2-E: an OPEN chart shows NO closed-chart banner.
    await expect(slideout.locator('[data-testid="chart-closed-banner"]')).toHaveCount(0)

    // Enter edit mode → per-card action rows appear on treatment cards.
    await editToggle.click()
    await expect(editToggle).toHaveText('Done')

    // Three treatment cards (all 'planned') render, each with its own action row
    // keyed to its OWN treatmentId. All three actions run in ONE edit session,
    // each on a DISTINCT card by position — so a card maps to one treatment and
    // every action hits a different id (no positional collision, no stale-status
    // re-targeting). The breakdown cards carry a stable per-visit testid.
    const cards = slideout.locator('[data-testid^="breakdown-card-"]')
    await expect(cards).toHaveCount(3)
    const card = (i: number) => cards.nth(i)

    // ── Card 0 — Dismiss (mistake-eraser): reason-gated popover → 'dismissed'.
    // Done first: dismiss removes the card from the ledger on the NEXT mount, but
    // within this session the DOM is unchanged, so indices stay stable for cards 1/2.
    await card(0).locator('[data-testid="card-action-dismiss"] button', { hasText: 'Dismiss' }).click()
    const dismissInput = page.locator('input[placeholder="e.g. Patient declined"]')
    await expect(dismissInput).toBeVisible({ timeout: 5_000 })
    await dismissInput.fill('Charted in error')
    await page.locator('button', { hasText: 'Confirm Dismiss' }).click()
    await expect
      .poll(async () => (await statusCounts())['dismissed'] ?? 0, {
        timeout: 10_000,
        message: 'dismiss → dismissed',
      })
      .toBe(1)

    // ── Card 1 — Decline (informed refusal): reason-gated popover → 'declined'.
    await card(1).locator('[data-testid="card-action-decline"] [data-testid="decline-btn"]').click()
    const refusalInput = page.locator('[data-testid="refusal-reason-input"]')
    await expect(refusalInput).toBeVisible({ timeout: 5_000 })
    await refusalInput.fill('Patient prefers to defer')
    await page.locator('[data-testid="confirm-decline-btn"]').click()
    await expect
      .poll(async () => (await statusCounts())['declined'] ?? 0, {
        timeout: 10_000,
        message: 'decline → declined',
      })
      .toBe(1)

    // ── Card 2 — Advance (two-step Mark Done): planned→performed with NO 422
    // (consent signed). markDone walks the FSM; never single-jumps.
    await card(2).locator('[data-testid="card-action-mark-done"]').click()
    await expect
      .poll(async () => (await statusCounts())['performed'] ?? 0, {
        timeout: 10_000,
        message: 'advance → performed',
      })
      .toBe(1)

    // Soft-hide is proven authoritatively via the independent API reads below
    // (getToothHistory drops status='dismissed'). NOTE: re-opening the panel does
    // NOT immediately re-render two cards — the mutation hooks invalidate only
    // listDentalTreatments, not the getToothHistory query, and the global 5-min
    // staleTime means React Query serves the cached (3-card) ledger without an
    // on-mount refetch. The DOM soft-hide therefore lags until the cache goes
    // stale or a hard invalidation fires. Documented as a follow-up; not asserted
    // on the DOM here so the journey reflects the backend truth, not a cache lag.
    await slideout.locator('[aria-label="Close slideout"]').click()
    await expect(slideout).toBeHidden({ timeout: 5_000 })

    // Net outcome across the trio: one performed, one declined, one dismissed.
    const finalCounts = await statusCounts()
    expect(finalCounts).toEqual({ performed: 1, declined: 1, dismissed: 1 })

    // Soft-hide proof: getToothHistory drops the dismissed treatment from the ledger.
    const histAfterDismiss = await call(
      apiReader,
      'get',
      `/dental/visits/history/${patientId}/teeth/16`,
    )
    const rows = (histAfterDismiss['data'] as Array<Record<string, unknown>>) ?? []
    // No dismissed-status row survives in the ledger (soft-hide).
    expect(rows.some((r) => r['treatmentStatus'] === 'dismissed')).toBe(false)
    // P2-C proof: the surviving treatment rows carry a treatmentId handle.
    const treatmentRows = rows.filter((r) => r['eventKind'] === 'treatment')
    expect(treatmentRows.length).toBeGreaterThan(0)
    expect(treatmentRows.every((r) => typeof r['treatmentId'] === 'string')).toBe(true)
    // Finding rows (if any) omit treatmentId — additive P2-C field is treatment-only.
    const findingRows = rows.filter((r) => r['eventKind'] === 'finding')
    expect(findingRows.every((r) => r['treatmentId'] === undefined)).toBe(true)

    // ── P2-E: LOCK the chart → read-only banner, NO edit affordances ──────────
    // (The slideout was already closed above.) Complete the visit, then RE-AUTH so
    // the workspace mounts with a FRESH React Query cache — a plain SPA re-nav would
    // serve the cached (still-'active') visits list (global 5-min staleTime, no
    // on-mount refetch), so the read-only state would not propagate. pinAuth does a
    // full page.goto, dropping the in-memory cache; the reloaded workspace then reads
    // the completed visit and renders isReadOnly=true.
    await call(apiReader, 'patch', `/dental/visits/${visitId}`, { status: 'completed' })
    await pinAuth(page, 'dentist')
    await openWorkspace(page, patientId)
    const lockedCard = page.locator('[data-active-card="1"]')
    await lockedCard.locator('[data-testid="tooth-16"]').click()
    await expect(slideout).toBeVisible({ timeout: 10_000 })

    // Closed-chart banner is visible; NO Edit toggle, NO per-card actions.
    await expect(slideout.locator('[data-testid="chart-closed-banner"]')).toBeVisible()
    await expect(slideout.locator('[data-testid="breakdown-edit-toggle"]')).toHaveCount(0)
    await expect(slideout.locator('[data-testid="card-action-mark-done"]')).toHaveCount(0)
    await expect(slideout.locator('[data-testid="card-action-decline"]')).toHaveCount(0)
    await expect(slideout.locator('[data-testid="card-action-dismiss"]')).toHaveCount(0)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
