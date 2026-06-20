/**
 * Shared billing-seed helpers for the money/destructive journeys (JC-4).
 *
 * These are ALLOWED pre-journey API setup (the same category as registerFreshPatient):
 * they build a real, issued, invoiceable invoice via the independent reader so the
 * journey itself only has to DRIVE the money/destructive UI action and read the
 * durable status back. The act under test (record payment / void / uncollectible /
 * refund) is always performed through the rendered DOM, never here.
 *
 * Each seed registers its OWN fresh patient, so the seeded invoice is the newest one
 * in the branch (the list now orders desc(createdAt)) and is deterministically findable
 * on page 1 of the billing list by its exact invoice-row-<id> testid.
 */
import type { APIRequestContext } from '@playwright/test'

export interface SeededInvoice {
  patientId: string
  visitId: string
  invoiceId: string
  invoiceNumber: string
  totalCents: number
  balanceCents: number
}

async function post(api: APIRequestContext, path: string, data: unknown): Promise<any> {
  const r = await api.post(path, { data })
  if (!r.ok()) throw new Error(`POST ${path} → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function patchStatus(
  api: APIRequestContext,
  path: string,
  data?: unknown,
): Promise<any> {
  const r = await api.patch(path, data === undefined ? {} : { data })
  if (!r.ok()) throw new Error(`PATCH ${path} → ${r.status()}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

/**
 * Seed an ISSUED invoice with a real ₱1,500 line item: register a fresh patient →
 * create+activate a visit → sign a consent (the TREATMENT_CONSENT_REQUIRED gate) →
 * add a treatment and mark it performed → create the invoice from the visit → issue it.
 */
export async function seedIssuedInvoice(
  api: APIRequestContext,
  branchId: string,
  memberId: string,
  label: string,
): Promise<SeededInvoice> {
  const stamp = Date.now()
  const patient = await post(api, '/dental/patients', {
    displayName: `${label} ${stamp}`,
    dateOfBirth: '1990-01-01',
    gender: 'male',
    consentGiven: true,
    branchId,
  })
  const patientId: string = patient.id ?? patient.data?.id
  if (!patientId) throw new Error('seedIssuedInvoice: patient response carried no id')

  const visit = await post(api, '/dental/visits', { patientId, branchId, dentistMemberId: memberId })
  const visitId: string = visit.id
  await patchStatus(api, `/dental/visits/${visitId}`, { status: 'active' })

  // Signed consent — the backend gates planned→performed on it.
  const consent = await post(api, `/dental/visits/${visitId}/consents`, {
    visitId,
    patientId,
    templateId: 'jc4-billing-consent',
    templateName: 'JC-4 Billing Seed Consent',
    procedureNature: 'Routine restorative',
  })
  const consentId: string = consent.id ?? consent.consent?.id
  if (!consentId) throw new Error('seedIssuedInvoice: consent response carried no id')
  await post(api, `/dental/visits/${visitId}/consents/${consentId}/sign`, {
    signatureData: 'data:image/png;base64,SIGNEDCONTENT',
  })

  // Treatment diagnosed → planned → performed (so the invoice has a billable line item).
  const tx = await post(api, `/dental/visits/${visitId}/treatments`, {
    visitId,
    patientId,
    cdtCode: 'D1110',
    description: 'Prophylaxis Adult',
    priceCents: 150000,
  })
  await patchStatus(api, `/dental/visits/${visitId}/treatments/${tx.id}`, { status: 'planned' })
  await patchStatus(api, `/dental/visits/${visitId}/treatments/${tx.id}`, { status: 'performed' })

  // Create the invoice from the visit (auto line items), then issue (draft → issued).
  const inv = await post(api, '/dental/billing/invoices', {
    visitId,
    patientId,
    branchId,
    dentistMemberId: memberId,
  })
  const issued = await patchStatus(api, `/dental/billing/invoices/${inv.id}/issue`)
  return {
    patientId,
    visitId,
    invoiceId: inv.id,
    invoiceNumber: issued.invoiceNumber ?? inv.invoiceNumber,
    totalCents: issued.totalCents ?? inv.totalCents,
    balanceCents: issued.balanceCents ?? inv.balanceCents,
  }
}

/** Record a full cash payment on an issued invoice via the API (makes it `paid`). */
export async function recordFullPaymentViaApi(
  api: APIRequestContext,
  invoiceId: string,
  amountCents: number,
  memberId: string,
): Promise<{ id: string }> {
  return post(api, `/dental/billing/invoices/${invoiceId}/payments`, {
    amountCents,
    method: 'cash',
    receiptNumber: `SEED-${Date.now()}`,
    recordedByMemberId: memberId,
  })
}

/** Independent read of an invoice's durable status fields. */
export async function readInvoice(
  api: APIRequestContext,
  invoiceId: string,
): Promise<{ status: string; balanceCents: number; paidCents: number; payments?: any[] }> {
  const r = await api.get(`/dental/billing/invoices/${invoiceId}`)
  if (!r.ok()) throw new Error(`GET invoice ${invoiceId} → ${r.status()}`)
  const inv = await r.json()
  return inv.data ?? inv
}
