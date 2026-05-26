/**
 * J15 — Offline sync metadata: sync-log lifecycle + per-entity localId.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J15
 * Rubric: J15; LF-BR-001, LF-BR-002, LF-BR-003, LF-BR-004. Persona: dentist.
 * Expected verdict: PASS.
 *
 * The API sync log lifecycle is fully verified (create → list → syncing → synced).
 * Per-entity localId is stored and returned on POST /dental/visits (GAP-001/GAP-002 closed).
 */
import {
  test,
  expect,
  type JourneyMeta,
  recordJourneyError,
  readOrgContext,
  readPatientIdByName,
  SEED_PATIENTS,
  API,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J15',
  name: 'Offline sync metadata — sync-log lifecycle + per-entity localId (GAP-001/GAP-002)',
  set: 'B',
  expectedVerdict: 'PASS',
  rubricIds: ['LF-BR-001', 'LF-BR-002', 'LF-BR-003', 'LF-BR-004'],
}

test.setTimeout(60_000)

test(`${META.id} — ${META.name}`, async ({ apiReader }) => {
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

    // ── Step 4: Real offline-create — per-entity localId (GAP-001/GAP-002) ──────
    //
    // GAP-001 adds localId/syncStatus to dentalVisits. Verify that a Visit created
    // with a localId stores and returns it with syncStatus='synced' (server default).

    const ctx = await readOrgContext(apiReader)
    const patientId = await readPatientIdByName(apiReader, SEED_PATIENTS.juan, ctx.branchId)

    const visitResp = await apiReader.post(`${API}/dental/visits`, {
      data: {
        patientId,
        branchId: ctx.branchId,
        dentistMemberId: ctx.memberId,
        localId: 'offline-e2e-visit-001',
      },
    })
    if (!visitResp.ok()) {
      throw new Error(
        `POST /dental/visits with localId failed (${visitResp.status()}): ${(await visitResp.text()).slice(0, 300)}`,
      )
    }
    const visitBody = await visitResp.json()
    expect(visitBody.localId, 'localId must be stored on visit').toBe('offline-e2e-visit-001')
    expect(visitBody.syncStatus, 'server-created visit syncStatus defaults to synced').toBe('synced')
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
