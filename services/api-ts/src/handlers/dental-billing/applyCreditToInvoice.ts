/**
 * applyCreditToInvoice — POST /dental/billing/invoices/:invoiceId/apply-credit
 *
 * Phase 4.1 (BR-052): draw a patient's available credit down against one of
 * their invoices. ATOMIC (withTenantTx): the available-credit read, the
 * invoice paid/balance update (DentalInvoiceRepository.addPayment — the same
 * tested primitive a cash payment uses), and the consuming (negative) ledger
 * row all commit together, so credit can never be over-drawn or double-applied.
 *
 * BR-052: appliedCents must be > 0, <= invoice.balanceCents, AND <= the
 * patient's available credit (read inside the transaction).
 */

import { sql } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError, ValidationError } from '@/core/errors';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPatientCreditRepository } from './repos/dental-patient-credit.repo';
import type { ApplyCreditToInvoiceBody, ApplyCreditToInvoiceParams } from '@/generated/openapi/validators';

export async function applyCreditToInvoice(
  ctx: ValidatedContext<ApplyCreditToInvoiceBody, never, ApplyCreditToInvoiceParams>,
): Promise<Response> {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  if (body.amountCents <= 0) throw new ValidationError('Apply amount must be positive');

  const invoice = await new DentalInvoiceRepository(db).findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');
  await assertBranchAccess(db, user.id, invoice.branchId);

  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot apply credit to a voided invoice', 'INVOICE_VOIDED');
  }

  // §g F-07: a deposit invoice is itself the source of a deposit credit; applying
  // credit TO it would let the deposit pay itself (circular). Credit is applied
  // only to standard (performed-work) invoices.
  if (invoice.kind === 'deposit') {
    throw new BusinessLogicError('Cannot apply credit to a deposit invoice', 'INVOICE_IS_DEPOSIT');
  }

  const result = await withTenantTx(db, { branchIds: [invoice.branchId] }, async (tx) => {
    const invoiceRepo = new DentalInvoiceRepository(tx);
    const creditRepo = new DentalPatientCreditRepository(tx);

    // Serialize concurrent credit draws for THIS patient FIRST: at READ COMMITTED
    // two in-flight applies could both read the same invoice balance + ledger
    // balance and both consume, over-drawing the ledger or pushing paidCents past
    // totalCents. A per-patient advisory xact lock (released at commit) — keyed on
    // the immutable patientId — makes the invoice + credit re-reads below atomic.
    // classid 1001 namespaces credit-apply locks. (Lock BEFORE the re-reads so the
    // balance check can't use a stale pre-lock value.)
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1001, hashtext(${invoice.patientId}))`);

    // Re-read inside the tx + under the lock so balance + available credit are consistent.
    const live = await invoiceRepo.findOneById(invoiceId);
    if (!live) throw new NotFoundError('Invoice');
    if (live.balanceCents <= 0) {
      throw new BusinessLogicError('Invoice has no outstanding balance', 'INVOICE_SETTLED');
    }

    const available = await creditRepo.getBalance(live.patientId);
    if (available <= 0) throw new BusinessLogicError('Patient has no available credit', 'NO_CREDIT');

    // BR-052: cap at both the invoice balance and the available credit.
    if (body.amountCents > live.balanceCents) {
      throw new BusinessLogicError(
        `Apply amount (${body.amountCents}) exceeds invoice balance (${live.balanceCents})`,
        'EXCEEDS_INVOICE_BALANCE',
      );
    }
    if (body.amountCents > available) {
      throw new BusinessLogicError(
        `Apply amount (${body.amountCents}) exceeds available credit (${available})`,
        'EXCEEDS_AVAILABLE_CREDIT',
      );
    }

    const updated = await invoiceRepo.addPayment(invoiceId, body.amountCents);
    await creditRepo.create({
      patientId: live.patientId,
      branchId: live.branchId,
      amountCents: -body.amountCents, // consuming row
      source: 'applied',
      invoiceId,
      createdBy: user.id,
      updatedBy: user.id,
    });

    return {
      patientId: live.patientId,
      branchId: live.branchId,
      invoiceBalanceCents: updated?.balanceCents ?? live.balanceCents - body.amountCents,
      invoiceStatus: updated?.status ?? live.status,
      remainingCreditCents: available - body.amountCents,
    };
  });

  const org = await getBranchOrgId(db, result.branchId);
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: org?.organizationId ?? result.branchId,
    branchId: result.branchId,
    eventType: 'data-modification',
    action: 'invoice.credit_applied',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    metadata: { patientId: result.patientId, appliedCents: body.amountCents },
  }, { failClosed: true });

  return ctx.json({
    invoiceId,
    appliedCents: body.amountCents,
    invoiceBalanceCents: result.invoiceBalanceCents,
    invoiceStatus: result.invoiceStatus,
    remainingCreditCents: result.remainingCreditCents,
  }, 200);
}
