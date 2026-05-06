/**
 * getPatientBalance — GET /dental/billing/patients/:patientId/balance
 *
 * FR4.4: Per-patient outstanding balance — sum all non-voided invoice balanceCents.
 */

import type { Context } from 'hono';
import type { DatabaseInstance } from '@/core/database';
import { UnauthorizedError } from '@/core/errors';
import { DentalInvoiceRepository } from './repos/dental-invoice.repo';
import { DentalPaymentPlanRepository } from './repos/dental-payment-plan.repo';
import { PatientRepository } from '../patient/repos/patient.repo';
import { assertBranchAccess } from '@/handlers/shared/assert-branch-access';

export async function getPatientBalance(ctx: Context) {
  const user = ctx.get('user') as any;
  if (!user) throw new UnauthorizedError('Authentication required');

  const patientId = ctx.req.param('patientId')!;
  const db = ctx.get('database') as DatabaseInstance;
  const logger = ctx.get('logger');

  // Branch-level authorization via patient's preferred branch
  const patientRepo = new PatientRepository(db);
  const patient = await patientRepo.findOneById(patientId);
  if (patient?.preferredBranchId) {
    await assertBranchAccess(db, user.id, patient.preferredBranchId);
  }

  const invoiceRepo = new DentalInvoiceRepository(db);
  const planRepo = new DentalPaymentPlanRepository(db);

  const invoices = await invoiceRepo.findMany({ patientId });
  const activeInvoices = invoices.filter(inv => inv.status !== 'voided');

  const totalBilledCents = activeInvoices.reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalPaidCents = activeInvoices.reduce((sum, inv) => sum + inv.paidCents, 0);
  const outstandingBalanceCents = activeInvoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  const overdueInvoices = activeInvoices.filter(inv => inv.status === 'overdue');
  const overdueAmountCents = overdueInvoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  // Active payment plans
  const plans = await planRepo.findByPatient(patientId);
  const activePlans = plans.filter(p => p.status === 'onTrack' || p.status === 'behind');

  logger?.info({ action: 'getPatientBalance', patientId, outstandingBalanceCents }, 'Patient balance retrieved');

  return ctx.json({
    patientId,
    totalBilledCents,
    totalPaidCents,
    outstandingBalanceCents,
    overdueAmountCents,
    invoiceCount: activeInvoices.length,
    overdueInvoiceCount: overdueInvoices.length,
    activePaymentPlanCount: activePlans.length,
  }, 200);
}
