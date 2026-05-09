/**
 * issueDentalInvoice handler
 *
 * POST /dental/billing/invoices/:invoiceId/issue
 * Transitions invoice from draft to issued.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function issueDentalInvoice(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchAccess(db, session.userId, invoice.branchId);

  if (invoice.status !== 'draft') {
    throw new BusinessLogicError('Only draft invoices can be issued', 'INVALID_STATUS');
  }

  const issued = await repo.issue(invoiceId);
  return ctx.json(issued);
}
