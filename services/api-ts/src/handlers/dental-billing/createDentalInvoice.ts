/**
 * createDentalInvoice handler
 *
 * POST /dental/billing/invoices
 * Creates an invoice from a visit. Fetches performed/verified treatments
 * and creates line items from CDT codes and prices.
 */

import { eq, and } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { TreatmentRepository } from '@/handlers/dental-visit/repos/treatment.repo';
import { consentForms } from '@/handlers/dental-clinical/repos/consent-form.schema';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import type { CreateDentalInvoiceBody } from '@/generated/openapi/validators';

export async function createDentalInvoice(
  ctx: ValidatedContext<CreateDentalInvoiceBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization
  await assertBranchRole(db, session.userId, body.branchId, ['dentist_owner', 'dentist_associate', 'staff_full']);

  // BR-011: signed consent form required before invoicing
  const [signedConsent] = await db
    .select({ id: consentForms.id })
    .from(consentForms)
    .where(and(eq(consentForms.visitId, body.visitId), eq(consentForms.signed, true)))
    .limit(1);
  if (!signedConsent) {
    throw new BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED');
  }

  const invoiceRepo = new DentalInvoiceRepository(db);
  const treatmentRepo = new TreatmentRepository(db);

  // Fetch performed/verified treatments for the visit
  const treatments = await treatmentRepo.findByVisit(body.visitId);
  const billable = treatments.filter(t => t.status === 'performed' || t.status === 'verified');

  if (billable.length === 0) {
    throw new ValidationError('No billable treatments found for this visit');
  }

  // S1-T7: Double-billing prevention — reject if any treatment already billed
  const alreadyBilled = billable.filter(t => t.billedInvoiceId);
  if (alreadyBilled.length > 0) {
    throw new BusinessLogicError(
      `${alreadyBilled.length} treatment(s) already billed on a previous invoice`,
      'TREATMENT_ALREADY_BILLED',
    );
  }

  // Calculate subtotal from treatments
  const subtotalCents = billable.reduce((sum, t) => sum + t.priceCents, 0);

  if (subtotalCents <= 0) {
    throw new BusinessLogicError('Invoice total must be positive', 'INVALID_AMOUNT');
  }

  const taxRate = body.taxRate ?? 0;
  const taxCents = Math.round(subtotalCents * taxRate);
  const totalCents = subtotalCents + taxCents;

  // Generate invoice number
  const invoiceNumber = await invoiceRepo.generateInvoiceNumber();

  // Create the invoice
  const invoice = await invoiceRepo.createOne({
    visitId: body.visitId,
    patientId: body.patientId,
    branchId: body.branchId,
    dentistMemberId: body.dentistMemberId,
    invoiceNumber,
    subtotalCents,
    taxCents,
    taxRate: taxRate.toString(),
    totalCents,
    balanceCents: totalCents,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
  });

  // Create line items from treatments
  const lineItems = billable.map(t => ({
    invoiceId: invoice.id,
    treatmentId: t.id,
    cdtCode: t.cdtCode,
    description: t.description,
    toothNumber: t.toothNumber,
    unitPriceCents: t.priceCents,
    quantity: 1,
    amountCents: t.priceCents,
    isDone: t.status === 'verified',
  }));

  const createdLineItems = await invoiceRepo.createLineItems(lineItems);

  // Mark treatments as billed to prevent double-billing (S1-T7)
  await treatmentRepo.setBilledInvoiceId(billable.map(t => t.id), invoice.id);

  return ctx.json({ ...invoice, lineItems: createdLineItems }, 201);
}
