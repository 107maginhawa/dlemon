/**
 * listDentalPayments handler
 *
 * GET /dental/billing/invoices/:invoiceId/payments
 * Lists non-voided payments for an invoice.
 */

import type { ValidatedContext } from '@/types/app';
import type { ListDentalPaymentsParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { parsePagination, buildPaginationMeta } from '@/utils/query';

export async function listDentalPayments(
  ctx: ValidatedContext<never, never, ListDentalPaymentsParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;

  const invoiceRepo = new DentalInvoiceRepository(db);
  const invoice = await invoiceRepo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchAccess(db, session.userId, invoice.branchId);

  // RLS P1b activation: route the dental_payment list read through withTenantTx
  // so the app_rls policy enforces the branch scope as a second wall. The by-PK
  // invoice fetch + authz above stay on db to preserve the exact 403/404.
  const payments = await withTenantTx(db, { branchIds: [invoice.branchId] }, (tx) =>
    new DentalPaymentRepository(tx).findByInvoice(invoiceId),
  );

  const { limit, offset } = parsePagination(ctx.req.query());
  const total = payments.length;
  const page = payments.slice(offset, offset + limit);
  return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
}
