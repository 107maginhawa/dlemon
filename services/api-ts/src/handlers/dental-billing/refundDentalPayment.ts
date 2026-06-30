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

import { sql } from 'drizzle-orm';
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

    // Serialize concurrent refunds of THIS payment: at READ COMMITTED two
    // in-flight refunds could both read alreadyRefunded=0 and both pass the cap,
    // committing refund rows that together exceed the payment. A per-payment
    // advisory xact lock (released at commit) makes the refunded-total read +
    // write atomic. classid 1002 namespaces refund locks.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1002, hashtext(${paymentId}))`);

    // Re-read under the lock: a void (which also reverses the invoice) committed
    // between the outer check and here must abort the refund — otherwise we double
    // removePayment and commit a false refund record.
    const livePayment = await new DentalPaymentRepository(tx).findOneById(paymentId);
    if (!livePayment || livePayment.isVoid) {
      throw new BusinessLogicError('Cannot refund a voided payment', 'PAYMENT_VOIDED');
    }
    const liveInvoice = await invoiceRepo.findOneById(payment.invoiceId);
    if (liveInvoice?.status === 'voided') {
      throw new BusinessLogicError('Cannot refund against a voided invoice', 'INVOICE_VOIDED');
    }

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

    // §g F-01: refunding a DEPOSIT payment must reverse the mirrored deposit credit
    // (recordDentalPayment mirrored the deposit cash into the wallet), or the
    // patient keeps both the cash AND the spendable credit — money from nothing.
    //
    // P1: take the per-patient credit lock (1001) for ANY refund that touches the
    // wallet — deposit reversals AND bookAsCredit refunds. Without it, a non-deposit
    // bookAsCredit refund reads availableCreditBefore (below) outside the lock, so
    // two concurrent credit mutations can read the same stale base and the
    // arithmetically-computed creditBalanceCents in the response loses one of them
    // (the ledger rows stay correct; only the reported number is wrong).
    if (liveInvoice?.kind === 'deposit' || bookAsCredit) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1001, hashtext(${payment.patientId}))`);
    }
    // F-02: the wallet is patient-GLOBAL — read it on db (superuser) so branch-
    // scoped RLS does not truncate it. Safe under the 1001 lock above (every credit
    // mutator takes it, so no competing write commits while we hold it).
    const availableCreditBefore = await new DentalPatientCreditRepository(db).getBalance(payment.patientId);
    // F-01 conservation: a deposit's cash is refundable only while its mirrored
    // credit is still in the wallet. If already applied to a performed invoice, the
    // spent portion is no longer cash-refundable.
    if (liveInvoice?.kind === 'deposit' && availableCreditBefore < body.amountCents) {
      throw new BusinessLogicError(
        `Deposit already applied — only ${Math.max(0, availableCreditBefore)} cents of it remain refundable as cash; refund the rest from the performed-work invoice`,
        'DEPOSIT_ALREADY_APPLIED',
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

    // §g F-01: reverse the mirrored deposit credit (consuming row).
    if (liveInvoice?.kind === 'deposit') {
      await creditRepo.create({
        patientId: payment.patientId,
        branchId: payment.branchId,
        amountCents: -body.amountCents, // negative: remove the deposit credit
        source: 'deposit_reversed',
        invoiceId: payment.invoiceId,
        createdByMemberId: membership?.id ?? null, // attribute the reversal to the refunding staff
        createdBy: session.userId,
        updatedBy: session.userId,
      });
    }

    if (bookAsCredit) {
      await creditRepo.create({
        patientId: payment.patientId,
        branchId: payment.branchId,
        amountCents: body.amountCents, // positive: credit to the patient
        source: 'refund',
        invoiceId: null, // non-consuming (positive) row — invoiceId is only for consuming rows
        createdByMemberId: membership?.id ?? null, // attribute the refund-to-credit to the acting staff
        createdBy: session.userId,
        updatedBy: session.userId,
      });
    }
    // F-02: compute the global wallet arithmetically — an in-tx db read can't see
    // the rows just written on `tx`, and a tx read would be branch-truncated.
    const creditBalanceCents = availableCreditBefore
      + (bookAsCredit ? body.amountCents : 0)
      + (liveInvoice?.kind === 'deposit' ? -body.amountCents : 0);

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
