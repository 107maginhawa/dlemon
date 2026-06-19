/**
 * refundDentalPayment — POST /dental/billing/payments/:paymentId/refund
 *
 * Phase 4.2 (BR-053): refund (partial or full) a previously-recorded payment,
 * distinct from the same-day void. Owner-only, reason-required, audited. The
 * refunded amount is reversed from the invoice (removePayment); when
 * `bookAsCredit` it is also booked to the patient's credit ledger (4.1) instead
 * of a cash-out. The reversal + refund record + optional credit row commit in a
 * single withTenantTx. A synchronous `payment.refunded` audit row IS the event
 * (ADR-006: no event bus).
 *
 * BR-053: payment must be non-void; the invoice must not be voided; the refund
 * amount must be 1 .. (payment.amountCents − already-refunded).
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId, getActiveMembershipId } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRefundRepository } from './repos/dental-payment-refund.repo';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import type { RefundDentalPaymentBody, RefundDentalPaymentParams } from '@/generated/openapi/validators';

export async function refundDentalPayment(
  ctx: ValidatedContext<RefundDentalPaymentBody, never, RefundDentalPaymentParams>,
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { paymentId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const payment = await new DentalPaymentRepository(db).findOneById(paymentId);
  if (!payment) throw new NotFoundError('Payment');

  // Owner-only.
  await assertBranchRole(db, session.userId, payment.branchId, ['dentist_owner']);

  // BR-053: a voided payment carries no money to refund.
  if (payment.isVoid) {
    throw new BusinessLogicError('Cannot refund a voided payment', 'PAYMENT_VOIDED');
  }

  const invoice = await new DentalInvoiceRepository(db).findOneById(payment.invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');
  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot refund against a voided invoice', 'INVOICE_VOIDED');
  }

  const membership = await getActiveMembershipId(db, session.userId, payment.branchId);
  const bookAsCredit = body.bookAsCredit ?? false;

  const result = await withTenantTx(db, { branchIds: [payment.branchId] }, async (tx) => {
    const refundRepo = new DentalPaymentRefundRepository(tx);
    const invoiceRepo = new DentalInvoiceRepository(tx);
    const creditRepo = new DentalPatientCreditRepository(tx);

    // BR-053: refund amount must fit within the un-refunded remainder.
    const alreadyRefunded = await refundRepo.totalRefundedForPayment(paymentId);
    const refundable = payment.amountCents - alreadyRefunded;
    if (refundable <= 0) {
      throw new BusinessLogicError('Payment is already fully refunded', 'ALREADY_REFUNDED');
    }
    if (body.amountCents > refundable) {
      throw new BusinessLogicError(
        `Refund amount (${body.amountCents}) exceeds the refundable remainder (${refundable})`,
        'EXCEEDS_REFUNDABLE',
      );
    }

    const updatedInvoice = await invoiceRepo.removePayment(payment.invoiceId, body.amountCents);
    const refund = await refundRepo.create({
      paymentId,
      invoiceId: payment.invoiceId,
      patientId: payment.patientId,
      branchId: payment.branchId,
      amountCents: body.amountCents,
      reason: body.reason,
      bookedAsCredit: bookAsCredit,
      refundedByMemberId: membership?.id ?? null,
      createdBy: session.userId,
      updatedBy: session.userId,
    });

    if (bookAsCredit) {
      await creditRepo.create({
        patientId: payment.patientId,
        branchId: payment.branchId,
        amountCents: body.amountCents, // positive: credit to the patient
        source: 'refund',
        invoiceId: payment.invoiceId,
        createdBy: session.userId,
        updatedBy: session.userId,
      });
    }
    const creditBalanceCents = await creditRepo.getBalance(payment.patientId);

    return {
      refundId: refund.id,
      invoiceBalanceCents: updatedInvoice?.balanceCents ?? invoice.balanceCents + body.amountCents,
      invoiceStatus: updatedInvoice?.status ?? invoice.status,
      creditBalanceCents,
    };
  });

  // BR-053 / ADR-006: the synchronous `payment.refunded` audit row IS the event.
  const org = await getBranchOrgId(db, payment.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: org?.organizationId ?? payment.branchId,
    branchId: payment.branchId,
    eventType: 'data-modification',
    action: 'payment.refunded',
    resourceType: 'dental_payment',
    resourceId: paymentId,
    reason: body.reason,
    metadata: { invoiceId: payment.invoiceId, amountCents: body.amountCents, bookedAsCredit: bookAsCredit },
  }, { failClosed: true });

  return ctx.json({
    refundId: result.refundId,
    paymentId,
    invoiceId: payment.invoiceId,
    amountCents: body.amountCents,
    invoiceBalanceCents: result.invoiceBalanceCents,
    invoiceStatus: result.invoiceStatus,
    bookedAsCredit: bookAsCredit,
    creditBalanceCents: result.creditBalanceCents,
  }, 200);
}
