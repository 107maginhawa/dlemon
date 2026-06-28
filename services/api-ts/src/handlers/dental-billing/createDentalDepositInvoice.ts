/**
 * createDentalDepositInvoice handler
 *
 * POST /dental/billing/invoices/deposit
 *
 * §g (billing-audit-2026-06-27): collect a deposit / pay-in-full against a
 * PLANNED treatment estimate. Mints a FINALIZED `kind='deposit'` invoice with one
 * non-treatment line, born `issued` + due-on-receipt so it is payable immediately
 * via the normal recordDentalPayment → BIR OR path. It later reconciles to the
 * performed-work invoice through the patient-credit bridge (S-D).
 *
 * GUARDRAILS (do NOT change):
 *  - Does NOT fetch/mark treatments billed and does NOT touch treatment status —
 *    the FSM and createDentalInvoice's `performed|verified` billable filter are
 *    untouched. A deposit is an advance on planned work, not a bill of it.
 *  - Tax is derived from the branch tax mode (BR-054), never the caller.
 *  - Born `issued` directly (not via issueDentalInvoice) so the deposit line —
 *    which has no CDT code — never hits payment-terms resolution and the invoice
 *    is due-on-receipt (expert-review F-03: a deposit must never go overdue).
 *  - `kind='deposit'` excludes it from recognized-revenue / AR totals (DQ3).
 */

import { and, eq, ne, sql } from 'drizzle-orm';
import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError, BusinessLogicError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { getVisitForBilling, getTreatmentsForInvoice } from '@/handlers/dental-visit/repos/visit-billing.facade';
import { assertBranchRole } from '@/handlers/shared/assert-branch-role';
import { getBranchOrgId, getBranchTaxConfig } from '@/handlers/dental-org/repos/org-billing.facade';
import { computeInvoiceTax } from './utils/tax';
import { withTenantTx } from '@/core/tenant-tx';
import { logAuditEvent } from '@/core/audit-logger';
import type { CreateDentalDepositInvoiceBody } from '@/generated/openapi/validators';

