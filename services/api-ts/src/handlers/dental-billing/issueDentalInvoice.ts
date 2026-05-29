/**
 * issueDentalInvoice handler
 *
 * PATCH /dental/billing/invoices/:invoiceId/issue
 * Transitions invoice from draft to issued.
 *
 * V-BIL-008: this is a state transition on an existing resource, so the
 * canonical method is PATCH (MODULE_SPEC §10 + dental-billing.tsp). The route
 * registration follows the TypeSpec on the next `bun run generate`; the handler
 * body is method-agnostic.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';

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
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner', 'dentist_associate']);

  if (invoice.status !== 'draft') {
    throw new BusinessLogicError('Only draft invoices can be issued', 'INVALID_STATUS');
  }

  const issued = await repo.issue(invoiceId);

  ctx.get('logger')?.info(
    { requestId: ctx.get('requestId'), action: 'dental_invoice_issue', invoiceId, branchId: invoice.branchId, by: session.userId },
    'Dental invoice issued',
  );

  return ctx.json(issued);
}
