/**
 * applyDentalDiscount handler
 *
 * POST /dental/billing/invoices/:invoiceId/discount
 * Applies a percentage discount and recalculates totals.
 */

import type { ValidatedContext } from '@/types/app';
import type { ApplyDentalDiscountBody, ApplyDentalDiscountParams } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { applyDiscountRate } from './utils/rounding';
import { logAuditEvent } from '@/core/audit-logger';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';

export async function applyDentalDiscount(
  ctx: ValidatedContext<ApplyDentalDiscountBody, never, ApplyDentalDiscountParams>
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

  // V-BIL-001: bound discount rate 0–100. An unbounded rate >100 produces a
  // negative totalCents/balanceCents (money-integrity breach); a negative rate
  // inflates the total. Defended here even if the schema validator is bypassed.
  if (
    typeof body.percentageRate !== 'number' ||
    !Number.isFinite(body.percentageRate) ||
    body.percentageRate < 0 ||
    body.percentageRate > 100
  ) {
    throw new BusinessLogicError(
      'Discount percentage rate must be between 0 and 100',
      'INVALID_DISCOUNT_RATE',
    );
  }

  const discountCents = applyDiscountRate(invoice.subtotalCents, body.percentageRate);
  const taxRate = Number(invoice.taxRate);

  const updated = await repo.applyDiscount(invoiceId, discountCents, taxRate, body.reason.trim(), session.userId);
  // P1-C fail-closed + P2-A before/after + reason (AUD-BR-004); non-PHI money fields.
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  await logAuditEvent(db, ctx.get('logger'), {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? invoice.branchId,
    branchId: invoice.branchId,
    eventType: 'data-modification',
    action: 'discount.applied',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    reason: body.reason.trim(),
    before: { discountCents: invoice.discountCents, totalCents: invoice.totalCents },
    after: { discountCents, totalCents: updated?.totalCents ?? null },
    metadata: { percentageRate: body.percentageRate, reason: body.reason.trim() },
  }, { failClosed: true });
  return ctx.json(updated);
}
