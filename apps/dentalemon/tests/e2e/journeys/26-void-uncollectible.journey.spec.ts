/**
 * J26 — Void an invoice + write one off as uncollectible through the billing UI (WF-041).
 *
 * JC-4: both are terminal, owner-only, money-integrity actions whose LIVE UI path was
 * unverified. This journey seeds two issued invoices, then drives the real Void form on
 * one and the real Mark-Uncollectible confirmation on the other, confirming each reaches
 * its durable terminal status via an independent read.
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
import type { Page } from '@playwright/test'

const META: JourneyMeta = {
  id: 'J26',
  name: 'Void + mark-uncollectible an invoice via the billing UI → durable terminal status',
  set: 'A',
  expectedVerdict: 'PASS',
  rubricIds: ['WF-041'],
}

async function openInvoice(page: Page, invoiceId: string) {
  const row = page.getByTestId(`invoice-row-${invoiceId}`)
  await expect(row, `invoice ${invoiceId} must render in the billing list`).toBeVisible({
    timeout: 15_000,
  })
  await row.click()
  const detail = page.getByTestId('invoice-detail')
  await expect(detail, 'invoice detail sheet must open').toBeVisible({ timeout: 10_000 })
  return detail
}

test(`${META.id} — ${META.name}`, async ({ page, apiReader }) => {
  try {
    const { branchId, memberId } = await readOrgContext(apiReader)
    const toVoid = await seedIssuedInvoice(apiReader, branchId, memberId, 'J26 Void')
    const toWriteOff = await seedIssuedInvoice(apiReader, branchId, memberId, 'J26 Uncollectible')

    await pinAuth(page, 'dentist')
    await spaNavigate(page, '/billing')
    await expect(page.getByTestId('billing-list')).toBeVisible({ timeout: 15_000 })

    // ── VOID ──────────────────────────────────────────────────────────────────
    let detail = await openInvoice(page, toVoid.invoiceId)
    await detail.getByTestId('invoice-more-btn').click()
    await detail.getByRole('button', { name: 'Void', exact: true }).click()
    await page.locator('#void-reason').fill('J26 duplicate invoice — voided in test')
    const [voidResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/billing\/invoices\/[^/?]+\/void/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      detail.getByRole('button', { name: 'Confirm void' }).click(),
    ])
    expect(voidResp.status(), 'void POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(voidResp.status(), 'void POST must be 2xx').toBeLessThan(300)
    await expect
      .poll(async () => (await readInvoice(apiReader, toVoid.invoiceId)).status, {
        message: 'WF-041: voiding must leave the invoice durably `voided`',
        timeout: 10_000,
      })
      .toBe('voided')

    // Back to the list to act on the second invoice. ("Close" matches both the header
    // ✕ and the footer button — either closes the sheet; take the first.)
    await detail.getByRole('button', { name: 'Close' }).first().click()
    await expect(detail).toBeHidden({ timeout: 10_000 })

    // ── MARK UNCOLLECTIBLE ──────────────────────────────────────────────────────
    detail = await openInvoice(page, toWriteOff.invoiceId)
    await detail.getByTestId('invoice-more-btn').click()
    await detail.getByTestId('mark-uncollectible-btn').click()
    const confirm = page.getByTestId('uncollectible-confirm')
    await expect(confirm, 'write-off confirmation must appear').toBeVisible({ timeout: 10_000 })
    const [uncollResp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          /\/dental\/billing\/invoices\/[^/?]+\/uncollectible/.test(r.url()) &&
          r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      confirm.getByRole('button', { name: 'Confirm write-off' }).click(),
    ])
    expect(uncollResp.status(), 'uncollectible POST must be 2xx').toBeGreaterThanOrEqual(200)
    expect(uncollResp.status(), 'uncollectible POST must be 2xx').toBeLessThan(300)
    await expect
      .poll(async () => (await readInvoice(apiReader, toWriteOff.invoiceId)).status, {
        message: 'WF-041: write-off must leave the invoice durably `uncollectible`',
        timeout: 10_000,
      })
      .toBe('uncollectible')

    recordJourneyPass(META)
  } catch (err) {
    recordJourneyError(META, err)
    throw err
  }
})
