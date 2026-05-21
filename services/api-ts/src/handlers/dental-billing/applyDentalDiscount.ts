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

  const discountCents = applyDiscountRate(invoice.subtotalCents, body.percentageRate);
  const taxRate = Number(invoice.taxRate);

  const updated = await repo.applyDiscount(invoiceId, discountCents, taxRate);
  return ctx.json(updated);
}
