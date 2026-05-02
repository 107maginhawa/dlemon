/**
 * listDentalInvoices handler
 *
 * GET /dental/billing/invoices
 * Lists invoices with optional filters by patientId, branchId, status.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';

export async function listDentalInvoices(
  ctx: ValidatedContext<never, any, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);

  const invoices = await repo.findMany({
    patientId: query.patientId,
    branchId: query.branchId,
    status: query.status,
  });

  return ctx.json(invoices);
}
