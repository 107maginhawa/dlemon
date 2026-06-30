/**
 * J19 — Case presentation: present → patient e-sign → accept (+ reject leg).
 *
 * Contract: docs/audits/JOURNEY_HARNESS_CONTRACT.md §J19
 * Rubric: case-acceptance / revenue conversion (Q19) + decision capture (Q20).
 * Persona: dentist presents; patient decides on the operatory iPad (staff session).
 * Expected verdict: PASS.
 *
 * GAP-2 (case-presentation fix-ready FIX-001): the platform's revenue-conversion
 * flow — present a treatment plan, hand the device to the patient, capture an
 * e-signature acceptance (or a reasoned decline) — was live-verified working but
 * had NO browser-level regression pin. J08 covers a different affordance
 * (per-item informed refusal); J09 covers treatment-plan VERSION freezing. This
 * journey DOM-drives the case-presentation accept/reject FSM end-to-end and
 * asserts the goal state (decision='accepted' / 'rejected') via an INDEPENDENT
 * read of the durable presentation record.
 *
 * FSM (verified against the handlers, §15):
 *   plan draft → presented (links pending treatments) → "Present to patient"
 *   mints a case-presentation → accept (e-sign) flips plan→approved + presentation
 *   →accepted (terminal); reject flips plan→rejected + presentation→rejected.
 *   accept REQUIRES the plan to carry linked items (else PLAN_HAS_NO_ITEMS); the
 *   seed (services/api-ts/scripts/seed-supplement.ts cpPlanSpecs) links them.
 *
 * Seed (reused, not reseeded — services/api-ts/scripts/seed-supplement.ts):
 *   - Accept leg: the patient carrying the `presented` cp plan (linked items,
 *     undecided) — present-to-patient directly.
 *   - Reject leg: the patient carrying the `draft` cp plan — transition
 *     draft→presented through the UI, then present-to-patient.
 *   A separate plan per leg is required because a decided presentation is terminal.
 *   §15: the seed binds each cp plan to a patient by physical-row index, NOT by the
 *   demo P0..P9 insertion order, so we DISCOVER the target patients at runtime by
 *   plan status via the independent reader (never hardcode the patient name).
 */
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
import type { Locator, Page, APIRequestContext } from '@playwright/test'
import { enableWorkspaceFlags } from '../helpers/feature-flags'

const META: JourneyMeta = {
  id: 'J19',
  name: 'Case presentation — present → patient e-sign → accept / reject',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['Q19', 'Q20'],
}

const SIGNER_NAME = 'Patient Demo Signature'
const REJECT_REASON = 'Patient wants a second opinion before the implant.'

// Case presentations can take a moment to mint + the workspace shell is heavy;
// two full legs (accept + reject) need a longer budget than the 30s default.
test.setTimeout(120_000)

/**
 * Discover the patient carrying a treatment plan in the given status, via the
 * independent reader (resolution-only, like readPatientIdByName — not a journey
 * step). The seed gives only the four case-presentation patients any plan rows,
 * exactly one each, so the first match is unambiguous.
 */
async function findPatientWithPlanStatus(
  api: APIRequestContext,
  branchId: string,
  status: string,
): Promise<string> {
  const listResp = await api.get(`/dental/patients?branchId=${branchId}`)
  if (!listResp.ok()) throw new Error(`patients list → ${listResp.status()}`)
  const body = await listResp.json()
  const patients: Array<{ id: string }> = Array.isArray(body) ? body : (body.items ?? body.data ?? [])
  for (const p of patients) {
    const plansResp = await api.get(`/dental/patients/${p.id}/treatment-plans`)
    if (!plansResp.ok()) continue
    const plans = await plansResp.json()
    const match = (Array.isArray(plans) ? plans : []).some(
      (pl: { status?: string }) => pl.status === status,
    )
    if (match) return p.id
  }
  throw new Error(
    `no patient with a '${status}' treatment plan in branch ${branchId} — ` +
      `run \`bun run db:reseed\` (seed-supplement seeds the case-presentation plans).`,
  )
}

/** Open the plan-level Treatment Plans sheet from the workspace top bar. */
async function openPlansSheet(page: Page): Promise<Locator> {
  const plansBtn = page.getByTestId('treatment-plans-tab-btn')
  await expect(plansBtn, 'workspace must expose a Plans affordance').toBeVisible({ timeout: 10_000 })
  await plansBtn.click()
  const sheet = page.getByTestId('treatment-plans-sheet')
  await expect(sheet, 'Treatment Plans sheet must mount').toBeVisible({ timeout: 10_000 })
  return sheet
}

/**
 * Hand the plan to the patient: ensure it is 'presented' (transition a draft via
 * the "Present" control if needed), then click "Present to patient" to mint a
 * case-presentation and navigate to the patient-facing surface. Returns the new
 * presentation id (read from the route).
 */
