/**
 * getDentalInvoice handler
 *
 * GET /dental/billing/invoices/:invoiceId
 * Returns invoice with line items and payments.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentRepository } from './repos/dental-payment.repo';
import { eq } from 'drizzle-orm';
import { patients } from '@/handlers/patient/repos/patient.schema';
import { persons } from '@/handlers/person/repos/person.schema';
import { dentalInvoices } from './repos/dental-invoice.schema';
import { dentalVisits } from '@/handlers/dental-visit/repos/visit.schema';

export async function getDentalInvoice(
  ctx: ValidatedContext<never, never, any>
): Promise<Response> {
  const session = ctx.get('session');
  if (!session) throw new UnauthorizedError();

  const { invoiceId } = ctx.req.valid('param');
  const db = ctx.get('database') as DatabaseInstance;
  const repo = new DentalInvoiceRepository(db);
  const paymentRepo = new DentalPaymentRepository(db);

  const result = await repo.findWithLineItems(invoiceId);
  if (!result) throw new NotFoundError('Invoice');

  // Fetch payments
  const payments = await paymentRepo.findByInvoice(invoiceId);

  // Resolve patient name
  const patientRows = await db
    .select({ firstName: persons.firstName, lastName: persons.lastName })
    .from(patients)
    .leftJoin(persons, eq(persons.id, patients.person))
    .where(eq(patients.id, result.invoice.patientId));

  const personRow = patientRows[0];
  const patientName = personRow?.firstName
    ? [personRow.firstName, personRow.lastName].filter(Boolean).join(' ')
    : undefined;

  // Resolve visit date
  const visitRows = await db
    .select({ activatedAt: dentalVisits.activatedAt, completedAt: dentalVisits.completedAt })
    .from(dentalVisits)
    .where(eq(dentalVisits.id, result.invoice.visitId));

  const visitRow = visitRows[0];
  const visitDate = visitRow?.activatedAt ?? visitRow?.completedAt;

  // Map line items: rename amountCents → priceCents for frontend compatibility
  const lineItems = result.lineItems.map((item) => ({
    ...item,
    priceCents: item.amountCents,
  }));

  return ctx.json({
    ...result.invoice,
    patientName,
    visitDate: visitDate ? visitDate.toISOString().split('T')[0] : undefined,
    lineItems,
    payments,
  });
}
