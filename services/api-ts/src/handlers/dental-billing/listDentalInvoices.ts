/**
 * listDentalInvoices handler
 *
 * GET /dental/billing/invoices
 * Lists invoices with optional filters by patientId, branchId, status.
 * Joins patient+person for patientName and visit for visitDate.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, ValidationError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { parsePagination, buildPaginationMeta } from '@/utils/query';
import { eq, and, sql } from 'drizzle-orm';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

export async function listDentalInvoices(
  ctx: ValidatedContext<never, any, never>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const query = ctx.req.valid('query');
  const db = ctx.get('database') as DatabaseInstance;

  // Branch-level authorization — optional filter; if provided, verify access
  if (query.branchId) {
    await assertBranchAccess(db, session.userId, query.branchId);
  }

  const conditions = [];
  if (query.patientId) conditions.push(eq(dentalInvoices.patientId, query.patientId));
  if (query.branchId) conditions.push(eq(dentalInvoices.branchId, query.branchId));
  if (query.status) conditions.push(eq(dentalInvoices.status, query.status));

  const rows = await db
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
      // Patient name from person table
      firstName: persons.firstName,
      lastName: persons.lastName,
      // Visit date
      visitActivatedAt: dentalVisits.activatedAt,
      visitCompletedAt: dentalVisits.completedAt,
    })
    .from(dentalInvoices)
    .leftJoin(patients, eq(patients.id, dentalInvoices.patientId))
    .leftJoin(persons, eq(persons.id, patients.person))
    .leftJoin(dentalVisits, eq(dentalVisits.id, dentalInvoices.visitId))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const invoices = rows.map((row) => {
    const { firstName, lastName, visitActivatedAt, visitCompletedAt, ...inv } = row;
    const patientName = firstName
      ? [firstName, lastName].filter(Boolean).join(' ')
      : undefined;
    const visitDate = visitActivatedAt ?? visitCompletedAt ?? undefined;
    return {
      ...inv,
      patientName,
      visitDate: visitDate ? visitDate.toISOString().split('T')[0] : undefined,
    };
  });

  const { limit, offset } = parsePagination(query);
  const total = invoices.length;
  const page = invoices.slice(offset, offset + limit);
  return ctx.json({ data: page, pagination: buildPaginationMeta(page, total, limit, offset) });
}