async function presentToPatient(page: Page, sheet: Locator): Promise<string> {
  const presentBtn = sheet.getByTestId('present-to-patient-btn').first()
  if (!(await presentBtn.isVisible().catch(() => false))) {
    // Plan is still 'draft' — move it to 'presented' first (the FSM transition the
    // PlanRow exposes as a "Mark presented" button; distinct from "Present to patient").
    const transition = sheet.getByRole('button', { name: 'Mark presented', exact: true }).first()
    await expect(transition, 'a draft plan must offer a Present transition').toBeVisible({
      timeout: 10_000,
    })
    await transition.click()
    await expect(presentBtn, 'a presented plan must offer "Present to patient"').toBeVisible({
      timeout: 15_000,
    })
  }
  await presentBtn.click()
  await page.waitForURL(/\/case-presentation\//, { timeout: 15_000 })
  const id = page.url().split('/case-presentation/')[1]?.split(/[?#]/)[0]
  if (!id) throw new Error(`could not parse presentationId from ${page.url()}`)
  return id
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  // Plan docs / case-presentation is v2-deferred (workspace.plan_docs) — opt in.
  await enableWorkspaceFlags(page, 'workspace.plan_docs')
  try {
    const { branchId } = await readOrgContext(apiReader)
    // §15: resolve targets by plan STATUS, not by hardcoded patient name (the seed
    // binds cp plans by physical-row index, which is not the demo P0..P9 order).
    const acceptPatientId = await findPatientWithPlanStatus(apiReader, branchId, 'presented')
    const rejectPatientId = await findPatientWithPlanStatus(apiReader, branchId, 'draft')

    await pinAuth(page, 'dentist')

    // ── Leg 1: ACCEPT (present → e-sign → accept) ─────────────────────────────
    await openWorkspace(page, acceptPatientId)
    const acceptSheet = await openPlansSheet(page)
    const acceptPresentationId = await presentToPatient(page, acceptSheet)

    const view = page.getByTestId('case-presentation-view')
    await expect(view, 'patient-facing case presentation must render').toBeVisible({ timeout: 15_000 })
    // The phased ₱ plan the patient is asked to accept must be visible.
    await expect(view.getByTestId('grand-total'), 'case must render a ₱ grand total').toBeVisible()

    // e-sign: type the signer name and draw a stroke on the signature pad.
    await view.getByLabel('Signer name').fill(SIGNER_NAME)
    const canvas = view.getByTestId('signature-canvas')
    await canvas.scrollIntoViewIfNeeded()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('signature canvas has no bounding box')
    await page.mouse.move(box.x + 15, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + 80, box.y + 60)
    await page.mouse.move(box.x + 170, box.y + 95)
    await page.mouse.up()

    const acceptPost = page
      .waitForResponse(
        (r) => /\/case-presentations\/[^/]+\/accept/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      )
      .catch(() => null)
    await view.getByTestId('accept-sign-btn').click()
    const acceptResp = await acceptPost
    // DoD clause 3 — every step succeeded: the accept POST itself must be 2xx, not
    // just "the UI flipped" (a failed accept would otherwise hide behind a stale view).
    expect(
      acceptResp?.ok(),
      `accept POST /case-presentations/:id/accept must be 2xx (got ${acceptResp?.status() ?? 'no response'})`,
    ).toBe(true)

    // UI flips to the read-only signed-acceptance record (FIX-002 viewer).
    await expect(
      page.getByTestId('accepted-plan-record'),
      'after accept the panel must show the signed-acceptance record',
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('signer-name')).toContainText(SIGNER_NAME)

    // ── Independent read: acceptance persisted on the durable record ──────────
    const accRead = await apiReader.get(
      `/dental/patients/${acceptPatientId}/case-presentations/${acceptPresentationId}`,
    )
    expect(accRead.ok(), `accept read → ${accRead.status()}`).toBe(true)
    const accAgg = await accRead.json()
    expect(accAgg.presentation?.decision, 'presentation decision must persist as accepted').toBe(
      'accepted',
    )
    expect(
      String(accAgg.presentation?.signerName ?? ''),
      'the typed signer name must persist',
    ).toContain(SIGNER_NAME)
    expect(accAgg.plan?.status, 'accept must flip the plan to approved').toBe('approved')

    // ── Leg 2: REJECT (present a different plan → decline with reason) ─────────
    await openWorkspace(page, rejectPatientId)
    const rejectSheet = await openPlansSheet(page)
    const rejectPresentationId = await presentToPatient(page, rejectSheet)

    const view2 = page.getByTestId('case-presentation-view')
    await expect(view2, 'patient-facing case presentation must render (reject leg)').toBeVisible({
      timeout: 15_000,
    })

    // Decline through the reason popover (Radix portal → page-scoped locators).
    await view2.getByTestId('reject-btn').click()
    const reasonField = page.getByLabel('Rejection reason')
    await expect(reasonField, 'decline must offer a reason field').toBeVisible({ timeout: 10_000 })
    await reasonField.fill(REJECT_REASON)

    const rejectPost = page
      .waitForResponse(
        (r) => /\/case-presentations\/[^/]+\/reject/.test(r.url()) && r.request().method() === 'POST',
        { timeout: 15_000 },
      )
      .catch(() => null)
    await page.getByTestId('reject-confirm-btn').click()
    const rejectResp = await rejectPost
    // DoD clause 3 — every step succeeded: the reject POST itself must be 2xx.
    expect(
      rejectResp?.ok(),
      `reject POST /case-presentations/:id/reject must be 2xx (got ${rejectResp?.status() ?? 'no response'})`,
    ).toBe(true)

    // UI flips to the read-only record showing the decline.
    await expect(
      page.getByTestId('accepted-plan-record'),
      'after decline the panel must show the declined record',
    ).toBeVisible({ timeout: 15_000 })

    // ── Independent read: rejection + reason persisted on the durable record ──
    const rejRead = await apiReader.get(
      `/dental/patients/${rejectPatientId}/case-presentations/${rejectPresentationId}`,
    )
    expect(rejRead.ok(), `reject read → ${rejRead.status()}`).toBe(true)
    const rejAgg = await rejRead.json()
    expect(rejAgg.presentation?.decision, 'presentation decision must persist as rejected').toBe(
      'rejected',
    )
    expect(
      String(rejAgg.presentation?.rejectionReason ?? ''),
      'the typed decline reason must persist',
    ).toContain('second opinion')
    expect(rejAgg.plan?.status, 'reject must flip the plan to rejected').toBe('rejected')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
