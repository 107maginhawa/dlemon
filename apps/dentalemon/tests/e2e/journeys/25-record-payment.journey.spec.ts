/**
 * J25 — Record a payment on an invoice through the billing UI (WF-014).
 *
 * JC-4: record-payment is backend-airtight but its LIVE UI path was unverified —
 * highest blast radius (money). This journey seeds an issued invoice (allowed API
 * setup), then drives the REAL Record-Payment form in the billing detail sheet and
 * confirms the invoice is DURABLY `paid` via an independent read — never a 2xx alone.
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
import { seedIssuedInvoice, readInvoice } from './_billing-helpers'

const META: JourneyMeta = {
  id: 'J25',
  name: 'Record payment on an invoice via the billing UI → durably paid',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-014'],
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)
    const seeded = await seedIssuedInvoice(apiReader, branchId, memberId, 'J25 Record Payment')
    expect(seeded.balanceCents, 'seeded invoice must carry a positive balance').toBeGreaterThan(0)

    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/billing')
    await expect(page.getByTestId('billing-list'), 'billing list must render').toBeVisible({
      timeout: 15_000,
    })

    // Newest-first ordering → the just-seeded invoice is on page 1; open its detail sheet.
    const row = page.getByTestId(`invoice-row-${seeded.invoiceId}`)
    await expect(row, 'the seeded invoice must render in the billing list').toBeVisible({
      timeout: 15_000,
    })
    await row.click()
    const detail = page.getByTestId('invoice-detail')
    await expect(detail, 'invoice detail sheet must open').toBeVisible({ timeout: 10_000 })

    // Drive the Record-Payment form (method defaults to cash).
    await detail.getByRole('button', { name: 'Record payment' }).click()
    await page.locator('#pay-amount').fill((seeded.balanceCents / 100).toString())
    await page.locator('#pay-receipt').fill(`J25-${Date.now()}`)

    const [payResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/billing\/invoices\/[^/?]+\/payments/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      detail.getByRole('button', { name: 'Record', exact: true }).click(),
    ])
    expect(payResp.status(), 'record-payment POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(payResp.status(), 'record-payment POST must be 2xx').toBeLessThan(300)

    // Independent read: the invoice is durably PAID with a zero balance.
    await expect
      .poll(async () => (await readInvoice(apiReader, seeded.invoiceId)).status, {
        message: 'WF-014: a full payment must leave the invoice durably `paid`',
        timeout: 10_000,
      })
      .toBe('paid')
    expect(
      (await readInvoice(apiReader, seeded.invoiceId)).balanceCents,
      'a fully-paid invoice must have zero balance',
    ).toBe(0)

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
