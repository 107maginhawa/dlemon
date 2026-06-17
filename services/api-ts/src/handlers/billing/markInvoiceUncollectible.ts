/**
 * Mark Invoice Uncollectible Handler
 *
 * Marks an invoice as uncollectible.
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import {
  ForbiddenError,
  NotFoundError,
  BusinessLogicError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { MarkInvoiceUncollectibleParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import type { NotificationService } from '@/core/notifs';
import { InvoiceRepository, MerchantAccountRepository } from './repos/billing.repo';
import { findBillingParty } from '../person/repos/person-billing.facade';
import type { InvoiceMetadata, MerchantMetadata } from './billing.types';
import { logAuditEvent } from '@/core/audit-logger';

/**
 * markInvoiceUncollectible
 *
 * Path: POST /invoices/{invoice}/mark-uncollectible
 * OperationId: markInvoiceUncollectible
 *
 * Mark invoice as uncollectible
 */
export async function markInvoiceUncollectible(
  ctx: ValidatedContext<never, never, MarkInvoiceUncollectibleParams>
): Promise<Response> {
  const database = ctx.get('database');
  const logger = ctx.get('logger');
  const billing = ctx.get('billing');
  const notifs = ctx.get('notifs') as NotificationService | undefined;

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated parameters
  const params = ctx.req.valid('param');
  const invoiceId = params.invoice;

  logger.info({ invoiceId, userId: user.id }, 'Marking invoice as uncollectible');

  // Create repository instances
  const invoiceRepo = new InvoiceRepository(database, logger);

  // Get existing invoice
  const invoice = await invoiceRepo.findOneById(invoiceId);

  if (!invoice) {
    throw new NotFoundError('Invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId,
      suggestions: ['Check invoice ID format', 'Verify invoice exists in system']
    });
  }

  // Authorization check: must be the provider who created the invoice
  const merchantPerson = await findBillingParty(database, invoice.merchant, logger);
  if (!merchantPerson) {
    throw new NotFoundError('Merchant person not found', {
      resourceType: 'person',
      resource: invoice.merchant,
      suggestions: ['Check merchant person ID format', 'Verify merchant person exists in system']
    });
  }

  if (merchantPerson.id !== user.id) {
    throw new ForbiddenError('You can only mark invoices as uncollectible for your own provider profile');
  }

  // Business rule: only open invoices can be marked as uncollectible
  if (invoice.status !== 'open') {
    throw new BusinessLogicError(
      `Cannot mark invoice as uncollectible: invoice is in ${invoice.status} state, only open invoices can be marked as uncollectible`,
      'INVALID_INVOICE_STATUS'
    );
  }

  // Additional business rule: invoice should not already be paid
  if (invoice.paymentStatus === 'succeeded') {
    throw new BusinessLogicError(
      'Cannot mark paid invoice as uncollectible',
      'INVOICE_ALREADY_PAID'
    );
  }

  // Update invoice status to uncollectible
  await invoiceRepo.updateStatus(invoiceId, 'uncollectible', user.id);
  const invoiceWithItems = await invoiceRepo.findOneWithLineItems(invoiceId);
  if (!invoiceWithItems) throw new NotFoundError('Invoice not found after update');
  const updatedInvoice = invoiceWithItems;

  // 1) Cancel an orphaned Stripe authorization, if one exists (best-effort —
  //    mirrors voidInvoice). An uncollectible invoice should not leave an
  //    authorization hold on the customer's card.
  const invoiceMeta = invoice.metadata as InvoiceMetadata | undefined;
  const stripePaymentIntentId = invoiceMeta?.stripePaymentIntentId;
  if (stripePaymentIntentId) {
    try {
      const merchantAccountRepo = new MerchantAccountRepository(database, logger);
      const merchantAccount = await merchantAccountRepo.findByPerson(invoice.merchant);
      const merchantMeta = merchantAccount?.metadata as MerchantMetadata | undefined;
      if (merchantMeta?.stripeAccountId) {
        await billing.cancelPaymentIntent(stripePaymentIntentId, merchantMeta.stripeAccountId, 'Marked uncollectible');
      }
    } catch (err) {
      // Non-fatal: the invoice is already uncollectible. Log and continue —
      // the audit row below records the write-off regardless.
      logger.warn({ err, invoiceId, stripePaymentIntentId }, 'Failed to cancel payment intent on uncollectible');
    }
  }

  // 2) Audit the write-off (fail-closed: a financial state change must not
  //    commit without an audit row). Accounting-system reconciliation is
  //    deferred — no accounting subsystem exists in this codebase yet.
  await logAuditEvent(database, logger, {
    personId: user.id,
    tenantId: updatedInvoice.merchant,
    eventType: 'data-modification',
    actorRole: 'provider',
    action: 'invoice.mark_uncollectible',
    resourceType: 'invoice',
    resourceId: invoiceId,
    before: { status: 'open' },
    after: { status: 'uncollectible' },
  }, { failClosed: true });

  // 3) Notify the customer (best-effort, non-blocking).
  notifs?.createNotification({
    recipient: updatedInvoice.customer,
    type: 'billing',
    channel: 'in-app',
    title: 'Invoice written off',
    message: `Invoice ${updatedInvoice.invoiceNumber} has been marked uncollectible`,
    relatedEntityType: 'invoice',
    relatedEntity: updatedInvoice.id,
  }).catch(() => {/* non-blocking */});

  logger.info({
    invoiceId,
    invoiceNumber: updatedInvoice.invoiceNumber,
    merchantId: updatedInvoice.merchant,
    customerId: updatedInvoice.customer,
    total: updatedInvoice.total,
    markedUncollectibleBy: user.id
  }, 'Invoice marked as uncollectible successfully');

  // Format response to match TypeSpec Invoice model
  const response = {
    id: updatedInvoice.id,
    invoiceNumber: updatedInvoice.invoiceNumber,
    customer: updatedInvoice.customer,
    merchant: updatedInvoice.merchant,
    context: updatedInvoice.context || null,
    status: updatedInvoice.status,
    subtotal: updatedInvoice.subtotal,
    tax: updatedInvoice.tax || null,
    total: updatedInvoice.total,
    currency: updatedInvoice.currency,
    paymentCaptureMethod: updatedInvoice.paymentCaptureMethod,
    paymentDueAt: updatedInvoice.paymentDueAt?.toISOString() || null,
    lineItems: updatedInvoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata
    })),
    paymentStatus: updatedInvoice.paymentStatus || null,
    paidAt: updatedInvoice.paidAt?.toISOString() || null,
    paidBy: updatedInvoice.paidBy || null,
    voidedAt: updatedInvoice.voidedAt?.toISOString() || null,
    voidedBy: updatedInvoice.voidedBy || null,
    voidThresholdMinutes: updatedInvoice.voidThresholdMinutes || null,
    authorizedAt: updatedInvoice.authorizedAt?.toISOString() || null,
    authorizedBy: updatedInvoice.authorizedBy || null,
    metadata: updatedInvoice.metadata || null,
    createdAt: updatedInvoice.createdAt.toISOString(),
    updatedAt: updatedInvoice.updatedAt.toISOString()
  };

  return ctx.json(response, 200);
}