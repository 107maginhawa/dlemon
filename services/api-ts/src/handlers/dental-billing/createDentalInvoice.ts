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
import { getTreatmentsForInvoiceLocked, markTreatmentsAsBilled } from '@/handlers/dental-visit/repos/visit-billing.facade';
import { hasSignedConsentForVisit } from '@/handlers/dental-clinical/repos/consent-billing.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId, getBranchTaxConfig } from '@/handlers/dental-org/repos/org-billing.facade';
import { computeInvoiceTax } from './utils/tax';
import { withTenantTx } from '@/core/tenant-tx';
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

  // BR-054: tax is derived from the branch tax mode, never the caller. Read it
  // here (on db) so the in-tx computation below stays a pure function of the
  // resolved subtotal.
  const taxConfig = await getBranchTaxConfig(db, body.branchId);

  // RLS P1b activation: route the idempotency reads, the consent/treatment
  // guards, and all writes (invoice + line items + mark-billed) through a SINGLE
  // withTenantTx so the app_rls policies on dental_invoice (Tier-1) and
  // dental_treatment / consent_form (Tier-2a, visit-anchored) enforce the branch
  // scope as a second wall — and the create stays atomic. Authz above and the
  // audit + domain-event below stay on db (the audit must record even a rolled-
  // back attempt's intent; the event is best-effort post-commit).
  const result = await withTenantTx(db, { branchIds: [body.branchId] }, async (tx) => {
    const invoiceRepo = new DentalInvoiceRepository(tx);

    // SL-01 / E-NEW-05: offline-replay idempotency. A retried create carrying a
    // previously-seen localId returns the EXISTING invoice (with its line items),
    // idempotently. This MUST run before the S1-T7 already-billed guard below: the
    // first successful create marks its treatments billed, so without this a replay
    // would hit TREATMENT_ALREADY_BILLED (422) instead of echoing the original.
    if (body.localId) {
      const existing = await invoiceRepo.findByLocalId(body.branchId, body.localId);
      if (existing) {
        const withItems = await invoiceRepo.findWithLineItems(existing.id);
        return { replay: true as const, invoice: existing, lineItems: withItems?.lineItems ?? [] };
      }
    }

    // BR-014: signed consent form required before invoicing (see MODULE_SPEC §5).
    // (Previously mislabeled BR-011, which governs payment-plan/void blocking.)
    const hasSigned = await hasSignedConsentForVisit(tx, body.visitId);
    if (!hasSigned) {
      throw new BusinessLogicError('Signed consent required before invoicing', 'CONSENT_REQUIRED');
    }

    // WFG-004: fetch the visit's treatments WITH a row-level FOR UPDATE lock (inside
    // this tx). Two concurrent createDentalInvoice for the same visit now serialize
    // here — the loser blocks until the winner commits its markTreatmentsAsBilled,
    // then reads the billed rows and is rejected by the already-billed guard below
    // (instead of both reading billedInvoiceId=null and each minting an invoice).
    const treatments = await getTreatmentsForInvoiceLocked(tx, body.visitId);
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

    // BR-054 / EM-BILL-001: taxRate must not be caller-controlled (privilege
    // escalation). Derived from the branch tax mode. PH prices are VAT-inclusive,
    // so VAT is carved OUT of the gross subtotal — total stays = subtotal.
    const tax = computeInvoiceTax({ subtotalCents, taxMode: taxConfig.taxMode, vatRate: taxConfig.vatRate });
    const taxRate = tax.taxRate;
    const taxCents = tax.taxCents;
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
      // BR-048: per-invoice payment-terms override (resolved to a dueDate at issue).
      paymentTermsDays: body.paymentTermsDays ?? undefined,
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
    await markTreatmentsAsBilled(tx, billable.map(t => t.id), invoice.id);

    return { replay: false as const, invoice, lineItems: createdLineItems };
  });

  // Idempotent replay: echo the existing invoice without re-auditing.
  if (result.replay) {
    return ctx.json({ ...result.invoice, lineItems: result.lineItems }, 201);
  }

  const invoice = result.invoice;
  const createdLineItems = result.lineItems;

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
  if (scheduler) {
    void emitInvoiceCreated(scheduler, {
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      branchId: invoice.branchId,
      totalCents: invoice.totalCents,
    }).catch(() => {/* non-blocking */});
  }

  return ctx.json({ ...invoice, lineItems: createdLineItems }, 201);
}
