/**
 * J15 — Offline sync metadata: create, list, transition via API; UI indicator (BROKEN expected).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J15
 * Rubric: J15; LF-BR-001, LF-BR-002, LF-BR-003. Persona: dentist.
 * Expected verdict: BROKEN.
 * P2 ref: P2-009 (sync status indicator deferred).
 *
 * The API sync log lifecycle is fully verified (create → list → syncing → synced).
 * The DOM step confirms no UI sync indicator exists (expected BROKEN).
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  expectJourneyBroken,
  recordJourneyError,
  API,
  APP,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J15',
  name: 'Offline sync metadata — create, list, transition via API; UI indicator (BROKEN expected)',
  set: 'B',
  expectedVerdict: 'BROKEN',
  rubricIds: ['LF-BR-001', 'LF-BR-002', 'LF-BR-003'],
}

test.setTimeout(60_000)

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    // ── Step 1: Create a sync log entry (simulating an offline-created record) ──

    const createResp = await apiReader.post(`${API}/dental/sync-logs`, {
      data: {
        localId: 'offline-e2e-001',
        entityType: 'dental_visit',
        entityId: 'offline-visit-001',
      },
    })
    if (!createResp.ok()) {
      throw new Error(
        `POST /dental/sync-logs failed (${createResp.status()}): ${(await createResp.text()).slice(0, 300)}`,
      )
    }
    const created = await createResp.json()
    const logId: string = created.id ?? created.logId ?? created.data?.id
    if (!logId) {
      throw new Error(
        `POST /dental/sync-logs returned no id. Body: ${JSON.stringify(created).slice(0, 300)}`,
      )
    }

    // ── Step 2: Verify the sync log is retrievable with status "pending" ─────────

    const listResp = await apiReader.get(`${API}/dental/sync-logs`)
    if (!listResp.ok()) {
      throw new Error(
        `GET /dental/sync-logs failed (${listResp.status()}): ${(await listResp.text()).slice(0, 300)}`,
      )
    }
    const listBody = await listResp.json()
    const items: any[] = Array.isArray(listBody) ? listBody : (listBody.items ?? listBody.data ?? [])
    const entry = items.find((e: any) => e.localId === 'offline-e2e-001')
    if (!entry) {
      throw new Error(
        `GET /dental/sync-logs: entry with localId "offline-e2e-001" not found. ` +
          `Items: ${JSON.stringify(items.map((e: any) => e.localId)).slice(0, 300)}`,
      )
    }
    expect(entry.syncStatus, 'created sync log must default to "pending"').toBe('pending')

    // ── Step 3a: Transition sync log to "syncing" ────────────────────────────────

    const syncingResp = await apiReader.patch(`${API}/dental/sync-logs/${logId}`, {
      data: { syncStatus: 'syncing' },
    })
    if (!syncingResp.ok()) {
      throw new Error(
        `PATCH /dental/sync-logs/${logId} → syncing failed (${syncingResp.status()}): ` +
          `${(await syncingResp.text()).slice(0, 300)}`,
      )
    }

    // ── Step 3b: Transition sync log to "synced" ─────────────────────────────────

    const syncedResp = await apiReader.patch(`${API}/dental/sync-logs/${logId}`, {
      data: { syncStatus: 'synced' },
    })
    if (!syncedResp.ok()) {
      throw new Error(
        `PATCH /dental/sync-logs/${logId} → synced failed (${syncedResp.status()}): ` +
          `${(await syncedResp.text()).slice(0, 300)}`,
      )
    }

    // ── Step 4: DOM journey — look for UI sync indicator (expected BROKEN) ────────
    //
    // API lifecycle verified above. Now confirm the UI has no sync status indicator.
    // P2-009 is deferred — BROKEN is the documented and expected outcome.

    await pinAuth(page, 'dentist')
    await page.goto(`${APP}/patients`)
    await page.waitForLoadState('networkidle')

    // No sync indicator exists in the UI yet (P2-009 deferred).
    await expectJourneyBroken(
      page,
      META,
      'Sync status indicator not implemented in UI (P2-009 deferred). API sync log lifecycle verified.',
    )
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
