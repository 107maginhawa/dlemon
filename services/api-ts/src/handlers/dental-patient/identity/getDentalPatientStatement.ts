/**
 * getDentalPatientStatement — GET /dental/patients/:id/statement
 *
 * FR2.21: Itemized statement — aggregate all visits, treatments, invoices,
 *          and payments for a patient.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { PatientRepository } from '../../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';
import { dentalVisits } from '../../dental-visit/repos/visit.schema';
import { dentalInvoices, dentalInvoiceLineItems } from '../../dental-billing/repos/dental-invoice.schema';
import { dentalPayments } from '../../dental-billing/repos/dental-payment.schema';
import { eq, desc } from 'drizzle-orm';
import type { GetDentalPatientStatementParams } from '@/generated/openapi/validators';

export async function getDentalPatientStatement(
  ctx: ValidatedContext<never, never, GetDentalPatientStatementParams>
) {
  const user = ctx.get('user');
  if (!user) throw new UnauthorizedError('Authentication required');

  const params = ctx.req.valid('param');
  const patientId = params.id;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  const repo = new PatientRepository(db, logger);
  const patient = await repo.findOneByIdWithPerson(patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  if (patient.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId as string);
  }

  // All visits
  const visits = await db
    .select()
    .from(dentalVisits)
    .where(eq(dentalVisits.patientId, patientId))
    .orderBy(desc(dentalVisits.createdAt));

  // All invoices
  const invoices = await db
    .select()
    .from(dentalInvoices)
    .where(eq(dentalInvoices.patientId, patientId))
    .orderBy(desc(dentalInvoices.createdAt));

  // Line items for each invoice
  const invoicesWithLines = await Promise.all(
    invoices.map(async (inv) => {
      const lines = await db
        .select()
        .from(dentalInvoiceLineItems)
        .where(eq(dentalInvoiceLineItems.invoiceId, inv.id));
      return { ...inv, lineItems: lines };
    })
  );

  // All payments
  const payments = await db
    .select()
    .from(dentalPayments)
    .where(eq(dentalPayments.patientId, patientId))
    .orderBy(desc(dentalPayments.createdAt));

  const totalBilledCents = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + (inv.totalCents ?? 0), 0);

  const totalPaidCents = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + (inv.paidCents ?? 0), 0);

  const outstandingBalanceCents = totalBilledCents - totalPaidCents;

  const person = patient.person;

  logger?.info({ action: 'getDentalPatientStatement', patientId }, 'Patient statement generated');

  return ctx.json({
    patientId,
    patientName: [person?.firstName, person?.lastName].filter(Boolean).join(' '),
    generatedAt: new Date().toISOString(),
    summary: {
      totalVisits: visits.length,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
      totalBilledCents,
      totalPaidCents,
      outstandingBalanceCents,
    },
    visits: visits.map(v => ({
      id: v.id,
      status: v.status,
      chiefComplaint: v.chiefComplaint,
      completedAt: v.completedAt,
      createdAt: v.createdAt,
    })),
    invoices: invoicesWithLines.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      totalCents: inv.totalCents,
      paidCents: inv.paidCents,
      balanceCents: inv.balanceCents,
      issuedAt: inv.issuedAt,
      lineItems: inv.lineItems,
    })),
    payments: payments.map(p => ({
      id: p.id,
      amountCents: p.amountCents,
      method: p.method,
      isVoid: p.isVoid,
      receiptNumber: p.receiptNumber,
      recordedAt: p.createdAt,
    })),
  }, 200);
}
