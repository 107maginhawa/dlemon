/**
 * listDentalInvoices handler
 *
 * GET /dental/billing/invoices
 * Lists invoices with optional filters by patientId, branchId, status.
 * Joins patient+person for patientName and visit for visitDate.
 */

import type { ValidatedContext } from '@/types/app';
import type { ListDentalInvoicesQuery } from '@/generated/openapi/validators';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { withTenantTx } from '@/core/tenant-tx';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import { eq, and, type SQL } from 'drizzle-orm';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { getPatientWithPersonForInvoice } from '@/handlers/patient/repos/patient-billing.facade';
import { getVisitForBilling } from '@/handlers/dental-visit/repos/visit-billing.facade';

export async function listDentalInvoices(
  ctx: ValidatedContext<never, ListDentalInvoicesQuery, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;

  // EM-BIL-001: branchId is required to prevent cross-branch invoice enumeration.
  // Matches the pattern in listDentalVisits, listDentalPatients, listPatientImages.
  if (!query.branchId) {
    return ctx.json({ error: 'branchId is required' }, 400);
  }

  // Branch-level authorization — verify the caller is an active member of the branch
  await assertBranchAccess(db, session.userId, query.branchId);

  const conditions: SQL[] = [];
  if (query.patientId) conditions.push(eq(dentalInvoices.patientId, query.patientId));
  if (query.branchId) conditions.push(eq(dentalInvoices.branchId, query.branchId));
  if (query.status) conditions.push(eq(dentalInvoices.status, query.status));

  // RLS P1b activation: route the list read + per-row enrichment through
  // withTenantTx so the app_rls policy on dental_invoice enforces the branch
  // scope as a second wall behind the app-level filter. Scope = the asserted
  // (required) branch. Authz above stays on db to preserve the exact 403.
  const invoices = await withTenantTx(db, { branchIds: [query.branchId] }, async (tx) => {
    const rows = await tx
      .select({
        id: dentalInvoices.id,
        invoiceNumber: dentalInvoices.invoiceNumber,
        patientId: dentalInvoices.patientId,
        visitId: dentalInvoices.visitId,
        branchId: dentalInvoices.branchId,
        dentistMemberId: dentalInvoices.dentistMemberId,
        status: dentalInvoices.status,
        subtotalCents: dentalInvoices.subtotalCents,
        discountCents: dentalInvoices.discountCents,
        taxCents: dentalInvoices.taxCents,
        taxRate: dentalInvoices.taxRate,
        totalCents: dentalInvoices.totalCents,
        paidCents: dentalInvoices.paidCents,
        balanceCents: dentalInvoices.balanceCents,
        dueDate: dentalInvoices.dueDate,
        issuedAt: dentalInvoices.issuedAt,
        paidAt: dentalInvoices.paidAt,
        voidedAt: dentalInvoices.voidedAt,
        createdAt: dentalInvoices.createdAt,
        updatedAt: dentalInvoices.updatedAt,
      })
      .from(dentalInvoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return Promise.all(rows.map(async (inv) => {
      const patientRow = await getPatientWithPersonForInvoice(tx, inv.patientId);
      const patientName = patientRow?.firstName
        ? [patientRow.firstName, patientRow.lastName].filter(Boolean).join(' ')
        : undefined;
      let visitDate: string | undefined;
      if (inv.visitId) {
        const visit = await getVisitForBilling(tx, inv.visitId);
        const d = visit?.completedAt;
        visitDate = d ? d.toISOString().split('T')[0] : undefined;
      }
      return { ...inv, patientName, visitDate };
    }));
  });

  const { limit, offset } = parsePagination(query);
  const total = invoices.length;
  const page = invoices.slice(offset, offset + limit);
  return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
}
