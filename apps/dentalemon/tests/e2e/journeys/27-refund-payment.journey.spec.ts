/**
 * J27 — Refund a payment through the billing UI (WF-BIL-REFUND).
 *
 * JC-4: refund is backend-airtight but its LIVE UI path was unverified. This journey
 * seeds an issued invoice, records a full payment via the API (so there is a real
 * payment to refund and the invoice is `paid`), then drives the per-payment Refund form
 * in the billing detail sheet and confirms the refund DURABLY reopened the invoice
 * (balance restored, no longer paid) via an independent read.
 */
import {
  test,
  expect,
  type JourneyMeta,
  pinAuth,
  spaNavigate,
  readOrgContext,
  recordJourneyPass,
  recordJourneyError,
} from './_journey-helpers'
import { seedIssuedInvoice, recordFullPaymentViaApi, readInvoice } from './_billing-helpers'

const META: JourneyMeta = {
  id: 'J27',
  name: 'Refund a payment via the billing UI → invoice durably reopened',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-BIL-REFUND'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)
    const seeded = await seedIssuedInvoice(apiReader, branchId, memberId, 'J27 Refund')
    const payment = await recordFullPaymentViaApi(
      apiReader,
      seeded.invoiceId,
      seeded.balanceCents,
      memberId,
    )
    expect(payment.id, 'seed payment must carry an id').toBeTruthy()
    // Precondition: the invoice is paid before we refund.
    expect((await readInvoice(apiReader, seeded.invoiceId)).status).toBe('paid')

    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/billing')
    await expect(page.getByTestId('billing-list')).toBeVisible({ timeout: 15_000 })

    const row = page.getByTestId(`invoice-row-${seeded.invoiceId}`)
    await expect(row, 'the seeded paid invoice must render').toBeVisible({ timeout: 15_000 })
    await row.click()
    const detail = page.getByTestId('invoice-detail')
    await expect(detail).toBeVisible({ timeout: 10_000 })

    // Drive the per-payment Refund form (amount prefills; reason is required).
    await detail.getByTestId(`refund-payment-${payment.id}`).click()
    const form = page.getByTestId('refund-payment-form')
    await expect(form, 'refund form must open').toBeVisible({ timeout: 10_000 })
    await page.getByTestId('refund-reason').fill('J27 treatment cancelled — full refund in test')

    const [refundResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/billing\/payments\/[^/?]+\/refund/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      page.getByTestId('confirm-payment-refund').click(),
    ])
    expect(refundResp.status(), 'refund POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(refundResp.status(), 'refund POST must be 2xx').toBeLessThan(300)

    // Independent read: a full refund durably reopens the invoice — balance restored,
    // status no longer `paid`.
    await expect
      .poll(async () => (await readInvoice(apiReader, seeded.invoiceId)).balanceCents, {
        message: 'WF-BIL-REFUND: a full refund must durably restore the invoice balance',
        timeout: 10_000,
      })
      .toBe(seeded.balanceCents)
    expect(
      (await readInvoice(apiReader, seeded.invoiceId)).status,
      'a refunded invoice must no longer be `paid`',
    ).not.toBe('paid')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
