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
import { releaseTreatmentsForInvoice } from '@/handlers/dental-visit/repos/visit-billing.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { withTenantTx } from '@/core/tenant-tx';
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

  // §g F-04: voiding a PAID deposit invoice would strand the mirrored deposit
  // credit (patient keeps spendable credit with no invoice debt). Require the
  // deposit payment to be refunded/voided first — which reverses the credit —
  // before the deposit invoice can be voided.
  if (invoice.kind === 'deposit' && invoice.paidCents > 0) {
    throw new BusinessLogicError(
      'Refund or void the deposit payment before voiding the deposit invoice',
      'DEPOSIT_HAS_PAYMENT',
    );
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

  const previousStatus = invoice.status;
  // RLS P1b activation: route the dental_invoice write through withTenantTx so
  // the app_rls policy enforces the branch scope as a second wall. Entity
  // fetch + authz + the active-payment-plan guard stay on db to preserve the
  // exact 403/404/422 behavior.
  const voided = await withTenantTx(db, { branchIds: [invoice.branchId] }, async (tx) => {
    const row = await new DentalInvoiceRepository(tx).voidInvoice(invoiceId);
    // Lost the void race: voidInvoice's status<>'voided' predicate matched 0 rows because
    // a concurrent void already committed. Reject instead of writing a second audit row.
    if (!row) throw new BusinessLogicError('Invoice is already voided', 'ALREADY_VOIDED');
    // G-01: a voided invoice must release the treatments it billed, otherwise their
    // billedInvoiceId stays set and the patient can never be re-invoiced
    // (createDentalInvoice → TREATMENT_ALREADY_BILLED 422) and the visit can't be
    // discarded (discardVisit hasBilledWork). Same withTenantTx scope as the void.
    await releaseTreatmentsForInvoice(tx, invoiceId);
    return row;
  });

  const logger = ctx.get('logger');
  logger?.info(
    { requestId: ctx.get('requestId'), action: 'dental_invoice_void', invoiceId, branchId: invoice.branchId, by: session.userId },
    'Dental invoice voided',
  );
  // P1-C: fail-closed — voiding an invoice (a money/compliance mutation) must never
  // silently commit without its audit row. SL-05 / E-NEW-02: this path was missed by
  // the original P1-C sweep (payment-void/discount/payment got `failClosed`; the
  // INVOICE-void path did not). P2-A (AUD-BR-004): capture before/after + reason.
  const branchForAudit = await getBranchOrgId(db, invoice.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? invoice.branchId,
    branchId: invoice.branchId,
    eventType: 'data-modification',
    action: 'invoice.voided',
    resourceType: 'dental_invoice',
    resourceId: invoiceId,
    reason,
    before: { status: previousStatus },
    after: { status: 'voided' },
    metadata: { reason },
  }, { failClosed: true });

  return ctx.json(voided);
}