export async function createDentalDepositInvoice(
  ctx: ValidatedContext<CreateDentalDepositInvoiceBody, never, never>,
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const body = ctx.req.valid('json');
  const db = ctx.get('database') as DatabaseInstance;

  // Same authority as creating a standard invoice (V-BIL-003): a deposit is a
  // payable invoice. staff_full is NOT permitted to mint one.
  await assertBranchRole(db, session.userId, body.branchId, ['dentist_owner', 'dentist_associate']);

  // BR-054: tax derived from the branch tax mode, read on db so the in-tx
  // computation stays a pure function of the deposit amount.
  const taxConfig = await getBranchTaxConfig(db, body.branchId);

  const result = await withTenantTx(db, { branchIds: [body.branchId] }, async (tx) => {
    const invoiceRepo = new DentalInvoiceRepository(tx);

    // F-06: offline-replay / double-tap idempotency. A retried create carrying a
    // previously-seen localId echoes the EXISTING deposit invoice. The
    // (branch, localId) partial-unique index backstops a concurrent race.
    if (body.localId) {
      const existing = await invoiceRepo.findByLocalId(body.branchId, body.localId);
      if (existing) {
        const withItems = await invoiceRepo.findWithLineItems(existing.id);
        return { replay: true as const, invoice: existing, lineItems: withItems?.lineItems ?? [] };
      }
    }

    // The deposit is anchored to a real visit owned by this branch + patient.
    const visit = await getVisitForBilling(tx, body.visitId);
    if (!visit || visit.branchId !== body.branchId) throw new NotFoundError('Visit');
    if (visit.patientId !== body.patientId) {
      throw new BusinessLogicError('Visit does not belong to this patient', 'VISIT_PATIENT_MISMATCH');
    }
    // F-06 (re-review #2): a deposit is for FUTURE work — not on a completed visit
    // (service already delivered → use the standard invoice).
    if (visit.completedAt) {
      throw new BusinessLogicError('Cannot take a deposit on a completed visit', 'VISIT_ALREADY_COMPLETED');
    }

    // F-03 (re-review #2): serialize deposit creation for this visit so two
    // concurrent deposits can't each pass the cumulative cap below (released at
    // commit). classid 1003 namespaces deposit-create locks.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1003, hashtext(${body.visitId}))`);

    // DQ1: cap the deposit at the active treatment-plan estimate (sum over all
    // non-dismissed / non-declined treatments — the case value the patient is
    // depositing against). No active plan → nothing to deposit against.
    const treatments = await getTreatmentsForInvoice(tx, body.visitId);
    const estimateCents = treatments
      .filter((t) => t.status !== 'dismissed' && t.status !== 'declined')
      .reduce((sum, t) => sum + t.priceCents, 0);
    if (estimateCents <= 0) {
      throw new BusinessLogicError('No planned work to take a deposit against', 'NO_PLANNED_WORK');
    }
    // F-03: the cap is CUMULATIVE — existing non-voided deposits on this visit plus
    // the new one must not exceed the estimate, or a clinic could over-collect via
    // multiple deposits and strand un-appliable credit.
    const [existing] = await tx
      .select({ sum: sql<number>`COALESCE(SUM(${dentalInvoices.totalCents}), 0)` })
      .from(dentalInvoices)
      .where(and(
        eq(dentalInvoices.visitId, body.visitId),
        eq(dentalInvoices.kind, 'deposit'),
        ne(dentalInvoices.status, 'voided'),
      ));
    const existingDepositCents = Number(existing?.sum ?? 0);
    if (existingDepositCents + body.depositCents > estimateCents) {
      throw new BusinessLogicError(
        `Deposit (${body.depositCents}) plus existing deposits (${existingDepositCents}) exceeds the planned estimate (${estimateCents})`,
        'DEPOSIT_EXCEEDS_ESTIMATE',
      );
    }

    // BR-054: PH prices are VAT-inclusive — VAT is carved OUT of the gross
    // deposit, so total == deposit. Identical math to a standard invoice.
    const tax = computeInvoiceTax({
      subtotalCents: body.depositCents,
      taxMode: taxConfig.taxMode,
      vatRate: taxConfig.vatRate,
    });

    const invoiceNumber = await invoiceRepo.generateInvoiceNumber();
    const now = new Date();

    const invoice = await invoiceRepo.createOne({
      visitId: body.visitId,
      patientId: body.patientId,
      branchId: body.branchId,
      dentistMemberId: body.dentistMemberId,
      invoiceNumber,
      kind: 'deposit',
      // Born issued, payable now. A deposit is DUE ON RECEIPT (paid at
      // collection), so it carries NO dueDate: (1) markOverdueInvoices uses
      // `lte(dueDate, asOf)`, which a NULL dueDate never matches → never overdue;
      // (2) a deposit has no meaningful "due date", and storing `now()` as one
      // displayed a raw timestamp that drifted a calendar day across timezones
      // (the OR/payment date vs a spurious Due Date). No dueDate → no drift.
      status: 'issued',
      subtotalCents: body.depositCents,
      taxCents: tax.taxCents,
      taxRate: tax.taxRate.toString(),
      totalCents: body.depositCents,
      balanceCents: body.depositCents,
      issuedAt: now,
      localId: body.localId,
    });

    const lineItems = await invoiceRepo.createLineItems([
      {
        invoiceId: invoice.id,
        treatmentId: null,
        cdtCode: null,
        description: 'Deposit — treatment plan',
        toothNumber: null,
        unitPriceCents: body.depositCents,
        quantity: 1,
        amountCents: body.depositCents,
        isDone: false,
      },
    ]);

    return { replay: false as const, invoice, lineItems };
  });

  // Idempotent replay: echo without re-auditing.
  if (result.replay) {
    return ctx.json({ ...result.invoice, lineItems: result.lineItems }, 201);
  }

  // Every money mutation is audited (fail-closed: the deposit must not commit
  // without its audit row).
  const logger = ctx.get('logger');
  const branchForAudit = await getBranchOrgId(db, body.branchId);
  await logAuditEvent(db, logger, {
    personId: session.userId,
    tenantId: branchForAudit?.organizationId ?? body.branchId,
    branchId: body.branchId,
    eventType: 'data-modification',
    action: 'invoice.deposit_created',
    resourceType: 'dental_invoice',
    resourceId: result.invoice.id,
    metadata: { visitId: body.visitId, depositCents: body.depositCents },
  }, { failClosed: true });

  return ctx.json({ ...result.invoice, lineItems: result.lineItems }, 201);
}
