/**
 * getDentalInvoice handler
 *
 * GET /dental/billing/invoices/:invoiceId
 * Returns invoice with line items.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';

export async function getDentalInvoice(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);

  const result = await repo.findWithLineItems(invoiceId);
  if (!result) throw new NotFoundError('Invoice');

  return ctx.json({ ...result.invoice, lineItems: result.lineItems });
}
