/**
 * getDentalPatientStatement — GET /dental/patients/:id/statement
 *
 * FR2.21: Itemized statement — aggregate all visits, treatments, invoices,
 *          and payments for a patient.
 */

import type { ValidatedContext } from '@/types/app';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError, NotFoundError } from '@/core/errors';
import { getDentalPatientWithPerson } from '../../patient/repos/patient-dental-patient.facade';
import { getVisitsByPatientId, isCountedVisit } from '../../dental-visit/repos/visit-dental-patient.facade';
import {
  getInvoicesByPatientId,
  getInvoiceLineItemsByInvoiceId,
  getPaymentsByPatientId,
} from '../../dental-billing/repos/billing-dental-patient.facade';
import { assertPatientBranchAccess } from '@/handlers/shared/assert-branch-access';
import { logAuditEvent } from '@/core/audit-logger';
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

  const patient = await getDentalPatientWithPerson(db, patientId);
  if (!patient) throw new NotFoundError('Patient not found');

  // Branch-level authorization
  await assertPatientBranchAccess(db, user.id, patient.preferredBranchId);

  // All visits
  const visits = await getVisitsByPatientId(db, patientId);

  // All invoices
  const invoices = await getInvoicesByPatientId(db, patientId);

  // Line items for each invoice
  const invoicesWithLines = await Promise.all(
    invoices.map(async (inv) => {
      const lines = await getInvoiceLineItemsByInvoiceId(db, inv.id);
      return { ...inv, lineItems: lines };
    })
  );

  // All payments
  const payments = await getPaymentsByPatientId(db, patientId);

  const totalBilledCents = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + (inv.totalCents ?? 0), 0);

  const totalPaidCents = invoices
    .filter(inv => inv.status !== 'voided')
    .reduce((sum, inv) => sum + (inv.paidCents ?? 0), 0);

  const outstandingBalanceCents = totalBilledCents - totalPaidCents;

  const person = patient.person;

  logger?.info({ action: 'getDentalPatientStatement', patientId }, 'Patient statement generated');

  // EF-PAT-005: audit READ of financial statement (PHI)
  await logAuditEvent(db, logger, {
    personId: user.id,
    tenantId: patient.preferredBranchId ?? patientId,
    action: 'patient.statement.read',
    resourceType: 'dental_patient_statement',
    resourceId: patientId,
  });

  return ctx.json({
    patientId,
    patientName: [person?.firstName, person?.lastName].filter(Boolean).join(' '),
    generatedAt: new Date().toISOString(),
    summary: {
      totalVisits: visits.filter(v => isCountedVisit(v.status)).length,
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
