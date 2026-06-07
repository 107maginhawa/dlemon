/**
 * voidDentalInvoice handler
 *
 * POST /dental/billing/invoices/:invoiceId/void
 * Marks an invoice as voided.
 */

import type { ValidatedContext } from '@/types/app';
import type { VoidDentalInvoiceParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';

export async function voidDentalInvoice(
  ctx: ValidatedContext<never, never, VoidDentalInvoiceParams>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  // Contract requires an auditable reason (min 5, max 500). The generated json
  // validator rejects an empty/short body with 400 before we get here.
  const { reason } = ctx.req.valid('json') as { reason: string };
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);

  const invoice = await repo.findOneById(invoiceId);
  if (!invoice) throw new NotFoundError('Invoice');

  // Branch-level authorization
  await assertBranchRole(db, session.userId, invoice.branchId, ['dentist_owner']);

  if (invoice.status === 'voided') {
    throw new BusinessLogicError('Invoice is already voided', 'ALREADY_VOIDED');
  }

  // NOTE: Voiding from any status (including 'paid') is intentional — allows
  // admin corrections (e.g., duplicate invoice, billing error). BR-011 guards
  // against voiding with an active payment plan. No additional role check is
  // enforced here; all authenticated branch members can void.

  // BR-011: Cannot void invoice with an active payment plan
  const paymentPlanRepo = new DentalPaymentPlanRepository(db);
  const plan = await paymentPlanRepo.findByInvoice(invoiceId);
  if (plan && (plan.status === 'on_track' || plan.status === 'behind')) {
    throw new BusinessLogicError('Cannot void invoice with active payment plan', 'ACTIVE_PAYMENT_PLAN');
  }

  const voided = await repo.voidInvoice(invoiceId);

  const logger = ctx.get('logger');
  logger?.info(
    { requestId: ctx.get('requestId'), action: 'dental_invoice_void', invoiceId, branchId: invoice.branchId, by: session.userId },
    'Dental invoice voided',
  );
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? invoice.branchId,
    branchId: invoice.branchId,
    action: 'invoice.voided',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    metadata: { reason },
  });

  return ctx.json(voided);
}
