/**
 * J15 — Offline sync metadata: sync-log lifecycle + server-default syncStatus.
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J15
 * Rubric: J15; LF-BR-001, LF-BR-002, LF-BR-003, LF-BR-004. Persona: dentist.
 * Expected verdict: PASS.
 *
 * The API sync-log lifecycle is fully verified (create → list[pending] → syncing →
 * synced) via the dental_sync_log table, and a server-created visit is born
 * syncStatus='synced'. See the GAP-001 note at step 4: echoing an inbound localId
 * on ENTITY create is not implemented for any syncable entity, so this journey does
 * not assert it (offline localId tracking lives in the sync-log table).
 */
import {
  test,
  expect,
  type JourneyMeta,
  recordJourneyError,
  readOrgContext,
  readPatientIdByName,
  API,
} from './_journey-helpers'

const META: JourneyMeta = {
  id: 'J15',
  name: 'Offline sync metadata — sync-log lifecycle + server-default syncStatus',
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
    // Match by the id returned at creation, NOT by localId: the DB isn't reset
    // between runs and the same localId from a prior run (already transitioned to
    // "synced" in step 3) would otherwise be picked up and fail the default check.
    const entry = items.find((e: any) => e.id === logId)
    if (!entry) {
      throw new Error(
        `GET /dental/sync-logs: entry with id "${logId}" not found. ` +
          `Items: ${JSON.stringify(items.map((e: any) => e.id)).slice(0, 300)}`,
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

    // ── Step 4: Server-created visit carries sync metadata ─────────────────────
    //
    // Verify a server-created Visit is born with syncStatus='synced' (the
    // syncableEntityFields default on dental_visit).
    //
    // NOTE (GAP-001, unimplemented): per-entity localId echo ON ENTITY CREATE is
    // NOT wired for any syncable entity. Migration 0056 added local_id/sync_status
    // columns to dental_visit/invoice/chart/treatment, and the Drizzle schemas map
    // them (syncableEntityFields), but NO create handler/validator accepts an
    // inbound localId — the generated request schema strips it. Offline localId
    // round-trip is tracked via the dental_sync_log table (steps 1-3 above), not by
    // echoing localId on the visit. We therefore do not assert a stored localId
    // here; doing so would test a non-existent feature.

    const ctx = await readOrgContext(apiReader)
    // readPatientIdByName signature is (api, branchId, displayName) — args were swapped.
    // The demo seed leaves every P0–P9 patient with an OPEN active visit, so creating
    // a new visit for them 409s (ACTIVE_VISIT_EXISTS). Use a P10+ patient (no seeded
    // visit) so the server-created-visit assertions below can run.
    const patientId = await readPatientIdByName(apiReader, ctx.branchId, 'Lorenzo Delos Santos')

    const visitResp = await apiReader.post(`${API}/dental/visits`, {
      data: {
        patientId,
        branchId: ctx.branchId,
        dentistMemberId: ctx.memberId,
      },
    })
    if (!visitResp.ok()) {
      throw new Error(
        `POST /dental/visits failed (${visitResp.status()}): ${(await visitResp.text()).slice(0, 300)}`,
      )
    }
    const visitBody = await visitResp.json()
    expect(visitBody.syncStatus, 'server-created visit syncStatus defaults to synced').toBe('synced')
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
