/**
 * recordDentalPayment handler
 *
 * POST /dental/billing/invoices/:invoiceId/payments
 * Creates a payment record and updates the invoice paid/balance amounts.
 */

import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { RecordDentalPaymentBody, RecordDentalPaymentParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ConflictError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';

export async function recordDentalPayment(
  ctx: ValidatedContext<RecordDentalPaymentBody, never, RecordDentalPaymentParams>
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

  // V-BIL-105 / BR-012: a `draft` invoice has not been issued. Per MODULE_SPEC §8
  // (SM-INVOICE) payments are valid only on issued/partial/overdue invoices, so
  // recording a payment on a draft is an out-of-FSM transition → 422.
  if (invoice.status === 'draft') {
    throw new BusinessLogicError(
      'Cannot record payment on a draft invoice; issue it first',
      'INVALID_STATUS_TRANSITION',
    );
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
  //
  // N-BIL-01: the idempotency replay MUST be scoped to THIS invoice.
  // `receiptNumber` has a GLOBAL unique index, so a global lookup would let a
  // client replay a receipt number from invoice A against invoice B and
  // receive A's payment (a different invoice/patient/amount) as a 200 success.
  //   - Same invoice + same receipt + same amount  → idempotent replay (200).
  //   - Same invoice + same receipt + diff amount   → CONFLICT (409); the
  //     receipt is already bound to a different amount on this invoice.
  //   - Receipt already used on a DIFFERENT invoice  → CONFLICT (409); never
  //     echo back another invoice's payment.
  if (body.receiptNumber) {
    const sameInvoiceMatch = await paymentRepo.findByInvoiceAndReceiptNumber(
      invoiceId,
      body.receiptNumber,
    );
    if (sameInvoiceMatch) {
      if (sameInvoiceMatch.amountCents !== body.amountCents) {
        throw new ConflictError(
          `Receipt number ${body.receiptNumber} already recorded on this invoice with a different amount`,
        );
      }
      return ctx.json(sameInvoiceMatch, 200);
    }

    // Not on this invoice — guard against cross-invoice receipt reuse, which
    // the global unique index would otherwise reject with an opaque 500.
    const globalMatch = await paymentRepo.findByReceiptNumber(body.receiptNumber);
    if (globalMatch) {
      throw new ConflictError(
        `Receipt number ${body.receiptNumber} is already in use on another invoice`,
      );
    }
  }

  const receiptNumber: string =
    body.receiptNumber ?? `RCP-${new Date().getFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  // V-BIL-009: optional caller-supplied payment date (defaults to now()).
  const paymentDate = body.paymentDate ? new Date(body.paymentDate) : undefined;

  // RLS P1b activation: route the two payload writes (the dental_payment insert
  // + the dental_invoice balance update) through a SINGLE withTenantTx so the
  // app_rls policies enforce the branch scope as a second wall — and so the two
  // writes are atomic. Entity fetch + authz + the FSM/overpayment guards + the
  // GLOBAL cross-invoice receipt-uniqueness check + the audit writes stay on db
  // (the global receipt check must see ALL branches to detect cross-invoice
  // reuse; wrapping it would hide a foreign collision and surface the global
  // unique index as an opaque 500).
  const { payment, updatedInvoice } = await withTenantTx(db, { branchIds: [invoice.branchId] }, async (tx) => {
    const txPayment = await new DentalPaymentRepository(tx).createOne({
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
    // WFG-004-class: the overpayment + immutability guards above read from the pre-tx
    // fetch. Re-assert them ATOMICALLY at write time — addPayment only applies when
    // balance_cents >= amount AND status is not voided/paid, so a concurrent payment that
    // consumed the balance OR a concurrent void/pay that made the invoice terminal makes
    // this match 0 rows (null). Throw to abort the tx (rolling back the payment insert).
    const txInvoiceRepo = new DentalInvoiceRepository(tx);
    const txInvoice = await txInvoiceRepo.addPayment(invoiceId, body.amountCents, {
      guardBalance: true,
      guardStatus: true,
    });
    if (!txInvoice) {
      // Distinguish the cause from the committed concurrent state for the right code: a
      // void/pay that landed first → INVOICE_IMMUTABLE; otherwise an over-the-balance race.
      const cur = await txInvoiceRepo.findOneById(invoiceId);
      if (cur && (cur.status === 'voided' || cur.status === 'paid')) {
        throw new BusinessLogicError(
          `Cannot record payment on a ${cur.status} invoice`,
          'INVOICE_IMMUTABLE',
        );
      }
      throw new BusinessLogicError(
        `Payment amount (${body.amountCents}) exceeds remaining balance`,
        'PAYMENT_EXCEEDS_BALANCE',
      );
    }

    // §g S-D: a deposit invoice's cash is mirrored into the patient credit wallet
    // (source='deposit') so it can later be applied to the performed-work invoice
    // via applyCreditToInvoice (the reconciliation bridge). Mirrors per payment so
    // the wallet always equals the deposit cash collected; refundDentalPayment
    // reverses the mirror (F-01) so the cash and the credit can never both be kept.
    // The write is on `tx` (branch_id = invoice branch, in RLS scope). It only ADDS
    // credit, so it needs no per-patient lock (a concurrent apply can only under-
    // apply against a momentarily smaller balance, never over-draw).
    if (invoice.kind === 'deposit') {
      // F-07 (re-review #2): take the per-patient credit lock (1001) so a
      // concurrent applyCreditToInvoice/refund can't read a stale wallet between
      // this mirror insert and its commit (would surface a transient false
      // NO_CREDIT). Money was already safe (the mirror only adds); this removes
      // the stale-read UX window and matches the apply/refund locking.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(1001, hashtext(${invoice.patientId}))`);
      await new DentalPatientCreditRepository(tx).create({
        patientId: invoice.patientId,
        branchId: invoice.branchId,
        amountCents: body.amountCents,
        source: 'deposit',
        invoiceId,
        createdBy: session.userId,
        updatedBy: session.userId,
      });
    }

    return { payment: txPayment, updatedInvoice: txInvoice };
  });

  // AL-010: payment.record audit trail (never throws — see audit-logger)
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  const tenantId = branchForAudit?.organizationId ?? invoice.branchId;
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId,
    branchId: invoice.branchId,
    eventType: 'data-modification',
    action: 'payment.record',
    resourceType: 'dental_payment',
    resourceId: payment.id,
    metadata: { invoiceId, amountCents: body.amountCents, method: body.method },
    // P1-C: a recorded payment must never silently commit without its audit row.
  }, { failClosed: true });

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
