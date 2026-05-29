/**
 * recordDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments
 * Creates a payment record and updates the invoice paid/balance amounts.
 */

import { randomUUID } from 'node:crypto';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';

export async function recordDentalPayment(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const invoiceRepo = new DentalInvoiceRepository(db);
  const paymentRepo = new DentalPaymentRepository(db);

  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  if (body.amountCents <= 0) {
    throw new BusinessLogicError('Payment amount must be positive', 'INVALID_AMOUNT');
  }

  // V-BIL-005: payment on a terminal (paid/voided) invoice → INVOICE_IMMUTABLE,
  // replacing the legacy ALREADY_PAID/VOIDED_INVOICE codes.
  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot record payment on a voided invoice', 'INVOICE_IMMUTABLE');
  }

  if (invoice.status === 'paid') {
    throw new BusinessLogicError('Cannot record payment on a fully paid invoice', 'INVOICE_IMMUTABLE');
  }

  // V-BIL-004: overpayment → PAYMENT_EXCEEDS_BALANCE (canonical taxonomy code).
  if (body.amountCents > invoice.balanceCents) {
    throw new BusinessLogicError(
      `Payment amount (${body.amountCents}) exceeds remaining balance (${invoice.balanceCents})`,
      'PAYMENT_EXCEEDS_BALANCE',
    );
  }

  // V-BIL-009: receiptNumber (the contract `reference`) is optional. When
  // supplied it doubles as the idempotency key; when omitted we generate one.
  if (body.receiptNumber) {
    const existing = await paymentRepo.findByReceiptNumber(body.receiptNumber);
    if (existing) {
      return ctx.json(existing, 200);
    }
  }

  const receiptNumber: string =
    body.receiptNumber ?? `RCP-${new Date().getFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  // V-BIL-009: optional caller-supplied payment date (defaults to now()).
  const paymentDate = body.paymentDate ? new Date(body.paymentDate) : undefined;

  // Create the payment
  const payment = await paymentRepo.createOne({
    invoiceId,
    patientId: invoice.patientId,
    branchId: invoice.branchId,
    amountCents: body.amountCents,
    method: body.method,
    receiptNumber,
    recordedByMemberId: body.recordedByMemberId,
    notes: body.notes,
    ...(paymentDate ? { createdAt: paymentDate } : {}),
  });

  // Update invoice totals
  const updatedInvoice = await invoiceRepo.addPayment(invoiceId, body.amountCents);

  // AL-010: payment.record audit trail (never throws — see audit-logger)
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  const tenantId = branchForAudit?.organizationId ?? invoice.branchId;
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId,
    branchId: invoice.branchId,
    action: 'payment.record',
    resourceType: 'dental_payment',
    resourceId: payment.id,
    metadata: { invoiceId, amountCents: body.amountCents, method: body.method },
  });

  // V-BIL-011 / DE-008 InvoicePaid: per ADR-006 there is NO event bus — the
  // semantic marker is satisfied by an audit-log row. Fire ONLY on the
  // transition to fully `paid` (not on partial payments). Reaching this point
  // means the pre-payment status was not already `paid` (guarded above), so a
  // post-payment `paid` status is necessarily a fresh transition.
  if (updatedInvoice?.status === 'paid') {
    await logAuditEvent(db, logger, {
      personId: session.userId,
      tenantId,
      branchId: invoice.branchId,
      action: 'invoice.paid',
      resourceType: 'dental_invoice',
      resourceId: invoiceId,
      metadata: { invoiceId, paidCents: updatedInvoice.paidCents },
    });
  }

  logger?.info(
    { requestId: ctx.get('requestId'), action: 'dental_payment_record', paymentId: payment.id, invoiceId, amountCents: body.amountCents, branchId: invoice.branchId, by: session.userId },
    'Dental payment recorded',
  );

  return ctx.json(payment, 201);
}
