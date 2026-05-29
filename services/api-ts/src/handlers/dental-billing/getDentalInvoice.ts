/**
 * getDentalInvoice handler
 *
 * GET /dental/billing/invoices/:invoiceId
 * Returns invoice with line items and payments.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getPatientWithPersonForInvoice } from '@/handlers/patient/repos/patient-billing.facade';
import { getVisitForBilling } from '@/handlers/dental-visit/repos/visit-billing.facade';

export async function getDentalInvoice(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);
  const paymentRepo = new DentalPaymentRepository(db);

  const result = await repo.findWithLineItems(invoiceId);
  if (!result) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchAccess(db, session.userId, result.invoice.branchId);

  // Fetch payments
  const payments = await paymentRepo.findByInvoice(invoiceId);

  // Resolve patient name
  const patientRow = await getPatientWithPersonForInvoice(db, result.invoice.patientId);
  const patientName = patientRow?.firstName
    ? [patientRow.firstName, patientRow.lastName].filter(Boolean).join(' ')
    : undefined;

  // Resolve visit date (visitId is nullable on invoice)
  let visitDate: Date | null | undefined;
  if (result.invoice.visitId) {
    const visit = await getVisitForBilling(db, result.invoice.visitId);
    visitDate = visit?.completedAt;
  }

  // Map line items: rename amountCents → priceCents for frontend compatibility
  const lineItems = result.lineItems.map((item) => ({
    ...item,
    priceCents: item.amountCents,
  }));

  const audit = ctx.get('audit') as any;
  if (audit?.logEvent) {
    await audit.logEvent({ eventType: 'data-access', category: 'clinical', action: 'read', outcome: 'success', user: session.userId, userType: 'client', resourceType: 'invoice', resource: invoiceId, description: 'Invoice retrieved', details: { resultCount: 1 }, ipAddress: ctx.req.header('x-forwarded-for'), userAgent: ctx.req.header('user-agent'), request: ctx.req.header('x-request-id') }, session.userId);
  }

  return ctx.json({
    ...result.invoice,
    // V-BIL-012: expose the contract's `outstanding_cents` name alongside the
    // internal `balanceCents` field (MODULE_SPEC §6 / §7). Both carry the same
    // value (total_cents − paid_cents) so existing callers are unaffected.
    outstandingCents: result.invoice.balanceCents,
    patientName,
    visitDate: visitDate ? visitDate.toISOString().split('T')[0] : undefined,
    lineItems,
    payments,
  });
}
