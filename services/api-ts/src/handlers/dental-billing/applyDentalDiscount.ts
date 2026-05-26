/**
 * applyDentalDiscount handler
 *
 * POST /dental/billing/invoices/:invoiceId/discount
 * Applies a percentage discount and recalculates totals.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { applyDiscountRate } from './utils/rounding';
import { logAuditEvent } from '@/core/audit-logger';
import { BranchRepository } from '@/handlers/dental-org/repos/branch.repo';

export async function applyDentalDiscount(
  ctx: ValidatedContext<any, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  const repo = new DentalInvoiceRepository(db);
  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner']);

  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Cannot apply discount to a voided invoice', 'VOIDED_INVOICE');
  }

  if (invoice.status === 'paid') {
    throw new BusinessLogicError('Cannot apply discount to a fully paid invoice', 'ALREADY_PAID');
  }

  if (!body.reason?.trim()) {
    throw new BusinessLogicError('Discount reason is required', 'DISCOUNT_REASON_REQUIRED');
  }

  const discountCents = applyDiscountRate(invoice.subtotalCents, body.percentageRate);
  const taxRate = Number(invoice.taxRate);

  const updated = await repo.applyDiscount(invoiceId, discountCents, taxRate, body.reason.trim(), session.userId);
  const branchForAudit = await new BranchRepository(db).findOneById(invoice.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? invoice.branchId,
    branchId: invoice.branchId,
    action: 'discount.applied',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    metadata: { percentageRate: body.percentageRate, reason: body.reason.trim() },
  });
  return ctx.json(updated);
}
