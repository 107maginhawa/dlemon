/**
 * Get Invoice Handler
 *
 * Retrieves a single invoice by ID.
 * Follows TypeSpec billing.tsp definition with current schema adaptation.
 */

import type { ValidatedContext } from '@/types/app';
import type { GetInvoiceQuery, GetInvoiceParams } from '@/generated/openapi/validators';
import { ForbiddenError, NotFoundError } from '@/core/errors';
import type { Session } from '@/types/auth';
import { InvoiceRepository } from './repos/billing.repo';
import { PersonRepository } from '../person/repos/person.repo';
import type { Config } from '@/core/config';

/**
 * getInvoice
 *
 * Path: GET /invoices/{invoice}
 * OperationId: getInvoice
 *
 * Get invoice by ID with authorization checks
 */
export async function getInvoice(
  ctx: ValidatedContext<never, GetInvoiceQuery, GetInvoiceParams>
): Promise<Response> {
  const database = ctx.get('database');
  const logger = ctx.get('logger');
  const config = ctx.get('config') as Config;

  // Get authenticated session (guaranteed by middleware)
  const session = ctx.get('session') as Session;
  const user = session.user;

  // Extract validated parameters
  const params = ctx.req.valid('param') as any;
  const query = ctx.req.valid('query') as any;

  const invoiceId = params.invoice;

  logger.debug({ invoiceId, userId: user.id }, 'Getting invoice');

  // Create repository instances
  const invoiceRepo = new InvoiceRepository(database, logger);
  const personRepo = new PersonRepository(database, logger);

  // Get invoice with line items
  const invoice = await invoiceRepo.findOneWithLineItems(invoiceId);

  if (!invoice) {
    throw new NotFoundError('Invoice not found', {
      resourceType: 'invoice',
      resource: invoiceId,
      suggestions: ['Check invoice ID format', 'Verify invoice exists in system']
    });
  }

  // Authorization check: user must be the provider who created the invoice
  // or the patient who is being billed (when we have patient auth)
  // Authorization: merchant, customer, or admin can view
  const merchantPerson = await personRepo.findOneById(invoice.merchant);
  if (!merchantPerson) {
    throw new NotFoundError('Merchant person not found', {
      resourceType: 'person',
      resource: invoice.merchant,
      suggestions: ['Check merchant person ID format', 'Verify merchant person exists in system']
    });
  }

  // Check if user is merchant, customer, or admin
  const isAdmin = user.role === 'admin';
  if (invoice.merchant !== user.id && invoice.customer !== user.id && !isAdmin) {
    throw new ForbiddenError('You can only access invoices where you are the merchant or customer');
  }

  logger.info({
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    merchantId: invoice.merchant,
    customerId: invoice.customer,
    status: invoice.status,
    total: invoice.total
  }, 'Invoice retrieved successfully');

  // Format response to match TypeSpec Invoice model
  const response = {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customer: invoice.customer,
    merchant: invoice.merchant,
    context: invoice.context || null,
    status: invoice.status,
    subtotal: invoice.subtotal,
    tax: invoice.tax || null,
    total: invoice.total,
    currency: invoice.currency,
    paymentCaptureMethod: invoice.paymentCaptureMethod,
    paymentDueAt: invoice.paymentDueAt?.toISOString() || null,
    lineItems: invoice.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      metadata: item.metadata
    })),
    paymentStatus: invoice.paymentStatus || null,
    paidAt: invoice.paidAt?.toISOString() || null,
    paidBy: invoice.paidBy || null,
    voidedAt: invoice.voidedAt?.toISOString() || null,
    voidedBy: invoice.voidedBy || null,
    voidThresholdMinutes: invoice.voidThresholdMinutes || null,
    authorizedAt: invoice.authorizedAt?.toISOString() || null,
    authorizedBy: invoice.authorizedBy || null,
    metadata: invoice.metadata || null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString()
  };

  return ctx.json(response, 200);
}