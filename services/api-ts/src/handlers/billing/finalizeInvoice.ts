/**
 * Finalize Invoice Handler
 *
 * Finalizes an invoice (changes from draft to open status).
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import {
  ForbiddenError,
  NotFoundError,
  BusinessLogicError
} from '@/core/errors';
import type { ValidatedContext } from '@/types/app';
import type { FinalizeInvoiceParams } from '@/generated/openapi/validators';
import type { Session } from '@/types/auth';
import type { NotificationService } from '@/core/notifs';
import { InvoiceRepository } from './repos/billing.repo';
import { findBillingParty } from '../person/repos/person-billing.facade';

/**
 * finalizeInvoice
 *
 * Path: POST /invoices/{invoice}/finalize
 * OperationId: finalizeInvoice
 *
 * Finalize an invoice (draft to open)
 */
export async function finalizeInvoice(
  ctx: ValidatedContext<never, never, FinalizeInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const logger = ctx.get('logger');
  const notifs = ctx.get('notifs') as NotificationService | undefined;

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated parameters
  const params = ctx.req.valid('param');
  const invoiceId = params.invoice;

  logger.info({ invoiceId, userId: user.id }, 'Finalizing invoice');

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
    throw new ForbiddenError('You can only finalize invoices for your own provider profile');
  }

  // Business rule: only draft invoices can be finalized
  if (invoice.status !== 'draft') {
    throw new BusinessLogicError(
      `Cannot finalize invoice: invoice is in ${invoice.status} state, only draft invoices can be finalized`,
      'INVALID_INVOICE_STATUS'
    );
  }

  // Validate invoice has required data before finalizing
  if (!invoice.total || invoice.total <= 0) {
    throw new BusinessLogicError(
      'Cannot finalize invoice: invoice must have a positive total amount',
      'INCOMPLETE_INVOICE_DATA'
    );
  }

  // Update invoice status to open and set issued timestamp
  await invoiceRepo.updateStatus(invoiceId, 'open', user.id);
  const invoiceWithItems = await invoiceRepo.findOneWithLineItems(invoiceId);
  if (!invoiceWithItems) throw new NotFoundError('Invoice not found after update');
  const finalizedInvoice = invoiceWithItems;

  logger.info({
    invoiceId,
    invoiceNumber: finalizedInvoice.invoiceNumber,
    merchantId: finalizedInvoice.merchant,
    customerId: finalizedInvoice.customer,
    total: finalizedInvoice.total,
    status: finalizedInvoice.status
  }, 'Invoice finalized successfully');

  // Format response to match TypeSpec Invoice model
  const response = {
    id: finalizedInvoice.id,
    invoiceNumber: finalizedInvoice.invoiceNumber,
    customer: finalizedInvoice.customer,
    merchant: finalizedInvoice.merchant,
    context: finalizedInvoice.context || null,
    status: finalizedInvoice.status,
    subtotal: finalizedInvoice.subtotal,
    tax: finalizedInvoice.tax || null,
    total: finalizedInvoice.total,
    currency: finalizedInvoice.currency,
    paymentCaptureMethod: finalizedInvoice.paymentCaptureMethod,
    paymentDueAt: finalizedInvoice.paymentDueAt?.toISOString() || null,
    lineItems: finalizedInvoice.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata
    })),
    paymentStatus: finalizedInvoice.paymentStatus || null,
    paidAt: finalizedInvoice.paidAt?.toISOString() || null,
    paidBy: finalizedInvoice.paidBy || null,
    voidedAt: finalizedInvoice.voidedAt?.toISOString() || null,
    voidedBy: finalizedInvoice.voidedBy || null,
    voidThresholdMinutes: finalizedInvoice.voidThresholdMinutes || null,
    authorizedAt: finalizedInvoice.authorizedAt?.toISOString() || null,
    authorizedBy: finalizedInvoice.authorizedBy || null,
    metadata: finalizedInvoice.metadata || null,
    createdAt: finalizedInvoice.createdAt.toISOString(),
    updatedAt: finalizedInvoice.updatedAt.toISOString()
  };

  // AC-NOTIF-02: fire billing notification to customer on invoice issue (best-effort)
  notifs?.createNotification({
    recipient: finalizedInvoice.customer,
    type: 'billing',
    channel: 'in-app',
    title: 'Invoice issued',
    message: `Invoice ${finalizedInvoice.invoiceNumber} for ${finalizedInvoice.total} ${finalizedInvoice.currency} has been issued`,
    relatedEntityType: 'invoice',
    relatedEntity: finalizedInvoice.id,
  }).catch(() => {/* non-blocking */});

  return ctx.json(response, 200);
}