/**
 * markUncollectible handler
 *
 * POST /dental/billing/invoices/:invoiceId/uncollectible
 *
 * V-BIL-006 / BR-013 / AC-BIL-005: write off an invoice the practice has given
 * up collecting. Owner-only. Transitions an issued/partial/overdue invoice to
 * the terminal `uncollectible` state; rejects paid/voided/draft (and a repeat
 * write-off). Audited.
 */

import type { ValidatedContext } from '@/types/app';
import type { MarkUncollectibleParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';

// BR-013: only an outstanding invoice can be written off. paid → nothing owed;
// voided → already terminal; draft → not yet issued.
const WRITE_OFF_FROM = new Set(['issued', 'partial', 'overdue']);

export async function markUncollectible(
  ctx: ValidatedContext<never, never, MarkUncollectibleParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  // Read the path param directly — the production route validates it as a UUID
  // via zValidator('param', MarkUncollectibleParams); reading raw keeps the
  // handler usable in test apps that register the route without that middleware.
  const invoiceId = ctx.req.param('invoiceId');
  if (!invoiceId) throw new NotFoundError('Invoice');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization — write-off is an owner-only billing action.
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner']);

  if (invoice.status === 'uncollectible') {
    throw new BusinessLogicError('Invoice is already uncollectible', 'ALREADY_UNCOLLECTIBLE');
  }
  if (!WRITE_OFF_FROM.has(invoice.status)) {
    throw new BusinessLogicError(
      `Cannot mark a ${invoice.status} invoice uncollectible`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  // RLS P1b activation: route the dental_invoice write through withTenantTx so
  // the app_rls policy enforces the branch scope as a second wall. Entity
  // fetch + authz above stay on db to preserve the exact 403/404 behavior.
  const updated = await withTenantTx(db, { branchIds: [invoice.branchId] }, async (tx) => {
    const txRepo = new DentalInvoiceRepository(tx);
    const row = await txRepo.markUncollectible(invoiceId);
    // Lost the race: the status<>writable predicate matched 0 rows because a concurrent
    // payment paid the invoice in full, or a concurrent write-off already ran. Reject
    // with the code the non-concurrent guard would have returned for the committed state.
    if (!row) {
      const cur = await txRepo.findOneById(invoiceId);
      if (cur?.status === 'uncollectible') {
        throw new BusinessLogicError('Invoice is already uncollectible', 'ALREADY_UNCOLLECTIBLE');
      }
      throw new BusinessLogicError(
        `Cannot mark a ${cur?.status ?? 'missing'} invoice uncollectible`,
        'INVALID_STATUS_TRANSITION',
      );
    }
    return row;
  });

  const logger = ctx.get('logger');
  logger?.info(
    { requestId: ctx.get('requestId'), action: 'dental_invoice_uncollectible', invoiceId, branchId: invoice.branchId, by: session.userId },
    'Dental invoice marked uncollectible',
  );
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? invoice.branchId,
    branchId: invoice.branchId,
    action: 'invoice.uncollectible',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    metadata: { previousStatus: invoice.status },
  });

  return ctx.json(updated);
}
