/**
 * createDentalInvoice handler
 *
 * POST /dental/billing/invoices
 * Creates an invoice from a visit. Fetches performed/verified treatments
 * and creates line items from CDT codes and prices.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { getTreatmentsForInvoice, markTreatmentsAsBilled } from '@/handlers/dental-visit/repos/visit-billing.facade';
import { hasSignedConsentForVisit } from '@/handlers/dental-clinical/repos/consent-billing.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId } from '@/handlers/dental-org/repos/org-billing.facade';
import { logAuditEvent } from '@/core/audit-logger';
import type { JobScheduler } from '@/core/jobs';
import { emitInvoiceCreated } from './domain-events';
import type { CreateDentalInvoiceBody } from '@/generated/openapi/validators';

export async function createDentalInvoice(
  ctx: ValidatedContext<CreateDentalInvoiceBody, never, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization
  // V-BIL-003: per ROLE_PERMISSION_MATRIX, create invoice = dentist_owner +
  // dentist_associate (own patients). staff_full is NOT permitted.
  await assertBranchRole(db, session.userId, body.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-014: signed consent form required before invoicing (see MODULE_SPEC §5).
  // (Previously mislabeled BR-011, which governs payment-plan/void blocking.)
  const hasSigned = await hasSignedConsentForVisit(db, body.visitId);
  if (!hasSigned) {
    throw new BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED');
  }

  const invoiceRepo = new DentalInvoiceRepository(db);

  // Fetch performed/verified treatments for the visit
  const treatments = await getTreatmentsForInvoice(db, body.visitId);
  const billable = treatments.filter(t => t.status === 'performed' || t.status === 'verified');

  if (billable.length === 0) {
    throw new BusinessLogicError('No billable treatments for this visit', 'NO_BILLABLE_TREATMENTS');
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

  // EM-BILL-001: taxRate must not be caller-controlled (privilege escalation —
  // client could set 0% to avoid tax or inflate to overcharge). Hardcoded to 0
  // until branch-level tax configuration is implemented.
  const taxRate = 0;
  const taxCents = 0;
  const totalCents = subtotalCents;

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
    // GAP-001: persist optional client-generated id for offline-first idempotent sync.
    localId: body.localId,
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
  await markTreatmentsAsBilled(db, billable.map(t => t.id), invoice.id);

  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, body.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? body.branchId,
    branchId: body.branchId,
    action: 'invoice.create',
    resourceType: 'dental_invoice',
    resourceId: invoice.id,
  });

  // DE-020: emit InvoiceCreated domain event (best-effort, non-blocking)
  const scheduler = ctx.get('jobs') as JobScheduler | undefined;
  scheduler && emitInvoiceCreated(scheduler, {
    invoiceId: invoice.id,
    patientId: invoice.patientId,
    branchId: invoice.branchId,
    totalCents: invoice.totalCents,
  }).catch(() => {/* non-blocking */});

  return ctx.json({ ...invoice, lineItems: createdLineItems }, 201);
}
